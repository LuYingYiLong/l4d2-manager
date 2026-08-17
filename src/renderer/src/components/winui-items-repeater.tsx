// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import type { ReactNode } from "react"
import { callback, commonStyle, cssLength, cx, itemLabel, xamlThickness } from "./winui-shared"
import type { WinItem, WinItemProps, WinStyle } from "./winui-shared"

export interface WinItemsRepeaterHandle {
	ItemsSourceView: {
		Count: number
		GetAt: (index: number) => WinItem | undefined
		IndexOf: (item: WinItem) => number
	}
	GetElementIndex: (element: Element | null) => number
	TryGetElement: (index: number) => HTMLElement | null
	GetOrCreateElement: (index: number) => HTMLElement | null
}

export const WinItemsRepeater = forwardRef<WinItemsRepeaterHandle, WinItemProps>(
	function WinItemsRepeater(props, ref) {
		const rootRef = useRef<HTMLDivElement>(null)
		const rawSource = props.ItemsSource ?? props.Items ?? []
		const items = useMemo(() => {
			if (Array.isArray(rawSource)) return rawSource
			if (rawSource && typeof rawSource === "object") {
				const source = rawSource as Record<string, unknown>
				const count = Number(source.Count ?? source.count ?? 0)
				const getter = source.GetAt ?? source.getAt
				if (typeof getter === "function")
					return Array.from({ length: Math.max(0, count) }, (_, index) =>
						(getter as (this: Record<string, unknown>, index: number) => WinItem).call(
							source,
							index
						)
					)
			}
			return []
		}, [rawSource])
		const layout =
			typeof (props as Record<string, unknown>).Layout === "object" &&
			(props as Record<string, unknown>).Layout !== null
				? ((props as Record<string, unknown>).Layout as Record<string, unknown>)
				: { Type: (props as Record<string, unknown>).Layout ?? "StackLayout" }
		const layoutType = String(layout.Type ?? layout.type ?? "StackLayout").toLowerCase()
		const orientation = String(layout.Orientation ?? layout.orientation ?? "Vertical")
		const spacing = Number(layout.Spacing ?? layout.spacing ?? 0)
		const minItemWidth = Number(
			layout.MinItemWidth ??
				layout.minItemWidth ??
				layout.ItemWidth ??
				layout.itemWidth ??
				120
		)
		const minItemHeight = Number(
			layout.MinItemHeight ??
				layout.minItemHeight ??
				layout.ItemHeight ??
				layout.itemHeight ??
				80
		)
		const maxRowsOrColumns = Number(
			layout.MaximumRowsOrColumns ?? layout.maximumRowsOrColumns ?? 0
		)
		const rowSpacing = Number(
			layout.MinRowSpacing ??
				layout.minRowSpacing ??
				layout.RowSpacing ??
				layout.rowSpacing ??
				spacing
		)
		const columnSpacing = Number(
			layout.MinColumnSpacing ??
				layout.minColumnSpacing ??
				layout.ColumnSpacing ??
				layout.columnSpacing ??
				spacing
		)
		const itemKey = (item: WinItem, index: number) => {
			if (typeof item === "object" && item !== null) {
				const record = item as Record<string, unknown>
				return String(
					record.Id ?? record.ID ?? record.id ?? record.Key ?? record.key ?? index
				)
			}
			return String(index)
		}
		const previousItems = useRef<WinItem[]>([])
		const renderItem = props.renderItem as
			((item: WinItem, index: number) => ReactNode) | undefined
		const itemTemplate = props.ItemTemplate as
			((item: WinItem, index: number) => ReactNode) | undefined
		const getElementIndex = (element: Element | null) => {
			const value = element?.getAttribute("data-index")
			return value === null || value === undefined ? -1 : Number(value)
		}
		const tryGetElement = (index: number) =>
			rootRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null
		const itemsSourceView = {
			Count: items.length,
			GetAt: (index: number) => items[index],
			IndexOf: (item: WinItem) => items.indexOf(item)
		}
		const style: WinStyle = {
			...(props.style as WinStyle | undefined),
			...commonStyle(props),
			"--items-repeater-spacing": `${spacing}px`,
			"--items-repeater-min-item-width": `${minItemWidth}px`,
			"--items-repeater-min-item-height": `${minItemHeight}px`,
			"--items-repeater-row-spacing": `${rowSpacing}px`,
			"--items-repeater-column-spacing": `${columnSpacing}px`,
			margin: props.Margin !== undefined ? xamlThickness(props.Margin) : undefined,
			maxWidth: props.MaxWidth !== undefined ? cssLength(props.MaxWidth) : undefined,
			justifyItems:
				props.HorizontalAlignment === "Left"
					? "start"
					: props.HorizontalAlignment === "Right"
						? "end"
						: props.HorizontalAlignment === "Center"
							? "center"
							: undefined,
			alignItems:
				props.VerticalAlignment === "Bottom"
					? "end"
					: props.VerticalAlignment === "Center"
						? "center"
						: undefined
		}
		if (maxRowsOrColumns > 0)
			style["--items-repeater-grid-template"] =
				`repeat(${maxRowsOrColumns}, minmax(${minItemWidth}px, 1fr))`
		const focusItem = (index: number) => {
			rootRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus()
		}
		const getGridColumnCount = () => {
			if (maxRowsOrColumns > 0 && layoutType.includes("uniform")) return maxRowsOrColumns
			const root = rootRef.current
			if (!root) return 1
			return Math.max(1, Math.round(root.clientWidth / Math.max(minItemWidth, 1)))
		}
		useEffect(() => {
			previousItems.current.forEach((item, index) => {
				if (!items.includes(item))
					callback<unknown>(
						props,
						"onElementClearing",
						"ElementClearing"
					)?.({
						Element: rootRef.current?.querySelector(`[data-index="${index}"]`),
						Index: index,
						Data: item
					})
			})
			items.forEach((item, index) => {
				callback<unknown>(
					props,
					"onElementPrepared",
					"ElementPrepared"
				)?.({
					Element: rootRef.current?.querySelector(`[data-index="${index}"]`),
					Index: index,
					Data: item
				})
			})
			previousItems.current = items
		}, [items])
		useEffect(
			() => () => {
				previousItems.current.forEach((item, index) =>
					callback<unknown>(
						props,
						"onElementClearing",
						"ElementClearing"
					)?.({
						Element: rootRef.current?.querySelector(`[data-index="${index}"]`),
						Index: index,
						Data: item
					})
				)
			},
			[]
		)
		useImperativeHandle(
			ref,
			() => ({
				ItemsSourceView: itemsSourceView,
				GetElementIndex: getElementIndex,
				TryGetElement: tryGetElement,
				GetOrCreateElement: tryGetElement
			}),
			[items]
		)
		const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
			callback<unknown>(props, "onKeyDown", "KeyDown")?.(event)
			const columns = getGridColumnCount()
			const delta =
				event.key === "ArrowDown"
					? orientation === "Horizontal"
						? 1
						: columns
					: event.key === "ArrowUp"
						? orientation === "Horizontal"
							? -1
							: -columns
						: event.key === "ArrowRight"
							? 1
							: event.key === "ArrowLeft"
								? -1
								: 0
			if (delta !== 0) {
				event.preventDefault()
				focusItem(Math.max(0, Math.min(items.length - 1, index + delta)))
			} else if (event.key === "Home" || event.key === "End") {
				event.preventDefault()
				focusItem(event.key === "Home" ? 0 : Math.max(0, items.length - 1))
			}
		}
		return (
			<div
				ref={rootRef}
				className={cx(
					"win-items-repeater",
					`layout-${layoutType}`,
					orientation === "Horizontal"
						? "orientation-horizontal"
						: "orientation-vertical",
					props.class as string | undefined
				)}
				style={style}
				role="list"
			>
				{items.map((item, index) => (
					<div
						key={itemKey(item, index)}
						className="win-items-repeater-element"
						data-index={index}
						role="listitem"
						tabIndex={0}
						onFocus={(event) =>
							callback<unknown>(props, "onGettingFocus", "GettingFocus")?.(event)
						}
						onKeyDown={(event) => handleKeyDown(event, index)}
					>
						{renderItem
							? renderItem(item, index)
							: itemTemplate
								? itemTemplate(item, index)
								: itemLabel(item)}
					</div>
				))}
			</div>
		)
	}
)
