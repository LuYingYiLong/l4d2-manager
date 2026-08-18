import type {
	AddonEnabledFilter,
	AddonGroup,
	AddonPreferences,
	AddonRecord,
	AddonSourceFilter
} from "../../../../shared/addon-types"

export interface AddonGroupTreeItem extends Record<string, unknown> {
	Key: string
	Label: string
	groupId: string | null
	children: AddonGroupTreeItem[]
	IsExpanded: boolean
}

export interface AddonFilter {
	search: string
	selectedGroupId: string | null
	source: AddonSourceFilter
	enabled: AddonEnabledFilter
	problems: AddonPreferences["problemFilter"]
	tag: string
	sortBy: AddonPreferences["sortBy"]
	sortDirection: AddonPreferences["sortDirection"]
}

export function addonTags(addon: Pick<AddonRecord, "workshopTags">): string[] {
	return [
		...new Map(
			addon.workshopTags
				.map((tag) => tag.trim())
				.filter(Boolean)
				.map((tag) => [tag.toLocaleLowerCase("zh-CN"), tag] as const)
		).values()
	]
}

function childGroups(groups: AddonGroup[], parentId: string | null): AddonGroupTreeItem[] {
	return groups
		.filter((group) => group.parentId === parentId)
		.sort(
			(left, right) =>
				left.order - right.order || left.name.localeCompare(right.name, "zh-CN")
		)
		.map((group) => ({
			Key: group.id,
			Label: group.name,
			groupId: group.id,
			children: childGroups(groups, group.id),
			IsExpanded: true
		}))
}

export function buildGroupTree(groups: AddonGroup[]): AddonGroupTreeItem[] {
	return [
		{
			Key: "__all__",
			Label: "全部 Addon",
			groupId: null,
			children: childGroups(groups, null),
			IsExpanded: true
		}
	]
}

export function findGroupTreeItem(
	items: AddonGroupTreeItem[],
	groupId: string | null
): AddonGroupTreeItem | undefined {
	for (const item of items) {
		if (item.groupId === groupId) return item
		const child = findGroupTreeItem(item.children, groupId)
		if (child) return child
	}
	return undefined
}

export function groupPath(groups: AddonGroup[], groupId: string | null): string[] {
	const result = ["全部 Addon"]
	let current = groupId
	const seen = new Set<string>()
	const names: string[] = []

	while (current && !seen.has(current)) {
		seen.add(current)
		const group = groups.find((candidate) => candidate.id === current)
		if (!group) break
		names.unshift(group.name)
		current = group.parentId
	}

	return [...result, ...names]
}

export function filterAndSortAddons(addons: AddonRecord[], filter: AddonFilter): AddonRecord[] {
	const query = filter.search.trim().toLocaleLowerCase("zh-CN")
	const direction = filter.sortDirection === "ascending" ? 1 : -1

	return addons
		.filter(
			(addon) => filter.selectedGroupId === null || addon.groupId === filter.selectedGroupId
		)
		.filter((addon) => filter.source === "all" || addon.source === filter.source)
		.filter((addon) => {
			if (filter.enabled === "all") return true
			if (filter.enabled === "unlisted") return addon.enabled === "unlisted"
			if (filter.enabled === "enabled") return addon.enabled === true
			return addon.enabled === false
		})
		.filter((addon) => {
			if (filter.problems === "all") return true
			if (filter.problems === "problems") return addon.issues.length > 0
			return addon.issues.length === 0
		})
		.filter((addon) => {
			const selectedTag = filter.tag.trim().toLocaleLowerCase("zh-CN")
			if (!selectedTag) return true
			return addonTags(addon).some((tag) => tag.toLocaleLowerCase("zh-CN") === selectedTag)
		})
		.filter((addon) => {
			if (!query) return true
			return [addon.name, addon.relativePath, ...addonTags(addon)].some((value) =>
				value.toLocaleLowerCase("zh-CN").includes(query)
			)
		})
		.sort((left, right) => {
			let comparison = 0
			if (filter.sortBy === "name") comparison = left.name.localeCompare(right.name, "zh-CN")
			else if (filter.sortBy === "modifiedAt")
				comparison = left.modifiedAt.localeCompare(right.modifiedAt)
			else if (filter.sortBy === "order") comparison = left.order - right.order
			else comparison = left.priority - right.priority
			return comparison * direction || left.order - right.order
		})
}

export function formatFileSize(bytes: number): string {
	if (bytes <= 0) return "—"
	const units = ["B", "KB", "MB", "GB"]
	let value = bytes
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function formatDate(value: string): string {
	if (!value) return "—"
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN")
}
