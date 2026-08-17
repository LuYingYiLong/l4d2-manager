import { contextBridge, ipcRenderer } from "electron"
import type {
	AddonOperationProgress,
	AddonPreferences,
	AddonUpdate,
	L4D2AddonApi
} from "../shared/addon-types"
import { L4D2_IPC_CHANNELS } from "../shared/addon-types"

const addons: L4D2AddonApi = {
	detectGame: () => ipcRenderer.invoke(L4D2_IPC_CHANNELS.detectGame),
	getSnapshot: () => ipcRenderer.invoke(L4D2_IPC_CHANNELS.getSnapshot),
	refresh: () => ipcRenderer.invoke(L4D2_IPC_CHANNELS.refresh),
	setAddonEnabled: (id, enabled) =>
		ipcRenderer.invoke(L4D2_IPC_CHANNELS.setAddonEnabled, id, enabled),
	setAddonsEnabled: (ids, enabled) =>
		ipcRenderer.invoke(L4D2_IPC_CHANNELS.setAddonsEnabled, ids, enabled),
	updateAddon: (id: string, update: AddonUpdate) =>
		ipcRenderer.invoke(L4D2_IPC_CHANNELS.updateAddon, id, update),
	updateAddons: (ids: string[], update: AddonUpdate) =>
		ipcRenderer.invoke(L4D2_IPC_CHANNELS.updateAddons, ids, update),
	createGroup: (name, parentId) =>
		ipcRenderer.invoke(L4D2_IPC_CHANNELS.createGroup, name, parentId),
	renameGroup: (id, name) => ipcRenderer.invoke(L4D2_IPC_CHANNELS.renameGroup, id, name),
	deleteGroup: (id) => ipcRenderer.invoke(L4D2_IPC_CHANNELS.deleteGroup, id),
	updatePreferences: (update: Partial<AddonPreferences>) =>
		ipcRenderer.invoke(L4D2_IPC_CHANNELS.updatePreferences, update),
	check: () => ipcRenderer.invoke(L4D2_IPC_CHANNELS.check),
	push: () => ipcRenderer.invoke(L4D2_IPC_CHANNELS.push),
	revealGameDirectory: () => ipcRenderer.invoke(L4D2_IPC_CHANNELS.revealGameDirectory),
	onProgress: (listener) => {
		const wrapped = (
			_event: Electron.IpcRendererEvent,
			progress: AddonOperationProgress
		): void => listener(progress)
		ipcRenderer.on(L4D2_IPC_CHANNELS.progress, wrapped)
		return () => ipcRenderer.removeListener(L4D2_IPC_CHANNELS.progress, wrapped)
	}
}

const api = { addons }

contextBridge.exposeInMainWorld("api", api)
