import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type {
	AddonEnabledState,
	AddonGroup,
	AddonPreferences,
	AddonSource
} from "../../shared/addon-types"
import { pathExists, writeFileAtomically } from "./file-utils"

export interface PersistedAddonState {
	id: string
	name: string
	source: AddonSource
	relativePath: string
	enabled: AddonEnabledState
	groupId: string | null
	tags: string[]
	priority: number
	order: number
}

export interface AddonStoreData {
	version: 1
	groups: AddonGroup[]
	addons: Record<string, PersistedAddonState>
	preferences: AddonPreferences
	dirty: boolean
	lastCheckedAt: string | null
	lastPushedAt: string | null
}

export const defaultPreferences: AddonPreferences = {
	selectedGroupId: null,
	sourceFilter: "all",
	enabledFilter: "all",
	problemFilter: "all",
	sortBy: "priority",
	sortDirection: "descending"
}

function cleanTags(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return [
		...new Set(
			value
				.filter((tag): tag is string => typeof tag === "string")
				.map((tag) => tag.trim())
				.filter(Boolean)
		)
	]
}

function cleanGroup(value: unknown): AddonGroup | null {
	if (!value || typeof value !== "object") return null
	const group = value as Partial<AddonGroup>
	if (typeof group.id !== "string" || typeof group.name !== "string") return null
	return {
		id: group.id,
		name: group.name.trim() || "未命名分组",
		parentId: typeof group.parentId === "string" ? group.parentId : null,
		order: Number.isFinite(group.order) ? Number(group.order) : 0
	}
}

function cleanAddon(value: unknown): PersistedAddonState | null {
	if (!value || typeof value !== "object") return null
	const addon = value as Partial<PersistedAddonState>
	if (
		typeof addon.id !== "string" ||
		typeof addon.name !== "string" ||
		typeof addon.relativePath !== "string" ||
		(addon.source !== "local" && addon.source !== "workshop")
	)
		return null

	return {
		id: addon.id,
		name: addon.name.trim() || addon.relativePath,
		source: addon.source,
		relativePath: addon.relativePath,
		enabled: addon.enabled === true || addon.enabled === false ? addon.enabled : "unlisted",
		groupId: typeof addon.groupId === "string" ? addon.groupId : null,
		tags: cleanTags(addon.tags),
		priority: Number.isFinite(addon.priority) ? Math.trunc(Number(addon.priority)) : 0,
		order: Number.isFinite(addon.order) ? Math.trunc(Number(addon.order)) : 0
	}
}

function cleanPreferences(value: unknown): AddonPreferences {
	if (!value || typeof value !== "object") return { ...defaultPreferences }
	const preferences = value as Partial<AddonPreferences>
	const sourceFilter = ["all", "local", "workshop"].includes(String(preferences.sourceFilter))
		? preferences.sourceFilter
		: "all"
	const enabledFilter = ["all", "enabled", "disabled", "unlisted"].includes(
		String(preferences.enabledFilter)
	)
		? preferences.enabledFilter
		: "all"
	const problemFilter = ["all", "problems", "healthy"].includes(String(preferences.problemFilter))
		? preferences.problemFilter
		: "all"
	const sortBy = ["priority", "name", "modifiedAt", "order"].includes(String(preferences.sortBy))
		? preferences.sortBy
		: "priority"

	return {
		selectedGroupId:
			typeof preferences.selectedGroupId === "string" ? preferences.selectedGroupId : null,
		sourceFilter: sourceFilter as AddonPreferences["sourceFilter"],
		enabledFilter: enabledFilter as AddonPreferences["enabledFilter"],
		problemFilter: problemFilter as AddonPreferences["problemFilter"],
		sortBy: sortBy as AddonPreferences["sortBy"],
		sortDirection: preferences.sortDirection === "ascending" ? "ascending" : "descending"
	}
}

function cleanStoreData(value: unknown): AddonStoreData {
	if (!value || typeof value !== "object") return createDefaultStoreData()
	const source = value as Partial<AddonStoreData>
	const groups = Array.isArray(source.groups)
		? source.groups.map(cleanGroup).filter((group): group is AddonGroup => group !== null)
		: []
	const addons: Record<string, PersistedAddonState> = {}

	if (source.addons && typeof source.addons === "object") {
		for (const value of Object.values(source.addons)) {
			const addon = cleanAddon(value)
			if (addon) addons[addon.id] = addon
		}
	}

	return {
		version: 1,
		groups,
		addons,
		preferences: cleanPreferences(source.preferences),
		dirty: source.dirty === true,
		lastCheckedAt: typeof source.lastCheckedAt === "string" ? source.lastCheckedAt : null,
		lastPushedAt: typeof source.lastPushedAt === "string" ? source.lastPushedAt : null
	}
}

export function createDefaultStoreData(): AddonStoreData {
	return {
		version: 1,
		groups: [],
		addons: {},
		preferences: { ...defaultPreferences },
		dirty: false,
		lastCheckedAt: null,
		lastPushedAt: null
	}
}

export class AddonStore {
	readonly filePath: string
	readonly backupDirectory: string

	constructor(userDataPath: string) {
		this.filePath = join(userDataPath, "addon-state.json")
		this.backupDirectory = join(userDataPath, "backups")
	}

	async load(): Promise<AddonStoreData> {
		if (!(await pathExists(this.filePath))) return createDefaultStoreData()

		try {
			return cleanStoreData(JSON.parse(await readFile(this.filePath, "utf8")))
		} catch {
			return createDefaultStoreData()
		}
	}

	async save(data: AddonStoreData): Promise<void> {
		await writeFileAtomically(this.filePath, `${JSON.stringify(data, null, 4)}\n`)
	}
}
