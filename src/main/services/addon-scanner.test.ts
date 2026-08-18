import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import type { GameDetectionResult } from "../../shared/addon-types"
import { addonIdFromPath, scanAddons } from "./addon-scanner"
import type { PersistedAddonState } from "./addon-store"

const temporaryDirectories: string[] = []

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true }))
	)
})

describe("Addon scanner", () => {
	it("combines local, Workshop and missing persisted Addons", async () => {
		const root = await mkdtemp(join(tmpdir(), "l4d2-manager-"))
		temporaryDirectories.push(root)
		const addonsPath = join(root, "left4dead2", "addons")
		const workshopPath = join(addonsPath, "workshop")
		await mkdir(workshopPath, { recursive: true })
		await writeFile(join(addonsPath, "local.vpk"), "local")
		await writeFile(join(workshopPath, "123.vpk"), "workshop")

		const missingId = addonIdFromPath("removed.vpk")
		const persisted: Record<string, PersistedAddonState> = {
			[missingId]: {
				id: missingId,
				name: "Removed",
				source: "local",
				relativePath: "removed.vpk",
				enabled: false,
				groupId: null,
				tags: ["old"],
				workshopTags: [],
				priority: 1,
				order: 9
			}
		}
		const detection: GameDetectionResult = {
			status: "found",
			message: "found",
			diagnostics: [],
			addonsPath,
			workshopPath
		}

		const result = await scanAddons(
			detection,
			[
				{
					path: "workshop/123.vpk",
					normalizedPath: "workshop/123.vpk",
					enabled: true,
					order: 0
				},
				{
					path: "old-entry.vpk",
					normalizedPath: "old-entry.vpk",
					enabled: false,
					order: 1
				}
			],
			persisted
		)

		expect(result.addons).toHaveLength(4)
		expect(result.addons.find((addon) => addon.relativePath === "local.vpk")).toMatchObject({
			source: "local",
			enabled: "unlisted",
			issues: ["未记录在 addonlist.txt 中"]
		})
		expect(
			result.addons.find((addon) => addon.relativePath === "workshop/123.vpk")
		).toMatchObject({
			source: "workshop",
			enabled: true,
			order: 0
		})
		expect(result.addons.find((addon) => addon.id === missingId)).toMatchObject({
			missing: true,
			issues: ["文件缺失"]
		})
		expect(result.addons.find((addon) => addon.relativePath === "old-entry.vpk")).toMatchObject(
			{
				enabled: false,
				missing: true,
				issues: ["addonlist.txt 中记录的文件缺失"]
			}
		)
	})
})
