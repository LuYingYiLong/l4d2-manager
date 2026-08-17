import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { promisify } from "node:util"
import { randomUUID } from "node:crypto"
import type {
	AddonGroup,
	AddonOperationProgress,
	AddonPreferences,
	AddonRecord,
	AddonSnapshot,
	AddonUpdate,
	CheckResult,
	GameDetectionResult,
	PushResult
} from "../../shared/addon-types"
import { formatAddonList, normalizeAddonPath, parseAddonList } from "./addon-list"
import type { AddonListEntry } from "./addon-list"
import { scanAddons } from "./addon-scanner"
import { loadAddonImage } from "./addon-image"
import { AddonStore, createDefaultStoreData, defaultPreferences } from "./addon-store"
import type { AddonStoreData, PersistedAddonState } from "./addon-store"
import { detectSteamL4D2 } from "./steam-discovery"
import { fetchWorkshopNames, isWorkshopNameCacheFresh, workshopIdFromAddon } from "./steam-workshop"
import { ensureWritable, pathExists, writeFileAtomically } from "./file-utils"

const execFileAsync = promisify(execFile)

const emptyDetection: GameDetectionResult = {
	status: "game-not-found",
	message: "尚未检测 Steam 版《求生之路 2》",
	diagnostics: []
}

function cleanTags(tags: string[]): string[] {
	return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
}

function addonFallbackName(relativePath: string): string {
	return basename(relativePath, extname(relativePath))
}

function persistedAddon(addon: AddonRecord): PersistedAddonState {
	return {
		id: addon.id,
		name: addon.name,
		source: addon.source,
		relativePath: addon.relativePath,
		enabled: addon.enabled,
		groupId: addon.groupId,
		tags: [...addon.tags],
		priority: addon.priority,
		order: addon.order
	}
}

async function readAddonList(path: string | undefined): Promise<AddonListEntry[]> {
	if (!path || !(await pathExists(path))) return []
	return parseAddonList(await readFile(path, "utf8"))
}

async function isL4D2Running(): Promise<boolean> {
	if (process.platform !== "win32") return false

	try {
		const { stdout } = await execFileAsync("tasklist.exe", [
			"/FI",
			"IMAGENAME eq left4dead2.exe",
			"/FO",
			"CSV",
			"/NH"
		])
		return stdout.toLocaleLowerCase("en-US").includes("left4dead2.exe")
	} catch {
		return false
	}
}

export class AddonManager {
	private readonly store: AddonStore
	private readonly progressListeners = new Set<(progress: AddonOperationProgress) => void>()
	private data: AddonStoreData = createDefaultStoreData()
	private detection: GameDetectionResult = emptyDetection
	private addons: AddonRecord[] = []
	private addonListEntries: AddonListEntry[] = []
	private mutationQueue: Promise<void> = Promise.resolve()

	constructor(userDataPath: string) {
		this.store = new AddonStore(userDataPath)
	}

	async initialize(): Promise<void> {
		this.data = await this.store.load()
		await this.refreshData()
	}

	onProgress(listener: (progress: AddonOperationProgress) => void): () => void {
		this.progressListeners.add(listener)
		return () => this.progressListeners.delete(listener)
	}

	getSnapshot(): AddonSnapshot {
		return {
			detection: { ...this.detection, diagnostics: [...this.detection.diagnostics] },
			addons: this.addons.map((addon) => ({
				...addon,
				tags: [...addon.tags],
				issues: [...addon.issues]
			})),
			groups: this.data.groups.map((group) => ({ ...group })),
			preferences: { ...this.data.preferences },
			dirty: this.data.dirty,
			issueCount: this.addons.filter((addon) => addon.issues.length > 0).length,
			lastCheckedAt: this.data.lastCheckedAt,
			lastPushedAt: this.data.lastPushedAt
		}
	}

	getAddonImage(id: string): Promise<string | null> {
		const addon = this.requireAddon(id)
		if (addon.missing) return Promise.resolve(null)
		return loadAddonImage(addon.filePath)
	}

	detectGame(): Promise<GameDetectionResult> {
		return this.enqueue(async () => {
			this.emitProgress({
				operation: "detect",
				phase: "started",
				message: "正在检测 Steam 和《求生之路 2》"
			})

			try {
				this.detection = await detectSteamL4D2()
				this.emitProgress({
					operation: "detect",
					phase: "completed",
					message: this.detection.message
				})
				return { ...this.detection, diagnostics: [...this.detection.diagnostics] }
			} catch (error) {
				this.emitFailure("detect", error)
				throw error
			}
		})
	}

	refresh(): Promise<AddonSnapshot> {
		return this.enqueue(() => this.runRefresh("refresh"))
	}

	setAddonEnabled(id: string, enabled: boolean): Promise<AddonSnapshot> {
		return this.setAddonsEnabled([id], enabled)
	}

	setAddonsEnabled(ids: string[], enabled: boolean): Promise<AddonSnapshot> {
		return this.enqueue(async () => {
			const addons = ids.map((id) => this.requireAddon(id))
			for (const addon of addons) {
				addon.enabled = enabled
				this.data.addons[addon.id] = persistedAddon(addon)
			}
			this.data.dirty = true
			await this.store.save(this.data)
			return this.getSnapshot()
		})
	}

	updateAddon(id: string, update: AddonUpdate): Promise<AddonSnapshot> {
		return this.updateAddons([id], update)
	}

	updateAddons(ids: string[], update: AddonUpdate): Promise<AddonSnapshot> {
		return this.enqueue(async () => {
			const addons = ids.map((id) => this.requireAddon(id))
			if (update.groupId !== undefined && update.groupId !== null) {
				this.requireGroup(update.groupId)
			}
			if (update.priority !== undefined && !Number.isFinite(update.priority)) {
				throw new Error("优先级必须是有效数字")
			}
			if (update.name !== undefined && addons.length > 1) {
				throw new Error("批量编辑不能修改名称")
			}

			for (const addon of addons) {
				if (update.name !== undefined) {
					const name = update.name.trim()
					if (!name) throw new Error("Addon 名称不能为空")
					addon.name = name
				}
				if (update.groupId !== undefined) addon.groupId = update.groupId
				if (update.tags !== undefined) addon.tags = cleanTags(update.tags)
				if (update.priority !== undefined) addon.priority = Math.trunc(update.priority)
				this.data.addons[addon.id] = persistedAddon(addon)
			}

			if (update.priority !== undefined) this.data.dirty = true
			await this.store.save(this.data)
			return this.getSnapshot()
		})
	}

	createGroup(name: string, parentId: string | null): Promise<AddonSnapshot> {
		return this.enqueue(async () => {
			const groupName = name.trim()
			if (!groupName) throw new Error("分组名称不能为空")
			if (parentId !== null) this.requireGroup(parentId)
			this.ensureUniqueGroupName(groupName, parentId)

			this.data.groups.push({
				id: randomUUID(),
				name: groupName,
				parentId,
				order: this.data.groups.filter((group) => group.parentId === parentId).length
			})
			await this.store.save(this.data)
			return this.getSnapshot()
		})
	}

	renameGroup(id: string, name: string): Promise<AddonSnapshot> {
		return this.enqueue(async () => {
			const group = this.requireGroup(id)
			const groupName = name.trim()
			if (!groupName) throw new Error("分组名称不能为空")
			this.ensureUniqueGroupName(groupName, group.parentId, id)
			group.name = groupName
			await this.store.save(this.data)
			return this.getSnapshot()
		})
	}

	deleteGroup(id: string): Promise<AddonSnapshot> {
		return this.enqueue(async () => {
			const group = this.requireGroup(id)
			for (const child of this.data.groups) {
				if (child.parentId === id) child.parentId = group.parentId
			}
			for (const addon of this.addons) {
				if (addon.groupId !== id) continue
				addon.groupId = group.parentId
				this.data.addons[addon.id] = persistedAddon(addon)
			}
			this.data.groups = this.data.groups.filter((candidate) => candidate.id !== id)
			if (this.data.preferences.selectedGroupId === id) {
				this.data.preferences.selectedGroupId = group.parentId
			}
			await this.store.save(this.data)
			return this.getSnapshot()
		})
	}

	updatePreferences(update: Partial<AddonPreferences>): Promise<AddonSnapshot> {
		return this.enqueue(async () => {
			const next = { ...this.data.preferences, ...update }
			this.data.preferences = {
				selectedGroupId:
					next.selectedGroupId &&
					this.data.groups.some((group) => group.id === next.selectedGroupId)
						? next.selectedGroupId
						: null,
				sourceFilter: ["all", "local", "workshop"].includes(next.sourceFilter)
					? next.sourceFilter
					: defaultPreferences.sourceFilter,
				enabledFilter: ["all", "enabled", "disabled", "unlisted"].includes(
					next.enabledFilter
				)
					? next.enabledFilter
					: defaultPreferences.enabledFilter,
				problemFilter: ["all", "problems", "healthy"].includes(next.problemFilter)
					? next.problemFilter
					: defaultPreferences.problemFilter,
				sortBy: ["priority", "name", "modifiedAt", "order"].includes(next.sortBy)
					? next.sortBy
					: defaultPreferences.sortBy,
				sortDirection: next.sortDirection === "ascending" ? "ascending" : "descending"
			}
			await this.store.save(this.data)
			return this.getSnapshot()
		})
	}

	check(): Promise<CheckResult> {
		return this.enqueue(async () => {
			const snapshot = await this.runRefresh("check")
			const checkedAt = new Date().toISOString()
			this.data.lastCheckedAt = checkedAt
			await this.store.save(this.data)
			return {
				snapshot: { ...snapshot, lastCheckedAt: checkedAt },
				checkedAt,
				issueCount: snapshot.issueCount
			}
		})
	}

	push(): Promise<PushResult> {
		return this.enqueue(async () => {
			this.emitProgress({
				operation: "push",
				phase: "started",
				message: "正在准备 addonlist.txt"
			})

			try {
				if (
					this.detection.status !== "found" ||
					!this.detection.addonListPath ||
					!this.detection.left4dead2Path
				) {
					throw new Error("尚未检测到 Steam 版《求生之路 2》")
				}

				const currentEntries = await readAddonList(this.detection.addonListPath)
				const existingAddons = this.addons.filter((addon) => !addon.missing)
				const knownPaths = new Set(
					existingAddons.map((addon) => normalizeAddonPath(addon.relativePath))
				)
				const managedEntries = existingAddons
					.filter((addon) => addon.enabled !== "unlisted")
					.sort(
						(left, right) =>
							right.priority - left.priority ||
							left.order - right.order ||
							left.name.localeCompare(right.name, "zh-CN")
					)
					.map((addon, order) => {
						addon.order = order
						this.data.addons[addon.id] = persistedAddon(addon)
						return {
							path: addon.relativePath,
							enabled: addon.enabled === true
						}
					})
				const unmanagedEntries = currentEntries
					.filter((entry) => !knownPaths.has(entry.normalizedPath))
					.map((entry) => ({ path: entry.path, enabled: entry.enabled }))
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
				const backupPath = join(this.store.backupDirectory, `addonlist-${timestamp}.txt`)

				await ensureWritable(
					this.detection.addonListPath,
					dirname(this.detection.addonListPath)
				)
				const writtenBackupPath = await writeFileAtomically(
					this.detection.addonListPath,
					formatAddonList([...managedEntries, ...unmanagedEntries]),
					backupPath
				)
				const gameWasRunning = await isL4D2Running()
				const pushedAt = new Date().toISOString()
				this.data.dirty = false
				this.data.lastPushedAt = pushedAt
				await this.store.save(this.data)
				await this.refreshData()

				const warning = gameWasRunning
					? "检测到 left4dead2.exe 正在运行；请返回游戏刷新 Add-ons 列表或重启游戏"
					: null
				this.emitProgress({
					operation: "push",
					phase: "completed",
					message: warning ?? "已安全写入 addonlist.txt"
				})

				return {
					snapshot: this.getSnapshot(),
					pushedAt,
					backupPath: writtenBackupPath,
					gameWasRunning,
					warning
				}
			} catch (error) {
				this.emitFailure("push", error)
				throw error
			}
		})
	}

	getGamePath(): string {
		if (this.detection.status !== "found" || !this.detection.gamePath) {
			throw new Error("尚未检测到 Steam 版《求生之路 2》")
		}
		return this.detection.gamePath
	}

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.mutationQueue.then(operation, operation)
		this.mutationQueue = result.then(
			() => undefined,
			() => undefined
		)
		return result
	}

	private async runRefresh(operation: "refresh" | "check"): Promise<AddonSnapshot> {
		this.emitProgress({
			operation,
			phase: "started",
			message: operation === "check" ? "正在检查 Addon" : "正在扫描 Addon"
		})

		try {
			await this.refreshData()
			const snapshot = this.getSnapshot()
			this.emitProgress({
				operation,
				phase: "completed",
				message:
					this.detection.status === "found"
						? `已发现 ${snapshot.addons.filter((addon) => !addon.missing).length} 个 VPK`
						: this.detection.message
			})
			return snapshot
		} catch (error) {
			this.emitFailure(operation, error)
			throw error
		}
	}

	private async refreshData(): Promise<void> {
		this.detection = await detectSteamL4D2()
		if (this.detection.status !== "found") {
			this.addons = []
			this.addonListEntries = []
			return
		}

		this.addonListEntries = await readAddonList(this.detection.addonListPath)
		const scan = await scanAddons(this.detection, this.addonListEntries, this.data.addons)
		const workshopNameWarning = await this.updateWorkshopNames(scan.addons)
		this.detection = {
			...this.detection,
			diagnostics: [
				...this.detection.diagnostics,
				...scan.diagnostics,
				...(workshopNameWarning ? [workshopNameWarning] : [])
			]
		}
		this.addons = scan.addons

		for (const addon of this.addons) this.data.addons[addon.id] = persistedAddon(addon)
		await this.store.save(this.data)
	}

	private async updateWorkshopNames(addons: AddonRecord[]): Promise<string | null> {
		const workshopAddons = addons.filter(
			(addon) => addon.source === "workshop" && !addon.missing
		)
		const workshopIds = [
			...new Set(
				workshopAddons.map(workshopIdFromAddon).filter((id): id is string => id !== null)
			)
		]
		const idsToFetch = workshopIds.filter((id) => {
			const cached = this.data.workshopNames[id]
			return !cached || !isWorkshopNameCacheFresh(cached.fetchedAt)
		})
		const previousNames = new Map(
			idsToFetch.map((id) => [id, this.data.workshopNames[id]?.name] as const)
		)
		let warning: string | null = null

		if (idsToFetch.length > 0) {
			try {
				const fetchedNames = await fetchWorkshopNames(idsToFetch)
				const fetchedAt = new Date().toISOString()
				for (const id of idsToFetch) {
					if (!fetchedNames.has(id)) continue
					this.data.workshopNames[id] = {
						name: fetchedNames.get(id) ?? null,
						fetchedAt
					}
				}
			} catch (error) {
				warning = `Steam Workshop 名称查询失败，已使用缓存或文件名：${
					error instanceof Error ? error.message : String(error)
				}`
			}
		}

		for (const addon of addons) {
			if (addon.source !== "workshop") continue
			const id = workshopIdFromAddon(addon)
			if (!id) continue

			const cachedName = this.data.workshopNames[id]?.name
			const persistedName = this.data.addons[addon.id]?.name
			const fallbackName = addonFallbackName(addon.relativePath)
			const previousName = previousNames.get(id)
			const hasCustomName =
				typeof persistedName === "string" &&
				persistedName !== fallbackName &&
				persistedName !== previousName

			if (!hasCustomName && cachedName) addon.name = cachedName
		}

		return warning
	}

	private requireAddon(id: string): AddonRecord {
		const addon = this.addons.find((candidate) => candidate.id === id)
		if (!addon) throw new Error(`找不到 Addon：${id}`)
		return addon
	}

	private requireGroup(id: string): AddonGroup {
		const group = this.data.groups.find((candidate) => candidate.id === id)
		if (!group) throw new Error(`找不到分组：${id}`)
		return group
	}

	private ensureUniqueGroupName(name: string, parentId: string | null, ignoreId?: string): void {
		const duplicate = this.data.groups.some(
			(group) =>
				group.id !== ignoreId &&
				group.parentId === parentId &&
				group.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0
		)
		if (duplicate) throw new Error(`分组“${name}”已经存在`)
	}

	private emitProgress(progress: AddonOperationProgress): void {
		for (const listener of this.progressListeners) listener(progress)
	}

	private emitFailure(operation: AddonOperationProgress["operation"], error: unknown): void {
		this.emitProgress({
			operation,
			phase: "failed",
			message: error instanceof Error ? error.message : String(error)
		})
	}
}
