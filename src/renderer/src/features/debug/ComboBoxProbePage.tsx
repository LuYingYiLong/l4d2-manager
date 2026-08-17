import { memo, useCallback, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { WinButton, WinComboBox, WinTextBlock } from "../../components/winui-components"
import type {
	WinComboBoxProbeEvent,
	WinComboBoxProbePhase
} from "../../components/winui-components"
import styles from "./ComboBoxProbePage.module.css"

const PROBE_ITEMS = [
	{ label: "Alpha" },
	{ label: "Bravo" },
	{ label: "Charlie" },
	{ label: "Delta" },
	{ label: "Echo" },
	{ label: "Foxtrot" },
	{ label: "Golf" }
]

const PHASE_LABELS: Record<WinComboBoxProbePhase, string> = {
	"pointer-down": "Pointer down",
	"pointer-up": "Pointer up",
	"pointer-cancel": "Pointer cancel",
	click: "Click",
	"open-request": "Open request",
	"open-state": "Open state",
	"position-request": "Position requested",
	"position-run": "Position running",
	"position-result": "Position result",
	"reveal-queued": "Reveal queued",
	"reveal-frame": "Reveal frame",
	"reveal-start": "Reveal start",
	"reveal-sample": "Reveal sample",
	"reveal-finish": "Reveal finish",
	"reveal-cancel": "Reveal cancel",
	"reveal-skipped": "Reveal skipped"
}

type ProbeHarnessProps = {
	hostRef: RefObject<HTMLDivElement | null>
	onProbe: (event: WinComboBoxProbeEvent) => void
}

const ProbeHarness = memo(function ProbeHarness({
	hostRef,
	onProbe
}: ProbeHarnessProps): React.JSX.Element {
	return (
		<section ref={hostRef} className={styles.stage} aria-label="ComboBox probe stage">
			<WinTextBlock className={styles.stageTitle} Text="被测 ComboBox" />
			<WinTextBlock
				className={styles.stageHint}
				Text="请按住控件约 200–500 ms 后松开，也可以使用右侧自动手势。"
			/>
			<WinComboBox
				Width={320}
				Header="动画探针"
				ItemsSource={PROBE_ITEMS}
				DisplayMemberPath="label"
				SelectedIndex={2}
				DebugProbe={onProbe}
			/>
		</section>
	)
})

const wait = (duration: number): Promise<void> =>
	new Promise<void>((resolve) => window.setTimeout(resolve, duration))

const dispatchPointer = (target: HTMLElement, type: "pointerdown" | "pointerup"): void => {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
			buttons: type === "pointerdown" ? 1 : 0,
			isPrimary: true
		})
	)
}

const detailText = (event: WinComboBoxProbeEvent): string =>
	Object.entries(event.detail ?? {})
		.map(([key, value]) => `${key}=${String(value)}`)
		.join(" · ")

export default function ComboBoxProbePage({ onExit }: { onExit: () => void }): React.JSX.Element {
	const hostRef = useRef<HTMLDivElement>(null)
	const [events, setEvents] = useState<WinComboBoxProbeEvent[]>([])
	const [running, setRunning] = useState(false)
	const onProbe = useCallback((event: WinComboBoxProbeEvent) => {
		setEvents((current) => [...current.slice(-199), event])
	}, [])
	const summary = useMemo(() => {
		const openCycles = new Set(
			events
				.filter((event) => event.phase === "open-state" && event.detail?.value === true)
				.map((event) => event.cycle)
		)
		const startsByCycle = new Map<number, number>()
		for (const event of events) {
			if (event.phase !== "reveal-start") continue
			startsByCycle.set(event.cycle, (startsByCycle.get(event.cycle) ?? 0) + 1)
		}
		return {
			openCount: openCycles.size,
			startCount: events.filter((event) => event.phase === "reveal-start").length,
			finishCount: events.filter((event) => event.phase === "reveal-finish").length,
			cancelCount: events.filter((event) => event.phase === "reveal-cancel").length,
			timelineIssueCount: events.filter(
				(event) =>
					event.phase === "reveal-sample" &&
					(event.detail?.timeWentBackwards === true ||
						Number(event.detail?.animationCount ?? 0) > 1)
			).length,
			duplicateCycles: [...startsByCycle.entries()]
				.filter(([, count]) => count > 1)
				.map(([cycle]) => cycle)
		}
	}, [events])
	const runGesture = async (holdDuration: number): Promise<void> => {
		if (running) return
		const target = hostRef.current?.querySelector<HTMLElement>("[role='combobox']")
		if (!target) return
		setRunning(true)
		setEvents([])
		try {
			if (target.getAttribute("aria-expanded") === "true") {
				target.click()
				await wait(160)
			}
			dispatchPointer(target, "pointerdown")
			await wait(holdDuration)
			dispatchPointer(target, "pointerup")
			target.click()
			await wait(1100)
		} finally {
			setRunning(false)
		}
	}
	const baseElapsed = events[0]?.elapsed ?? 0
	const duplicateDetected = summary.duplicateCycles.length > 0

	return (
		<main className={`${styles.page} win-theme-scope`}>
			<header className={styles.header}>
				<div>
					<h1>ComboBox 动画探针</h1>
					<p>开发场景：隔离输入、定位与 Web Animation 生命周期。</p>
				</div>
				<WinButton Content="返回管理器" onClick={onExit} />
			</header>

			<div className={styles.workspace}>
				<ProbeHarness hostRef={hostRef} onProbe={onProbe} />

				<aside className={styles.controls}>
					<h2>复现手势</h2>
					<div className={styles.buttonRow}>
						<WinButton
							Content="自动瞬时点击"
							IsEnabled={!running}
							onClick={() => void runGesture(0)}
						/>
						<WinButton
							Content="自动长按 300 ms"
							IsEnabled={!running}
							onClick={() => void runGesture(300)}
						/>
						<WinButton
							Content="清空记录"
							IsEnabled={!running}
							onClick={() => setEvents([])}
						/>
					</div>
					<p className={styles.explanation}>
						自动手势会依次派发 pointerdown、等待、pointerup 和
						click；手动长按仍是判断浏览器原生事件竞态的主要依据。
					</p>
				</aside>
			</div>

			<section className={styles.summary} aria-label="Probe summary">
				<div>
					<span>打开周期</span>
					<strong>{summary.openCount}</strong>
				</div>
				<div>
					<span>动画开始</span>
					<strong>{summary.startCount}</strong>
				</div>
				<div>
					<span>正常结束</span>
					<strong>{summary.finishCount}</strong>
				</div>
				<div>
					<span>被取消</span>
					<strong>{summary.cancelCount}</strong>
				</div>
				<div className={summary.timelineIssueCount > 0 ? styles.failed : undefined}>
					<span>时间轴异常</span>
					<strong>{summary.timelineIssueCount}</strong>
				</div>
				<div className={duplicateDetected ? styles.failed : styles.passed}>
					<span>入口判定</span>
					<strong>
						{duplicateDetected
							? `重复：周期 ${summary.duplicateCycles.join(", ")}`
							: summary.startCount > 0
								? "每周期一次"
								: "等待测试"}
					</strong>
				</div>
			</section>

			<section className={styles.logSection}>
				<div className={styles.logHeader}>
					<h2>事件时间线</h2>
					<span>{events.length} 条记录</span>
				</div>
				<div className={styles.tableViewport}>
					<table>
						<thead>
							<tr>
								<th>#</th>
								<th>相对时间</th>
								<th>周期</th>
								<th>阶段</th>
								<th>状态</th>
								<th>详情</th>
							</tr>
						</thead>
						<tbody>
							{events.length === 0 ? (
								<tr>
									<td colSpan={6} className={styles.emptyLog}>
										尚无事件，请操作上方 ComboBox。
									</td>
								</tr>
							) : (
								events.map((event) => (
									<tr key={event.sequence}>
										<td>{event.sequence}</td>
										<td>{(event.elapsed - baseElapsed).toFixed(1)} ms</td>
										<td>{event.cycle}</td>
										<td>{PHASE_LABELS[event.phase]}</td>
										<td>
											{event.open ? "open" : "closed"} /{" "}
											{event.flyoutReady ? "ready" : "waiting"}
										</td>
										<td>{detailText(event)}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>
		</main>
	)
}
