import { useEffect, useState } from "react"
import AddonManagerPage from "../features/addons/AddonManagerPage"
import ComboBoxProbePage from "../features/debug/ComboBoxProbePage"

const COMBO_BOX_PROBE_HASH = "#/combobox-probe"

function App(): React.JSX.Element {
	const [showComboBoxProbe, setShowComboBoxProbe] = useState(
		import.meta.env.DEV && window.location.hash === COMBO_BOX_PROBE_HASH
	)
	useEffect(() => {
		if (!import.meta.env.DEV) return undefined
		const syncProbeRoute = (): void => {
			setShowComboBoxProbe(window.location.hash === COMBO_BOX_PROBE_HASH)
		}
		const onKeyDown = (event: KeyboardEvent): void => {
			if (!event.ctrlKey || !event.shiftKey || event.code !== "F10") return
			event.preventDefault()
			window.location.hash =
				window.location.hash === COMBO_BOX_PROBE_HASH ? "" : COMBO_BOX_PROBE_HASH
		}
		window.addEventListener("hashchange", syncProbeRoute)
		window.addEventListener("keydown", onKeyDown)
		return () => {
			window.removeEventListener("hashchange", syncProbeRoute)
			window.removeEventListener("keydown", onKeyDown)
		}
	}, [])
	if (showComboBoxProbe) {
		return <ComboBoxProbePage onExit={() => (window.location.hash = "")} />
	}
	return <AddonManagerPage />
}

export default App
