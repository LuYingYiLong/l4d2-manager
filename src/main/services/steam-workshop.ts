import { basename, extname } from "node:path"
import type { AddonRecord } from "../../shared/addon-types"

const publishedFileDetailsUrl =
	"https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"
const requestBatchSize = 50
const requestTimeoutMs = 10_000
export const workshopNameCacheMaxAgeMs = 30 * 24 * 60 * 60 * 1000

export interface WorkshopMetadata {
	name: string | null
	tags: string[]
}

interface PublishedFileTag {
	tag?: string
	display_name?: string
}

interface PublishedFileDetail {
	publishedfileid?: string | number
	title?: string
	tags?: Array<PublishedFileTag | string>
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

function cleanTags(tags: Array<PublishedFileTag | string> | undefined): string[] {
	if (!Array.isArray(tags)) return []
	return [
		...new Set(
			tags
				.map((tag) => (typeof tag === "string" ? tag : (tag.display_name ?? tag.tag ?? "")))
				.map((tag) => tag.trim())
				.filter(Boolean)
		)
	]
}

function responseDetailMap(details: PublishedFileDetail[]): Map<string, WorkshopMetadata> {
	const result = new Map<string, WorkshopMetadata>()
	for (const detail of details) {
		const id = detail.publishedfileid === undefined ? null : String(detail.publishedfileid)
		if (!id || !/^\d{1,20}$/.test(id)) continue

		const name = typeof detail.title === "string" ? detail.title.trim() : ""
		result.set(id, { name: name || null, tags: cleanTags(detail.tags) })
	}
	return result
}

async function fetchWorkshopMetadataBatch(ids: string[]): Promise<Map<string, WorkshopMetadata>> {
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

	const result = new Map<string, WorkshopMetadata>(
		ids.map((id) => [id, { name: null, tags: [] }])
	)
	for (const [id, metadata] of responseDetailMap(details)) result.set(id, metadata)
	return result
}

export async function fetchWorkshopMetadata(ids: string[]): Promise<Map<string, WorkshopMetadata>> {
	const uniqueIds = [...new Set(ids.filter((id) => /^\d{1,20}$/.test(id)))]
	const batches: string[][] = []

	for (let index = 0; index < uniqueIds.length; index += requestBatchSize) {
		batches.push(uniqueIds.slice(index, index + requestBatchSize))
	}

	const results = await Promise.all(batches.map((batch) => fetchWorkshopMetadataBatch(batch)))
	return new Map(results.flatMap((result) => [...result.entries()]))
}

export async function fetchWorkshopNames(ids: string[]): Promise<Map<string, string | null>> {
	const metadata = await fetchWorkshopMetadata(ids)
	return new Map([...metadata].map(([id, value]) => [id, value.name]))
}
