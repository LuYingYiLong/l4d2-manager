import { useEffect, useState } from "react"
import { WinNavigationView, WinTextBox, WinTitleBar } from "../components"
import type { WinItem } from "../components"
import AddonManagerPage from "../features/addons/AddonManagerPage"
import ComboBoxProbePage from "../features/debug/ComboBoxProbePage"
import SettingsPage from "../features/settings/SettingsPage"
import styles from "./App.module.css"
import { applyAppTheme } from "./theme"

const COMBO_BOX_PROBE_HASH = "#/combobox-probe"

const navigationItems = [
	{
		Key: "addons",
		Content: "Addon 管理",
		Icon: "\uE8B7",
		"AutomationProperties.Name": "Addon 管理"
	}
]

function App(): React.JSX.Element {
	const [showComboBoxProbe, setShowComboBoxProbe] = useState(
		import.meta.env.DEV && window.location.hash === COMBO_BOX_PROBE_HASH
	)
	const [navigationOpen, setNavigationOpen] = useState(true)
	const [selectedNavigationItem, setSelectedNavigationItem] = useState<WinItem>(
		navigationItems[0]
	)
	const [search, setSearch] = useState("")
	useEffect(() => {
		let active = true
		void window.api.addons
			.getSnapshot()
			.then((snapshot) => {
				if (active) applyAppTheme(snapshot.settings.theme)
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [])
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
	const selectedNavigationValue =
		typeof selectedNavigationItem === "object" && selectedNavigationItem !== null
			? String(
					(selectedNavigationItem as Record<string, unknown>).Value ??
						(selectedNavigationItem as Record<string, unknown>).Key ??
						""
				)
			: String(selectedNavigationItem)
	const isSettingsPage = selectedNavigationValue === "settings"
	return (
		<div className={styles.appShell}>
			<div className={styles.navigationHost}>
				<WinNavigationView
					PaneTitle="Navigation"
					PaneDisplayMode="LeftCompact"
					IsPaneOpen={navigationOpen}
					IsPaneToggleButtonVisible={false}
					IsBackButtonVisible="Collapsed"
					SettingsLabel="设置"
					SettingsIcon={"\uE713"}
					OpenPaneLength={280}
					CompactPaneLength={52}
					MenuItemsSource={navigationItems}
					SelectedItem={selectedNavigationItem}
					onUpdate:SelectedItem={(item) => {
						if (item) setSelectedNavigationItem(item)
					}}
				>
					{isSettingsPage ? (
						<SettingsPage
							onSettingsChanged={(settings) => applyAppTheme(settings.theme)}
						/>
					) : (
						<AddonManagerPage search={search} />
					)}
				</WinNavigationView>
			</div>

			<WinTitleBar
				className={styles.titleBar}
				PreferredHeightOption="Compact"
				style={{ "--TitleBarCompactHeight": "38px" }}
				IsPaneToggleButtonVisible
				onPaneToggleRequested={() => setNavigationOpen((open) => !open)}
				LeftHeader={<span className={styles.titleBarMark}>L2</span>}
				RightHeader={<span className={styles.titleBarName}>L4D2 Manager</span>}
			/>

			<div className={styles.globalSearch}>
				<WinTextBox
					Value={search}
					PlaceholderText="搜索名称、文件名或 Steam 标签"
					ShowDeleteButton
					onUpdate:Value={setSearch}
				/>
			</div>
		</div>
	)
}

export default App
