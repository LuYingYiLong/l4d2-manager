import type { BrowserWindow, IpcMainInvokeEvent } from "electron"
import { dialog, ipcMain, nativeTheme, shell } from "electron"
import type { AddonPreferences, AddonUpdate, AppSettings } from "../../shared/addon-types"
import { L4D2_IPC_CHANNELS } from "../../shared/addon-types"
import type { AddonManager } from "../services/addon-manager"

function requireString(value: unknown, name: string): string {
	if (typeof value !== "string") throw new Error(`${name} 必须是字符串`)
	return value
}

function optionalStringOrNull(value: unknown, name: string): string | null {
	if (value === null) return null
	return requireString(value, name)
}

function requireStringArray(value: unknown, name: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`${name} 必须是字符串数组`)
	}
	return value
}

export function registerAddonIpc(
	manager: AddonManager,
	getWindow: () => BrowserWindow | null
): void {
	const assertSender = (event: IpcMainInvokeEvent): void => {
		const window = getWindow()
		if (!window || event.sender !== window.webContents)
			throw new Error("拒绝未知窗口的 IPC 请求")
	}

	const handle = <T extends unknown[], TResult>(
		channel: string,
		handler: (...args: T) => TResult | Promise<TResult>
	): void => {
		ipcMain.handle(channel, (event, ...args: T) => {
			assertSender(event)
			return handler(...args)
		})
	}

	handle(L4D2_IPC_CHANNELS.detectGame, () => manager.detectGame())
	handle(L4D2_IPC_CHANNELS.getSnapshot, () => manager.getSnapshot())
	handle(L4D2_IPC_CHANNELS.getAddonImage, (id: unknown) =>
		manager.getAddonImage(requireString(id, "id"))
	)
	handle(L4D2_IPC_CHANNELS.refresh, () => manager.refresh())
	handle(L4D2_IPC_CHANNELS.setAddonEnabled, (id: unknown, enabled: unknown) => {
		if (typeof enabled !== "boolean") throw new Error("enabled 必须是布尔值")
		return manager.setAddonEnabled(requireString(id, "id"), enabled)
	})
	handle(L4D2_IPC_CHANNELS.setAddonsEnabled, (ids: unknown, enabled: unknown) => {
		if (typeof enabled !== "boolean") throw new Error("enabled 必须是布尔值")
		return manager.setAddonsEnabled(requireStringArray(ids, "ids"), enabled)
	})
	handle(L4D2_IPC_CHANNELS.updateAddon, (id: unknown, update: unknown) => {
		if (!update || typeof update !== "object") throw new Error("update 必须是对象")
		return manager.updateAddon(requireString(id, "id"), update as AddonUpdate)
	})
	handle(L4D2_IPC_CHANNELS.updateAddons, (ids: unknown, update: unknown) => {
		if (!update || typeof update !== "object") throw new Error("update 必须是对象")
		return manager.updateAddons(requireStringArray(ids, "ids"), update as AddonUpdate)
	})
	handle(L4D2_IPC_CHANNELS.createGroup, (name: unknown, parentId: unknown) =>
		manager.createGroup(requireString(name, "name"), optionalStringOrNull(parentId, "parentId"))
	)
	handle(L4D2_IPC_CHANNELS.renameGroup, (id: unknown, name: unknown) =>
		manager.renameGroup(requireString(id, "id"), requireString(name, "name"))
	)
	handle(L4D2_IPC_CHANNELS.deleteGroup, (id: unknown) =>
		manager.deleteGroup(requireString(id, "id"))
	)
	handle(L4D2_IPC_CHANNELS.updatePreferences, (update: unknown) => {
		if (!update || typeof update !== "object") throw new Error("偏好设置必须是对象")
		return manager.updatePreferences(update as Partial<AddonPreferences>)
	})
	handle(L4D2_IPC_CHANNELS.updateSettings, async (update: unknown) => {
		if (!update || typeof update !== "object") throw new Error("应用设置必须是对象")
		const snapshot = await manager.updateSettings(update as Partial<AppSettings>)
		nativeTheme.themeSource = snapshot.settings.theme
		return snapshot
	})
	handle(L4D2_IPC_CHANNELS.selectGameRoot, async () => {
		const options: Electron.OpenDialogOptions = {
			title: "选择《求生之路 2》游戏根目录",
			properties: ["openDirectory"]
		}
		const window = getWindow()
		const result = window
			? await dialog.showOpenDialog(window, options)
			: await dialog.showOpenDialog(options)
		return result.canceled ? null : (result.filePaths[0] ?? null)
	})
	handle(L4D2_IPC_CHANNELS.check, () => manager.check())
	handle(L4D2_IPC_CHANNELS.push, () => manager.push())
	handle(L4D2_IPC_CHANNELS.revealGameDirectory, async () => {
		const error = await shell.openPath(manager.getGamePath())
		if (error) throw new Error(error)
	})

	manager.onProgress((progress) => {
		const window = getWindow()
		if (window && !window.isDestroyed()) {
			window.webContents.send(L4D2_IPC_CHANNELS.progress, progress)
		}
	})
}
