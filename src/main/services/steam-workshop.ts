import { basename, extname } from "node:path"
import type { AddonRecord } from "../../shared/addon-types"

const publishedFileDetailsUrl =
	"https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"
const requestBatchSize = 50
const requestTimeoutMs = 10_000
export const workshopNameCacheMaxAgeMs = 30 * 24 * 60 * 60 * 1000

interface PublishedFileDetail {
	publishedfileid?: string | number
	title?: string
}

interface PublishedFileDetailsResponse {
	response?: {
		publishedfiledetails?: PublishedFileDetail[]
	}
}

export function workshopIdFromAddon(
	addon: Pick<AddonRecord, "source" | "relativePath">
): string | null {
	if (addon.source !== "workshop") return null

	const id = basename(addon.relativePath, extname(addon.relativePath))
	return /^\d{1,20}$/.test(id) ? id : null
}

export function isWorkshopNameCacheFresh(fetchedAt: string, now = Date.now()): boolean {
	const timestamp = Date.parse(fetchedAt)
	return (
		Number.isFinite(timestamp) &&
		timestamp <= now &&
		now - timestamp < workshopNameCacheMaxAgeMs
	)
}

function responseDetailMap(details: PublishedFileDetail[]): Map<string, string | null> {
	const result = new Map<string, string | null>()
	for (const detail of details) {
		const id = detail.publishedfileid === undefined ? null : String(detail.publishedfileid)
		if (!id || !/^\d{1,20}$/.test(id)) continue

		const name = typeof detail.title === "string" ? detail.title.trim() : ""
		result.set(id, name || null)
	}
	return result
}

async function fetchWorkshopNameBatch(ids: string[]): Promise<Map<string, string | null>> {
	const body = new URLSearchParams({ itemcount: String(ids.length) })
	ids.forEach((id, index) => body.append(`publishedfileids[${index}]`, id))

	const response = await fetch(publishedFileDetailsUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		signal: AbortSignal.timeout(requestTimeoutMs)
	})
	if (!response.ok) throw new Error(`Steam API 返回 HTTP ${response.status}`)

	const payload = (await response.json()) as PublishedFileDetailsResponse
	const details = payload.response?.publishedfiledetails
	if (!Array.isArray(details)) throw new Error("Steam API 返回了无法识别的 Workshop 数据")

	const result = new Map<string, string | null>(ids.map((id) => [id, null]))
	for (const [id, name] of responseDetailMap(details)) result.set(id, name)
	return result
}

export async function fetchWorkshopNames(ids: string[]): Promise<Map<string, string | null>> {
	const uniqueIds = [...new Set(ids.filter((id) => /^\d{1,20}$/.test(id)))]
	const batches: string[][] = []

	for (let index = 0; index < uniqueIds.length; index += requestBatchSize) {
		batches.push(uniqueIds.slice(index, index + requestBatchSize))
	}

	const results = await Promise.all(batches.map((batch) => fetchWorkshopNameBatch(batch)))
	return new Map(results.flatMap((result) => [...result.entries()]))
}
