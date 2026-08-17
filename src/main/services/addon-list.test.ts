import { describe, expect, it } from "vitest"
import { formatAddonList, normalizeAddonPath, parseAddonList } from "./addon-list"

describe("addonlist.txt", () => {
	it("normalizes game-relative paths", () => {
		expect(normalizeAddonPath("left4dead2\\addons\\Workshop\\123.vpk")).toBe("workshop/123.vpk")
		expect(normalizeAddonPath("./addons/local.vpk")).toBe("local.vpk")
	})

	it("parses enabled state and preserves order", () => {
		const entries = parseAddonList(
			['"AddonList"', "{", '\t"workshop\\\\111.vpk" "1"', '\t"local.vpk" "0"', "}"].join("\n")
		)

		expect(entries).toEqual([
			{
				path: "workshop\\111.vpk",
				normalizedPath: "workshop/111.vpk",
				enabled: true,
				order: 0
			},
			{
				path: "local.vpk",
				normalizedPath: "local.vpk",
				enabled: false,
				order: 1
			}
		])
	})

	it("formats a canonical file that can be parsed again", () => {
		const formatted = formatAddonList([
			{ path: "workshop/111.vpk", enabled: true },
			{ path: "local.vpk", enabled: false }
		])

		expect(formatted).toContain('"workshop\\\\111.vpk" "1"')
		expect(
			parseAddonList(formatted).map(({ normalizedPath, enabled }) => ({
				normalizedPath,
				enabled
			}))
		).toEqual([
			{ normalizedPath: "workshop/111.vpk", enabled: true },
			{ normalizedPath: "local.vpk", enabled: false }
		])
	})
})
