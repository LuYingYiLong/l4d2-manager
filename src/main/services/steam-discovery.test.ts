import { describe, expect, it } from "vitest"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { installDirectoryFromManifest, steamLibraryPathsFromVdf } from "./steam-discovery"
import { detectSteamL4D2 } from "./steam-discovery"

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

	it("detects a configured game root", async () => {
		if (process.platform !== "win32") return
		const root = await mkdtemp(join(tmpdir(), "l4d2-manager-settings-"))
		try {
			await mkdir(join(root, "left4dead2", "addons"), { recursive: true })
			const result = await detectSteamL4D2(root)

			expect(result.status).toBe("found")
			expect(result.gamePath).toBe(root)
			expect(result.addonsPath).toBe(join(root, "left4dead2", "addons"))
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
})
