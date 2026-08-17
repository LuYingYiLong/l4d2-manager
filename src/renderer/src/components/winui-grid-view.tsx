// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinCheckBox } from "./winui-controls"
import { callback, commonStyle, cx, domProps, itemLabel, itemsOf, itemRecord } from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinValue } from "./winui-shared"

type WinGridViewProps = WinItemProps &
	WinChangeProps<WinValue> & {
		SelectedIndex?: number
		SelectedItem?: WinItem
		SelectedItems?: WinItem[]
		SelectionMode?: "None" | "Single" | "Multiple" | "Extended"
		IsItemClickEnabled?: boolean
		CanDragItems?: boolean
		CanReorderItems?: boolean
		AllowDrop?: boolean
		IsGrouped?: boolean
		GroupHeaderTemplate?: (group: WinItem, index: number) => ReactNode
	}

export function WinGridView(props: WinGridViewProps): React.JSX.Element {
	const items = itemsOf(props)
	const mode = props.SelectionMode ?? "Single"
	const isEnabled = props.IsEnabled !== false
	const isItemClickEnabled = props.IsItemClickEnabled ?? true
	const canDragItems = isEnabled && props.CanDragItems === true
	const canReorderItems = props.CanReorderItems === true
	const allowDrop = props.AllowDrop === true
	const grouped = props.IsGrouped === true
	const groupItems = (group: WinItem) => {
		const record = itemRecord(group)
		const children = record.Items ?? record.items
		return Array.isArray(children) ? (children as WinItem[]) : []
	}
	const sourceItems = grouped ? items.flatMap((group) => groupItems(group)) : items
	const itemKey = (item: WinItem, index: number) => {
		const record = itemRecord(item)
		return String(record.id ?? record.Id ?? record.Key ?? record.key ?? record.Title ?? index)
	}
	const initialSelection =
		props.SelectedItems ??
		(props.SelectedItem !== undefined
			? [props.SelectedItem]
			: props.SelectedIndex !== undefined && sourceItems[props.SelectedIndex]
				? [sourceItems[props.SelectedIndex]]
				: [])
	const [internalSelection, setInternalSelection] = useState<WinItem[]>(initialSelection)
	const selectedItems = props.SelectedItems ?? internalSelection
	const [selectionAnchor, setSelectionAnchor] = useState(-1)
	const [draggingIndices, setDraggingIndices] = useState<number[]>([])
	const [insertSlotIndex, setInsertSlotIndex] = useState(-1)
	const [dragSize, setDragSize] = useState({ width: 0, height: 0 })
	const gridRef = useRef<HTMLDivElement>(null)
	const isDragging = draggingIndices.length > 0

	useEffect(() => {
		if (props.SelectedItems !== undefined) {
			setInternalSelection(props.SelectedItems)
			return
		}
		if (props.SelectedItem !== undefined) {
			setInternalSelection(props.SelectedItem === null ? [] : [props.SelectedItem])
			return
		}
		if (props.SelectedIndex !== undefined) {
			setInternalSelection(
				props.SelectedIndex >= 0 && sourceItems[props.SelectedIndex]
					? [sourceItems[props.SelectedIndex]]
					: []
			)
		}
	}, [props.SelectedItems, props.SelectedItem, props.SelectedIndex, items, grouped])

	const isSelected = (item: WinItem) =>
		selectedItems.some((selected) => Object.is(selected, item))
	const emitSelection = (
		next: WinItem[],
		event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
	) => {
		const previous = selectedItems
		const addedItems = next.filter(
			(item) => !previous.some((selected) => Object.is(selected, item))
		)
		const removedItems = previous.filter(
			(item) => !next.some((selected) => Object.is(selected, item))
		)
		if (props.SelectedItems === undefined) setInternalSelection(next)
		const nextIndex = next.length > 0 ? sourceItems.indexOf(next[0]) : -1
		callback<WinItem[]>(props, "onUpdate:SelectedItems", "onUpdate:selectedItems")?.(next)
		callback<WinItem | null>(props, "onUpdate:SelectedItem")?.(next[0] ?? null)
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

	const selectItem = (
		event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
		item: WinItem,
		index: number
	) => {
		if (!isEnabled || isDragging) return
		if (isItemClickEnabled)
			callback<unknown>(
				props,
				"onItemClick",
				"ItemClick"
			)?.({
				ClickedItem: item,
				OriginalSource: event.target
			})
		if (mode === "None") return
		let next: WinItem[]
		if (mode === "Single") {
			next = [item]
			setSelectionAnchor(index)
		} else if (mode === "Multiple") {
			next = isSelected(item)
				? selectedItems.filter((selected) => !Object.is(selected, item))
				: [...selectedItems, item]
			setSelectionAnchor(index)
		} else if ((event.ctrlKey || event.metaKey) && mode === "Extended") {
			next = isSelected(item)
				? selectedItems.filter((selected) => !Object.is(selected, item))
				: [...selectedItems, item]
			setSelectionAnchor(index)
		} else if (event.shiftKey && selectionAnchor >= 0) {
			const start = Math.min(selectionAnchor, index)
			const end = Math.max(selectionAnchor, index)
			next = sourceItems.slice(start, end + 1)
		} else {
			next = [item]
			setSelectionAnchor(index)
		}
		emitSelection(next, event)
	}

	const toggleCheckBox = (item: WinItem, value: boolean | null) => {
		if (!isEnabled || mode === "None") return
		const next =
			value === true
				? isSelected(item)
					? selectedItems
					: [...selectedItems, item]
				: selectedItems.filter((selected) => !Object.is(selected, item))
		emitSelection(next, {
			currentTarget: gridRef.current,
			target: gridRef.current
		} as unknown as React.MouseEvent<HTMLElement>)
	}

	const resetDrag = () => {
		setDraggingIndices([])
		setInsertSlotIndex(-1)
		setDragSize({ width: 0, height: 0 })
	}

	const dragIndicesFor = (index: number) => {
		if (!isSelected(items[index])) return [index]
		const indices = items.reduce<number[]>((result, item, itemIndex) => {
			if (isSelected(item)) result.push(itemIndex)
			return result
		}, [])
		return indices.length > 0 ? indices : [index]
	}

	const onDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
		if (!canDragItems || grouped) {
			event.preventDefault()
			return
		}
		const indices = dragIndicesFor(index)
		setDraggingIndices(indices)
		setInsertSlotIndex(-1)
		setDragSize({
			width: event.currentTarget.offsetWidth,
			height: event.currentTarget.offsetHeight
		})
		event.dataTransfer.effectAllowed = "move"
		event.dataTransfer.setData("text/plain", "")
		callback<unknown>(
			props,
			"onDragItemsStarting",
			"DragItemsStarting"
		)?.({
			Items: indices.map((itemIndex) => items[itemIndex]),
			OriginalSource: event.currentTarget
		})
	}

	const calculateInsertSlot = (event: React.DragEvent<HTMLDivElement>) => {
		const root = gridRef.current
		if (!root) return -1
		const candidates = Array.from(
			root.querySelectorAll<HTMLElement>(
				".win-grid-item[data-grid-index]:not(.dragging-source)"
			)
		)
		const entries = candidates
			.map((element) => ({
				index: Number(element.dataset.gridIndex),
				rect: element.getBoundingClientRect()
			}))
			.filter((entry) => Number.isFinite(entry.index))
			.sort(
				(left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left
			)
		if (entries.length === 0) return items.length
		const row = entries.filter(
			(entry) => event.clientY >= entry.rect.top && event.clientY <= entry.rect.bottom
		)
		const activeRow =
			row.length > 0
				? row
				: event.clientY < entries[0].rect.top
					? entries.slice(0, 1)
					: entries.slice(-1)
		for (const entry of activeRow) {
			if (event.clientX < entry.rect.left + entry.rect.width / 2) return entry.index
		}
		return event.clientY > entries.at(-1)!.rect.bottom
			? items.length
			: (activeRow.at(-1)?.index ?? items.length) + 1
	}

	const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		if (!isEnabled || !allowDrop || !canReorderItems || grouped) return
		event.preventDefault()
		event.dataTransfer.dropEffect = "move"
		const slot = calculateInsertSlot(event)
		if (slot < 0) return
		const sorted = [...draggingIndices].sort((left, right) => left - right)
		const contiguous = sorted.every((index, offset) => index === sorted[0] + offset)
		if (contiguous && slot >= sorted[0] && slot <= sorted[sorted.length - 1] + 1) {
			setInsertSlotIndex(-1)
			return
		}
		setInsertSlotIndex(slot)
		callback<unknown>(
			props,
			"onDragOver",
			"DragOver"
		)?.({
			DataTransfer: event.dataTransfer,
			AcceptedOperation: "Move",
			InsertIndex: slot,
			OriginalSource: event.target
		})
	}

	const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
		if (!isEnabled || !allowDrop) return
		event.preventDefault()
		if (!isDragging || !canReorderItems || grouped) {
			callback<unknown>(
				props,
				"onDrop",
				"Drop"
			)?.({
				DataTransfer: event.dataTransfer,
				AcceptedOperation: "Copy",
				InsertIndex: insertSlotIndex >= 0 ? insertSlotIndex : items.length,
				OriginalSource: event.target
			})
			resetDrag()
			return
		}
		if (insertSlotIndex < 0) {
			resetDrag()
			return
		}
		const draggedItems = draggingIndices.map((index) => items[index])
		const remaining = items.filter((_, index) => !draggingIndices.includes(index))
		const target = items[insertSlotIndex]
		const insertAt =
			insertSlotIndex >= items.length
				? remaining.length
				: Math.max(0, remaining.indexOf(target))
		const nextItems = [...remaining]
		nextItems.splice(insertAt, 0, ...draggedItems)
		callback<WinItem[]>(props, "onUpdate:ItemsSource")?.(nextItems)
		callback<WinItem[]>(props, "onReorder", "reorder")?.(nextItems)
		callback<unknown>(
			props,
			"onDrop",
			"Drop"
		)?.({
			DataTransfer: event.dataTransfer,
			AcceptedOperation: "Move",
			InsertIndex: insertAt,
			OriginalSource: event.target
		})
		callback<unknown>(
			props,
			"onDragItemsCompleted",
			"DragItemsCompleted"
		)?.({
			Items: draggedItems,
			DropResult: "Move"
		})
		resetDrag()
	}

	const renderItem = (item: WinItem, index: number, group?: WinItem) => {
		const selected = isSelected(item)
		const isSource = draggingIndices.includes(index)
		const content = props.renderItem
			? props.renderItem(item, index)
			: props.ItemTemplate
				? props.ItemTemplate(item, index)
				: itemLabel(item)
		return (
			<div
				key={`${group ? "group-" : "item-"}${index}-${itemKey(item, index)}`}
				className={cx(
					"win-grid-item",
					selected ? "selected" : undefined,
					isItemClickEnabled && !isDragging ? "clickEnabled" : undefined,
					isDragging && !isSource ? "drag-shrink" : undefined,
					isSource ? "dragging-source" : undefined,
					!group && (mode === "Multiple" || mode === "Extended")
						? "has-checkbox"
						: undefined
				)}
				data-grid-index={group ? undefined : index}
				draggable={group ? false : canDragItems}
				onClick={(event) => selectItem(event, item, index)}
				onDragStart={(event) => onDragStart(event, index)}
				onDragEnd={resetDrag}
			>
				{!group && (mode === "Multiple" || mode === "Extended") && (
					<div className="grid-checkbox" onClick={(event) => event.stopPropagation()}>
						<WinCheckBox
							IsChecked={selected}
							onUpdate:IsChecked={(value) => toggleCheckBox(item, value)}
						/>
					</div>
				)}
				<div className="grid-item-inner">{content}</div>
				{isDragging && isSource && draggingIndices.length > 1 && (
					<div className="drag-count-badge">{draggingIndices.length}</div>
				)}
			</div>
		)
	}

	const renderEntries = () => {
		const entries: ReactNode[] = []
		items.forEach((item, index) => {
			if (isDragging && insertSlotIndex === index && !draggingIndices.includes(index))
				entries.push(
					<div
						key={`placeholder-${index}`}
						className="win-grid-drop-placeholder"
						style={{ width: dragSize.width, height: dragSize.height }}
					/>
				)
			entries.push(renderItem(item, index))
		})
		if (isDragging && insertSlotIndex >= items.length)
			entries.push(
				<div
					key="placeholder-end"
					className="win-grid-drop-placeholder"
					style={{ width: dragSize.width, height: dragSize.height }}
				/>
			)
		return entries
	}

	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={gridRef}
			className={cx("win-grid-view", props.className, props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
			role="listbox"
			aria-multiselectable={mode === "Multiple" || mode === "Extended"}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onDragLeave={() => {
				if (!isDragging) setInsertSlotIndex(-1)
			}}
		>
			{grouped ? (
				<div className="win-grid-groups">
					{items.map((group, groupIndex) => (
						<section
							key={`group-${groupIndex}-${itemKey(group, groupIndex)}`}
							className="win-grid-group"
						>
							<button
								type="button"
								className="win-grid-group-header"
								onClick={(event) =>
									event.currentTarget.dispatchEvent(
										new CustomEvent("semanticzoomrequest", {
											bubbles: true,
											detail: {
												Item: group,
												OriginalSource: event.currentTarget
											}
										})
									)
								}
							>
								{props.GroupHeaderTemplate
									? props.GroupHeaderTemplate(group, groupIndex)
									: itemLabel(group)}
								<span className="win-grid-group-divider" aria-hidden="true" />
							</button>
							<div className="win-grid-view-inner win-grid-group-items">
								{groupItems(group).map((item, itemIndex) =>
									renderItem(item, itemIndex, group)
								)}
							</div>
						</section>
					))}
				</div>
			) : (
				<div className="win-grid-view-inner">{renderEntries()}</div>
			)}
		</div>
	)
}
