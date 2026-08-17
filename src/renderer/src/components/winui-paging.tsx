// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes } from "react"
import { alignments, callback, commonStyle, cx, domProps, itemLabel, itemsOf } from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinProps, WinStyle } from "./winui-shared"

export function WinPipsPager(
	props: WinProps &
		WinChangeProps<number> & {
			NumberOfPages?: number
			SelectedPageIndex?: number
			MaxVisiblePips?: number
			Orientation?: string
			PreviousButtonVisibility?: string
			NextButtonVisibility?: string
			PreviousButtonStyle?: WinStyle | string
			NextButtonStyle?: WinStyle | string
			SelectedPipStyle?: WinStyle | string
			NormalPipStyle?: WinStyle | string
			WrapMode?: string
		}
): React.JSX.Element {
	const numberOfPages = Number(props.NumberOfPages)
	const totalPages = Number.isFinite(numberOfPages) ? Math.trunc(numberOfPages) : -1
	const maxVisibleCandidate = Number(props.MaxVisiblePips ?? 5)
	const maxVisiblePips = Number.isFinite(maxVisibleCandidate)
		? Math.max(0, Math.trunc(maxVisibleCandidate))
		: 5
	const selectedExternal: number | undefined =
		props.SelectedPageIndex !== undefined
			? props.SelectedPageIndex
			: typeof props.value === "number"
				? props.value
				: undefined
	const initialSelected = Number.isFinite(selectedExternal) ? Number(selectedExternal) : 0
	const [selected, setSelected] = useState(initialSelected)
	const previousExternalSelectionRef = useRef<number | undefined>(selectedExternal)
	const [isPointerOver, setIsPointerOver] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const isHorizontal =
		String(
			props.Orientation ?? (props.orientation as string | undefined) ?? "Horizontal"
		).toLowerCase() === "horizontal"
	const canWrap = String(props.WrapMode ?? "None").toLowerCase() === "wrap" && totalPages > 1
	const selectedNumber = Number(selected)
	const selectedIndex =
		totalPages > 0
			? Math.min(
					Math.max(0, Number.isFinite(selectedNumber) ? selectedNumber : 0),
					totalPages - 1
				)
			: Math.max(0, Number.isFinite(selectedNumber) ? selectedNumber : 0)
	const pageCount =
		totalPages === 0 || maxVisiblePips <= 0
			? 0
			: totalPages > 0
				? totalPages
				: Math.max(maxVisiblePips, selectedIndex + 2)
	const visiblePipCount = Math.min(maxVisiblePips, pageCount)
	const canGoPrevious = pageCount > 0 && (selectedIndex > 0 || canWrap)
	const canGoNext = pageCount > 0 && (totalPages < 0 || selectedIndex < totalPages - 1 || canWrap)
	const pointerVisibilityActive = isPointerOver || isFocused
	const previousVisibility = props.PreviousButtonVisibility ?? "Collapsed"
	const nextVisibility = props.NextButtonVisibility ?? "Collapsed"
	const previousVisible =
		pageCount > 0 &&
		canGoPrevious &&
		(previousVisibility === "Visible" || pointerVisibilityActive)
	const nextVisible =
		pageCount > 0 && canGoNext && (nextVisibility === "Visible" || pointerVisibilityActive)
	const firstVisibleIndex =
		visiblePipCount <= 0 || pageCount <= visiblePipCount
			? 0
			: Math.min(
					Math.max(0, selectedIndex - Math.floor(visiblePipCount / 2)),
					pageCount - visiblePipCount
				)
	const styleValue = (value: WinStyle | string | undefined): WinStyle | undefined =>
		typeof value === "object" && value !== null ? value : undefined
	useEffect(() => {
		if (
			selectedExternal === undefined ||
			selectedExternal === previousExternalSelectionRef.current
		)
			return
		previousExternalSelectionRef.current = selectedExternal
		setSelected(Number(selectedExternal))
	}, [selectedExternal])
	useEffect(() => {
		if (totalPages <= 0) return
		const normalized = Math.min(Math.max(0, selected), totalPages - 1)
		if (normalized === selected) return
		setSelected(normalized)
		callback<number>(props, "onValueChange", "onUpdate:SelectedPageIndex")?.(normalized)
	}, [selected, totalPages])
	const setSelectedPageIndex = (nextIndex: number) => {
		if (!enabled || pageCount === 0) return
		let normalized = Math.trunc(nextIndex)
		if (totalPages > 0) {
			if (canWrap) normalized = ((normalized % totalPages) + totalPages) % totalPages
			else normalized = Math.min(Math.max(0, normalized), totalPages - 1)
		} else normalized = Math.max(0, normalized)
		if (normalized === selectedIndex) return
		setSelected(normalized)
		callback<number>(props, "onValueChange", "onUpdate:SelectedPageIndex")?.(normalized)
		callback<Record<string, never>>(
			props,
			"onSelectedIndexChanged",
			"SelectedIndexChanged"
		)?.({})
	}
	const goToPreviousPage = () => setSelectedPageIndex(selectedIndex - 1)
	const goToNextPage = () => setSelectedPageIndex(selectedIndex + 1)
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!enabled) return
		const previousKey = isHorizontal ? "ArrowLeft" : "ArrowUp"
		const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown"
		if (event.key === previousKey) {
			event.preventDefault()
			goToPreviousPage()
		} else if (event.key === nextKey) {
			event.preventDefault()
			goToNextPage()
		} else if (event.key === "Home") {
			event.preventDefault()
			setSelectedPageIndex(0)
		} else if (event.key === "End" && totalPages > 0) {
			event.preventDefault()
			setSelectedPageIndex(totalPages - 1)
		}
	}
	const horizontalAlignment = alignments[props.HorizontalAlignment ?? "Left"] ?? "flex-start"
	const verticalAlignment = alignments[props.VerticalAlignment ?? "Top"] ?? "flex-start"
	const rootStyle: WinStyle = {
		...props.style,
		...commonStyle(props),
		justifySelf: horizontalAlignment,
		alignSelf: verticalAlignment,
		background: props.Background ?? "transparent"
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-pips-pager",
				isHorizontal ? "orientation-horizontal" : "orientation-vertical",
				enabled ? undefined : "is-disabled",
				props.className,
				props.class
			)}
			style={rootStyle}
			role="group"
			onPointerEnter={() => setIsPointerOver(true)}
			onPointerLeave={() => setIsPointerOver(false)}
			onFocus={() => setIsFocused(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null))
					setIsFocused(false)
			}}
			onKeyDown={handleKeyDown}
		>
			{previousVisibility !== "Collapsed" && (
				<button
					className={cx(
						"navigation-button",
						"previous-page-button",
						!previousVisible ? "hidden" : undefined
					)}
					type="button"
					aria-label="Previous page"
					disabled={!enabled || !canGoPrevious}
					style={styleValue(props.PreviousButtonStyle)}
					onClick={goToPreviousPage}
				>
					<span aria-hidden="true">{"\uEDDB"}</span>
				</button>
			)}
			<div
				className="pips-viewport"
				style={
					isHorizontal
						? { width: visiblePipCount * 12 + "px", height: pageCount ? "24px" : "0px" }
						: { width: pageCount ? "24px" : "0px", height: visiblePipCount * 12 + "px" }
				}
			>
				<div
					className="pips-repeater"
					style={{
						transform: isHorizontal
							? `translateX(${-firstVisibleIndex * 12}px)`
							: `translateY(${-firstVisibleIndex * 12}px)`
					}}
				>
					{Array.from({ length: pageCount }, (_, index) => (
						<button
							key={index}
							className={cx(
								"pip-button",
								selectedIndex === index ? "selected" : undefined
							)}
							type="button"
							disabled={!enabled}
							style={styleValue(
								selectedIndex === index
									? props.SelectedPipStyle
									: props.NormalPipStyle
							)}
							aria-label={`Page ${index + 1}`}
							aria-posinset={index + 1}
							aria-setsize={totalPages > 0 ? totalPages : undefined}
							onClick={() => setSelectedPageIndex(index)}
						>
							<span className="pip-glyph" aria-hidden="true">
								{"\uEA3B"}
							</span>
						</button>
					))}
				</div>
			</div>
			{nextVisibility !== "Collapsed" && (
				<button
					className={cx(
						"navigation-button",
						"next-page-button",
						!nextVisible ? "hidden" : undefined
					)}
					type="button"
					aria-label="Next page"
					disabled={!enabled || !canGoNext}
					style={styleValue(props.NextButtonStyle)}
					onClick={goToNextPage}
				>
					<span aria-hidden="true">{"\uEDDC"}</span>
				</button>
			)}
		</div>
	)
}
export function WinFlipView(
	props: WinItemProps &
		WinChangeProps<number> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			Orientation?: "Horizontal" | "Vertical" | string
			IsEnabled?: boolean
			items?: WinItem[]
		}
): React.JSX.Element {
	const items = props.ItemsSource ?? props.items ?? itemsOf(props)
	const orientationValue =
		props.Orientation ?? (props.orientation as string | undefined) ?? "Horizontal"
	const isVertical = String(orientationValue).toLowerCase() === "vertical"
	const clampIndex = (index: number) =>
		items.length === 0
			? 0
			: Math.min(Math.max(Math.trunc(Number(index) || 0), 0), items.length - 1)
	const selectedItemIndex =
		props.SelectedItem === undefined
			? -1
			: items.findIndex((item) => Object.is(item, props.SelectedItem))
	const selectedIndexProp =
		props.SelectedIndex ?? (typeof props.value === "number" ? props.value : undefined)
	const initialIndex =
		props.SelectedItem !== undefined
			? selectedItemIndex
			: selectedIndexProp === undefined
				? 0
				: Number(selectedIndexProp)
	const [currentIndex, setCurrentIndex] = useState(clampIndex(initialIndex))
	const previousExternalSelectionRef = useRef<unknown>(
		props.SelectedItem !== undefined ? props.SelectedItem : selectedIndexProp
	)
	const [isHovered, setIsHovered] = useState(false)
	const touchStart = useRef<number | null>(null)
	const isEnabled = props.IsEnabled !== false && props.disabled !== true
	const selectedIndex =
		props.SelectedItem !== undefined
			? clampIndex(selectedItemIndex)
			: selectedIndexProp === undefined
				? currentIndex
				: clampIndex(Number(selectedIndexProp))
	useEffect(() => {
		const externalSelection =
			props.SelectedItem !== undefined ? props.SelectedItem : selectedIndexProp
		if (
			externalSelection !== previousExternalSelectionRef.current ||
			(items.length === 0 && currentIndex !== 0)
		) {
			previousExternalSelectionRef.current = externalSelection
			setCurrentIndex(
				props.SelectedItem !== undefined
					? clampIndex(selectedItemIndex)
					: clampIndex(Number(selectedIndexProp ?? 0))
			)
		}
	}, [currentIndex, items.length, props.SelectedItem, selectedIndexProp, selectedItemIndex])
	const selectIndex = (index: number) => {
		if (!isEnabled || items.length === 0) return
		const bounded = clampIndex(index)
		if (bounded === selectedIndex) return
		const previous = items[selectedIndex]
		const next = items[bounded]
		setCurrentIndex(bounded)
		callback<number>(props, "onUpdate:SelectedIndex")?.(bounded)
		callback<number>(props, "onValueChange", "onChangeValue")?.(bounded)
		callback<WinItem>(props, "onUpdate:SelectedItem")?.(next)
		callback<unknown>(
			props,
			"onSelectionChanged",
			"SelectionChanged"
		)?.({
			AddedItems: next === undefined ? [] : [next],
			RemovedItems: previous === undefined ? [] : [previous],
			SelectedIndex: bounded,
			SelectedItem: next
		})
	}
	const renderFlipItem = (item: WinItem, index: number) =>
		props.renderItem
			? props.renderItem(item, index)
			: props.ItemTemplate
				? props.ItemTemplate(item, index)
				: itemLabel(item)
	const itemKey = (item: WinItem, index: number) => {
		if (typeof item !== "object" || item === null) return String(index)
		const record = item as Record<string, unknown>
		return String(record.id ?? record.title ?? record.alt ?? index)
	}
	const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (!isEnabled) return
		event.preventDefault()
		const delta = isVertical ? event.deltaY : event.deltaX || event.deltaY
		if (delta > 0) selectIndex(selectedIndex + 1)
		else if (delta < 0) selectIndex(selectedIndex - 1)
	}
	const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
		if (!isEnabled || event.touches.length === 0) return
		const touch = event.touches[0]
		touchStart.current = isVertical ? touch.clientY : touch.clientX
	}
	const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
		if (!isEnabled || touchStart.current === null || event.changedTouches.length === 0) return
		const touch = event.changedTouches[0]
		const end = isVertical ? touch.clientY : touch.clientX
		const difference = touchStart.current - end
		touchStart.current = null
		if (difference > 30) selectIndex(selectedIndex + 1)
		else if (difference < -30) selectIndex(selectedIndex - 1)
	}
	const onTouchCancel = () => {
		touchStart.current = null
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-flip-view",
				isVertical ? "vertical" : "horizontal",
				props.class,
				props.className,
				!isEnabled ? "disabled" : undefined
			)}
			style={{ ...props.style, ...commonStyle(props) }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onWheel={onWheel}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			onTouchCancel={onTouchCancel}
		>
			<div
				className="flip-view-track"
				style={{
					transform: isVertical
						? `translateY(-${selectedIndex * 100}%)`
						: `translateX(-${selectedIndex * 100}%)`
				}}
			>
				{items.map((item, index) => (
					<div key={itemKey(item, index)} className="flip-view-item">
						{renderFlipItem(item, index)}
					</div>
				))}
			</div>
			<button
				type="button"
				className="flip-btn prev"
				aria-label="Previous item"
				aria-hidden={!isHovered || selectedIndex <= 0}
				hidden={!isHovered || selectedIndex <= 0}
				disabled={!isEnabled || selectedIndex <= 0}
				onClick={() => selectIndex(selectedIndex - 1)}
			>
				<span className="icon flip-arrow" aria-hidden="true">
					{isVertical ? "\uEDDB" : "\uEDD9"}
				</span>
			</button>
			<button
				type="button"
				className="flip-btn next"
				aria-label="Next item"
				aria-hidden={!isHovered || selectedIndex >= items.length - 1}
				hidden={!isHovered || selectedIndex >= items.length - 1}
				disabled={!isEnabled || selectedIndex >= items.length - 1}
				onClick={() => selectIndex(selectedIndex + 1)}
			>
				<span className="icon flip-arrow" aria-hidden="true">
					{isVertical ? "\uEDDC" : "\uEDDA"}
				</span>
			</button>
		</div>
	)
}
