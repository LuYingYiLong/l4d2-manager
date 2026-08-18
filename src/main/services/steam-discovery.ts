import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { join, normalize } from "node:path"
import { promisify } from "node:util"
import type { GameDetectionResult } from "../../shared/addon-types"
import { L4D2_APP_ID } from "../../shared/addon-types"
import { pathExists } from "./file-utils"
import { parseVdf, vdfObject, vdfString } from "./vdf"

const execFileAsync = promisify(execFile)

interface RegistryLocation {
	key: string
	value: string
}

const registryLocations: RegistryLocation[] = [
	{ key: "HKCU\\Software\\Valve\\Steam", value: "SteamPath" },
	{ key: "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", value: "InstallPath" },
	{ key: "HKLM\\SOFTWARE\\Valve\\Steam", value: "InstallPath" }
]

function uniquePaths(paths: Array<string | undefined>): string[] {
	const seen = new Set<string>()
	const result: string[] = []

	for (const path of paths) {
		if (!path) continue
		const normalized = normalize(path.trim().replace(/^"|"$/g, ""))
		const key = normalized.toLocaleLowerCase("en-US")
		if (seen.has(key)) continue
		seen.add(key)
		result.push(normalized)
	}

	return result
}

async function queryRegistryPath(location: RegistryLocation): Promise<string | undefined> {
	try {
		const { stdout } = await execFileAsync("reg.exe", [
			"query",
			location.key,
			"/v",
			location.value
		])
		const line = stdout
			.split(/\r?\n/)
			.find((candidate) =>
				candidate
					.toLocaleLowerCase("en-US")
					.includes(location.value.toLocaleLowerCase("en-US"))
			)
		return line?.match(/REG_\w+\s+(.+)$/i)?.[1]?.trim()
	} catch {
		return undefined
	}
}

async function findSteamRoots(): Promise<string[]> {
	const registryPaths = await Promise.all(registryLocations.map(queryRegistryPath))
	return uniquePaths([
		...registryPaths,
		process.env["ProgramFiles(x86)"]
			? join(process.env["ProgramFiles(x86)"], "Steam")
			: undefined,
		process.env.ProgramFiles ? join(process.env.ProgramFiles, "Steam") : undefined
	])
}

async function readSteamLibraries(steamRoot: string, diagnostics: string[]): Promise<string[]> {
	const libraryFilePath = join(steamRoot, "steamapps", "libraryfolders.vdf")
	const libraries = [steamRoot]

	if (!(await pathExists(libraryFilePath))) {
		diagnostics.push(`未找到 Steam 库配置：${libraryFilePath}`)
		return libraries
	}

	try {
		libraries.push(...steamLibraryPathsFromVdf(await readFile(libraryFilePath, "utf8")))
	} catch (error) {
		diagnostics.push(
			`无法解析 Steam 库配置：${error instanceof Error ? error.message : String(error)}`
		)
	}

	return uniquePaths(libraries)
}

export function steamLibraryPathsFromVdf(source: string): string[] {
	const root = parseVdf(source)
	const libraryFolders = vdfObject(root.libraryfolders ?? root.LibraryFolders)
	const libraries: string[] = []

	for (const value of Object.values(libraryFolders ?? {})) {
		const library = vdfObject(value)
		const path = vdfString(library?.path)
		if (path) libraries.push(path)
	}

	return uniquePaths(libraries)
}

export function installDirectoryFromManifest(source: string): string | undefined {
	const root = parseVdf(source)
	const appState = vdfObject(root.AppState ?? root.appstate)
	return vdfString(appState?.installdir)
}

async function manifestInstallDirectory(manifestPath: string): Promise<string | undefined> {
	try {
		return installDirectoryFromManifest(await readFile(manifestPath, "utf8"))
	} catch {
		return undefined
	}
}

async function detectL4D2AtGameRoot(gameRoot: string): Promise<GameDetectionResult> {
	const normalizedRoot = normalize(gameRoot.trim())
	const left4dead2Path = join(normalizedRoot, "left4dead2")
	const addonsPath = join(left4dead2Path, "addons")
	if (!(await pathExists(addonsPath))) {
		return {
			status: "game-not-found",
			message: "指定的游戏根目录无效",
			diagnostics: [`未找到 Addon 目录：${addonsPath}`],
			gamePath: normalizedRoot,
			left4dead2Path,
			addonsPath,
			workshopPath: join(addonsPath, "workshop"),
			addonListPath: join(left4dead2Path, "addonlist.txt")
		}
	}

	return {
		status: "found",
		message: "已检测到指定的《求生之路 2》目录",
		diagnostics: [],
		gamePath: normalizedRoot,
		left4dead2Path,
		addonsPath,
		workshopPath: join(addonsPath, "workshop"),
		addonListPath: join(left4dead2Path, "addonlist.txt")
	}
}

export async function detectSteamL4D2(gameRoot = ""): Promise<GameDetectionResult> {
	const diagnostics: string[] = []

	if (process.platform !== "win32") {
		return {
			status: "unsupported-platform",
			message: "第一版只支持 Windows Steam 版《求生之路 2》",
			diagnostics
		}
	}

	if (gameRoot.trim()) return detectL4D2AtGameRoot(gameRoot)

	const possibleRoots = await findSteamRoots()
	const steamRoots: string[] = []

	for (const possibleRoot of possibleRoots) {
		if (await pathExists(join(possibleRoot, "steamapps"))) steamRoots.push(possibleRoot)
		else diagnostics.push(`忽略不存在的 Steam 路径：${possibleRoot}`)
	}

	if (steamRoots.length === 0) {
		return {
			status: "steam-not-found",
			message: "未检测到 Steam 安装",
			diagnostics
		}
	}

	for (const steamRoot of steamRoots) {
		const libraries = await readSteamLibraries(steamRoot, diagnostics)

		for (const libraryPath of libraries) {
			const manifestPath = join(libraryPath, "steamapps", `appmanifest_${L4D2_APP_ID}.acf`)
			if (!(await pathExists(manifestPath))) continue

			const installDirectory =
				(await manifestInstallDirectory(manifestPath)) ?? "Left 4 Dead 2"
			const gamePath = join(libraryPath, "steamapps", "common", installDirectory)
			const left4dead2Path = join(gamePath, "left4dead2")
			const addonsPath = join(left4dead2Path, "addons")

			if (!(await pathExists(addonsPath))) {
				diagnostics.push(`发现 AppID 550，但 Addon 目录不存在：${addonsPath}`)
				continue
			}

			return {
				status: "found",
				message: "已检测到 Steam 版《求生之路 2》",
				diagnostics,
				steamPath: steamRoot,
				libraryPath,
				gamePath,
				left4dead2Path,
				addonsPath,
				workshopPath: join(addonsPath, "workshop"),
				addonListPath: join(left4dead2Path, "addonlist.txt")
			}
		}
	}

	return {
		status: "game-not-found",
		message: "已检测到 Steam，但没有找到 AppID 550",
		diagnostics,
		steamPath: steamRoots[0]
	}
}
