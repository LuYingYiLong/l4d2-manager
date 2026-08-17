import { constants } from "node:fs"
import { access, copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

export async function ensureWritable(path: string, parentPath: string): Promise<void> {
	await access((await pathExists(path)) ? path : parentPath, constants.W_OK)
}

export async function writeFileAtomically(
	targetPath: string,
	content: string,
	backupPath?: string
): Promise<string | null> {
	await mkdir(dirname(targetPath), { recursive: true })

	const suffix = `${process.pid}-${Date.now()}`
	const temporaryPath = `${targetPath}.${suffix}.tmp`
	const rollbackPath = `${targetPath}.${suffix}.previous`
	const targetExisted = await pathExists(targetPath)
	let movedOriginal = false
	let completed = false

	try {
		await writeFile(temporaryPath, content, "utf8")

		if (targetExisted && backupPath) {
			await mkdir(dirname(backupPath), { recursive: true })
			await copyFile(targetPath, backupPath)
		}

		if (targetExisted) {
			await rename(targetPath, rollbackPath)
			movedOriginal = true
		}

		await rename(temporaryPath, targetPath)
		completed = true

		if (movedOriginal) await rm(rollbackPath, { force: true }).catch(() => undefined)
		return targetExisted && backupPath ? backupPath : null
	} catch (error) {
		if (movedOriginal && !(await pathExists(targetPath))) {
			await rename(rollbackPath, targetPath).catch(() => undefined)
		}
		throw error
	} finally {
		if (!completed) await rm(temporaryPath, { force: true }).catch(() => undefined)
	}
}
