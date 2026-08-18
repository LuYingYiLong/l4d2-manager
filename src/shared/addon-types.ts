export const L4D2_APP_ID = 550

export const L4D2_IPC_CHANNELS = {
	detectGame: "l4d2:addons:detect-game",
	getSnapshot: "l4d2:addons:get-snapshot",
	getAddonImage: "l4d2:addons:get-addon-image",
	refresh: "l4d2:addons:refresh",
	setAddonEnabled: "l4d2:addons:set-enabled",
	setAddonsEnabled: "l4d2:addons:set-many-enabled",
	updateAddon: "l4d2:addons:update-addon",
	updateAddons: "l4d2:addons:update-many-addons",
	createGroup: "l4d2:addons:create-group",
	renameGroup: "l4d2:addons:rename-group",
	deleteGroup: "l4d2:addons:delete-group",
	updatePreferences: "l4d2:addons:update-preferences",
	check: "l4d2:addons:check",
	push: "l4d2:addons:push",
	revealGameDirectory: "l4d2:addons:reveal-game-directory",
	progress: "l4d2:addons:progress"
} as const

export type AddonSource = "local" | "workshop"
export type AddonEnabledState = boolean | "unlisted"
export type AddonSortKey = "priority" | "name" | "modifiedAt" | "order"
export type SortDirection = "ascending" | "descending"
export type AddonSourceFilter = "all" | AddonSource
export type AddonEnabledFilter = "all" | "enabled" | "disabled" | "unlisted"
export type AddonProblemFilter = "all" | "problems" | "healthy"

export interface GameDetectionResult {
	status: "found" | "unsupported-platform" | "steam-not-found" | "game-not-found"
	message: string
	diagnostics: string[]
	steamPath?: string
	libraryPath?: string
	gamePath?: string
	left4dead2Path?: string
	addonsPath?: string
	workshopPath?: string
	addonListPath?: string
}

export interface AddonRecord {
	id: string
	name: string
	source: AddonSource
	relativePath: string
	filePath: string
	size: number
	modifiedAt: string
	enabled: AddonEnabledState
	groupId: string | null
	tags: string[]
	workshopTags: string[]
	priority: number
	order: number
	issues: string[]
	missing: boolean
}

export interface AddonGroup {
	id: string
	name: string
	parentId: string | null
	order: number
}

export interface AddonPreferences {
	selectedGroupId: string | null
	sourceFilter: AddonSourceFilter
	enabledFilter: AddonEnabledFilter
	problemFilter: AddonProblemFilter
	tagFilter: string
	sortBy: AddonSortKey
	sortDirection: SortDirection
}

export interface AddonSnapshot {
	detection: GameDetectionResult
	addons: AddonRecord[]
	groups: AddonGroup[]
	preferences: AddonPreferences
	dirty: boolean
	issueCount: number
	lastCheckedAt: string | null
	lastPushedAt: string | null
}

export interface AddonUpdate {
	name?: string
	groupId?: string | null
	tags?: string[]
	priority?: number
}

export interface CheckResult {
	snapshot: AddonSnapshot
	checkedAt: string
	issueCount: number
}

export interface PushResult {
	snapshot: AddonSnapshot
	pushedAt: string
	backupPath: string | null
	gameWasRunning: boolean
	warning: string | null
}

export interface AddonOperationProgress {
	operation: "detect" | "refresh" | "check" | "push"
	phase: "started" | "progress" | "completed" | "failed"
	message: string
	completed?: number
	total?: number
}

export interface L4D2AddonApi {
	detectGame(): Promise<GameDetectionResult>
	getSnapshot(): Promise<AddonSnapshot>
	getAddonImage(id: string): Promise<string | null>
	refresh(): Promise<AddonSnapshot>
	setAddonEnabled(id: string, enabled: boolean): Promise<AddonSnapshot>
	setAddonsEnabled(ids: string[], enabled: boolean): Promise<AddonSnapshot>
	updateAddon(id: string, update: AddonUpdate): Promise<AddonSnapshot>
	updateAddons(ids: string[], update: AddonUpdate): Promise<AddonSnapshot>
	createGroup(name: string, parentId: string | null): Promise<AddonSnapshot>
	renameGroup(id: string, name: string): Promise<AddonSnapshot>
	deleteGroup(id: string): Promise<AddonSnapshot>
	updatePreferences(update: Partial<AddonPreferences>): Promise<AddonSnapshot>
	check(): Promise<CheckResult>
	push(): Promise<PushResult>
	revealGameDirectory(): Promise<void>
	onProgress(listener: (progress: AddonOperationProgress) => void): () => void
}
