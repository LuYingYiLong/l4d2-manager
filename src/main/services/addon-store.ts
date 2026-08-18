import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type {
	AddonEnabledState,
	AddonGroup,
	AppSettings,
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
	workshopTags: string[]
	priority: number
	order: number
}

export interface WorkshopNameCacheEntry {
	name: string | null
	tags: string[]
	fetchedAt: string
}

export interface AddonStoreData {
	version: 1
	settings: AppSettings
	groups: AddonGroup[]
	addons: Record<string, PersistedAddonState>
	workshopNames: Record<string, WorkshopNameCacheEntry>
	preferences: AddonPreferences
	dirty: boolean
	lastCheckedAt: string | null
	lastPushedAt: string | null
}

export const defaultAppSettings: AppSettings = {
	theme: "system",
	gameRoot: ""
}

export const defaultPreferences: AddonPreferences = {
	selectedGroupId: null,
	sourceFilter: "all",
	enabledFilter: "all",
	problemFilter: "all",
	tagFilter: "",
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

function cleanSettings(value: unknown): AppSettings {
	if (!value || typeof value !== "object") return { ...defaultAppSettings }
	const settings = value as Partial<AppSettings>
	return {
		theme: settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system",
		gameRoot: typeof settings.gameRoot === "string" ? settings.gameRoot.trim() : ""
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
		workshopTags: cleanTags(addon.workshopTags),
		priority: Number.isFinite(addon.priority) ? Math.trunc(Number(addon.priority)) : 0,
		order: Number.isFinite(addon.order) ? Math.trunc(Number(addon.order)) : 0
	}
}

function cleanWorkshopNames(value: unknown): Record<string, WorkshopNameCacheEntry> {
	if (!value || typeof value !== "object") return {}

	const result: Record<string, WorkshopNameCacheEntry> = {}
	for (const [id, cacheValue] of Object.entries(value)) {
		if (!/^\d{1,20}$/.test(id) || !cacheValue || typeof cacheValue !== "object") continue

		const entry = cacheValue as Partial<WorkshopNameCacheEntry>
		const hasTags = Array.isArray(entry.tags)
		if (
			(entry.name !== null && typeof entry.name !== "string") ||
			typeof entry.fetchedAt !== "string" ||
			!Number.isFinite(Date.parse(entry.fetchedAt))
		)
			continue

		result[id] = {
			name: typeof entry.name === "string" ? entry.name.trim() || null : null,
			tags: cleanTags(entry.tags),
			fetchedAt: hasTags ? entry.fetchedAt : new Date(0).toISOString()
		}
	}

	return result
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
	const tagFilter = typeof preferences.tagFilter === "string" ? preferences.tagFilter.trim() : ""
	const sortBy = ["priority", "name", "modifiedAt", "order"].includes(String(preferences.sortBy))
		? preferences.sortBy
		: "priority"

	return {
		selectedGroupId:
			typeof preferences.selectedGroupId === "string" ? preferences.selectedGroupId : null,
		sourceFilter: sourceFilter as AddonPreferences["sourceFilter"],
		enabledFilter: enabledFilter as AddonPreferences["enabledFilter"],
		problemFilter: problemFilter as AddonPreferences["problemFilter"],
		tagFilter,
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
		settings: cleanSettings(source.settings),
		groups,
		addons,
		workshopNames: cleanWorkshopNames(source.workshopNames),
		preferences: cleanPreferences(source.preferences),
		dirty: source.dirty === true,
		lastCheckedAt: typeof source.lastCheckedAt === "string" ? source.lastCheckedAt : null,
		lastPushedAt: typeof source.lastPushedAt === "string" ? source.lastPushedAt : null
	}
}

export function createDefaultStoreData(): AddonStoreData {
	return {
		version: 1,
		settings: { ...defaultAppSettings },
		groups: [],
		addons: {},
		workshopNames: {},
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
