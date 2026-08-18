import { createHash } from "node:crypto"
import { readdir, stat } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import type { AddonRecord, AddonSource, GameDetectionResult } from "../../shared/addon-types"
import type { AddonListEntry } from "./addon-list"
import { normalizeAddonPath } from "./addon-list"
import type { PersistedAddonState } from "./addon-store"

export interface AddonScanResult {
	addons: AddonRecord[]
	diagnostics: string[]
}

export function addonIdFromPath(relativePath: string): string {
	return createHash("sha256").update(normalizeAddonPath(relativePath)).digest("hex").slice(0, 24)
}

async function scanDirectory(
	directoryPath: string,
	source: AddonSource,
	prefix: string,
	addonList: Map<string, AddonListEntry>,
	persisted: Record<string, PersistedAddonState>,
	diagnostics: string[]
): Promise<AddonRecord[]> {
	let entries

	try {
		entries = await readdir(directoryPath, { withFileTypes: true })
	} catch (error) {
		const code = error && typeof error === "object" && "code" in error ? error.code : undefined
		if (code !== "ENOENT") {
			diagnostics.push(
				`无法读取目录 ${directoryPath}：${error instanceof Error ? error.message : String(error)}`
			)
		}
		return []
	}

	const vpkEntries = entries.filter(
		(entry) => entry.isFile() && extname(entry.name).toLocaleLowerCase("en-US") === ".vpk"
	)

	const records = await Promise.all(
		vpkEntries.map(async (entry, fallbackOrder): Promise<AddonRecord | null> => {
			const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
			const normalizedPath = normalizeAddonPath(relativePath)
			const id = addonIdFromPath(relativePath)
			const stored = persisted[id]
			const addonListEntry = addonList.get(normalizedPath)
			const filePath = join(directoryPath, entry.name)

			try {
				const fileStat = await stat(filePath)
				const enabled = addonListEntry?.enabled ?? stored?.enabled ?? "unlisted"
				const issues = enabled === "unlisted" ? ["未记录在 addonlist.txt 中"] : []

				return {
					id,
					name: stored?.name ?? basename(entry.name, extname(entry.name)),
					source,
					relativePath,
					filePath,
					size: fileStat.size,
					modifiedAt: fileStat.mtime.toISOString(),
					enabled,
					groupId: stored?.groupId ?? null,
					tags: stored?.tags ?? [],
					workshopTags: stored?.workshopTags ?? [],
					priority: stored?.priority ?? 0,
					order: addonListEntry?.order ?? stored?.order ?? fallbackOrder,
					issues,
					missing: false
				}
			} catch (error) {
				diagnostics.push(
					`无法读取 VPK ${filePath}：${error instanceof Error ? error.message : String(error)}`
				)
				return null
			}
		})
	)

	return records.filter((record): record is AddonRecord => record !== null)
}

export async function scanAddons(
	detection: GameDetectionResult,
	addonListEntries: AddonListEntry[],
	persisted: Record<string, PersistedAddonState>
): Promise<AddonScanResult> {
	if (detection.status !== "found" || !detection.addonsPath || !detection.workshopPath) {
		return { addons: [], diagnostics: [] }
	}

	const diagnostics: string[] = []
	const addonList = new Map(
		addonListEntries.map((entry) => [entry.normalizedPath, entry] as const)
	)
	const [localAddons, workshopAddons] = await Promise.all([
		scanDirectory(detection.addonsPath, "local", "", addonList, persisted, diagnostics),
		scanDirectory(
			detection.workshopPath,
			"workshop",
			"workshop",
			addonList,
			persisted,
			diagnostics
		)
	])
	const discovered = [...localAddons, ...workshopAddons]
	const discoveredIds = new Set(discovered.map((addon) => addon.id))
	const missingById = new Map<string, AddonRecord>()

	for (const entry of addonListEntries) {
		const id = addonIdFromPath(entry.normalizedPath)
		if (discoveredIds.has(id)) continue
		const stored = persisted[id]
		const relativePath = entry.normalizedPath
		missingById.set(id, {
			id,
			name: stored?.name ?? basename(relativePath, extname(relativePath)),
			source: relativePath.startsWith("workshop/") ? "workshop" : "local",
			relativePath,
			filePath: join(detection.addonsPath, relativePath),
			size: 0,
			modifiedAt: "",
			enabled: entry.enabled,
			groupId: stored?.groupId ?? null,
			tags: stored?.tags ?? [],
			workshopTags: stored?.workshopTags ?? [],
			priority: stored?.priority ?? 0,
			order: entry.order,
			issues: ["addonlist.txt 中记录的文件缺失"],
			missing: true
		})
	}

	for (const addon of Object.values(persisted)) {
		if (discoveredIds.has(addon.id) || missingById.has(addon.id)) continue
		missingById.set(addon.id, {
			...addon,
			filePath: join(detection.addonsPath, addon.relativePath),
			size: 0,
			modifiedAt: "",
			issues: ["文件缺失"],
			missing: true
		})
	}

	return {
		addons: [...discovered, ...missingById.values()],
		diagnostics
	}
}
