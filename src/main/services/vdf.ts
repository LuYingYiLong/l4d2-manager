export type VdfValue = string | VdfObject
export interface VdfObject {
	[key: string]: VdfValue
}

type VdfToken = "{" | "}" | string

function tokenizeVdf(source: string): VdfToken[] {
	const tokens: VdfToken[] = []
	let index = 0

	while (index < source.length) {
		const character = source[index]

		if (/\s/.test(character)) {
			index += 1
			continue
		}

		if (character === "/" && source[index + 1] === "/") {
			index = source.indexOf("\n", index + 2)
			if (index < 0) break
			continue
		}

		if (character === "{" || character === "}") {
			tokens.push(character)
			index += 1
			continue
		}

		if (character === '"') {
			index += 1
			let value = ""

			while (index < source.length) {
				const current = source[index]
				if (current === '"') {
					index += 1
					break
				}
				if (current === "\\" && index + 1 < source.length) {
					const escaped = source[index + 1]
					value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped
					index += 2
					continue
				}
				value += current
				index += 1
			}

			tokens.push(value)
			continue
		}

		const start = index
		while (index < source.length && !/[\s{}]/.test(source[index])) index += 1
		tokens.push(source.slice(start, index))
	}

	return tokens
}

function parseVdfObject(tokens: VdfToken[], cursor: { index: number }, nested: boolean): VdfObject {
	const result: VdfObject = {}

	while (cursor.index < tokens.length) {
		const key = tokens[cursor.index]
		cursor.index += 1

		if (key === "}") {
			if (!nested) throw new Error("VDF 中存在多余的右括号")
			return result
		}
		if (key === "{") throw new Error("VDF 键名位置出现了左括号")

		const next = tokens[cursor.index]
		cursor.index += 1

		if (next === undefined) throw new Error(`VDF 键“${key}”缺少值`)
		if (next === "}") throw new Error(`VDF 键“${key}”缺少值`)

		result[key] = next === "{" ? parseVdfObject(tokens, cursor, true) : String(next)
	}

	if (nested) throw new Error("VDF 对象缺少右括号")
	return result
}

export function parseVdf(source: string): VdfObject {
	const tokens = tokenizeVdf(source.replace(/^\uFEFF/, ""))
	return parseVdfObject(tokens, { index: 0 }, false)
}

export function vdfObject(value: VdfValue | undefined): VdfObject | undefined {
	return value && typeof value === "object" ? value : undefined
}

export function vdfString(value: VdfValue | undefined): string | undefined {
	return typeof value === "string" ? value : undefined
}
