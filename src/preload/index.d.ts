import type { L4D2AddonApi } from "../shared/addon-types"

declare global {
	interface Window {
		api: {
			addons: L4D2AddonApi
		}
	}
}
