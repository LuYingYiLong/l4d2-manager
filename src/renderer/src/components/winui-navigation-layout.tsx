// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinMenuFlyout } from "./winui-menu-flyout"
import type { WinMenuItem } from "./winui-menu-flyout"
import { WinScrollViewer } from "./winui-scrolling"
import {
	callback,
	commonStyle,
	cssLength,
	cx,
	domProps,
	itemLabel,
	itemRecord,
	itemsOf,
	useControllable
} from "./winui-shared"
import type { WinItem, WinItemProps, WinProps, WinStyle } from "./winui-shared"

type WinSplitViewProps = WinProps & {
	IsPaneOpen?: boolean
	DisplayMode?: "Inline" | "CompactInline" | "Overlay" | "CompactOverlay" | string
	PanePlacement?: "Left" | "Right" | string
	OpenPaneLength?: number
	CompactPaneLength?: number
	PaneBackground?: string
	IsTabStop?: boolean
	isPaneOpen?: boolean
	displayMode?: string
	placement?: string
	openPaneLength?: number
	compactPaneLength?: number
	paneBackground?: string
}

export function WinSplitView(props: WinSplitViewProps): React.JSX.Element {
	const displayMode = props.DisplayMode ?? props.displayMode ?? "Inline"
	const placement = props.PanePlacement ?? props.placement ?? "Left"
	const openLength = props.OpenPaneLength ?? props.openPaneLength ?? 256
	const compactLength = props.CompactPaneLength ?? props.compactPaneLength ?? 48
	const externalOpen = props.IsPaneOpen ?? props.isPaneOpen
	const [paneOpen, setPaneOpen] = useControllable(externalOpen, true, (value) =>
		callback<boolean>(
			props,
			"onValueChange",
			"onUpdate:IsPaneOpen",
			"onUpdate:isPaneOpen"
		)?.(value)
	)
	const isCompactMode = displayMode === "CompactInline" || displayMode === "CompactOverlay"
	const isOverlayMode = displayMode === "Overlay" || displayMode === "CompactOverlay"
	const displayModeClass =
		(
			{
				Inline: "mode-inline",
				CompactInline: "mode-compact-inline",
				Overlay: "mode-overlay",
				CompactOverlay: "mode-compact-overlay"
			} as Record<string, string>
		)[displayMode] ?? "mode-inline"
	const paneWidth = paneOpen ? openLength : isCompactMode ? compactLength : 0
	const paneStyle: WinStyle = {
		width: cssLength(paneWidth),
		background: props.PaneBackground ?? props.paneBackground
	}
	const closeOverlay = () => {
		if (paneOpen && isOverlayMode) setPaneOpen(false)
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-split-view",
				displayModeClass,
				placement === "Right" ? "placement-right" : "placement-left",
				paneOpen ? "is-open" : undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
			onClick={closeOverlay}
		>
			<aside
				className="split-view-pane"
				style={paneStyle}
				onClick={(event) => event.stopPropagation()}
			>
				<div className="split-view-pane-inner" style={{ width: cssLength(openLength) }}>
					{props.Pane ?? (props["pane"] as ReactNode | undefined)}
				</div>
			</aside>
			<div className="split-view-content-host" onClick={closeOverlay}>
				<WinScrollViewer
					className="split-view-content"
					VerticalScrollMode="Auto"
					VerticalScrollBarVisibility="Auto"
					HorizontalScrollMode="Disabled"
					HorizontalScrollBarVisibility="Disabled"
					IsTabStop={props.IsTabStop}
				>
					{props.children ?? props.Content}
				</WinScrollViewer>
			</div>
		</div>
	)
}
type WinBreadcrumbProps = WinItemProps & {
	FlowDirection?: "LeftToRight" | "RightToLeft" | string
	IsEnabled?: boolean
}

export function WinBreadcrumbBar(props: WinBreadcrumbProps): React.JSX.Element {
	const items = itemsOf(props)
	const rootRef = useRef<HTMLElement>(null)
	const ellipsisRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<Array<HTMLDivElement | null>>([])
	const [firstRenderedIndex, setFirstRenderedIndex] = useState(0)
	const [ellipsisRendered, setEllipsisRendered] = useState(false)
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
	const [flyoutOpen, setFlyoutOpen] = useState(false)
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
	const [inheritedDirection, setInheritedDirection] = useState<"ltr" | "rtl">("ltr")
	const isEnabled = props.IsEnabled !== false
	const direction =
		props.FlowDirection === "RightToLeft"
			? "rtl"
			: props.FlowDirection === "LeftToRight"
				? "ltr"
				: inheritedDirection
	const forwardKey = direction === "rtl" ? "ArrowLeft" : "ArrowRight"
	const backwardKey = direction === "rtl" ? "ArrowRight" : "ArrowLeft"
	const hiddenItems = items
		.slice(0, firstRenderedIndex)
		.map((item, index) => ({ item, index }))
		.reverse()
	const isItemEnabled = (item: WinItem) => isEnabled && itemRecord(item).IsEnabled !== false
	const itemKey = (item: WinItem, index: number) => {
		const record = itemRecord(item)
		return String(record.Key ?? record.Id ?? record.id ?? `${index}-${String(itemLabel(item))}`)
	}
	const getTabIndex = (index: number) => {
		const defaultIndex = ellipsisRendered ? -1 : items.findIndex((item) => isItemEnabled(item))
		const effective = focusedIndex ?? defaultIndex
		return effective === index ? 0 : -1
	}
	const focusIndex = (index: number) => {
		setFocusedIndex(index)
		requestAnimationFrame(() => {
			if (index === -1) ellipsisRef.current?.querySelector("button")?.focus()
			else
				(
					itemRefs.current[index]?.querySelector(
						"button, [role=button]"
					) as HTMLElement | null
				)?.focus()
		})
	}
	const raiseItemClicked = (item: WinItem) => {
		if (!isItemEnabled(item)) return
		callback<WinItem>(props, "onItemClicked", "ItemClicked")?.(item)
	}
	const focusableIndices = () => {
		const result: number[] = []
		if (isEnabled && ellipsisRendered) result.push(-1)
		for (let index = firstRenderedIndex; index < items.length; index += 1) {
			if (isItemEnabled(items[index])) result.push(index)
		}
		return result
	}
	const handleItemKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
		if ((event.key === "Enter" || event.key === " ") && index === items.length - 1) {
			event.preventDefault()
			raiseItemClicked(items[index])
			return
		}
		if (event.key !== forwardKey && event.key !== backwardKey) return
		const focusable = focusableIndices()
		const currentPosition = focusable.indexOf(index)
		if (currentPosition < 0) return
		const nextPosition = currentPosition + (event.key === forwardKey ? 1 : -1)
		if (nextPosition < 0 || nextPosition >= focusable.length) return
		event.preventDefault()
		focusIndex(focusable[nextPosition])
	}
	const measure = () => {
		const root = rootRef.current
		if (!root || !items.length) {
			setEllipsisRendered(false)
			setFirstRenderedIndex(0)
			return
		}
		setInheritedDirection(getComputedStyle(root).direction === "rtl" ? "rtl" : "ltr")
		const widths = items.map(
			(_, index) => itemRefs.current[index]?.getBoundingClientRect().width ?? 0
		)
		const totalWidth = widths.reduce((total, width) => total + width, 0)
		if (totalWidth <= root.clientWidth) {
			setEllipsisRendered(false)
			setFirstRenderedIndex(0)
			return
		}
		const ellipsisWidth = ellipsisRef.current?.getBoundingClientRect().width ?? 0
		let firstIndex = items.length - 1
		let occupied = (widths[firstIndex] ?? 0) + ellipsisWidth
		for (let index = items.length - 2; index >= 0; index -= 1) {
			const nextWidth = occupied + (widths[index] ?? 0)
			if (nextWidth > root.clientWidth) break
			occupied = nextWidth
			firstIndex = index
		}
		setEllipsisRendered(true)
		setFirstRenderedIndex(firstIndex)
		if (focusedIndex !== -1 && focusedIndex !== null && focusedIndex < firstIndex)
			setFocusedIndex(-1)
	}
	useEffect(() => {
		let frame = 0
		const requestMeasure = () => {
			if (frame) cancelAnimationFrame(frame)
			frame = requestAnimationFrame(measure)
		}
		requestMeasure()
		const observer =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(requestMeasure) : undefined
		if (rootRef.current) observer?.observe(rootRef.current)
		itemRefs.current.forEach((element) => element && observer?.observe(element))
		document.fonts?.ready.then(requestMeasure)
		return () => {
			if (frame) cancelAnimationFrame(frame)
			observer?.disconnect()
		}
	}, [items, props.ItemTemplate])
	const openFlyout = () => {
		if (!isEnabled || !ellipsisRendered || !hiddenItems.length) return
		const button = ellipsisRef.current?.querySelector("button")
		if (!button) return
		setAnchorRect(button.getBoundingClientRect())
		setFlyoutOpen(true)
	}
	const menuItems = hiddenItems.map(({ item, index }) => ({
		Text: itemLabel(item),
		BreadcrumbItem: item,
		IsEnabled: isItemEnabled(item),
		Key: itemKey(item, index)
	}))
	return (
		<>
			<nav
				ref={rootRef}
				id={typeof props.id === "string" ? props.id : undefined}
				className={cx(
					"win-breadcrumb-bar",
					props.className,
					props.class,
					!isEnabled ? "disabled" : undefined
				)}
				role="navigation"
				aria-disabled={isEnabled ? undefined : true}
				dir={direction}
				style={{ ...props.style, ...commonStyle(props) }}
			>
				<div className="win-breadcrumb-items-repeater">
					<div
						ref={ellipsisRef}
						className={cx(
							"win-breadcrumb-layout-root",
							"win-breadcrumb-ellipsis-item",
							!ellipsisRendered ? "is-crumbled" : undefined
						)}
						aria-hidden={ellipsisRendered ? undefined : true}
						inert={!ellipsisRendered ? true : undefined}
					>
						<button
							type="button"
							className="win-breadcrumb-item-button win-breadcrumb-ellipsis-button"
							disabled={!isEnabled}
							tabIndex={ellipsisRendered ? getTabIndex(-1) : -1}
							aria-label="More"
							onFocus={() => setFocusedIndex(-1)}
							onClick={openFlyout}
							onKeyDown={(event) => handleItemKeyDown(event, -1)}
						>
							<span className="win-breadcrumb-ellipsis-glyph" aria-hidden="true">
								{"\uE712"}
							</span>
						</button>
						<span className="win-breadcrumb-chevron" aria-hidden="true">
							{direction === "rtl" ? "\uE973" : "\uE974"}
						</span>
					</div>
					{items.map((item, index) => {
						const crumbled = ellipsisRendered && index < firstRenderedIndex
						const current = index === items.length - 1
						return (
							<div
								key={itemKey(item, index)}
								ref={(element) => {
									itemRefs.current[index] = element
								}}
								className={cx(
									"win-breadcrumb-layout-root",
									current ? "is-current" : undefined,
									crumbled ? "is-crumbled" : undefined,
									!isItemEnabled(item) ? "is-disabled" : undefined
								)}
								aria-hidden={crumbled ? true : undefined}
								inert={crumbled ? true : undefined}
							>
								{current ? (
									<div
										className={cx(
											"win-breadcrumb-current-item",
											!isItemEnabled(item) ? "is-disabled" : undefined
										)}
										role="button"
										aria-disabled={isItemEnabled(item) ? undefined : true}
										aria-posinset={
											crumbled ? undefined : index - firstRenderedIndex + 1
										}
										aria-setsize={
											crumbled
												? undefined
												: Math.max(0, items.length - firstRenderedIndex)
										}
										tabIndex={crumbled ? -1 : getTabIndex(index)}
										onFocus={() => setFocusedIndex(index)}
										onKeyDown={(event) => handleItemKeyDown(event, index)}
									>
										{props.ItemTemplate ? (
											props.ItemTemplate(item, index)
										) : (
											<span className="win-breadcrumb-item-content">
												{itemLabel(item)}
											</span>
										)}
									</div>
								) : (
									<button
										type="button"
										className="win-breadcrumb-item-button"
										disabled={!isItemEnabled(item)}
										tabIndex={crumbled ? -1 : getTabIndex(index)}
										aria-posinset={
											crumbled ? undefined : index - firstRenderedIndex + 1
										}
										aria-setsize={
											crumbled
												? undefined
												: Math.max(0, items.length - firstRenderedIndex)
										}
										onFocus={() => setFocusedIndex(index)}
										onClick={() => raiseItemClicked(item)}
										onKeyDown={(event) => handleItemKeyDown(event, index)}
									>
										{props.ItemTemplate ? (
											props.ItemTemplate(item, index)
										) : (
											<span className="win-breadcrumb-item-content">
												{itemLabel(item)}
											</span>
										)}
									</button>
								)}
								{!current && (
									<span className="win-breadcrumb-chevron" aria-hidden="true">
										{direction === "rtl" ? "\uE973" : "\uE974"}
									</span>
								)}
							</div>
						)
					})}
				</div>
			</nav>
			<WinMenuFlyout
				IsOpen={flyoutOpen}
				AnchorRect={anchorRect}
				Items={menuItems}
				Placement="Bottom"
				MinWidth={20}
				onClose={() => setFlyoutOpen(false)}
				onSelect={(item: WinMenuItem) => {
					setFlyoutOpen(false)
					const selected = item.BreadcrumbItem as WinItem
					if (selected !== undefined) raiseItemClicked(selected)
				}}
			/>
		</>
	)
}
