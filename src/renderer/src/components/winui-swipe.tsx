// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { ReactNode } from "react"
import { callback, commonStyle, cssLength, cx, xamlThickness } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

type WinSwipeItemRecord = Record<string, unknown>
type WinSwipeItemsRecord = { Mode: string; Items: WinSwipeItemRecord[] }

function normalizeSwipeItems(value: unknown): WinSwipeItemsRecord | undefined {
	if (Array.isArray(value)) return { Mode: "Reveal", Items: value as WinSwipeItemRecord[] }
	if (!value || typeof value !== "object") return undefined
	const record = value as Record<string, unknown>
	const items = record.Items ?? record.items
	if (!Array.isArray(items)) return undefined
	return {
		Mode:
			String(record.Mode ?? record.mode ?? "Reveal").toLowerCase() === "execute"
				? "Execute"
				: "Reveal",
		Items: items.filter((item): item is WinSwipeItemRecord =>
			Boolean(item && typeof item === "object")
		)
	}
}

function swipeItemValue(item: WinSwipeItemRecord, key: string): unknown {
	if (item[key] !== undefined) return item[key]
	const command = item.Command
	if (command && typeof command === "object") return (command as WinSwipeItemRecord)[key]
	return undefined
}

function swipeItemText(item: WinSwipeItemRecord): string {
	return String(swipeItemValue(item, "Text") ?? swipeItemValue(item, "Label") ?? "")
}

const swipeSymbolGlyphs: Record<string, string> = {
	Accept: "\uE8FB",
	Add: "\uE710",
	Back: "\uE72B",
	Cancel: "\uE711",
	Close: "\uE711",
	Copy: "\uE8C8",
	Cut: "\uE8C6",
	Delete: "\uE74D",
	Edit: "\uE70F",
	Favorite: "\uE734",
	Flag: "\uE7C1",
	FontDecrease: "\uE8A0",
	FontIncrease: "\uE8A1",
	Forward: "\uE72A",
	OpenFile: "\uE8E5",
	Paste: "\uE77F",
	Pause: "\uE769",
	Play: "\uE768",
	Redo: "\uE7A6",
	Save: "\uE74E",
	SelectAll: "\uE8B3",
	Share: "\uE72D",
	Stop: "\uE71A",
	Undo: "\uE7A7"
}

function swipeItemIcon(item: WinSwipeItemRecord): ReactNode {
	const source = swipeItemValue(item, "IconSource") ?? swipeItemValue(item, "Icon")
	if (source && typeof source === "object") {
		const record = source as WinSwipeItemRecord
		return (record.Glyph ??
			(typeof record.Symbol === "string"
				? (swipeSymbolGlyphs[record.Symbol] ?? record.Symbol)
				: record.Symbol) ??
			record.UriSource ??
			"") as ReactNode
	}
	return (
		typeof source === "string" ? (swipeSymbolGlyphs[source] ?? source) : (source ?? "")
	) as ReactNode
}

function swipeItemIconUri(item: WinSwipeItemRecord): string | undefined {
	const source = swipeItemValue(item, "IconSource") ?? swipeItemValue(item, "Icon")
	if (source && typeof source === "object") {
		const uri = (source as WinSwipeItemRecord).UriSource
		return typeof uri === "string" ? uri : undefined
	}
	if (typeof source === "string" && /^(https?:|data:|\/|\.\.?\/)/.test(source)) return source
	return undefined
}

function swipeItemCanExecute(item: WinSwipeItemRecord): boolean {
	const command = item.Command
	if (!command || typeof command !== "object") return true
	const canExecute = (command as WinSwipeItemRecord).CanExecute
	return typeof canExecute === "function"
		? Boolean((canExecute as (parameter?: unknown) => boolean)(item.CommandParameter))
		: true
}

export interface WinSwipeControlHandle {
	Close: () => void
	Content: HTMLElement | null
	Element: HTMLElement | null
}

export const WinSwipeControl = forwardRef<
	WinSwipeControlHandle,
	WinProps & {
		LeftItems?: unknown
		RightItems?: unknown
		TopItems?: unknown
		BottomItems?: unknown
		Background?: string
		BorderBrush?: string
		BorderThickness?: string | number
		CornerRadius?: string | number
		AutomationPropertiesName?: string
	}
>(function WinSwipeControl(props, ref): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null)
	const pointerId = useRef<number | null>(null)
	const startPoint = useRef({ x: 0, y: 0 })
	const [activeSide, setActiveSide] = useState<"Left" | "Right" | "Top" | "Bottom" | null>(null)
	const [activeItems, setActiveItems] = useState<WinSwipeItemsRecord | undefined>(undefined)
	const [offset, setOffset] = useState({ x: 0, y: 0 })
	const [interacting, setInteracting] = useState(false)
	const [isOpen, setIsOpen] = useState(false)
	const openStateRef = useRef(false)
	const interactingStateRef = useRef(false)
	openStateRef.current = isOpen
	interactingStateRef.current = interacting
	const leftItems = normalizeSwipeItems(props.LeftItems)
	const rightItems = normalizeSwipeItems(props.RightItems)
	const topItems = normalizeSwipeItems(props.TopItems)
	const bottomItems = normalizeSwipeItems(props.BottomItems)
	const isValidSwipeItems = (items: WinSwipeItemsRecord | undefined) =>
		Boolean(
			items?.Items.length &&
			(String(items.Mode).toLowerCase() !== "execute" || items.Items.length === 1)
		)
	const itemsForSide = (side: "Left" | "Right" | "Top" | "Bottom") =>
		({ Left: leftItems, Right: rightItems, Top: topItems, Bottom: bottomItems })[side]
	const validItemsForSide = (side: "Left" | "Right" | "Top" | "Bottom") => {
		const items = itemsForSide(side)
		return isValidSwipeItems(items) ? items : undefined
	}
	const hasHorizontalItems = Boolean(
		isValidSwipeItems(leftItems) || isValidSwipeItems(rightItems)
	)
	const hasVerticalItems = Boolean(isValidSwipeItems(topItems) || isValidSwipeItems(bottomItems))
	const isHorizontal = activeSide === "Left" || activeSide === "Right"
	const automationName =
		typeof props["AutomationProperties.Name"] === "string"
			? String(props["AutomationProperties.Name"])
			: typeof props.AutomationPropertiesName === "string"
				? props.AutomationPropertiesName
				: undefined
	const mode = activeItems?.Mode ?? "Reveal"
	const revealExtent = activeItems
		? mode === "Execute"
			? isHorizontal
				? (rootRef.current?.clientWidth ?? 0)
				: (rootRef.current?.clientHeight ?? 0)
			: activeItems.Items.length * (isHorizontal ? 68 : 60)
		: 0
	const openThreshold = Math.min(Math.max(revealExtent, 0), 100)
	const setClosed = () => {
		setIsOpen(false)
		setInteracting(false)
		setOffset({ x: 0, y: 0 })
		window.setTimeout(() => {
			if (!openStateRef.current && !interactingStateRef.current) {
				setActiveSide(null)
				setActiveItems(undefined)
			}
		}, 200)
	}
	const setOpened = () => {
		if (!activeSide || !activeItems) return
		const value = activeSide === "Left" || activeSide === "Top" ? revealExtent : -revealExtent
		setOffset(
			activeSide === "Left" || activeSide === "Right"
				? { x: value, y: 0 }
				: { x: 0, y: value }
		)
		setIsOpen(true)
		setInteracting(false)
	}
	useImperativeHandle(
		ref,
		() => ({
			Close: setClosed,
			get Content() {
				return rootRef.current?.querySelector<HTMLElement>(".swipe-control-content") ?? null
			},
			get Element() {
				return rootRef.current
			}
		}),
		[isOpen, interacting, activeSide, activeItems]
	)
	const executeItem = (item: WinSwipeItemRecord) => {
		if (typeof item.Invoked === "function")
			(item.Invoked as (sender: WinSwipeItemRecord, args: unknown) => void)(item, {
				SwipeControl: {
					Close: setClosed,
					Content: rootRef.current,
					Element: rootRef.current
				}
			})
		const command = item.Command
		if (command && typeof command === "object") {
			const record = command as WinSwipeItemRecord
			if (
				typeof record.CanExecute === "function" &&
				!(record.CanExecute as (parameter?: unknown) => boolean)(item.CommandParameter)
			)
				return
			if (typeof record.Execute === "function")
				(record.Execute as (parameter?: unknown) => void)(item.CommandParameter)
		}
		if (typeof item.onClick === "function") (item.onClick as () => void)()
		if (String(item.BehaviorOnInvoked ?? "Auto") !== "RemainOpen") setClosed()
		else setOpened()
	}
	const beginSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== "touch" || event.button !== 0) return
		if (hasHorizontalItems && hasVerticalItems) return
		if (isOpen) {
			setClosed()
			event.preventDefault()
			return
		}
		pointerId.current = event.pointerId
		startPoint.current = { x: event.clientX, y: event.clientY }
		setInteracting(true)
		rootRef.current?.setPointerCapture(event.pointerId)
	}
	const moveSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
		if (pointerId.current !== event.pointerId) return
		const deltaX = event.clientX - startPoint.current.x
		const deltaY = event.clientY - startPoint.current.y
		let side = activeSide
		let currentItems = activeItems
		if (!side) {
			if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10) return
			const horizontal = Math.abs(deltaX) >= Math.abs(deltaY)
			const candidate = horizontal
				? deltaX > 0
					? "Left"
					: "Right"
				: deltaY > 0
					? "Top"
					: "Bottom"
			if (!validItemsForSide(candidate)) {
				setInteracting(false)
				return
			}
			side = candidate
			currentItems = validItemsForSide(candidate)
			setActiveSide(candidate)
		}
		if (!side || !currentItems) return
		if (!activeItems) setActiveItems(currentItems)
		const horizontal = side === "Left" || side === "Right"
		const currentMode = currentItems.Mode ?? "Reveal"
		const currentExtent =
			currentMode === "Execute"
				? horizontal
					? (rootRef.current?.clientWidth ?? 0)
					: (rootRef.current?.clientHeight ?? 0)
				: currentItems.Items.length * (horizontal ? 68 : 60)
		const raw = side === "Left" || side === "Right" ? deltaX : deltaY
		const signed = side === "Left" || side === "Top" ? Math.max(0, raw) : Math.min(0, raw)
		const limit = Math.max(currentExtent, 1)
		const clamped =
			side === "Left" || side === "Top" ? Math.min(limit, signed) : Math.max(-limit, signed)
		setOffset(side === "Left" || side === "Right" ? { x: clamped, y: 0 } : { x: 0, y: clamped })
		event.preventDefault()
	}
	const endSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
		if (pointerId.current !== event.pointerId) return
		pointerId.current = null
		if (rootRef.current?.hasPointerCapture(event.pointerId))
			rootRef.current.releasePointerCapture(event.pointerId)
		if (activeItems && thresholdReached && mode === "Execute") {
			executeItem(activeItems.Items[0])
		} else if (activeItems && thresholdReached) {
			setOpened()
		} else {
			setClosed()
		}
	}
	const cancelSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
		if (pointerId.current !== event.pointerId) return
		pointerId.current = null
		if (rootRef.current?.hasPointerCapture(event.pointerId))
			rootRef.current.releasePointerCapture(event.pointerId)
		setClosed()
	}
	useEffect(() => {
		if (!isOpen) return undefined
		const onOutsidePointer = (event: globalThis.PointerEvent) => {
			if (event.target instanceof Node && !rootRef.current?.contains(event.target))
				setClosed()
		}
		document.addEventListener("pointerdown", onOutsidePointer, true)
		return () => document.removeEventListener("pointerdown", onOutsidePointer, true)
	}, [isOpen, activeItems, offset, interacting])
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const contentStyle: WinStyle = {
		transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
		padding: xamlThickness(props.Padding),
		background: props.Background as string | undefined,
		borderColor: props.BorderBrush as string | undefined,
		borderWidth: xamlThickness(props.BorderThickness),
		borderStyle: props.BorderBrush ? "solid" : undefined,
		borderRadius: cssLength(props.CornerRadius)
	}
	const currentAmount = Math.abs(isHorizontal ? offset.x : offset.y)
	const thresholdReached =
		activeItems !== undefined && currentAmount > Math.max(0, openThreshold - 1)
	const underlayStyle: WinStyle = {
		clipPath: (() => {
			const width = rootRef.current?.clientWidth ?? 0
			const height = rootRef.current?.clientHeight ?? 0
			const amount = Math.max(0, Math.abs(isHorizontal ? offset.x : offset.y))
			if (activeSide === "Left") return `inset(0 ${Math.max(0, width - amount)}px 0 0)`
			if (activeSide === "Right") return `inset(0 0 0 ${Math.max(0, width - amount)}px)`
			if (activeSide === "Top") return `inset(0 0 ${Math.max(0, height - amount)}px 0)`
			return `inset(${Math.max(0, height - amount)}px 0 0 0)`
		})(),
		background: "var(--SwipeItemBackground, var(--ctrl-fill-tertiary))",
		transition: interacting ? "none" : "clip-path 200ms cubic-bezier(0, 0, 0, 1)",
		width: "100%",
		height: "100%"
	}
	const panelStyle: WinStyle = {
		width: isHorizontal
			? mode === "Execute"
				? "100%"
				: `${(activeItems?.Items.length ?? 0) * 68}px`
			: "100%",
		height: isHorizontal
			? "100%"
			: mode === "Execute"
				? "100%"
				: `${(activeItems?.Items.length ?? 0) * 60}px`,
		flexDirection: isHorizontal ? "row" : "column",
		transform:
			mode === "Execute"
				? (() => {
						const width = rootRef.current?.clientWidth ?? 0
						const height = rootRef.current?.clientHeight ?? 0
						if (activeSide === "Left")
							return `translate3d(${(offset.x - width) / 2}px, 0, 0)`
						if (activeSide === "Right")
							return `translate3d(${(offset.x + width) / 2}px, 0, 0)`
						if (activeSide === "Top")
							return `translate3d(0, ${(offset.y - height) / 2}px, 0)`
						return `translate3d(0, ${(offset.y + height) / 2}px, 0)`
					})()
				: undefined,
		background:
			mode === "Execute"
				? String(
						activeItems?.Items[0]?.Background ??
							(thresholdReached
								? "var(--SwipeItemPostThresholdExecuteBackground, var(--accent-base))"
								: "var(--SwipeItemPreThresholdExecuteBackground, var(--ctrl-fill-tertiary))")
					)
				: undefined
	}
	return (
		<div
			id={typeof props.id === "string" ? props.id : undefined}
			ref={rootRef}
			className={cx(
				"win-swipe-control",
				interacting ? "interacting" : undefined,
				isOpen ? "open" : undefined,
				className,
				legacyClassName
			)}
			style={{
				...commonStyle(props),
				...(props.style as WinStyle | undefined),
				touchAction:
					hasHorizontalItems && hasVerticalItems
						? "none"
						: hasHorizontalItems
							? "pan-y"
							: hasVerticalItems
								? "pan-x"
								: "auto"
			}}
			aria-label={automationName}
			onContextMenu={(event) => {
				event.preventDefault()
				callback<unknown>(props, "onContextRequested", "ContextRequested")?.(event)
			}}
			onPointerEnter={(event) =>
				callback<unknown>(props, "onPointerEntered", "PointerEntered")?.(event)
			}
			onPointerLeave={(event) =>
				callback<unknown>(props, "onPointerExited", "PointerExited")?.(event)
			}
			onPointerDown={beginSwipe}
			onPointerMove={moveSwipe}
			onPointerUp={endSwipe}
			onPointerCancel={cancelSwipe}
			onLostPointerCapture={cancelSwipe}
		>
			{activeItems && activeSide && (
				<div
					className={cx(
						"swipe-content-root",
						`side-${activeSide.toLowerCase()}`,
						`mode-${mode.toLowerCase()}`
					)}
					style={underlayStyle}
				>
					<div className="swipe-items-panel" style={panelStyle}>
						{activeItems.Items.map((item, index) => (
							<button
								key={`${index}-${swipeItemText(item)}`}
								type="button"
								className="swipe-item"
								style={{
									background:
										mode === "Execute"
											? "transparent"
											: String(
													item.Background ??
														"var(--SwipeItemBackground, var(--ctrl-fill-tertiary))"
												),
									color: String(
										item.Foreground ??
											(mode === "Execute"
												? thresholdReached
													? "var(--SwipeItemPostThresholdExecuteForeground, var(--accent-text))"
													: "var(--SwipeItemPreThresholdExecuteForeground, var(--ctrl-strong-fill))"
												: "var(--SwipeItemForeground, var(--text-primary))")
									)
								}}
								aria-label={swipeItemText(item) || automationName}
								disabled={!swipeItemCanExecute(item)}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={(event) => {
									event.stopPropagation()
									executeItem(item)
								}}
							>
								<span className="swipe-item-content">
									{swipeItemIconUri(item) ? (
										<span
											className="swipe-item-bitmap"
											style={
												{
													"--swipe-item-bitmap-source": `url("${swipeItemIconUri(item)}")`
												} as WinStyle
											}
											aria-hidden="true"
										/>
									) : swipeItemIcon(item) ? (
										<span className="swipe-item-icon" aria-hidden="true">
											{swipeItemIcon(item)}
										</span>
									) : null}
									{swipeItemText(item) ? (
										<span className="swipe-item-text">
											{swipeItemText(item)}
										</span>
									) : null}
								</span>
							</button>
						))}
					</div>
				</div>
			)}
			<div className="swipe-control-content" style={contentStyle}>
				{(props.children as ReactNode) ?? (props.Content as ReactNode)}
			</div>
		</div>
	)
})
