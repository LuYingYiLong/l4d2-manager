export interface AddonListEntry {
	path: string
	normalizedPath: string
	enabled: boolean
	order: number
}

function decodeQuotedValue(value: string): string {
	return value.replace(/\\(["\\])/g, "$1")
}

function encodeQuotedValue(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function normalizeAddonPath(value: string): string {
	let normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "")
	normalized = normalized.replace(/^left4dead2\/addons\//i, "")
	normalized = normalized.replace(/^addons\//i, "")
	normalized = normalized.replace(/^\/+/, "")
	return normalized.toLocaleLowerCase("en-US")
}

export function parseAddonList(source: string): AddonListEntry[] {
	const entries: AddonListEntry[] = []
	const expression = /"((?:\\.|[^"])*)"\s+"([01])"/g
	let match: RegExpExecArray | null

	while ((match = expression.exec(source.replace(/^\uFEFF/, ""))) !== null) {
		const path = decodeQuotedValue(match[1])
		entries.push({
			path,
			normalizedPath: normalizeAddonPath(path),
			enabled: match[2] === "1",
			order: entries.length
		})
	}

	return entries
}

export function formatAddonList(entries: Array<Pick<AddonListEntry, "path" | "enabled">>): string {
	const lines = ['"AddonList"', "{"]

	for (const entry of entries) {
		const windowsPath = entry.path.replace(/\//g, "\\")
		lines.push(`\t"${encodeQuotedValue(windowsPath)}" "${entry.enabled ? "1" : "0"}"`)
	}

	lines.push("}", "")
	return lines.join("\n")
}
