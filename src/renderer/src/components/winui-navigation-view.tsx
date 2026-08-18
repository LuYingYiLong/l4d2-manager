// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinScrollViewer } from "./winui-scrolling"
import { callback, commonStyle, cssLength, cx, domProps, itemLabel, itemsOf } from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinStyle, WinValue } from "./winui-shared"

type WinNavigationDisplayMode = "Auto" | "Left" | "LeftCompact" | "LeftMinimal" | "Top"
type PaneTransition = "opening" | "closing" | null

type WinNavigationProps = WinItemProps &
	WinChangeProps<WinValue> & {
		MenuItems?: WinItem[]
		MenuItemsSource?: WinItem[]
		FooterMenuItems?: WinItem[]
		FooterMenuItemsSource?: WinItem[]
		SelectedItem?: WinItem
		SelectedIndex?: number
		PaneDisplayMode?: WinNavigationDisplayMode
		IsPaneOpen?: boolean
		IsPaneVisible?: boolean
		IsPaneToggleButtonVisible?: boolean
		IsSettingsVisible?: boolean
		IsBackButtonVisible?: "Auto" | "Visible" | "Collapsed"
		IsBackEnabled?: boolean
		OpenPaneLength?: number
		CompactPaneLength?: number
		CompactModeThresholdWidth?: number
		ExpandedModeThresholdWidth?: number
		PaneTitle?: ReactNode
		AlwaysShowHeader?: boolean
		SelectionFollowsFocus?: "Enabled" | "Disabled" | string
		SettingsLabel?: ReactNode
		SettingsIcon?: ReactNode
		PaneHeader?: ReactNode
		PaneFooter?: ReactNode
		PaneCustomContent?: ReactNode
		AutoSuggestBox?: ReactNode
		ContentOverlay?: ReactNode
	}

function navigationRecord(item: WinItem): Record<string, unknown> {
	return typeof item === "object" && item !== null ? item : {}
}

function navigationChildren(item: WinItem): WinItem[] {
	const record = navigationRecord(item)
	const children = record.MenuItems ?? record.children
	return Array.isArray(children) ? (children as WinItem[]) : []
}

function navigationLabel(item: WinItem): ReactNode {
	if (typeof item !== "object" || item === null) return item
	const record = navigationRecord(item)
	return (record.Content ??
		record.Name ??
		record.Text ??
		record.label ??
		record.Title ??
		"") as ReactNode
}

function navigationIcon(item: WinItem): ReactNode {
	const record = navigationRecord(item)
	return (record.Icon ?? record.Glyph ?? record.icon ?? "") as ReactNode
}

function navigationItemValue(item: WinItem, index: number, prefix: string): string {
	if (typeof item !== "object" || item === null) return String(item)
	const record = navigationRecord(item)
	return String(
		record.Value ??
			record.value ??
			record.Tag ??
			record.tag ??
			record.Key ??
			record.Name ??
			record.Id ??
			`${prefix}-${index}`
	)
}

function isNavigationItemEnabled(item: WinItem): boolean {
	const record = navigationRecord(item)
	return record.IsEnabled !== false && record.isEnabled !== false
}

export function WinNavigationView(props: WinNavigationProps): React.JSX.Element {
	const menuItems =
		props.MenuItems && props.MenuItems.length > 0
			? props.MenuItems
			: (props.MenuItemsSource ?? itemsOf(props))
	const footerItems =
		props.FooterMenuItems && props.FooterMenuItems.length > 0
			? props.FooterMenuItems
			: (props.FooterMenuItemsSource ?? [])
	const shellRef = useRef<HTMLDivElement>(null)
	const topMenuRef = useRef<HTMLDivElement>(null)
	const topMeasureRef = useRef<HTMLDivElement>(null)
	const moreButtonRef = useRef<HTMLButtonElement>(null)
	const morePanelRef = useRef<HTMLDivElement>(null)
	const navItemRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const groupChildrenRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const indicatorTrackRef = useRef<HTMLDivElement>(null)
	const indicatorRef = useRef<HTMLDivElement>(null)
	const indicatorAnimationRef = useRef<Animation | null>(null)
	const indicatorStyleRef = useRef<WinStyle>({ opacity: 0 })
	const indicatorAxisRef = useRef<"x" | "y">("y")
	const [shellWidth, setShellWidth] = useState(0)
	const [internalSelected, setInternalSelected] = useState<WinItem | null>(() => {
		if (props.SelectedItem !== undefined) return props.SelectedItem
		if (props.SelectedIndex !== undefined && props.SelectedIndex >= 0) {
			return menuItems[props.SelectedIndex] ?? null
		}
		return null
	})
	const [internalPaneOpen, setInternalPaneOpen] = useState(true)
	const [paneTransition, setPaneTransition] = useState<PaneTransition>(null)
	const [hamburgerAnimation, setHamburgerAnimation] = useState("")
	const [autoPaneOverride, setAutoPaneOverride] = useState<boolean | null>(null)
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
	const [groupHeights, setGroupHeights] = useState<Record<string, number>>({})
	const [topVisibleCount, setTopVisibleCount] = useState(menuItems.length)
	const [topItemWidths, setTopItemWidths] = useState<Record<string, number>>({})
	const [topMoreButtonWidth, setTopMoreButtonWidth] = useState(40)
	const [moreOpen, setMoreOpen] = useState(false)
	const [indicatorStyle, setIndicatorStyle] = useState<WinStyle>({ opacity: 0 })
	const [indicatorIsChild, setIndicatorIsChild] = useState(false)
	const previousResponsiveMode = useRef<string | undefined>(undefined)
	const paneTransitionTarget = useRef<boolean | null>(null)
	const paneTransitionTimer = useRef<number | undefined>(undefined)
	const hamburgerPressed = useRef(false)
	const hamburgerPressDone = useRef(false)
	const selectedItem =
		props.SelectedItem ??
		(props.SelectedIndex !== undefined && props.SelectedIndex >= 0
			? (menuItems[props.SelectedIndex] ?? null)
			: props.value !== undefined && typeof props.value === "number"
				? (menuItems[props.value] ?? null)
				: internalSelected)
	const displayMode = props.PaneDisplayMode ?? "Auto"
	const responsiveMode =
		displayMode === "Auto"
			? shellWidth >= (props.ExpandedModeThresholdWidth ?? 1008)
				? "Left"
				: shellWidth >= (props.CompactModeThresholdWidth ?? 641)
					? "LeftCompact"
					: "LeftMinimal"
			: displayMode
	const isTopNavigation = responsiveMode === "Top"
	const isCompactMode = responsiveMode === "LeftCompact" || responsiveMode === "LeftMinimal"
	const isPaneOpen =
		props.IsPaneOpen ??
		(displayMode === "Auto"
			? (autoPaneOverride ?? responsiveMode === "Left")
			: internalPaneOpen)
	const isPaneContentVisible = isTopNavigation || !isCompactMode || isPaneOpen
	const compactItemContentVisible = isPaneContentVisible || responsiveMode === "LeftCompact"
	const previousPaneOpen = useRef(isPaneOpen)
	const renderedPaneTransition: PaneTransition =
		paneTransition ??
		(previousPaneOpen.current !== isPaneOpen ? (isPaneOpen ? "opening" : "closing") : null)

	const startPaneTransition = (nextOpen: boolean) => {
		if (isTopNavigation) return
		if (paneTransitionTimer.current !== undefined) {
			window.clearTimeout(paneTransitionTimer.current)
		}
		setPaneTransition(nextOpen ? "opening" : "closing")
		const duration = isCompactMode ? (nextOpen ? 350 : 120) : 200
		paneTransitionTimer.current = window.setTimeout(() => {
			paneTransitionTimer.current = undefined
			setPaneTransition(null)
		}, duration)
	}

	useEffect(() => {
		if (displayMode === "Auto") setAutoPaneOverride(null)
	}, [displayMode, responsiveMode])
	useEffect(() => {
		if (previousPaneOpen.current === isPaneOpen) return
		previousPaneOpen.current = isPaneOpen
		if (paneTransitionTarget.current === isPaneOpen) {
			paneTransitionTarget.current = null
			return
		}
		startPaneTransition(isPaneOpen)
	}, [isPaneOpen, responsiveMode])
	useEffect(
		() => () => {
			if (paneTransitionTimer.current !== undefined) {
				window.clearTimeout(paneTransitionTimer.current)
			}
		},
		[]
	)

	useEffect(() => {
		const element = shellRef.current
		if (!element) return
		const updateWidth = () => setShellWidth(element.getBoundingClientRect().width)
		updateWidth()
		const observer = new ResizeObserver(updateWidth)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	useEffect(() => {
		if (
			previousResponsiveMode.current !== undefined &&
			previousResponsiveMode.current !== responsiveMode
		) {
			callback<unknown>(
				props,
				"onDisplayModeChanged",
				"DisplayModeChanged"
			)?.({
				DisplayMode: responsiveMode
			})
		}
		previousResponsiveMode.current = responsiveMode
	}, [responsiveMode])

	const selectedValue = selectedItem
		? navigationItemValue(
				selectedItem,
				menuItems.findIndex((item) => Object.is(item, selectedItem)),
				"menu"
			)
		: null
	const itemIsSelected = (item: WinItem, index: number, prefix: string) => {
		if (Object.is(item, selectedItem)) return true
		return navigationItemValue(item, index, prefix) === selectedValue
	}
	const selectedRootIndex = menuItems.findIndex((item, index) => {
		if (itemIsSelected(item, index, "menu")) return true
		return navigationChildren(item).some((child, childIndex) =>
			itemIsSelected(child, childIndex, `menu-${index}-child`)
		)
	})
	const selectedChildGroupValue = (() => {
		for (let index = 0; index < menuItems.length; index += 1) {
			const item = menuItems[index]
			const children = navigationChildren(item)
			if (
				children.some((child, childIndex) =>
					itemIsSelected(child, childIndex, `menu-${index}-child`)
				)
			)
				return navigationItemValue(item, index, "menu")
		}
		return null
	})()
	useEffect(() => {
		if (!selectedChildGroupValue) return
		setExpandedGroups((current) =>
			Object.prototype.hasOwnProperty.call(current, selectedChildGroupValue)
				? current
				: { ...current, [selectedChildGroupValue]: true }
		)
	}, [selectedChildGroupValue])
	useEffect(() => {
		let frame: number | undefined
		const measureGroups = () => {
			if (frame !== undefined) cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				const nextHeights: Record<string, number> = {}
				Object.entries(groupChildrenRefs.current).forEach(([value, element]) => {
					if (element) nextHeights[value] = Math.ceil(element.scrollHeight)
				})
				setGroupHeights((current) => {
					const keys = Object.keys(nextHeights)
					if (
						keys.length === Object.keys(current).length &&
						keys.every((key) => current[key] === nextHeights[key])
					)
						return current
					return nextHeights
				})
			})
		}
		measureGroups()
		const observer =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureGroups) : undefined
		Object.values(groupChildrenRefs.current).forEach((element) => {
			if (element) observer?.observe(element)
		})
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame)
			observer?.disconnect()
		}
	}, [menuItems.length, isPaneContentVisible, expandedGroups, isCompactMode])
	useEffect(() => {
		if (!isTopNavigation) {
			setTopVisibleCount(menuItems.length)
			setTopItemWidths({})
			setMoreOpen(false)
			return
		}
		let frame: number | undefined
		const requestMeasure = () => {
			if (frame !== undefined) globalThis.cancelAnimationFrame?.(frame)
			frame = globalThis.requestAnimationFrame(() => {
				const measureRoot = topMeasureRef.current
				if (!measureRoot) return
				const nextWidths: Record<string, number> = {}
				measureRoot
					.querySelectorAll<HTMLElement>("[data-nav-measure-value]")
					.forEach((element) => {
						const value = element.dataset.navMeasureValue
						if (value)
							nextWidths[value] = Math.ceil(element.getBoundingClientRect().width)
					})
				const moreElement = measureRoot.querySelector<HTMLElement>(
					'[data-nav-measure-value="__more"]'
				)
				const nextMoreWidth = Math.ceil(moreElement?.getBoundingClientRect().width ?? 40)
				setTopItemWidths((current) => {
					const keys = Object.keys(nextWidths)
					if (
						keys.length === Object.keys(current).length &&
						keys.every((key) => current[key] === nextWidths[key])
					)
						return current
					return nextWidths
				})
				setTopMoreButtonWidth((current) =>
					current === nextMoreWidth ? current : nextMoreWidth
				)
			})
		}
		requestMeasure()
		const observer =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(requestMeasure) : undefined
		if (topMenuRef.current) observer?.observe(topMenuRef.current)
		if (topMeasureRef.current) observer?.observe(topMeasureRef.current)
		document.fonts?.ready.then(requestMeasure)
		return () => {
			if (frame !== undefined) globalThis.cancelAnimationFrame?.(frame)
			observer?.disconnect()
		}
	}, [isTopNavigation, menuItems.length, shellWidth])
	useEffect(() => {
		if (!isTopNavigation) {
			setTopVisibleCount(menuItems.length)
			return
		}
		const topBar = topMenuRef.current
		const topMenu = topBar?.querySelector<HTMLElement>(".win-navigation-top-menu")
		const availableWidth = Math.max(
			0,
			topMenu?.getBoundingClientRect().width ?? shellWidth - 16
		)
		const widthFor = (item: WinItem, index: number) =>
			topItemWidths[navigationItemValue(item, index, "top")] ?? 48
		const totalWidth = menuItems.reduce<number>(
			(total, item, index) => total + widthFor(item, index),
			0
		)
		let visibleCount = menuItems.length
		if (totalWidth > availableWidth) {
			let usedWidth = 0
			visibleCount = 0
			for (let index = 0; index < menuItems.length; index += 1) {
				const itemWidth = widthFor(menuItems[index], index)
				if (usedWidth + itemWidth + topMoreButtonWidth > availableWidth) break
				usedWidth += itemWidth
				visibleCount = index + 1
			}
		}
		if (selectedRootIndex >= 0) visibleCount = Math.max(visibleCount, selectedRootIndex + 1)
		const nextCount = Math.min(menuItems.length, visibleCount)
		setTopVisibleCount((current) => (current === nextCount ? current : nextCount))
		if (nextCount === menuItems.length) setMoreOpen(false)
	}, [
		isTopNavigation,
		menuItems.length,
		selectedRootIndex,
		shellWidth,
		topItemWidths,
		topMoreButtonWidth
	])
	useEffect(() => {
		if (!moreOpen) return undefined
		const focusFrame = requestAnimationFrame(() => {
			morePanelRef.current
				?.querySelector<HTMLElement>(
					'[data-win-nav-item="true"]:not([aria-disabled="true"])'
				)
				?.focus({ preventScroll: true })
		})
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.preventDefault()
			setMoreOpen(false)
			requestAnimationFrame(() => moreButtonRef.current?.focus({ preventScroll: true }))
		}
		const onPointerDown = (event: globalThis.PointerEvent) => {
			const target = event.target
			if (
				target instanceof Node &&
				(morePanelRef.current?.contains(target) || moreButtonRef.current?.contains(target))
			)
				return
			setMoreOpen(false)
		}
		document.addEventListener("keydown", onKeyDown, true)
		document.addEventListener("pointerdown", onPointerDown, true)
		return () => {
			cancelAnimationFrame(focusFrame)
			document.removeEventListener("keydown", onKeyDown, true)
			document.removeEventListener("pointerdown", onPointerDown, true)
		}
	}, [moreOpen])
	const onHamburgerPointerDown = () => {
		hamburgerPressed.current = true
		hamburgerPressDone.current = false
		setHamburgerAnimation("pressing")
	}
	const onHamburgerPointerUp = () => {
		if (!hamburgerPressed.current) return
		hamburgerPressed.current = false
		if (hamburgerPressDone.current) setHamburgerAnimation("releasing")
	}
	const onHamburgerPointerLeave = () => {
		if (!hamburgerPressed.current) return
		hamburgerPressed.current = false
		if (hamburgerPressDone.current) setHamburgerAnimation("releasing")
	}
	const onHamburgerAnimationEnd = (event: React.AnimationEvent<HTMLSpanElement>) => {
		if (event.animationName === "hamburger-press" && hamburgerAnimation === "pressing") {
			hamburgerPressDone.current = true
			if (!hamburgerPressed.current) setHamburgerAnimation("releasing")
			return
		}
		if (event.animationName === "hamburger-release" && hamburgerAnimation === "releasing") {
			hamburgerPressDone.current = false
			setHamburgerAnimation("")
		}
	}
	const setPaneOpen = (next: boolean) => {
		if (next === isPaneOpen) return
		paneTransitionTarget.current = next
		startPaneTransition(next)
		if (props.IsPaneOpen === undefined) {
			if (displayMode === "Auto") setAutoPaneOverride(next)
			else setInternalPaneOpen(next)
		}
		callback<unknown>(
			props,
			next ? "onPaneOpening" : "onPaneClosing",
			next ? "PaneOpening" : "PaneClosing"
		)?.({})
		callback<boolean>(props, "onUpdate:IsPaneOpen")?.(next)
		callback<unknown>(
			props,
			next ? "onPaneOpened" : "onPaneClosed",
			next ? "PaneOpened" : "PaneClosed"
		)?.({})
	}
	const selectItem = (
		item: WinItem,
		index: number,
		prefix: string,
		invoke = true,
		collapsePane = true
	) => {
		if (!isNavigationItemEnabled(item)) return
		const value = navigationItemValue(item, index, prefix)
		if (props.SelectedItem === undefined && props.SelectedIndex === undefined) {
			setInternalSelected(item)
		}
		callback<WinItem>(props, "onUpdate:SelectedItem")?.(item)
		callback<number>(
			props,
			"onUpdate:SelectedIndex"
		)?.(
			menuItems.findIndex(
				(candidate, candidateIndex) =>
					navigationItemValue(candidate, candidateIndex, prefix) === value
			)
		)
		callback<WinValue>(props, "onValueChange", "onChangeValue")?.(value)
		setMoreOpen(false)
		callback<unknown>(
			props,
			"onSelectionChanged",
			"SelectionChanged"
		)?.({
			SelectedItem: item,
			SelectedItemContainer: item,
			OriginalSource: item
		})
		if (invoke) {
			callback<unknown>(
				props,
				"onItemInvoked",
				"ItemInvoked"
			)?.({
				InvokedItem: item,
				OriginalSource: item
			})
		}
		if (collapsePane && !isTopNavigation && isCompactMode && isPaneOpen) setPaneOpen(false)
	}
	const toggleGroup = (item: WinItem, index: number, prefix: string) => {
		const value = navigationItemValue(item, index, prefix)
		const nextExpanded = !(expandedGroups[value] ?? false)
		setExpandedGroups((current) => ({ ...current, [value]: nextExpanded }))
		callback<unknown>(
			props,
			nextExpanded ? "onExpanding" : "onCollapsed",
			nextExpanded ? "Expanding" : "Collapsed"
		)?.({
			ExpandingItem: nextExpanded ? item : undefined,
			CollapsedItem: nextExpanded ? undefined : item
		})
	}
	const visibleNavigationItems = () => {
		const root = shellRef.current
		if (!root) return []
		return Array.from(root.querySelectorAll<HTMLElement>('[data-win-nav-item="true"]')).filter(
			(element) =>
				element.getAttribute("aria-disabled") !== "true" &&
				!element.closest('.win-nav-group-children[aria-hidden="true"]') &&
				element.getClientRects().length > 0
		)
	}
	const focusNavigationItem = (element: HTMLElement | null | undefined) => {
		if (!element) return
		element.focus({ preventScroll: true })
		element.scrollIntoView({ block: "nearest", inline: "nearest" })
	}
	const handleNavigationFocus = (
		event: React.FocusEvent<HTMLDivElement>,
		item: WinItem,
		index: number,
		prefix: string,
		hasChildren: boolean
	) => {
		if (
			props.SelectionFollowsFocus !== "Enabled" ||
			hasChildren ||
			!event.currentTarget.matches(":focus-visible")
		)
			return
		selectItem(item, index, prefix, true, false)
	}
	const handleNavigationItemKeyDown = (
		event: React.KeyboardEvent<HTMLDivElement>,
		item: WinItem,
		index: number,
		prefix: string,
		value: string,
		hasChildren: boolean,
		parentValue?: string
	) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault()
			const elements = visibleNavigationItems()
			const current = elements.indexOf(event.currentTarget)
			if (elements.length === 0) return
			const delta = event.key === "ArrowDown" ? 1 : -1
			focusNavigationItem(elements[(current + delta + elements.length) % elements.length])
			return
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault()
			const elements = visibleNavigationItems()
			focusNavigationItem(event.key === "Home" ? elements[0] : elements[elements.length - 1])
			return
		}
		if (event.key === "ArrowRight" && hasChildren) {
			event.preventDefault()
			if (!expandedGroups[value]) toggleGroup(item, index, prefix)
			requestAnimationFrame(() => {
				const child = Array.from(
					shellRef.current?.querySelectorAll<HTMLElement>('[data-win-nav-item="true"]') ??
						[]
				).find((element) => element.getAttribute("data-nav-parent") === value)
				focusNavigationItem(child)
			})
			return
		}
		if (event.key === "ArrowLeft" && parentValue) {
			event.preventDefault()
			setExpandedGroups((current) => ({ ...current, [parentValue]: false }))
			focusNavigationItem(navItemRefs.current[parentValue])
			return
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			if (hasChildren) {
				if (!isPaneContentVisible && isCompactMode) setPaneOpen(true)
				if (navigationRecord(item).SelectsOnInvoked !== false)
					selectItem(item, index, prefix, true, false)
				toggleGroup(item, index, prefix)
			} else {
				selectItem(item, index, prefix)
			}
		}
	}
	const renderNavigationItem = (
		item: WinItem,
		index: number,
		prefix: string,
		parentValue?: string
	): ReactNode => {
		const record = navigationRecord(item)
		const value = navigationItemValue(item, index, prefix)
		const children = navigationChildren(item)
		const itemType = String(record.Type ?? record.type ?? "")
		if (itemType.toLowerCase() === "header") {
			return (
				<div key={value} className="win-nav-item-header">
					{navigationLabel(item)}
				</div>
			)
		}
		if (itemType.toLowerCase() === "separator") {
			return <div key={value} className="win-nav-item-separator" />
		}
		const selected = itemIsSelected(item, index, prefix)
		const enabled = isNavigationItemEnabled(item)
		const expanded = expandedGroups[value] ?? false
		const hasChildren = children.length > 0
		const selectOnInvoked =
			record.SelectsOnInvoked !== false && record.selectsOnInvoked !== false
		const infoBadge = record.InfoBadge as WinItem | undefined
		const automationName =
			record["AutomationProperties.Name"] ?? record.AutomationName ?? record.automationName
		const tooltip = record.ToolTip ?? record.Tooltip ?? record.tooltip
		const childSelected = children.some((child, childIndex) =>
			itemIsSelected(child, childIndex, `${value}-child`)
		)
		return (
			<div
				key={value}
				className={cx(
					"win-nav-group",
					hasChildren ? "has-children" : undefined,
					expanded ? "expanded" : undefined,
					childSelected ? "is-child-selected" : undefined
				)}
			>
				<div
					ref={(element) => {
						navItemRefs.current[value] = element
					}}
					className={cx(
						"win-nav-item",
						parentValue ? "win-nav-group-child" : undefined,
						selected && selectOnInvoked ? "is-selected" : undefined,
						!enabled ? "is-disabled" : undefined,
						isCompactMode && !compactItemContentVisible ? "icon-only" : undefined
					)}
					role={prefix === "more" ? "menuitem" : "button"}
					tabIndex={enabled ? 0 : -1}
					data-win-nav-item="true"
					data-nav-value={value}
					data-nav-parent={parentValue}
					aria-disabled={!enabled || undefined}
					aria-label={automationName ? String(automationName) : undefined}
					aria-current={selected ? "page" : undefined}
					aria-expanded={hasChildren ? expanded : undefined}
					aria-haspopup={hasChildren ? "menu" : undefined}
					title={tooltip ? String(tooltip) : undefined}
					onFocus={(event) =>
						handleNavigationFocus(event, item, index, prefix, hasChildren)
					}
					onKeyDown={(event) =>
						handleNavigationItemKeyDown(
							event,
							item,
							index,
							prefix,
							value,
							hasChildren,
							parentValue
						)
					}
					onClick={() => {
						if (hasChildren) {
							if (!isPaneContentVisible && isCompactMode) setPaneOpen(true)
							if (selectOnInvoked) selectItem(item, index, prefix, true, false)
							toggleGroup(item, index, prefix)
						} else if (selectOnInvoked) selectItem(item, index, prefix)
					}}
				>
					{navigationIcon(item) && (
						<span className="win-nav-icon">{navigationIcon(item)}</span>
					)}
					{compactItemContentVisible && (
						<span className="win-nav-label">{navigationLabel(item)}</span>
					)}
					{infoBadge && compactItemContentVisible && (
						<span className="win-nav-info-badge">{itemLabel(infoBadge)}</span>
					)}
					{hasChildren && compactItemContentVisible && (
						<span
							className={cx(
								"win-nav-group-chevron",
								expanded ? "expanded" : undefined
							)}
							aria-label={expanded ? "Collapse" : "Expand"}
							role="button"
							onClick={(event) => {
								event.stopPropagation()
								toggleGroup(item, index, prefix)
							}}
						>
							{"\uE70D"}
						</span>
					)}
				</div>
				{hasChildren && (
					<div
						className="win-nav-group-children"
						ref={(element) => {
							groupChildrenRefs.current[value] = element
						}}
						style={{
							height:
								expanded && isPaneContentVisible
									? `${groupHeights[value] ?? children.length * 38}px`
									: "0px"
						}}
						aria-hidden={!expanded || !isPaneContentVisible}
						inert={!expanded || !isPaneContentVisible ? true : undefined}
					>
						{children.map((child, childIndex) =>
							renderNavigationItem(child, childIndex, `${value}-child`, value)
						)}
					</div>
				)}
			</div>
		)
	}
	const renderItems = (items: WinItem[], prefix: string, parentValue?: string) =>
		items.map((item, index) => renderNavigationItem(item, index, prefix, parentValue))
	const makeIndicatorStretchKeyframes = (axis: "x" | "y", from: number, to: number) => {
		const distance = Math.abs(to - from)
		const edge = Math.min(from, to)
		const translate = (value: number) =>
			axis === "x" ? `translateX(${value}px)` : `translateY(${value}px)`
		const dimension = axis === "x" ? "width" : "height"
		return [
			{
				transform: translate(from),
				[dimension]: "16px",
				offset: 0,
				easing: "cubic-bezier(0.9, 0.1, 1, 0.2)"
			},
			{
				transform: translate(edge),
				[dimension]: `${distance + 16}px`,
				offset: 0.333,
				easing: "cubic-bezier(0.1, 0.9, 0.2, 1)"
			},
			{
				transform: translate(to),
				[dimension]: "16px",
				offset: 1
			}
		]
	}
	const setIndicatorRestingStyle = (next: WinStyle) => {
		const previous = indicatorStyleRef.current
		const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
		const unchanged = [...keys].every((key) => previous[key] === next[key])
		indicatorStyleRef.current = next
		if (!unchanged) setIndicatorStyle(next)
	}
	const readIndicatorTranslation = (axis: "x" | "y", fallback: number) => {
		const indicator = indicatorRef.current
		if (!indicator) return fallback
		const transform = getComputedStyle(indicator).transform
		const matrix3d = transform.match(/^matrix3d\\((.+)\\)$/)
		if (matrix3d) {
			const parts = matrix3d[1].split(",").map((value) => Number.parseFloat(value.trim()))
			const translation = axis === "x" ? parts[12] : parts[13]
			if (Number.isFinite(translation)) return translation
		}
		const matrix = transform.match(/^matrix\\((.+)\\)$/)
		if (matrix) {
			const parts = matrix[1].split(",").map((value) => Number.parseFloat(value.trim()))
			const translation = axis === "x" ? parts[4] : parts[5]
			if (Number.isFinite(translation)) return translation
		}
		const styleTransform = String(indicatorStyleRef.current.transform ?? "")
		const match = styleTransform.match(
			axis === "x" ? /translateX\\(([-\\d.]+)px\\)/ : /translateY\\(([-\\d.]+)px\\)/
		)
		return match ? Number.parseFloat(match[1]) : fallback
	}
	const syncNavigationIndicator = (animateSelectionChange = true) => {
		const root = shellRef.current
		const track = indicatorTrackRef.current
		const indicator = indicatorRef.current
		if (!root || !track || !indicator) return
		const selectedElement = Array.from(
			root.querySelectorAll<HTMLElement>('[data-win-nav-item="true"]')
		).find(
			(element) =>
				element.getAttribute("aria-current") === "page" &&
				element.getClientRects().length > 0
		)
		let target = selectedElement
		let isChild = target?.classList.contains("win-nav-group-child") ?? false
		if (isTopNavigation && isChild) {
			const group = target?.closest<HTMLElement>(".win-nav-group-children")?.parentElement
			const rootItem = group?.querySelector<HTMLElement>(
				':scope > [data-win-nav-item="true"]'
			)
			if (rootItem?.getClientRects().length) {
				target = rootItem
				isChild = false
			}
		}
		if (!target) {
			indicatorAnimationRef.current?.cancel()
			indicatorAnimationRef.current = null
			setIndicatorRestingStyle({
				...indicatorStyleRef.current,
				opacity: 0,
				transition: "none"
			})
			return
		}
		const trackRect = track.getBoundingClientRect()
		const targetRect = target.getBoundingClientRect()
		if (
			targetRect.width <= 0 ||
			targetRect.height <= 0 ||
			trackRect.width <= 0 ||
			trackRect.height <= 0
		) {
			setIndicatorRestingStyle({
				...indicatorStyleRef.current,
				opacity: 0,
				transition: "none"
			})
			return
		}
		if (!isTopNavigation) {
			const viewport = root.querySelector<HTMLElement>(
				".win-navigation-scroll-viewer .win-scroll-viewer-viewport"
			)
			if (viewport?.contains(target)) {
				const viewportRect = viewport.getBoundingClientRect()
				if (
					targetRect.bottom <= viewportRect.top ||
					targetRect.top >= viewportRect.bottom
				) {
					setIndicatorRestingStyle({
						...indicatorStyleRef.current,
						opacity: 0,
						transition: "none"
					})
					return
				}
			}
		}
		const axis = isTopNavigation ? "x" : "y"
		const nextPosition =
			axis === "x"
				? targetRect.left - trackRect.left + targetRect.width / 2 - 8
				: targetRect.top - trackRect.top + targetRect.height / 2 - 8
		const previous = indicatorStyleRef.current
		const previousVisible = Number(previous.opacity ?? 0) > 0.5
		const previousAxis = indicatorAxisRef.current
		const oldPosition =
			previousAxis === axis ? readIndicatorTranslation(axis, nextPosition) : nextPosition
		const indicatorTransition =
			typeof indicator.animate === "function"
				? "none"
				: "transform 600ms cubic-bezier(0.1, 0.9, 0.2, 1), left 200ms cubic-bezier(0.1, 0.9, 0.2, 1), width 600ms cubic-bezier(0.1, 0.9, 0.2, 1), height 600ms cubic-bezier(0.1, 0.9, 0.2, 1)"
		indicatorAnimationRef.current?.cancel()
		indicatorAnimationRef.current = null
		indicatorAxisRef.current = axis
		setIndicatorIsChild(isChild)
		const nextStyle: WinStyle =
			axis === "x"
				? {
						left: "0px",
						width: "16px",
						height: "3px",
						transform: `translateX(${nextPosition}px)`,
						opacity: 1,
						transition: indicatorTransition
					}
				: {
						left: isChild ? "36px" : "4px",
						width: "3px",
						height: "16px",
						transform: `translateY(${nextPosition}px)`,
						opacity: 1,
						transition: indicatorTransition
					}
		setIndicatorRestingStyle(nextStyle)
		const distance = Math.abs(nextPosition - oldPosition)
		if (
			!animateSelectionChange ||
			!previousVisible ||
			previousAxis !== axis ||
			distance < 1 ||
			typeof indicator.animate !== "function"
		)
			return
		const animation = indicator.animate(
			makeIndicatorStretchKeyframes(axis, oldPosition, nextPosition),
			{
				duration: 600,
				fill: "forwards"
			}
		)
		indicatorAnimationRef.current = animation
		animation.onfinish = () => {
			if (indicatorAnimationRef.current !== animation) return
			indicatorAnimationRef.current = null
			setIndicatorRestingStyle(nextStyle)
		}
	}
	useEffect(() => {
		let frame: number | undefined
		const schedule = () => {
			if (frame !== undefined) cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => syncNavigationIndicator(true))
		}
		schedule()
		const root = shellRef.current
		const track = indicatorTrackRef.current
		const resizeObserver =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : undefined
		if (root) resizeObserver?.observe(root)
		if (track) resizeObserver?.observe(track)
		const scrollTargets = root
			? Array.from(
					root.querySelectorAll<HTMLElement>(
						".win-scroll-viewer-viewport, .win-navigation-top-menu"
					)
				)
			: []
		root?.addEventListener("scroll", schedule, true)
		scrollTargets.forEach((element) => element.addEventListener("scroll", schedule, true))
		window.addEventListener("resize", schedule)
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame)
			root?.removeEventListener("scroll", schedule, true)
			scrollTargets.forEach((element) =>
				element.removeEventListener("scroll", schedule, true)
			)
			window.removeEventListener("resize", schedule)
			resizeObserver?.disconnect()
		}
	}, [
		expandedGroups,
		isPaneContentVisible,
		isPaneOpen,
		isTopNavigation,
		selectedChildGroupValue,
		selectedRootIndex,
		selectedValue,
		shellWidth,
		topItemWidths,
		topVisibleCount
	])
	const settingsItem: WinItem = {
		Value: "settings",
		Content: props.SettingsLabel ?? "Settings",
		Icon: props.SettingsIcon ?? "\uE713",
		IsEnabled: true
	}
	const topVisibleItems = menuItems.slice(0, topVisibleCount)
	const topOverflowItems = menuItems.slice(topVisibleCount)
	const backVisibility = props.IsBackButtonVisible ?? "Auto"
	const backButtonVisible = backVisibility !== "Collapsed"
	const leftBackButtonVisible = backButtonVisible
	const paneToggle = props.IsPaneToggleButtonVisible !== false
	const paneClass = isTopNavigation
		? cx("top", props.IsPaneVisible === false ? "pane-hidden" : undefined)
		: cx(
				responsiveMode.toLowerCase(),
				isPaneOpen ? "pane-open" : "pane-closed",
				isPaneContentVisible ? "pane-content-visible" : "pane-content-hidden",
				props.IsPaneVisible === false ? "pane-hidden" : undefined
			)
	const navigationStyle: WinStyle = {
		...props.style,
		...commonStyle(props),
		"--nav-open-pane-width": cssLength(props.OpenPaneLength ?? 320),
		"--nav-compact-pane-width": cssLength(props.CompactPaneLength ?? 48),
		"--nav-pane-duration": isCompactMode ? "350ms" : "200ms",
		"--nav-pane-open-duration": isCompactMode ? "350ms" : "200ms",
		"--nav-pane-close-duration": isCompactMode ? "120ms" : "200ms",
		"--nav-pane-easing": isCompactMode
			? "cubic-bezier(0.1, 0.9, 0.2, 1)"
			: "cubic-bezier(0, 0.35, 0.15, 1)"
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={shellRef}
			className={cx("win-navigation-view", paneClass, props.className, props.class)}
			style={navigationStyle}
		>
			<aside
				className={cx(
					"win-navigation-pane",
					renderedPaneTransition ? `is-pane-${renderedPaneTransition}` : undefined
				)}
				aria-label={String(props.PaneTitle ?? "Navigation")}
				aria-hidden={props.IsPaneVisible === false}
			>
				{!isTopNavigation && (
					<div
						ref={indicatorTrackRef}
						className="win-nav-indicator-track"
						aria-hidden="true"
					>
						<div
							ref={indicatorRef}
							className={cx(
								"win-nav-indicator",
								indicatorIsChild ? "is-child" : undefined
							)}
							style={indicatorStyle}
						/>
					</div>
				)}
				{leftBackButtonVisible && !isTopNavigation && (
					<button
						type="button"
						className="win-navigation-back"
						disabled={!props.IsBackEnabled}
						onClick={() =>
							callback<unknown>(props, "onBackRequested", "BackRequested")?.({})
						}
					>
						<span aria-hidden="true">{"\uE72B"}</span>
						{isPaneContentVisible && <span>Back</span>}
					</button>
				)}
				<div className="win-navigation-header">
					{paneToggle && !isTopNavigation && (
						<button
							type="button"
							className="win-navigation-toggle"
							aria-label={isPaneOpen ? "Close navigation" : "Open navigation"}
							onPointerDown={onHamburgerPointerDown}
							onPointerUp={onHamburgerPointerUp}
							onPointerLeave={onHamburgerPointerLeave}
							onPointerCancel={onHamburgerPointerLeave}
							onClick={() => setPaneOpen(!isPaneOpen)}
						>
							<span
								className={cx(
									"icon",
									"animated-icon",
									"animated-icon-hamburger",
									hamburgerAnimation || undefined
								)}
								onAnimationEnd={onHamburgerAnimationEnd}
								aria-hidden="true"
							>
								{"\uE700"}
							</span>
						</button>
					)}
					{isPaneContentVisible && <span>{props.PaneTitle}</span>}
				</div>
				{props.PaneHeader && isPaneContentVisible && (
					<div className="win-navigation-pane-header">{props.PaneHeader}</div>
				)}
				{props.AutoSuggestBox && isPaneContentVisible && (
					<div className="win-navigation-pane-search">{props.AutoSuggestBox}</div>
				)}
				<WinScrollViewer
					className="win-navigation-scroll-viewer"
					VerticalScrollMode="Auto"
					VerticalScrollBarVisibility="Auto"
					HorizontalScrollMode="Disabled"
					HorizontalScrollBarVisibility="Disabled"
				>
					{props.PaneCustomContent && isPaneContentVisible && (
						<div className="win-navigation-pane-custom-content">
							{props.PaneCustomContent}
						</div>
					)}
					<nav
						className="win-navigation-menu"
						onKeyDown={(event) => {
							if (event.key === "Escape" && isCompactMode && isPaneOpen)
								setPaneOpen(false)
						}}
					>
						{renderItems(menuItems, "menu")}
					</nav>
				</WinScrollViewer>
				{footerItems.length > 0 && (
					<nav className="win-navigation-footer">
						{props.PaneFooter && isPaneContentVisible && (
							<div className="win-navigation-pane-footer">{props.PaneFooter}</div>
						)}
						{renderItems(footerItems, "footer")}
					</nav>
				)}
				{props.PaneFooter && footerItems.length === 0 && isPaneContentVisible && (
					<div className="win-navigation-pane-footer">{props.PaneFooter}</div>
				)}
				{props.IsSettingsVisible !== false && (
					<div className="win-navigation-settings">
						{renderNavigationItem(settingsItem, menuItems.length, "footer")}
					</div>
				)}
			</aside>
			<main className="win-navigation-content">
				{isTopNavigation && (
					<div className="win-navigation-top-bar" ref={topMenuRef}>
						<div
							ref={indicatorTrackRef}
							className="win-nav-indicator-track"
							aria-hidden="true"
						>
							<div
								ref={indicatorRef}
								className="win-nav-indicator"
								style={indicatorStyle}
							/>
						</div>
						{backButtonVisible && (
							<button
								type="button"
								className="win-navigation-top-back"
								disabled={!props.IsBackEnabled}
								aria-label="Back"
								onClick={() =>
									callback<unknown>(
										props,
										"onBackRequested",
										"BackRequested"
									)?.({})
								}
							>
								{"\uE72B"}
							</button>
						)}
						{props.PaneHeader && (
							<div className="win-navigation-top-fixed win-navigation-top-pane-header">
								{props.PaneHeader}
							</div>
						)}
						{!props.PaneHeader && props.PaneTitle && !paneToggle && (
							<div className="win-navigation-top-fixed win-navigation-top-pane-title">
								{props.PaneTitle}
							</div>
						)}
						<nav className="win-navigation-top-menu">
							{renderItems(topVisibleItems, "top")}
							{topOverflowItems.length > 0 && (
								<div className="win-navigation-more-wrapper">
									<button
										type="button"
										ref={moreButtonRef}
										className="win-nav-more-button"
										aria-label="More navigation items"
										aria-haspopup="menu"
										aria-expanded={moreOpen}
										onClick={() => setMoreOpen((current) => !current)}
									>
										{"\uE712"}
									</button>
									{moreOpen && (
										<div
											ref={morePanelRef}
											className="win-nav-more-panel"
											role="menu"
										>
											{renderItems(topOverflowItems, "more")}
										</div>
									)}
								</div>
							)}
						</nav>
						{props.PaneCustomContent && (
							<div className="win-navigation-top-pane-custom-content">
								{props.PaneCustomContent}
							</div>
						)}
						{props.AutoSuggestBox && (
							<div className="win-navigation-top-fixed win-navigation-top-pane-search">
								{props.AutoSuggestBox}
							</div>
						)}
						{props.PaneFooter && (
							<div className="win-navigation-top-fixed win-navigation-top-pane-footer">
								{props.PaneFooter}
							</div>
						)}
						<div className="win-navigation-top-footer">
							{renderItems(footerItems, "top-footer")}
							{props.IsSettingsVisible !== false &&
								renderNavigationItem(
									settingsItem,
									menuItems.length,
									"top-settings"
								)}
						</div>
						<div
							ref={topMeasureRef}
							className="win-navigation-top-measure"
							aria-hidden="true"
						>
							{menuItems.map((item, index) => {
								const record = navigationRecord(item)
								const itemType = String(
									record.Type ?? record.type ?? ""
								).toLowerCase()
								const value = navigationItemValue(item, index, "top")
								if (itemType === "header")
									return (
										<div
											key={value}
											data-nav-measure-value={value}
											className="win-nav-item-header"
										>
											{navigationLabel(item)}
										</div>
									)
								if (itemType === "separator")
									return (
										<div
											key={value}
											data-nav-measure-value={value}
											className="win-nav-item-separator"
										/>
									)
								return (
									<div
										key={value}
										data-nav-measure-value={value}
										className="win-nav-item"
									>
										{navigationIcon(item) && (
											<span className="win-nav-icon">
												{navigationIcon(item)}
											</span>
										)}
										<span className="win-nav-label">
											{navigationLabel(item)}
										</span>
										{navigationChildren(item).length > 0 && (
											<span className="win-nav-group-chevron">
												{"\uE70D"}
											</span>
										)}
									</div>
								)
							})}
							<div
								data-nav-measure-value="__more"
								className="win-nav-item win-nav-more-button"
							>
								{"\uE712"}
							</div>
						</div>
					</div>
				)}
				{props.Header && (props.AlwaysShowHeader !== false || !isTopNavigation) && (
					<div className="win-navigation-page-header">{props.Header}</div>
				)}
				<div className="win-navigation-page-content">{props.children ?? props.Content}</div>
				{props.ContentOverlay && (
					<div className="win-navigation-content-overlay">{props.ContentOverlay}</div>
				)}
			</main>
		</div>
	)
}
