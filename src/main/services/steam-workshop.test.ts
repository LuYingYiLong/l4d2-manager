import { afterEach, describe, expect, it, vi } from "vitest"
import type { AddonRecord } from "../../shared/addon-types"
import {
	fetchWorkshopMetadata,
	fetchWorkshopNames,
	isWorkshopNameCacheFresh,
	workshopIdFromAddon
} from "./steam-workshop"

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("Steam Workshop", () => {
	it("extracts a numeric PublishedFileId from a Workshop VPK", () => {
		const addon = {
			source: "workshop",
			relativePath: "workshop/384949406.vpk"
		} as AddonRecord

		expect(workshopIdFromAddon(addon)).toBe("384949406")
		expect(
			workshopIdFromAddon({
				source: "local",
				relativePath: "local.vpk"
			} as AddonRecord)
		).toBeNull()
	})

	it("fetches names and caches missing response entries as null", async () => {
		const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
			const body = init?.body as URLSearchParams
			expect(init?.method).toBe("POST")
			expect(body.get("itemcount")).toBe("2")
			expect(body.get("publishedfileids[0]")).toBe("123")
			expect(body.get("publishedfileids[1]")).toBe("456")

			return new Response(
				JSON.stringify({
					response: {
						publishedfiledetails: [{ publishedfileid: "123", title: "My Addon" }]
					}
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		})
		vi.stubGlobal("fetch", fetchMock)

		expect(await fetchWorkshopNames(["123", "456"])).toEqual(
			new Map([
				["123", "My Addon"],
				["456", null]
			])
		)
	})

	it("reads official Workshop tags from published file details", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						response: {
							publishedfiledetails: [
								{
									publishedfileid: "123",
									title: "Tagged Addon",
									tags: [
										{ tag: "Campaign" },
										{ display_name: "Sound" },
										"Campaign"
									]
								}
							]
						}
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
		)
		vi.stubGlobal("fetch", fetchMock)

		expect(await fetchWorkshopMetadata(["123"])).toEqual(
			new Map([["123", { name: "Tagged Addon", tags: ["Campaign", "Sound"] }]])
		)
	})

	it("keeps names cached for thirty days", () => {
		const now = Date.parse("2026-08-17T00:00:00.000Z")
		expect(isWorkshopNameCacheFresh("2026-08-01T00:00:00.000Z", now)).toBe(true)
		expect(isWorkshopNameCacheFresh("2026-07-01T00:00:00.000Z", now)).toBe(false)
	})
})
