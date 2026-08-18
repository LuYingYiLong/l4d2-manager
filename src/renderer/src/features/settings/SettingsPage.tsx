import { useCallback, useEffect, useState } from "react"
import { WinButton, WinComboBox, WinInfoBar, WinTextBox } from "../../components"
import type { AddonSnapshot, AppSettings, AppTheme } from "../../../../shared/addon-types"
import styles from "./SettingsPage.module.css"

const themeOptions = [
	{ label: "跟随系统", value: "system" },
	{ label: "浅色", value: "light" },
	{ label: "深色", value: "dark" }
]

type SettingsNotice = {
	severity: "Success" | "Error"
	title: string
	message: string
}

interface SettingsPageProps {
	onSettingsChanged?: (settings: AppSettings) => void
}

export default function SettingsPage({ onSettingsChanged }: SettingsPageProps): React.JSX.Element {
	const [snapshot, setSnapshot] = useState<AddonSnapshot | null>(null)
	const [gameRoot, setGameRoot] = useState("")
	const [busy, setBusy] = useState(true)
	const [notice, setNotice] = useState<SettingsNotice | null>(null)

	const applySnapshot = useCallback(
		(next: AddonSnapshot): void => {
			setSnapshot(next)
			setGameRoot(next.settings.gameRoot)
			onSettingsChanged?.(next.settings)
		},
		[onSettingsChanged]
	)

	const fail = useCallback((error: unknown): void => {
		setNotice({
			severity: "Error",
			title: "保存设置失败",
			message: error instanceof Error ? error.message : String(error)
		})
	}, [])

	useEffect(() => {
		void window.api.addons
			.getSnapshot()
			.then(applySnapshot)
			.catch(fail)
			.finally(() => setBusy(false))
	}, [applySnapshot, fail])

	const updateSettings = async (update: Partial<AppSettings>, message: string): Promise<void> => {
		setBusy(true)
		setNotice(null)
		try {
			const next = await window.api.addons.updateSettings(update)
			applySnapshot(next)
			setNotice({ severity: "Success", title: "设置已保存", message })
		} catch (error) {
			fail(error)
		} finally {
			setBusy(false)
		}
	}

	const chooseGameRoot = async (): Promise<void> => {
		try {
			const selectedPath = await window.api.addons.selectGameRoot()
			if (selectedPath) setGameRoot(selectedPath)
		} catch (error) {
			fail(error)
		}
	}

	if (!snapshot) {
		return <div className={styles.loading}>正在加载设置…</div>
	}

	const rootChanged = gameRoot.trim() !== snapshot.settings.gameRoot
	const detectionMessage =
		snapshot.detection.status === "found" && snapshot.detection.gamePath
			? `当前检测到：${snapshot.detection.gamePath}`
			: snapshot.detection.message

	return (
		<div className={styles.page}>
			<div className={styles.content}>
				<header className={styles.header}>
					<div className={styles.eyebrow}>L4D2 MANAGER</div>
					<h1>设置</h1>
					<p>管理应用外观和《求生之路 2》的游戏目录。</p>
				</header>

				{notice && (
					<WinInfoBar
						className={styles.notice}
						IsOpen
						Severity={notice.severity}
						Title={notice.title}
						Message={notice.message}
						IsClosable
						onUpdate:IsOpen={(open: boolean) => {
							if (!open) setNotice(null)
						}}
					/>
				)}

				<section className={styles.section}>
					<h2>外观</h2>
					<label className={styles.field}>
						<span className={styles.label}>主题</span>
						<WinComboBox
							ItemsSource={themeOptions}
							DisplayMemberPath="label"
							SelectedValuePath="value"
							SelectedValue={snapshot.settings.theme}
							IsEnabled={!busy}
							onUpdate:SelectedValue={(value) =>
								void updateSettings(
									{ theme: String(value ?? "system") as AppTheme },
									"主题已切换"
								)
							}
						/>
						<span className={styles.description}>
							跟随系统会根据 Windows 当前主题自动切换。
						</span>
					</label>
				</section>

				<section className={styles.section}>
					<h2>游戏</h2>
					<label className={styles.field}>
						<span className={styles.label}>游戏根目录</span>
						<div className={styles.pathRow}>
							<WinTextBox
								Value={gameRoot}
								PlaceholderText="留空以自动检测 Steam 游戏目录"
								ShowDeleteButton
								IsEnabled={!busy}
								onUpdate:Value={setGameRoot}
							/>
							<WinButton IsEnabled={!busy} onClick={() => void chooseGameRoot()}>
								选择目录
							</WinButton>
						</div>
						<span className={styles.description}>
							填写《求生之路 2》安装目录，例如包含 left4dead2
							文件夹的目录；留空时自动从 Steam 库中查找 AppID 550。
						</span>
					</label>
					<div
						className={styles.detection}
						data-found={snapshot.detection.status === "found"}
					>
						<span className={styles.detectionGlyph} aria-hidden="true">
							{snapshot.detection.status === "found" ? "" : ""}
						</span>
						<span>{detectionMessage}</span>
					</div>
					<WinButton
						Style="AccentButtonStyle"
						IsEnabled={!busy && rootChanged}
						onClick={() =>
							void updateSettings({ gameRoot: gameRoot.trim() }, "游戏根目录已更新")
						}
					>
						保存游戏目录
					</WinButton>
				</section>
			</div>
		</div>
	)
}
