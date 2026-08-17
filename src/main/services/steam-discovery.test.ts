import { describe, expect, it } from "vitest"
import { installDirectoryFromManifest, steamLibraryPathsFromVdf } from "./steam-discovery"

describe("Steam VDF discovery", () => {
	it("reads all configured Steam library paths", () => {
		const source = [
			'"libraryfolders"',
			"{",
			'\t"0"',
			"\t{",
			'\t\t"path" "C:\\\\Program Files (x86)\\\\Steam"',
			"\t}",
			'\t"1"',
			"\t{",
			'\t\t"path" "D:\\\\SteamLibrary"',
			'\t\t"apps" { "550" "123456" }',
			"\t}",
			"}"
		].join("\n")

		expect(steamLibraryPathsFromVdf(source)).toEqual([
			"C:\\Program Files (x86)\\Steam",
			"D:\\SteamLibrary"
		])
	})

	it("reads the install directory from appmanifest_550.acf", () => {
		expect(
			installDirectoryFromManifest(
				['"AppState"', "{", '\t"appid" "550"', '\t"installdir" "Left 4 Dead 2"', "}"].join(
					"\n"
				)
			)
		).toBe("Left 4 Dead 2")
	})
})
