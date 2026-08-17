// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useState } from "react"
import { WinCheckBox } from "./winui-controls"
import {
	ScrollViewerScrollBarVisibility,
	ScrollViewerScrollMode,
	WinScrollViewer
} from "./winui-scrolling"
import { callback, commonStyle, cssLength, cx, itemLabel, itemsOf } from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinStyle, WinValue } from "./winui-shared"

export function WinItemsView(
	props: WinItemProps &
		WinChangeProps<WinValue> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			SelectedItems?: WinItem[]
			SelectionMode?: "None" | "Single" | "Multiple" | "Extended"
			IsItemInvokedEnabled?: boolean
			IsItemClickEnabled?: boolean
			Layout?: string | Record<string, unknown>
			HorizontalScrollMode?: ScrollViewerScrollMode
			VerticalScrollMode?: ScrollViewerScrollMode
			HorizontalScrollBarVisibility?: ScrollViewerScrollBarVisibility
			VerticalScrollBarVisibility?: ScrollViewerScrollBarVisibility
		}
): React.JSX.Element {
	const items = itemsOf(props)
	const mode = props.SelectionMode ?? (props.SelectedIndex !== undefined ? "Single" : "None")
	const initialSelection =
		mode === "Single" && props.SelectedItem !== undefined
			? [props.SelectedItem]
			: (props.SelectedItems ??
				(props.SelectedIndex !== undefined && items[props.SelectedIndex]
					? [items[props.SelectedIndex]]
					: []))
	const [internalSelection, setInternalSelection] = useState<WinItem[]>(initialSelection)
	const selectedItems =
		mode === "Single" && props.SelectedItem !== undefined
			? [props.SelectedItem]
			: (props.SelectedItems ?? internalSelection)
	const [selectionAnchor, setSelectionAnchor] = useState(-1)
	useEffect(() => {
		const nextSelection =
			mode === "Single" && props.SelectedItem !== undefined
				? [props.SelectedItem]
				: props.SelectedItems !== undefined
					? props.SelectedItems
					: props.SelectedIndex !== undefined
						? props.SelectedIndex >= 0 && items[props.SelectedIndex]
							? [items[props.SelectedIndex]]
							: []
						: undefined
		if (nextSelection !== undefined) setInternalSelection(nextSelection)
	}, [mode, props.SelectedItems, props.SelectedItem, props.SelectedIndex, items])
	const isSelected = (item: WinItem) =>
		selectedItems.some((selected) => Object.is(selected, item))
	const layout =
		typeof props.Layout === "object" && props.Layout !== null
			? props.Layout
			: { Type: props.Layout ?? "StackLayout" }
	const layoutType = String(layout.Type ?? layout.type ?? "StackLayout").toLowerCase()
	const orientation = String(layout.Orientation ?? layout.orientation ?? "Vertical")
	const layoutStyle: WinStyle = {
		"--items-view-spacing": cssLength(layout.Spacing ?? layout.spacing ?? 0),
		"--items-view-min-item-width": cssLength(
			layout.MinItemWidth ??
				layout.minItemWidth ??
				layout.ItemWidth ??
				layout.itemWidth ??
				150
		),
		"--items-view-min-item-height": cssLength(
			layout.MinItemHeight ??
				layout.minItemHeight ??
				layout.ItemHeight ??
				layout.itemHeight ??
				80
		),
		"--items-view-row-spacing": cssLength(
			layout.MinRowSpacing ??
				layout.minRowSpacing ??
				layout.LineSpacing ??
				layout.lineSpacing ??
				0
		),
		"--items-view-column-spacing": cssLength(
			layout.MinColumnSpacing ??
				layout.minColumnSpacing ??
				layout.MinItemSpacing ??
				layout.minItemSpacing ??
				0
		),
		"--items-view-line-height": cssLength(layout.LineHeight ?? layout.lineHeight ?? 160),
		"--items-view-grid-template":
			Number(layout.MaximumRowsOrColumns ?? layout.maximumRowsOrColumns ?? 0) > 0
				? `repeat(${Number(layout.MaximumRowsOrColumns ?? layout.maximumRowsOrColumns)}, max-content)`
				: undefined
	}
	const selectItem = (
		event: {
			shiftKey?: boolean
			ctrlKey?: boolean
			metaKey?: boolean
			currentTarget?: EventTarget | null
		},
		item: WinItem,
		index: number,
		checkedValue?: boolean
	) => {
		if (mode === "None") return
		const previous = selectedItems
		let next: WinItem[]
		let updateAnchor = true
		if (mode === "Single") {
			next = [item]
		} else if (mode === "Multiple") {
			if (checkedValue !== undefined) {
				next = checkedValue
					? isSelected(item)
						? previous
						: [...previous, item]
					: previous.filter((selected) => !Object.is(selected, item))
			} else {
				next = isSelected(item)
					? previous.filter((selected) => !Object.is(selected, item))
					: [...previous, item]
			}
		} else if (event.shiftKey && selectionAnchor >= 0) {
			const start = Math.min(selectionAnchor, index)
			const end = Math.max(selectionAnchor, index)
			next = items.slice(start, end + 1)
			updateAnchor = false
		} else if (event.ctrlKey || event.metaKey || checkedValue !== undefined) {
			if (checkedValue !== undefined) {
				next = checkedValue
					? isSelected(item)
						? previous
						: [...previous, item]
					: previous.filter((selected) => !Object.is(selected, item))
			} else {
				next = isSelected(item)
					? previous.filter((selected) => !Object.is(selected, item))
					: [...previous, item]
			}
		} else {
			next = [item]
		}
		if (updateAnchor) setSelectionAnchor(index)
		setInternalSelection(next)
		const addedItems = next.filter(
			(candidate) => !previous.some((selected) => Object.is(selected, candidate))
		)
		const removedItems = previous.filter(
			(candidate) => !next.some((selected) => Object.is(selected, candidate))
		)
		callback<WinItem[]>(props, "onUpdate:SelectedItems")?.(next)
		callback<WinItem | null>(props, "onUpdate:SelectedItem")?.(next[0] ?? null)
		callback<number>(
			props,
			"onUpdate:SelectedIndex"
		)?.(next.length > 0 ? items.findIndex((candidate) => Object.is(candidate, next[0])) : -1)
		callback<WinValue>(
			props,
			"onValueChange"
		)?.(next.length > 0 ? items.findIndex((candidate) => Object.is(candidate, next[0])) : -1)
		callback<unknown>(
			props,
			"onSelectionChanged",
			"SelectionChanged"
		)?.({
			AddedItems: addedItems,
			RemovedItems: removedItems,
			SelectedItems: next,
			OriginalSource: event.currentTarget
		})
	}
	const onCheckBoxChanged = (item: WinItem, index: number, value: boolean | null) => {
		selectItem({ currentTarget: null }, item, index, value === true)
	}
	const invokeItem = (event: React.MouseEvent<HTMLElement>, item: WinItem, index: number) => {
		if (!props.IsItemInvokedEnabled) return
		callback<unknown>(
			props,
			"onItemInvoked",
			"ItemInvoked"
		)?.({
			InvokedItem: item,
			Index: index,
			OriginalSource: event.currentTarget
		})
	}
	return (
		<WinScrollViewer
			{...props}
			className={cx("win-items-view", props.className, props.class)}
			role="listbox"
			VerticalScrollMode={props.VerticalScrollMode ?? "Auto"}
			VerticalScrollBarVisibility={props.VerticalScrollBarVisibility ?? "Auto"}
			HorizontalScrollMode={props.HorizontalScrollMode ?? "Auto"}
			HorizontalScrollBarVisibility={props.HorizontalScrollBarVisibility ?? "Auto"}
			aria-multiselectable={mode === "Multiple" || mode === "Extended"}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			<div
				className={cx(
					"win-items-view-layout",
					`layout-${layoutType}`,
					orientation === "Horizontal" ? "orientation-horizontal" : "orientation-vertical"
				)}
				style={layoutStyle}
			>
				{items.map((item, index) => (
					<div
						key={
							typeof item === "object" && item !== null
								? String(
										(item as Record<string, unknown>).Id ??
											(item as Record<string, unknown>).ID ??
											(item as Record<string, unknown>).id ??
											(item as Record<string, unknown>).Key ??
											(item as Record<string, unknown>).key ??
											(item as Record<string, unknown>).Title ??
											(item as Record<string, unknown>).title ??
											index
									)
								: index
						}
						className={cx(
							"win-items-view-item",
							isSelected(item) ? "selected" : undefined,
							props.IsItemInvokedEnabled ? "invokable" : undefined
						)}
						data-index={index}
						role="option"
						aria-selected={isSelected(item)}
						tabIndex={0}
						onClick={(event) => {
							selectItem(event, item, index)
							if (props.IsItemClickEnabled !== undefined) {
								if (props.IsItemClickEnabled)
									callback<unknown>(
										props,
										"onItemClick",
										"ItemClick"
									)?.({
										ClickedItem: item,
										OriginalSource: event.target
									})
							} else callback<unknown>(props, "onItemClick", "ItemClick")?.(item)
						}}
						onDoubleClick={(event) => invokeItem(event, item, index)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault()
								invokeItem(
									event as unknown as React.MouseEvent<HTMLElement>,
									item,
									index
								)
								return
							}
							if (event.key === " ") {
								event.preventDefault()
								selectItem(
									event as unknown as React.MouseEvent<HTMLElement>,
									item,
									index
								)
							}
						}}
					>
						{(mode === "Multiple" || mode === "Extended") && (
							<WinCheckBox
								className="selection-checkbox"
								IsChecked={isSelected(item)}
								onUpdate:IsChecked={(value) =>
									onCheckBoxChanged(item, index, value)
								}
								onClick={(event) => event.stopPropagation()}
								onKeyDown={(event) => event.stopPropagation()}
							/>
						)}
						{props.renderItem
							? props.renderItem(item, index)
							: props.ItemTemplate
								? props.ItemTemplate(item, index)
								: itemLabel(item)}
					</div>
				))}
			</div>
		</WinScrollViewer>
	)
}
