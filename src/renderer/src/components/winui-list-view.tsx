// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinScrollViewer } from "./winui-scrolling"
import {
	alignments,
	callback,
	commonStyle,
	cssLength,
	cx,
	domProps,
	itemLabel,
	itemsOf,
	itemRecord,
	xamlThickness
} from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinStyle, WinValue } from "./winui-shared"

type WinListViewItemStyle = {
	Height?: string | number
	MinHeight?: string | number
	Padding?: string | number
	BorderBrush?: string
	BorderThickness?: string | number
	CornerRadius?: string | number
	HorizontalContentAlignment?: string
	VerticalContentAlignment?: string
}

type WinListViewProps = WinItemProps &
	WinChangeProps<WinValue> & {
		IsGrouped?: boolean
		IsItemClickEnabled?: boolean
		CanDragItems?: boolean
		CanReorderItems?: boolean
		AllowDrop?: boolean
		AreStickyGroupHeadersEnabled?: boolean
		SelectedIndex?: number
		SelectedItem?: WinItem
		SelectedItems?: WinItem[]
		SelectionMode?: "None" | "Single" | "Multiple" | "Extended"
		ItemContainerStyle?: WinListViewItemStyle
	}

function listGroupItems(group: WinItem): WinItem[] {
	const items = itemRecord(group).Items ?? itemRecord(group).items
	return Array.isArray(items) ? (items as WinItem[]) : []
}

function listGroupTitle(group: WinItem): ReactNode {
	const record = itemRecord(group)
	return (record.Key ?? record.Title ?? record.Header ?? record.Name ?? "") as ReactNode
}

function listItemStyle(value: WinListViewItemStyle | undefined): WinStyle {
	if (!value) return {}
	return {
		height: cssLength(value.Height),
		minHeight: cssLength(value.MinHeight),
		padding: xamlThickness(value.Padding),
		borderColor: value.BorderBrush,
		borderWidth: cssLength(value.BorderThickness),
		borderRadius: cssLength(value.CornerRadius),
		justifyContent: value.HorizontalContentAlignment
			? (alignments[value.HorizontalContentAlignment] ?? value.HorizontalContentAlignment)
			: undefined,
		alignItems: value.VerticalContentAlignment
			? (alignments[value.VerticalContentAlignment] ?? value.VerticalContentAlignment)
			: undefined
	}
}

export function WinListView(props: WinListViewProps): React.JSX.Element {
	const sourceItems = itemsOf(props)
	const grouped = props.IsGrouped === true
	const mode = props.SelectionMode ?? (props.SelectedIndex !== undefined ? "Single" : "Single")
	const initialFlatItems = grouped
		? sourceItems.flatMap((group) => listGroupItems(group))
		: sourceItems
	const [internalItems, setInternalItems] = useState<WinItem[]>(sourceItems)
	const [internalSelection, setInternalSelection] = useState<WinItem[]>(
		() =>
			props.SelectedItems ??
			(props.SelectedItem !== undefined
				? [props.SelectedItem]
				: props.SelectedIndex !== undefined &&
					  props.SelectedIndex >= 0 &&
					  initialFlatItems[props.SelectedIndex]
					? [initialFlatItems[props.SelectedIndex]]
					: [])
	)
	const [selectionAnchor, setSelectionAnchor] = useState(-1)
	const [draggingIndices, setDraggingIndices] = useState<number[]>([])
	const [insertBeforeIndex, setInsertBeforeIndex] = useState(-1)
	const itemElements = useRef<Record<number, HTMLDivElement | null>>({})
	const isDragging = draggingIndices.length > 0

	useEffect(() => {
		if (!isDragging) setInternalItems(sourceItems)
	}, [props.ItemsSource, props.Items, isDragging])

	const flatItems = grouped
		? internalItems.flatMap((group) => listGroupItems(group))
		: internalItems
	const selectedItems = internalSelection
	useEffect(() => {
		const nextSelection =
			props.SelectedItems !== undefined
				? props.SelectedItems
				: props.SelectedItem !== undefined
					? [props.SelectedItem]
					: props.SelectedIndex !== undefined
						? props.SelectedIndex >= 0 && flatItems[props.SelectedIndex]
							? [flatItems[props.SelectedIndex]]
							: []
						: undefined
		if (nextSelection !== undefined) setInternalSelection(nextSelection)
	}, [props.SelectedItems, props.SelectedItem, props.SelectedIndex, grouped, internalItems])
	const isSelected = (item: WinItem) =>
		selectedItems.some((selected) => Object.is(selected, item))
	const isEnabled = props.IsEnabled !== false
	const canDrag = isEnabled && props.CanDragItems === true && !grouped
	const itemStyle = listItemStyle(props.ItemContainerStyle)

	const updateSelection = (
		event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
		item: WinItem,
		index: number
	) => {
		if (!isEnabled || mode === "None" || isDragging) return
		const previous = selectedItems
		let next: WinItem[]
		let updateAnchor = true
		if (mode === "Single") {
			next = [item]
		} else if (mode === "Multiple") {
			next = isSelected(item)
				? previous.filter((selected) => !Object.is(selected, item))
				: [...previous, item]
		} else if (event.shiftKey && selectionAnchor >= 0) {
			const start = Math.min(selectionAnchor, index)
			const end = Math.max(selectionAnchor, index)
			next = flatItems.slice(start, end + 1)
			updateAnchor = false
		} else if (event.ctrlKey || event.metaKey) {
			next = isSelected(item)
				? previous.filter((selected) => !Object.is(selected, item))
				: [...previous, item]
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
		const nextIndex =
			next.length > 0 ? flatItems.findIndex((candidate) => Object.is(candidate, next[0])) : -1
		callback<number>(props, "onUpdate:SelectedIndex")?.(nextIndex)
		callback<WinValue>(props, "onValueChange")?.(nextIndex)
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

	const itemClick = (
		event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
		item: WinItem
	) => {
		if (!props.IsItemClickEnabled || !isEnabled || isDragging) return
		callback<unknown>(
			props,
			"onItemClick",
			"ItemClick"
		)?.({
			ClickedItem: item,
			OriginalSource: event.target
		})
	}

	const dragIndicesFor = (index: number) => {
		if (!selectedItems.some((selected) => Object.is(selected, flatItems[index]))) return [index]
		const indices = flatItems.reduce<number[]>((result, item, itemIndex) => {
			if (isSelected(item)) result.push(itemIndex)
			return result
		}, [])
		return indices.length > 0 ? indices : [index]
	}

	const onDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
		if (!canDrag) {
			event.preventDefault()
			return
		}
		const indices = dragIndicesFor(index)
		setDraggingIndices(indices)
		setInsertBeforeIndex(-1)
		event.dataTransfer.effectAllowed = "move"
		event.dataTransfer.setData("text/plain", "")
		callback<unknown>(
			props,
			"onDragItemsStarting",
			"DragItemsStarting"
		)?.({
			Items: indices.map((itemIndex) => internalItems[itemIndex]),
			OriginalSource: event.currentTarget
		})
	}

	const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		if (!isEnabled || (!isDragging && !props.AllowDrop)) return
		if (isDragging && props.CanReorderItems !== true) return
		event.preventDefault()
		event.dataTransfer.dropEffect = isDragging && props.CanReorderItems ? "move" : "copy"
		let nextInsertIndex = flatItems.length
		for (let index = 0; index < flatItems.length; index += 1) {
			const element = itemElements.current[index]
			if (!element || draggingIndices.includes(index)) continue
			const bounds = element.getBoundingClientRect()
			if (event.clientY < bounds.top + bounds.height / 2) {
				nextInsertIndex = index
				break
			}
		}
		setInsertBeforeIndex(nextInsertIndex)
		callback<unknown>(
			props,
			"onDragOver",
			"DragOver"
		)?.({
			DataTransfer: event.dataTransfer,
			AcceptedOperation: isDragging ? "Move" : "Copy",
			InsertIndex: nextInsertIndex,
			OriginalSource: event.target
		})
	}

	const resetDrag = () => {
		setDraggingIndices([])
		setInsertBeforeIndex(-1)
	}

	const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
		if (!isEnabled || (!isDragging && !props.AllowDrop)) return
		event.preventDefault()
		const insertIndex = insertBeforeIndex < 0 ? flatItems.length : insertBeforeIndex
		if (!isDragging) {
			callback<unknown>(
				props,
				"onDrop",
				"Drop"
			)?.({
				DataTransfer: event.dataTransfer,
				AcceptedOperation: "Copy",
				InsertIndex: insertIndex,
				OriginalSource: event.target
			})
			resetDrag()
			return
		}
		if (props.CanReorderItems !== true) {
			resetDrag()
			return
		}
		const movedItems = draggingIndices.map((index) => internalItems[index])
		const remainingItems = internalItems.filter((_, index) => !draggingIndices.includes(index))
		const adjustedIndex = Math.max(
			0,
			Math.min(
				remainingItems.length,
				insertIndex - draggingIndices.filter((index) => index < insertIndex).length
			)
		)
		const nextItems = [
			...remainingItems.slice(0, adjustedIndex),
			...movedItems,
			...remainingItems.slice(adjustedIndex)
		]
		setInternalItems(nextItems)
		callback<WinItem[]>(props, "onUpdate:ItemsSource")?.(nextItems)
		callback<unknown>(
			props,
			"onDrop",
			"Drop"
		)?.({
			DataTransfer: event.dataTransfer,
			AcceptedOperation: "Move",
			InsertIndex: adjustedIndex,
			OriginalSource: event.target
		})
		callback<unknown>(
			props,
			"onDragItemsCompleted",
			"DragItemsCompleted"
		)?.({
			Items: movedItems,
			DropResult: "Move"
		})
		resetDrag()
	}

	const renderItem = (item: WinItem, index: number) => {
		const selected = isSelected(item)
		const isDragSource = draggingIndices.includes(index)
		return (
			<div
				key={String(
					itemRecord(item).Key ?? itemRecord(item).Id ?? itemRecord(item).id ?? index
				)}
				ref={(element) => {
					itemElements.current[index] = element
				}}
				className={cx(
					"win-list-item",
					selected ? "selected" : undefined,
					props.IsItemClickEnabled ? "interactive" : undefined,
					props.ItemContainerStyle?.HorizontalContentAlignment === "Stretch"
						? "content-stretch"
						: undefined,
					isDragSource ? "dragging-source" : undefined,
					insertBeforeIndex === index ? "drag-before" : undefined
				)}
				style={itemStyle}
				role="option"
				aria-selected={mode === "None" ? undefined : selected}
				aria-disabled={!isEnabled}
				tabIndex={isEnabled && mode !== "None" ? 0 : -1}
				draggable={canDrag}
				onDragStart={(event) => onDragStart(event, index)}
				onDragEnd={resetDrag}
				onClick={(event) => {
					itemClick(event, item)
					updateSelection(event, item, index)
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault()
						itemClick(event, item)
						updateSelection(event, item, index)
					}
				}}
			>
				{mode === "Multiple" && (
					<span
						className={cx("list-selection-box", selected ? "checked" : undefined)}
						aria-hidden="true"
					>
						{"\uE73E"}
					</span>
				)}
				{props.renderItem
					? props.renderItem(item, index)
					: props.ItemTemplate
						? props.ItemTemplate(item, index)
						: itemLabel(item)}
				{(mode === "Single" || mode === "Extended") && (
					<span
						className={cx(
							"win-list-view-selection-indicator",
							selected ? "active" : undefined
						)}
						aria-hidden="true"
					/>
				)}
			</div>
		)
	}

	const renderList = () => {
		if (!grouped) return internalItems.map((item, index) => renderItem(item, index))
		let flatIndex = 0
		return internalItems.map((group, groupIndex) => {
			const groupItems = listGroupItems(group)
			const renderedItems = groupItems.map((item) => {
				const rendered = renderItem(item, flatIndex)
				flatIndex += 1
				return rendered
			})
			return (
				<div
					key={String(itemRecord(group).Key ?? itemRecord(group).Id ?? groupIndex)}
					className="win-list-group"
				>
					<div
						className={cx(
							"win-list-header",
							props.AreStickyGroupHeadersEnabled ? "sticky" : undefined
						)}
					>
						{listGroupTitle(group)}
					</div>
					{renderedItems}
				</div>
			)
		})
	}

	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-list-view",
				props.className,
				props.class,
				!isEnabled ? "disabled" : undefined
			)}
			role="listbox"
			aria-disabled={!isEnabled}
			aria-multiselectable={mode === "Multiple" || mode === "Extended"}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			<WinScrollViewer
				className="win-list-scroll-viewer"
				VerticalScrollMode="Auto"
				HorizontalScrollMode="Disabled"
				VerticalScrollBarVisibility="Auto"
				HorizontalScrollBarVisibility="Hidden"
				onDragOver={onDragOver}
				onDrop={onDrop}
			>
				<div className="win-list-content" onDragOver={onDragOver} onDrop={onDrop}>
					{renderList()}
				</div>
			</WinScrollViewer>
		</div>
	)
}
