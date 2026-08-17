// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinScrollViewer } from "./winui-scrolling"
import type { WinScrollViewerHandle } from "./winui-scrolling"
import {
	alignments,
	callback,
	commonStyle,
	contentOf,
	cssLength,
	cx,
	domProps,
	itemLabel,
	xamlThickness
} from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinProps, WinStyle } from "./winui-shared"

export function WinPivot(
	props: WinItemProps &
		WinChangeProps<number> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			Title?: ReactNode
			IsLocked?: boolean
			IsHeaderItemsCarouselEnabled?: boolean
			HeaderTemplate?: (item: WinItem, index: number) => ReactNode
			LeftHeader?: ReactNode
			RightHeader?: ReactNode
			FlowDirection?: "LeftToRight" | "RightToLeft"
			IsEnabled?: boolean
		}
): React.JSX.Element {
	type PivotItemModel = {
		source: WinItem
		key: string
		header: ReactNode
		content?: ReactNode
		isEnabled: boolean
		vnode?: ReactNode
	}
	const itemRecord = (item: WinItem): Record<string, unknown> =>
		typeof item === "object" && item !== null ? item : {}
	const normalizeItem = (source: WinItem, index: number, content?: ReactNode): PivotItemModel => {
		const record = itemRecord(source)
		const header =
			record.Header ?? record.Title ?? record.Text ?? record.Label ?? itemLabel(source)
		const identity = record.Key ?? record.Id ?? record.id ?? record.Name ?? index
		return {
			source,
			key: String(identity),
			header: header as ReactNode,
			content: content ?? (record.Content as ReactNode | undefined),
			isEnabled: record.IsEnabled !== false && record.isEnabled !== false
		}
	}
	const slotItems = useMemo(() => {
		return Children.toArray(props.children).flatMap((child, index) => {
			if (!isValidElement(child)) return []
			const childProps = child.props as Record<string, unknown>
			const source = childProps as unknown as WinItem
			return [
				normalizeItem(
					source,
					index,
					(childProps.children ?? childProps.Content) as ReactNode | undefined
				)
			]
		})
	}, [props.children])
	const items = useMemo(() => {
		const sourceItems = props.ItemsSource ?? props.Items
		if (Array.isArray(sourceItems))
			return sourceItems.map((item, index) => normalizeItem(item, index))
		return slotItems
	}, [props.Items, props.ItemsSource, slotItems])
	const findPivotItemIndex = (target: unknown) =>
		items.findIndex((item) => Object.is(item.source, target) || Object.is(item.header, target))
	const headerScrollerRef = useRef<WinScrollViewerHandle>(null)
	const headerClipperRef = useRef<HTMLDivElement>(null)
	const headerRefs = useRef<Record<number, HTMLButtonElement | null>>({})
	const [canScrollPrevious, setCanScrollPrevious] = useState(false)
	const [canScrollNext, setCanScrollNext] = useState(false)
	const [internalIndex, setInternalIndex] = useState(() => {
		if (props.SelectedItem !== undefined) {
			return findPivotItemIndex(props.SelectedItem)
		}
		return Number(props.SelectedIndex ?? (typeof props.value === "number" ? props.value : 0))
	})
	const externalIndex: number | undefined =
		props.SelectedItem !== undefined
			? findPivotItemIndex(props.SelectedItem)
			: (props.SelectedIndex ?? (typeof props.value === "number" ? props.value : undefined))
	const hasExternalSelection = props.SelectedItem !== undefined || externalIndex !== undefined
	const clampIndex = (index: number) =>
		items.length === 0
			? -1
			: Math.min(Math.max(Math.trunc(Number(index) || 0), 0), items.length - 1)
	const currentIndex: number = clampIndex(internalIndex)
	const previousExternalIndexRef = useRef<number | undefined>(externalIndex)
	const [displayedIndex, setDisplayedIndex] = useState(currentIndex)
	const displayedIndexRef = useRef(displayedIndex)
	const transitioningRef = useRef(false)
	const pendingTransitionRef = useRef<{ index: number; focus: boolean; user: boolean } | null>(
		null
	)
	const transitionTokenRef = useRef(0)
	const itemHostRef = useRef<HTMLDivElement>(null)
	const isEnabled = props.IsEnabled !== false && props.disabled !== true
	const isRtl = props.FlowDirection === "RightToLeft"
	const reducedMotion = () =>
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
	const focusHeader = (index: number) => {
		headerRefs.current[index]?.focus({ preventScroll: true })
	}
	const updateHeaderNavigation = () => {
		const viewport = headerClipperRef.current?.querySelector<HTMLElement>(
			".win-scroll-viewer-viewport"
		)
		if (!viewport) return
		const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
		setCanScrollPrevious(viewport.scrollLeft > 1)
		setCanScrollNext(viewport.scrollLeft < maxScroll - 1)
	}
	const ensureSelectedHeaderInView = () => {
		const viewport = headerClipperRef.current?.querySelector<HTMLElement>(
			".win-scroll-viewer-viewport"
		)
		const header = headerRefs.current[currentIndex]
		if (!viewport || !header || props.IsHeaderItemsCarouselEnabled === false) {
			updateHeaderNavigation()
			return
		}
		const viewportRect = viewport.getBoundingClientRect()
		const headerRect = header.getBoundingClientRect()
		if (headerRect.left < viewportRect.left)
			viewport.scrollBy({
				left: headerRect.left - viewportRect.left - 20,
				behavior: "smooth"
			})
		else if (headerRect.right > viewportRect.right)
			viewport.scrollBy({
				left: headerRect.right - viewportRect.right + 20,
				behavior: "smooth"
			})
		updateHeaderNavigation()
	}
	const commitSelection = (nextIndex: number, oldItem: PivotItemModel | null, user: boolean) => {
		const nextItem = items[nextIndex]
		if (!nextItem) return
		displayedIndexRef.current = nextIndex
		setDisplayedIndex(nextIndex)
		setInternalIndex(nextIndex)
		if (user) {
			callback<number>(props, "onUpdate:SelectedIndex")?.(nextIndex)
			callback<number>(props, "onValueChange", "onChangeValue")?.(nextIndex)
			callback<WinItem>(props, "onUpdate:SelectedItem")?.(nextItem.source)
			callback<unknown>(
				props,
				"onSelectionChanged",
				"SelectionChanged"
			)?.({
				AddedItems: [nextItem.source],
				RemovedItems: oldItem ? [oldItem.source] : [],
				SelectedItem: nextItem.source,
				SelectedIndex: nextIndex
			})
		}
	}
	const animateHost = async (keyframes: Keyframe[], duration: number, easing: string) => {
		const host = itemHostRef.current
		if (!host || reducedMotion() || typeof host.animate !== "function") return
		try {
			const animation = host.animate(keyframes, { duration, easing, fill: "both" })
			await animation.finished
			animation.cancel()
		} catch {
			// A queued selection can replace the host while the animation is running.
		}
	}
	const transitionTo = async (nextIndex: number, shouldFocus: boolean, user: boolean) => {
		if (nextIndex < 0 || nextIndex >= items.length) return
		if (transitioningRef.current) {
			pendingTransitionRef.current = { index: nextIndex, focus: shouldFocus, user }
			return
		}
		const oldIndex = displayedIndexRef.current
		if (nextIndex === oldIndex) {
			if (shouldFocus) focusHeader(nextIndex)
			return
		}
		const nextItem = items[nextIndex]
		if (!nextItem || !isEnabled || (user && (props.IsLocked || !nextItem.isEnabled))) return
		const oldItem = items[oldIndex] ?? null
		const token = ++transitionTokenRef.current
		transitioningRef.current = true
		callback<unknown>(
			props,
			"PivotItemUnloading",
			"onPivotItemUnloading"
		)?.({
			Item: oldItem?.source ?? null
		})
		callback<unknown>(
			props,
			"PivotItemLoading",
			"onPivotItemLoading"
		)?.({
			Item: nextItem.source
		})
		try {
			if (!reducedMotion()) {
				await animateHost(
					[
						{ transform: "translate3d(0, 0, 0)", opacity: 1 },
						{
							transform: `translate3d(${nextIndex < oldIndex ? 7 : -7}px, 0, 0)`,
							opacity: 0
						}
					],
					83,
					"linear"
				)
			}
			if (token !== transitionTokenRef.current) return
			commitSelection(nextIndex, oldItem, user)
			callback<unknown>(
				props,
				"PivotItemUnloaded",
				"onPivotItemUnloaded"
			)?.({
				Item: oldItem?.source ?? null
			})
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
			if (!reducedMotion()) {
				await animateHost(
					[
						{
							transform: `translate3d(${nextIndex < oldIndex ? -20 : 20}px, 0, 0)`,
							opacity: 0
						},
						{ transform: "translate3d(0, 0, 0)", opacity: 1 }
					],
					767,
					"cubic-bezier(0.1, 0.9, 0.2, 1)"
				)
			}
			callback<unknown>(
				props,
				"PivotItemLoaded",
				"onPivotItemLoaded"
			)?.({
				Item: nextItem.source
			})
		} finally {
			if (token === transitionTokenRef.current) {
				transitioningRef.current = false
				const queued = pendingTransitionRef.current
				pendingTransitionRef.current = null
				if (queued && queued.index !== displayedIndexRef.current)
					void transitionTo(queued.index, queued.focus, queued.user)
				else if (queued?.focus) focusHeader(displayedIndexRef.current)
			}
		}
		if (shouldFocus) focusHeader(nextIndex)
		ensureSelectedHeaderInView()
	}
	useEffect(() => {
		if (!hasExternalSelection || externalIndex === previousExternalIndexRef.current) return
		previousExternalIndexRef.current = externalIndex
		setInternalIndex(externalIndex ?? -1)
	}, [externalIndex, hasExternalSelection])
	useEffect(() => {
		if (currentIndex >= 0 && currentIndex !== displayedIndexRef.current)
			void transitionTo(currentIndex, false, false)
	}, [currentIndex])
	useEffect(() => {
		if (!hasExternalSelection && items.length > 0) {
			setInternalIndex((index) => clampIndex(index))
		}
		if (displayedIndexRef.current >= items.length) {
			displayedIndexRef.current = items.length - 1
			setDisplayedIndex(items.length - 1)
		}
	}, [hasExternalSelection, items.length])
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			updateHeaderNavigation()
			ensureSelectedHeaderInView()
		})
		const viewport = headerClipperRef.current?.querySelector<HTMLElement>(
			".win-scroll-viewer-viewport"
		)
		const observer =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(updateHeaderNavigation)
				: null
		if (headerClipperRef.current) observer?.observe(headerClipperRef.current)
		if (viewport) observer?.observe(viewport)
		return () => {
			cancelAnimationFrame(frame)
			observer?.disconnect()
		}
	}, [items.length, props.IsHeaderItemsCarouselEnabled, currentIndex])
	const enabledHeaderIndices = items.reduce<number[]>((indices, item, index) => {
		if (isEnabled && !props.IsLocked && item.isEnabled) indices.push(index)
		return indices
	}, [])
	const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
		if (!isEnabled || props.IsLocked) return
		const forwardKey = isRtl ? "ArrowLeft" : "ArrowRight"
		const backwardKey = isRtl ? "ArrowRight" : "ArrowLeft"
		const position = enabledHeaderIndices.indexOf(index)
		if (position < 0) return
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			void transitionTo(index, true, true)
			return
		}
		let nextPosition = position
		if (event.key === forwardKey)
			nextPosition = Math.min(enabledHeaderIndices.length - 1, position + 1)
		else if (event.key === backwardKey) nextPosition = Math.max(0, position - 1)
		else if (event.key === "Home") nextPosition = 0
		else if (event.key === "End") nextPosition = enabledHeaderIndices.length - 1
		else return
		event.preventDefault()
		void transitionTo(enabledHeaderIndices[nextPosition], true, true)
	}
	const renderPivotContent = (item: PivotItemModel, index: number) => {
		if (item.content !== undefined) return item.content
		if (props.renderItem) return props.renderItem(item.source, index)
		if (props.ItemTemplate) return props.ItemTemplate(item.source, index)
		return itemLabel(item.source)
	}
	const rootStyle: WinStyle = {
		...(props.style as WinStyle | undefined),
		...commonStyle(props),
		minHeight: props.MinHeight !== undefined ? cssLength(props.MinHeight) : undefined
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-pivot",
				props.class,
				props.className,
				props.IsLocked ? "is-locked" : undefined,
				!isEnabled ? "is-disabled" : undefined
			)}
			aria-disabled={!isEnabled}
			dir={isRtl ? "rtl" : "ltr"}
			style={rootStyle}
		>
			{props.Title !== undefined && props.Title !== "" && (
				<div className="win-pivot-title-content-control">{props.Title}</div>
			)}
			<div className="win-pivot-template-grid">
				{props.LeftHeader !== undefined && props.LeftHeader !== "" && (
					<div className="win-pivot-left-header-presenter">{props.LeftHeader}</div>
				)}
				<div ref={headerClipperRef} className="win-pivot-header-clipper">
					<WinScrollViewer
						ref={headerScrollerRef}
						className="win-pivot-header-scroll-viewer"
						HorizontalScrollMode="Auto"
						HorizontalScrollBarVisibility="Hidden"
						VerticalScrollMode="Disabled"
						VerticalScrollBarVisibility="Disabled"
						ZoomMode="Disabled"
						IsTabStop={false}
						onViewChanged={updateHeaderNavigation}
					>
						<div className="win-pivot-header-panel" role="tablist">
							{items.map((item, index) => {
								const selected = index === currentIndex
								const enabled = isEnabled && !props.IsLocked && item.isEnabled
								return (
									<button
										key={item.key}
										ref={(element) => {
											headerRefs.current[index] = element
										}}
										className={cx(
											"win-pivot-header-item",
											selected ? "is-selected" : "is-unselected",
											!enabled ? "is-disabled" : undefined,
											props.IsLocked && !selected
												? "is-unselected-locked"
												: undefined
										)}
										type="button"
										role="tab"
										aria-selected={selected}
										aria-disabled={!enabled}
										tabIndex={
											selected ||
											(currentIndex < 0 && index === enabledHeaderIndices[0])
												? 0
												: -1
										}
										disabled={!enabled}
										onClick={() => void transitionTo(index, false, true)}
										onKeyDown={(event) => handleHeaderKeyDown(event, index)}
									>
										{props.HeaderTemplate
											? props.HeaderTemplate(item.source, index)
											: item.header}
										<span
											className="win-pivot-selected-pipe"
											aria-hidden="true"
										/>
									</button>
								)
							})}
						</div>
					</WinScrollViewer>
					{props.IsHeaderItemsCarouselEnabled !== false && canScrollPrevious && (
						<button
							type="button"
							className="win-pivot-nav-button win-pivot-previous-button"
							aria-label="Previous pivot items"
							onClick={() =>
								headerScrollerRef.current?.ScrollBy(isRtl ? 160 : -160, 0)
							}
						>
							<span className="win-pivot-nav-glyph" aria-hidden="true">
								{"\uE76B"}
							</span>
						</button>
					)}
					{props.IsHeaderItemsCarouselEnabled !== false && canScrollNext && (
						<button
							type="button"
							className="win-pivot-nav-button win-pivot-next-button"
							aria-label="Next pivot items"
							onClick={() =>
								headerScrollerRef.current?.ScrollBy(isRtl ? -160 : 160, 0)
							}
						>
							<span className="win-pivot-nav-glyph" aria-hidden="true">
								{"\uE76C"}
							</span>
						</button>
					)}
				</div>
				{props.RightHeader !== undefined && props.RightHeader !== "" && (
					<div className="win-pivot-right-header-presenter">{props.RightHeader}</div>
				)}
				<div className="win-pivot-item-presenter" role="tabpanel">
					{displayedIndex >= 0 && items[displayedIndex] && (
						<div
							ref={itemHostRef}
							key={items[displayedIndex].key}
							className="win-pivot-item-host"
						>
							{renderPivotContent(items[displayedIndex], displayedIndex)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
export function WinPivotItem(props: WinProps): React.JSX.Element {
	return <div className="win-pivot-item">{props.children ?? contentOf(props)}</div>
}
export function WinSelectorBar(
	props: WinItemProps &
		WinChangeProps<number> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			IsEnabled?: boolean
			Background?: string
			BorderBrush?: string
			CornerRadius?: string | number
			TabNavigation?: string
		}
): React.JSX.Element {
	type SelectorBarItemModel = {
		source: WinItem
		key: string
		text: ReactNode
		content: ReactNode
		icon: ReactNode
		isSelected: boolean
		isEnabled: boolean
		padding: string | number | undefined
		width: string | number | undefined
		height: string | number | undefined
		minWidth: string | number | undefined
		maxWidth: string | number | undefined
		horizontalContentAlignment: string
		verticalContentAlignment: string
	}
	const getRecord = (item: WinItem): Record<string, unknown> =>
		typeof item === "object" && item !== null ? item : {}
	const iconMap: Record<string, string> = {
		Accept: "\uE8FB",
		Add: "\uE710",
		Back: "\uE72B",
		Calendar: "\uE787",
		Cancel: "\uE711",
		Clock: "\uE823",
		Contact: "\uE77B",
		Delete: "\uE74D",
		Edit: "\uE70F",
		Favorite: "\uE734",
		Filter: "\uE71C",
		Home: "\uE80F",
		Mail: "\uE715",
		More: "\uE712",
		Play: "\uE768",
		Refresh: "\uE72C",
		Save: "\uE74E",
		Search: "\uE721",
		Setting: "\uE713",
		Settings: "\uE713",
		Share: "\uE72D",
		Sort: "\uE8CB",
		Star: "\uE734",
		Sync: "\uE895"
	}
	const normalizeItem = (
		source: WinItem,
		index: number,
		keyOverride?: string | number | null
	): SelectorBarItemModel => {
		const toBoolean = (value: unknown, fallback: boolean) => {
			if (value === undefined || value === null) return fallback
			if (typeof value === "boolean") return value
			const normalized = String(value).trim().toLowerCase()
			if (["true", "1", "yes"].includes(normalized)) return true
			if (["false", "0", "no"].includes(normalized)) return false
			return Boolean(value)
		}
		const record = getRecord(source)
		const text =
			record.Text ??
			record.Label ??
			(typeof source === "string" || typeof source === "number" ? source : "")
		const content = record.Content ?? record.children ?? text
		const icon = record.Icon
		const key =
			keyOverride ??
			record.Key ??
			record.Id ??
			record.Name ??
			`${index}:${String(text ?? "")}`
		return {
			source,
			key: String(key),
			text: text as ReactNode,
			content: content as ReactNode,
			icon: icon as ReactNode,
			isSelected: toBoolean(record.IsSelected, false),
			isEnabled: toBoolean(record.IsEnabled, true),
			padding: record.Padding as string | number | undefined,
			width: record.Width as string | number | undefined,
			height: record.Height as string | number | undefined,
			minWidth: record.MinWidth as string | number | undefined,
			maxWidth: record.MaxWidth as string | number | undefined,
			horizontalContentAlignment: String(record.HorizontalContentAlignment ?? "Center"),
			verticalContentAlignment: String(record.VerticalContentAlignment ?? "Center")
		}
	}
	const slotItems = useMemo(() => {
		const children = Children.toArray(props.children)
		return children.flatMap((child, index) => {
			if (!isValidElement(child)) return []
			const childProps = child.props as Record<string, unknown>
			const source = childProps as unknown as WinItem
			return [normalizeItem(source, index, child.key)]
		})
	}, [props.children])
	const items = useMemo(() => {
		const sourceItems = props.Items ?? props.ItemsSource
		return Array.isArray(sourceItems)
			? sourceItems.map((item, index) => normalizeItem(item, index))
			: slotItems
	}, [props.Items, props.ItemsSource, slotItems])
	const selectedItemControlled = props.SelectedItem !== undefined
	const selectedIndexControlled =
		props.SelectedIndex !== undefined || typeof props.value === "number"
	const initialIndex = (() => {
		if (props.SelectedItem !== undefined) {
			return items.findIndex((item) => Object.is(item.source, props.SelectedItem))
		}
		if (props.SelectedIndex !== undefined || typeof props.value === "number")
			return Number(props.SelectedIndex ?? props.value)
		return items.findIndex((item) => item.isSelected)
	})()
	const [uncontrolledIndex, setUncontrolledIndex] = useState(
		initialIndex >= 0 ? Math.trunc(initialIndex) : -1
	)
	const selectedIndex = selectedItemControlled
		? items.findIndex((item) => Object.is(item.source, props.SelectedItem))
		: selectedIndexControlled
			? Math.trunc(Number(props.SelectedIndex ?? props.value))
			: Math.min(Math.max(uncontrolledIndex, -1), Math.max(items.length - 1, -1))
	const isEnabled = props.IsEnabled !== false && props.disabled !== true
	const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
	useEffect(() => {
		if (!selectedItemControlled && !selectedIndexControlled) {
			setUncontrolledIndex((index) =>
				items.length === 0
					? -1
					: index < 0
						? -1
						: Math.min(Math.max(index, 0), items.length - 1)
			)
		}
	}, [items.length, selectedIndexControlled, selectedItemControlled])
	const enabledIndices = items.reduce<number[]>((indices, item, index) => {
		if (isEnabled && item.isEnabled) indices.push(index)
		return indices
	}, [])
	const changeSelection = (index: number, invoke: boolean) => {
		const item = items[index]
		if (!item || !isEnabled || !item.isEnabled || index === selectedIndex) return
		if (!selectedItemControlled && !selectedIndexControlled) setUncontrolledIndex(index)
		callback<number>(props, "onUpdate:SelectedIndex")?.(index)
		callback<number>(props, "onValueChange", "onChangeValue")?.(index)
		callback<WinItem>(props, "onUpdate:SelectedItem")?.(item.source)
		callback<unknown>(
			props,
			"onSelectionChanged",
			"SelectionChanged"
		)?.({
			AddedItems: [item.source],
			RemovedItems: selectedIndex >= 0 ? [items[selectedIndex]?.source].filter(Boolean) : [],
			SelectedItem: item.source,
			SelectedIndex: index
		})
		if (invoke)
			callback<unknown>(
				props,
				"onItemInvoked",
				"ItemInvoked"
			)?.({
				InvokedItem: item.source,
				Index: index
			})
	}
	const moveFocus = (index: number) => {
		if (index < 0 || index >= items.length || !items[index]?.isEnabled) return
		itemRefs.current[index]?.focus({ preventScroll: true })
		changeSelection(index, false)
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
		if (!isEnabled) return
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			changeSelection(index, true)
			return
		}
		const position = enabledIndices.indexOf(index)
		if (position < 0) return
		let nextPosition = position
		if (event.key === "ArrowRight" || event.key === "ArrowDown")
			nextPosition = Math.min(enabledIndices.length - 1, position + 1)
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
			nextPosition = Math.max(0, position - 1)
		else if (event.key === "Home") nextPosition = 0
		else if (event.key === "End") nextPosition = enabledIndices.length - 1
		else return
		event.preventDefault()
		moveFocus(enabledIndices[nextPosition])
	}
	const getText = (item: SelectorBarItemModel): ReactNode => item.text
	const hasText = (item: SelectorBarItemModel) =>
		item.text !== undefined && item.text !== null && item.text !== ""
	const hasIcon = (item: SelectorBarItemModel) =>
		item.icon !== undefined && item.icon !== null && item.icon !== ""
	const getIconContent = (icon: ReactNode): ReactNode =>
		typeof icon === "string" ? (iconMap[icon] ?? icon) : icon
	const rootStyle: WinStyle = {
		...(props.style as WinStyle | undefined),
		...commonStyle(props),
		background: props.Background ?? "transparent",
		borderColor: props.BorderBrush ?? "transparent",
		borderRadius: cssLength(props.CornerRadius ?? 0)
	}
	const itemsViewStyle: WinStyle = {
		padding: xamlThickness(props.Padding ?? "0,4")
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-selector-bar",
				!isEnabled ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={rootStyle}
			role="tablist"
			aria-disabled={!isEnabled}
		>
			<div className="win-selector-bar-items-view" style={itemsViewStyle}>
				{items.map((item, index) => {
					const selected = index === selectedIndex
					const enabled = isEnabled && item.isEnabled
					const itemStyle: WinStyle = {
						"--win-selector-bar-item-padding": xamlThickness(
							item.padding ?? "12,10,12,7"
						),
						width: cssLength(item.width),
						height: cssLength(item.height),
						minWidth: cssLength(item.minWidth),
						maxWidth: cssLength(item.maxWidth),
						justifyContent: alignments[item.horizontalContentAlignment] ?? "center",
						alignItems: alignments[item.verticalContentAlignment] ?? "center"
					}
					return (
						<button
							key={item.key}
							ref={(element) => {
								itemRefs.current[index] = element
							}}
							data-selector-bar-index={index}
							type="button"
							className={cx(
								"win-selector-bar-item",
								selected ? "is-selected" : "is-unselected",
								!enabled ? "is-disabled" : undefined,
								hasIcon(item) ? "has-icon" : undefined
							)}
							disabled={!enabled}
							role="tab"
							aria-selected={selected}
							aria-disabled={!enabled}
							tabIndex={
								selected || (selectedIndex < 0 && index === enabledIndices[0])
									? 0
									: -1
							}
							style={itemStyle}
							onClick={() => changeSelection(index, true)}
							onKeyDown={(event) => handleKeyDown(event, index)}
						>
							<span className="win-selector-bar-item-content">
								{hasIcon(item) && (
									<span className="win-selector-bar-item-icon" aria-hidden="true">
										{typeof item.icon === "string" &&
										(item.icon.trim().startsWith("<") ||
											item.icon.trim().startsWith("&")) ? (
											<span
												className="win-selector-bar-item-icon-glyph icon"
												dangerouslySetInnerHTML={{ __html: item.icon }}
											/>
										) : (
											<span className="win-selector-bar-item-icon-glyph icon">
												{getIconContent(item.icon)}
											</span>
										)}
									</span>
								)}
								{hasText(item) && (
									<span className="win-selector-bar-item-text">
										{props.renderItem
											? props.renderItem(item.source, index)
											: props.ItemTemplate
												? props.ItemTemplate(item.source, index)
												: getText(item)}
									</span>
								)}
							</span>
							<span
								className="win-selector-bar-item-selection-visual"
								aria-hidden="true"
							/>
							<span
								className="win-selector-bar-item-common-visual"
								aria-hidden="true"
							/>
						</button>
					)
				})}
			</div>
		</div>
	)
}
export function WinSelectorBarItem(props: WinProps): React.JSX.Element {
	return (
		<button type="button" className={cx("win-selector-bar-item", props.class)}>
			{contentOf(props, props.children)}
		</button>
	)
}
