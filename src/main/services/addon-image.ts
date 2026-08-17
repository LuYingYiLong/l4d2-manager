import { readFile, stat } from "node:fs/promises"
import { join, parse } from "node:path"

const supportedImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"] as const
const imageMimeTypes: Record<(typeof supportedImageExtensions)[number], string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".gif": "image/gif",
	".bmp": "image/bmp"
}
const maxAddonImageSize = 8 * 1024 * 1024

export function addonImageCandidates(filePath: string): string[] {
	const parsedPath = parse(filePath)
	return supportedImageExtensions.map((extension) =>
		join(parsedPath.dir, `${parsedPath.name}${extension}`)
	)
}

export async function loadAddonImage(filePath: string): Promise<string | null> {
	for (const imagePath of addonImageCandidates(filePath)) {
		try {
			const imageStat = await stat(imagePath)
			if (!imageStat.isFile() || imageStat.size > maxAddonImageSize) continue

			const extension = parse(imagePath).ext.toLocaleLowerCase(
				"en-US"
			) as keyof typeof imageMimeTypes
			const contents = await readFile(imagePath)
			return `data:${imageMimeTypes[extension]};base64,${contents.toString("base64")}`
		} catch (error) {
			const code =
				error && typeof error === "object" && "code" in error ? error.code : undefined
			if (code === "ENOENT") continue
			throw new Error(
				`无法读取 Addon 图片 ${imagePath}：${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	return null
}
