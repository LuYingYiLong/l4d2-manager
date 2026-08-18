import { describe, expect, it } from "vitest"
import type { AddonRecord } from "../../../../shared/addon-types"
import { buildGroupTree, filterAndSortAddons, groupPath } from "./addon-view"

const baseAddon: AddonRecord = {
	id: "base",
	name: "Base",
	source: "local",
	relativePath: "base.vpk",
	filePath: "C:\\base.vpk",
	size: 1,
	modifiedAt: "2026-01-01T00:00:00.000Z",
	enabled: true,
	groupId: null,
	workshopTags: [],
	priority: 0,
	order: 0,
	issues: [],
	missing: false
}

describe("Addon view model", () => {
	it("builds nested virtual groups and paths", () => {
		const groups = [
			{ id: "maps", name: "地图", parentId: null, order: 0 },
			{ id: "coop", name: "合作", parentId: "maps", order: 0 }
		]

		expect(buildGroupTree(groups)[0].children[0].children[0].Label).toBe("合作")
		expect(groupPath(groups, "coop")).toEqual(["全部 Addon", "地图", "合作"])
	})

	it("searches Workshop tags and sorts higher priority first", () => {
		const addons = [
			{ ...baseAddon, id: "low", name: "Low", workshopTags: ["地图"], priority: 1 },
			{ ...baseAddon, id: "high", name: "High", workshopTags: ["地图"], priority: 10 },
			{ ...baseAddon, id: "other", name: "Other", workshopTags: ["武器"], priority: 99 }
		]
		const result = filterAndSortAddons(addons, {
			search: "地图",
			selectedGroupId: null,
			source: "all",
			enabled: "all",
			problems: "all",
			tag: "",
			sortBy: "priority",
			sortDirection: "descending"
		})

		expect(result.map((addon) => addon.id)).toEqual(["high", "low"])
	})

	it("filters by an exact tag without changing tag casing", () => {
		const addons = [
			{ ...baseAddon, id: "map", workshopTags: ["地图"] },
			{ ...baseAddon, id: "weapon", workshopTags: ["武器"] },
			{ ...baseAddon, id: "untagged", workshopTags: [] }
		]

		const result = filterAndSortAddons(addons, {
			search: "",
			selectedGroupId: null,
			source: "all",
			enabled: "all",
			problems: "all",
			tag: " 地图 ",
			sortBy: "priority",
			sortDirection: "descending"
		})

		expect(result.map((addon) => addon.id)).toEqual(["map"])
	})
})
