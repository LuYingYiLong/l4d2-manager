// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinCheckBox } from "./winui-controls"
import { callback, commonStyle, cx, domProps, itemLabel, itemsOf } from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinValue } from "./winui-shared"

export function WinTreeView(
	props: WinItemProps &
		WinChangeProps<WinValue> & {
			RootItems?: WinItem[]
			SelectionMode?: string
			SelectedItem?: WinItem
			SelectedItems?: WinItem[]
			CanDragItems?: boolean
			AllowDrop?: boolean
		}
): React.JSX.Element {
	type TreeNode = {
		item: WinItem
		key: string
		parentKey?: string
		level: number
		index: number
		siblings: WinItem[]
		children: WinItem[]
	}
	const source = props.RootItems ?? itemsOf(props)
	const selectionMode = String(props.SelectionMode ?? props.selectionMode ?? "Single")
	const canDrag = props.CanDragItems ?? props.canDragItems === true
	const allowDrop = props.AllowDrop ?? props.allowDrop === true
	const getRecord = (item: WinItem): Record<string, unknown> =>
		typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}
	const getChildren = (item: WinItem): WinItem[] => {
		const record = getRecord(item)
		for (const name of ["children", "Children", "Items", "ItemsSource"]) {
			if (Array.isArray(record[name])) return record[name] as WinItem[]
		}
		return []
	}
	const nodeKey = (item: WinItem, path: string) => {
		const record = getRecord(item)
		const identity = record.Key ?? record.Id ?? record.id ?? record.Value ?? record.value
		return identity === undefined || identity === null ? path : `${path}:${String(identity)}`
	}
	const initialExpanded = (item: WinItem) => {
		const record = getRecord(item)
		return record.IsExpanded ?? record.isExpanded ?? record.Expanded ?? record.expanded
	}
	const flatten = (
		items: WinItem[],
		level = 1,
		parentKey?: string,
		path = "0",
		expansionMap: Record<string, boolean> = {}
	): TreeNode[] => {
		const result: TreeNode[] = []
		items.forEach((item, index) => {
			const key = nodeKey(item, `${path}-${index}`)
			const children = getChildren(item)
			result.push({ item, key, parentKey, level, index, siblings: items, children })
			const expanded = expansionMap[key] ?? Boolean(initialExpanded(item))
			if (expanded && children.length > 0)
				result.push(...flatten(children, level + 1, key, key, expansionMap))
		})
		return result
	}
	const findKey = (target: WinItem | undefined, nodes: TreeNode[]) =>
		target === undefined ? undefined : nodes.find((node) => Object.is(node.item, target))?.key
	const initialNodes = flatten(source, 1, undefined, "0", {})
	const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})
	const expandedKeysRef = useRef<Record<string, boolean>>(expandedKeys)
	const [focusedKey, setFocusedKey] = useState(initialNodes[0]?.key ?? "")
	const [selectedKey, setSelectedKey] = useState<string | undefined>(() =>
		findKey(props.SelectedItem, initialNodes)
	)
	const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
		(props.SelectedItems ?? []).flatMap((item) => {
			const key = findKey(item, initialNodes)
			return key ? [key] : []
		})
	)
	const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const visibleNodes = flatten(source, 1, undefined, "0", expandedKeysRef.current)
	const dragStateRef = useRef<{ item: WinItem; parent: WinItem[] } | null>(null)
	const [dropState, setDropState] = useState<{
		key: string
		position: "top" | "bottom" | "inside"
	} | null>(null)
	const isMultiple = selectionMode === "Multiple" || selectionMode === "Extended"
	const selectedKeyFromProps = findKey(props.SelectedItem, visibleNodes)
	const controlledSelectedKey =
		props.SelectedItem === undefined ? selectedKey : selectedKeyFromProps
	const controlledSelectedKeys =
		props.SelectedItems === undefined
			? selectedKeys
			: props.SelectedItems.flatMap((item) => {
					const key = findKey(item, visibleNodes)
					return key ? [key] : []
				})
	const isRawSelected = (item: WinItem) => getRecord(item).selected === true
	const isAllSelected = (item: WinItem): boolean => {
		const children = getChildren(item)
		return children.length > 0 ? children.every(isAllSelected) : isRawSelected(item)
	}
	const isAnySelected = (item: WinItem): boolean => {
		const children = getChildren(item)
		return children.length > 0 ? children.some(isAnySelected) : isRawSelected(item)
	}
	const getCheckValue = (item: WinItem): boolean | null => {
		if (getChildren(item).length === 0) return isRawSelected(item)
		if (isAllSelected(item)) return true
		if (isAnySelected(item)) return null
		return false
	}
	const setAllSelected = (item: WinItem, value: boolean) => {
		const record = getRecord(item)
		if (typeof item === "object" && item !== null) record.selected = value
		getChildren(item).forEach((child) => setAllSelected(child, value))
	}
	const clearSelection = (items: WinItem[]) => {
		items.forEach((item) => {
			if (typeof item === "object" && item !== null) getRecord(item).selected = false
			clearSelection(getChildren(item))
		})
	}
	const selectedItemsFromTree = (items: WinItem[]): WinItem[] =>
		items.flatMap((item) => [
			...(isRawSelected(item) ? [item] : []),
			...selectedItemsFromTree(getChildren(item))
		])
	const onCheck = (node: TreeNode, value: boolean | null) => {
		const nextValue = value === true
		setAllSelected(node.item, nextValue)
		const nextItems = selectedItemsFromTree(source)
		const nextKeys = visibleNodes
			.filter((candidate) => nextItems.some((item) => Object.is(item, candidate.item)))
			.map((candidate) => candidate.key)
		setSelectedKeys(nextKeys)
		callback<WinItem[]>(props, "onUpdate:SelectedItems")?.(nextItems)
		callback<WinItem[]>(props, "onUpdate:ItemsSource", "onUpdate:items")?.([...source])
	}

	useEffect(() => {
		expandedKeysRef.current = expandedKeys
	}, [expandedKeys])
	const emitItems = () => {
		callback<WinItem[]>(props, "onUpdate:ItemsSource", "onUpdate:items")?.(source)
	}
	const moveFocus = (next: TreeNode | undefined) => {
		if (!next) return
		setFocusedKey(next.key)
		rowRefs.current[next.key]?.focus({ preventScroll: true })
	}
	const selectNode = (node: TreeNode) => {
		if (isMultiple) {
			const current = getCheckValue(node.item)
			onCheck(node, current === null ? false : !current)
		} else {
			clearSelection(source)
			if (typeof node.item === "object" && node.item !== null)
				getRecord(node.item).selected = true
			setSelectedKey(node.key)
			callback<WinItem>(props, "onUpdate:SelectedItem")?.(node.item)
			callback<unknown>(
				props,
				"onSelectionChanged",
				"SelectionChanged"
			)?.({
				SelectedItem: node.item,
				SelectedItems: [node.item]
			})
		}
		callback<WinItem>(
			props,
			"onItemClick",
			"ItemClick",
			"onItemInvoked",
			"ItemInvoked"
		)?.(node.item)
		emitItems()
	}
	const toggleExpand = (node: TreeNode) => {
		if (node.children.length === 0) return
		const nextExpanded = !(
			expandedKeysRef.current[node.key] ?? Boolean(initialExpanded(node.item))
		)
		const record = getRecord(node.item)
		const expandedKey = ["expanded", "Expanded", "isExpanded", "IsExpanded"].find(
			(key) => key in record
		)
		record[expandedKey ?? "expanded"] = nextExpanded
		expandedKeysRef.current = { ...expandedKeysRef.current, [node.key]: nextExpanded }
		setExpandedKeys(expandedKeysRef.current)
		callback<unknown>(
			props,
			nextExpanded ? "onExpanding" : "onCollapsed",
			nextExpanded ? "Expanding" : "Collapsed"
		)?.({
			Node: node.item,
			Item: node.item
		})
		emitItems()
	}
	const isDescendant = (parent: WinItem, child: WinItem): boolean =>
		getChildren(parent).some(
			(candidate) => candidate === child || isDescendant(candidate, child)
		)
	const dropNode = (node: TreeNode) => {
		const drag = dragStateRef.current
		if (!drag || drag.item === node.item || isDescendant(drag.item, node.item)) return
		const position = dropState?.key === node.key ? dropState.position : "inside"
		const oldIndex = drag.parent.indexOf(drag.item)
		if (oldIndex >= 0) drag.parent.splice(oldIndex, 1)
		if (position === "inside") {
			const record = getRecord(node.item)
			let children = getChildren(node.item)
			if (children.length === 0) {
				children = []
				record.children = children
			}
			children.push(drag.item)
			expandedKeysRef.current = { ...expandedKeysRef.current, [node.key]: true }
			setExpandedKeys(expandedKeysRef.current)
		} else {
			const targetIndex = node.siblings.indexOf(node.item)
			const insertIndex = Math.max(0, targetIndex + (position === "bottom" ? 1 : 0))
			node.siblings.splice(insertIndex, 0, drag.item)
		}
		dragStateRef.current = null
		setDropState(null)
		emitItems()
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, node: TreeNode) => {
		const index = visibleNodes.findIndex((candidate) => candidate.key === node.key)
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault()
			moveFocus(visibleNodes[index + (event.key === "ArrowDown" ? 1 : -1)])
			return
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault()
			moveFocus(
				event.key === "Home" ? visibleNodes[0] : visibleNodes[visibleNodes.length - 1]
			)
			return
		}
		if (event.key === "ArrowRight" && node.children.length > 0) {
			event.preventDefault()
			const expanded =
				expandedKeysRef.current[node.key] ?? Boolean(initialExpanded(node.item))
			if (!expanded) toggleExpand(node)
			else moveFocus(visibleNodes[index + 1])
			return
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault()
			const expanded =
				expandedKeysRef.current[node.key] ?? Boolean(initialExpanded(node.item))
			if (expanded && node.children.length > 0) toggleExpand(node)
			else if (node.parentKey)
				moveFocus(visibleNodes.find((candidate) => candidate.key === node.parentKey))
			return
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			selectNode(node)
		}
	}
	const renderTree = (nodes: TreeNode[]): ReactNode =>
		nodes.map((node) => {
			const expanded =
				expandedKeysRef.current[node.key] ?? Boolean(initialExpanded(node.item))
			const checkValue = getCheckValue(node.item)
			const controlledChecked = controlledSelectedKeys.includes(node.key)
			const selected = isMultiple
				? checkValue === true || controlledChecked
				: controlledSelectedKey === node.key || isRawSelected(node.item)
			const isFocused =
				focusedKey === node.key || (!focusedKey && node.key === visibleNodes[0]?.key)
			return (
				<div key={node.key} className="win-tree-node">
					<div
						ref={(element) => {
							rowRefs.current[node.key] = element
						}}
						className={cx(
							"win-tree-item",
							selected ? "selected" : undefined,
							dropState?.key === node.key ? `drop-${dropState.position}` : undefined
						)}
						style={{ paddingLeft: `${(node.level - 1) * 16 + 8}px` }}
						role="treeitem"
						tabIndex={isFocused ? 0 : -1}
						aria-level={node.level}
						aria-posinset={node.index + 1}
						aria-setsize={node.siblings.length}
						aria-selected={selected}
						aria-expanded={node.children.length > 0 ? expanded : undefined}
						draggable={canDrag}
						onFocus={() => setFocusedKey(node.key)}
						onKeyDown={(event) => handleKeyDown(event, node)}
						onClick={() => selectNode(node)}
						onDragStart={(event) => {
							if (canDrag) {
								dragStateRef.current = { item: node.item, parent: node.siblings }
								event.dataTransfer.effectAllowed = "move"
							}
						}}
						onDragOver={(event) => {
							if (!allowDrop) return
							event.preventDefault()
							event.stopPropagation()
							event.dataTransfer.dropEffect = "move"
							const rect = event.currentTarget.getBoundingClientRect()
							const offset = event.clientY - rect.top
							const position =
								offset < rect.height * 0.25
									? "top"
									: offset > rect.height * 0.75
										? "bottom"
										: "inside"
							setDropState({ key: node.key, position })
						}}
						onDragLeave={() => {
							if (dropState?.key === node.key) setDropState(null)
						}}
						onDrop={(event) => {
							if (!allowDrop) return
							event.preventDefault()
							event.stopPropagation()
							dropNode(node)
						}}
					>
						<button
							type="button"
							className={cx(
								"win-tree-chevron",
								node.children.length === 0 ? "is-hidden" : undefined
							)}
							aria-label={expanded ? "Collapse" : "Expand"}
							onClick={(event) => {
								event.stopPropagation()
								toggleExpand(node)
							}}
						>
							{node.children.length > 0 ? "\uE74C" : ""}
						</button>
						{isMultiple && (
							<div
								className="tree-checkbox"
								onClick={(event) => event.stopPropagation()}
							>
								<WinCheckBox
									IsThreeState
									IsChecked={
										controlledChecked && checkValue === false
											? true
											: checkValue
									}
									aria-label={`Select ${String(itemLabel(node.item))}`}
									onUpdate:IsChecked={(value) => onCheck(node, value)}
								/>
							</div>
						)}
						<span className="win-tree-item-content">
							{props.renderItem
								? props.renderItem(node.item, node.index)
								: props.ItemTemplate
									? props.ItemTemplate(node.item, node.index)
									: itemLabel(node.item)}
						</span>
					</div>
					{expanded && node.children.length > 0 && (
						<div className="win-tree-children" role="group">
							{renderTree(
								flatten(
									node.children,
									node.level + 1,
									node.key,
									node.key,
									expandedKeysRef.current
								)
							)}
						</div>
					)}
				</div>
			)
		})
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx("win-tree-view", "is-root", props.className, props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
			role="tree"
			aria-multiselectable={isMultiple}
			onDragOver={(event) => {
				if (allowDrop) {
					event.preventDefault()
					event.dataTransfer.dropEffect = "move"
				}
			}}
			onDrop={(event) => {
				if (!allowDrop || !dragStateRef.current) return
				event.preventDefault()
				const drag = dragStateRef.current
				const index = drag.parent.indexOf(drag.item)
				if (index >= 0) drag.parent.splice(index, 1)
				source.push(drag.item)
				dragStateRef.current = null
				emitItems()
			}}
		>
			{renderTree(visibleNodes.filter((node) => node.level === 1))}
		</div>
	)
}
