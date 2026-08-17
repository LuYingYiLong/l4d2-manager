// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { WinFlyout } from "./winui-dialogs"
import { callback, cx, itemLabel } from "./winui-shared"
import type { WinItem, WinProps, WinStyle, WinValue } from "./winui-shared"

export interface WinMenuItem {
	Text?: ReactNode
	Title?: ReactNode
	Label?: ReactNode
	Icon?: ReactNode
	Value?: WinValue
	IsEnabled?: boolean
	IsChecked?: boolean
	Separator?: boolean
	Kind?: string
	Items?: WinMenuItem[]
	GroupName?: string
	Foreground?: string
	Background?: string
	KeyboardAcceleratorTextOverride?: string
	KeyboardAccelerators?: Array<{ Key?: string; Modifiers?: string | string[] }>
	Command?: Record<string, unknown>
	[key: string]: unknown
}

function menuItemKind(item: WinMenuItem): string {
	if (item.Separator || item.Kind === "MenuFlyoutSeparator") return "MenuFlyoutSeparator"
	if (item.Kind) return item.Kind
	if (item.Items) return "MenuFlyoutSubItem"
	return "MenuFlyoutItem"
}

export function menuItemDisabled(item: WinMenuItem): boolean {
	if (item.IsEnabled === false) return true
	const command = item.Command
	return (
		typeof command?.CanExecute === "function" &&
		(command.CanExecute as (parameter: unknown) => boolean)(item.CommandParameter) === false
	)
}

export function menuItemText(item: WinMenuItem): ReactNode {
	return (item.Text ?? item.Command?.Label ?? itemLabel(item as unknown as WinItem)) as ReactNode
}

function menuItemIcon(item: WinMenuItem): ReactNode {
	const command = item.Command
	const iconSource = command?.IconSource
	if (item.Icon) return item.Icon
	if (typeof iconSource === "string") {
		const commandGlyphs: Record<string, string> = {
			Cancel: "\uE711",
			Copy: "\uE8C8",
			Cut: "\uE8C6",
			Delete: "\uE74D",
			OpenFile: "\uE8E5",
			Paste: "\uE77F",
			Redo: "\uE7A6",
			Save: "\uE74E",
			SelectAll: "\uE8B3",
			Undo: "\uE7A7"
		}
		return commandGlyphs[iconSource] ?? iconSource
	}
	if (typeof iconSource === "object" && iconSource !== null) {
		const source = iconSource as Record<string, unknown>
		return (source.Glyph ?? source.Symbol) as ReactNode
	}
	return ""
}

function menuItemAccelerator(item: WinMenuItem): string {
	if (item.KeyboardAcceleratorTextOverride) return item.KeyboardAcceleratorTextOverride
	const accelerator = item.KeyboardAccelerators?.[0] ?? item.Command?.KeyboardAccelerators?.[0]
	if (!accelerator) return ""
	const modifiers = Array.isArray(accelerator.Modifiers)
		? accelerator.Modifiers
		: String(accelerator.Modifiers ?? "")
				.split(/[,+\s]+/)
				.filter(Boolean)
	const parts: string[] = []
	if (modifiers.includes("Control") || modifiers.includes("Ctrl")) parts.push("Ctrl")
	if (modifiers.includes("Shift")) parts.push("Shift")
	if (modifiers.includes("Alt")) parts.push("Alt")
	if (modifiers.includes("Windows") || modifiers.includes("Meta")) parts.push("Win")
	if (accelerator.Key) {
		const key = String(accelerator.Key)
		parts.push(key.length === 1 ? key.toUpperCase() : key)
	}
	return parts.join("+")
}

export function matchesMenuAccelerator(item: WinMenuItem, event: React.KeyboardEvent): boolean {
	const commandAccelerators = item.Command?.KeyboardAccelerators
	const accelerators =
		item.KeyboardAccelerators ??
		(Array.isArray(commandAccelerators)
			? (commandAccelerators as Array<{ Key?: string; Modifiers?: string | string[] }>)
			: [])
	return accelerators.some((accelerator) => {
		const modifiers = new Set(
			(Array.isArray(accelerator.Modifiers)
				? accelerator.Modifiers
				: String(accelerator.Modifiers ?? "")
						.split(/[,+\s]+/)
						.filter(Boolean)) as string[]
		)
		return (
			event.key.toLowerCase() === String(accelerator.Key ?? "").toLowerCase() &&
			event.ctrlKey === (modifiers.has("Control") || modifiers.has("Ctrl")) &&
			event.shiftKey === modifiers.has("Shift") &&
			event.altKey === modifiers.has("Alt") &&
			event.metaKey === (modifiers.has("Windows") || modifiers.has("Meta"))
		)
	})
}

function menuItemHeight(item: WinMenuItem): number {
	return menuItemKind(item) === "MenuFlyoutSeparator" ? 3 : 36
}

function estimateMenuHeight(items: WinMenuItem[]): number {
	return Math.max(
		0,
		items.reduce((height, item) => height + menuItemHeight(item), 4)
	)
}

function estimateMenuWidth(items: WinMenuItem[]): number {
	if (items.length === 0) return 180
	const hasToggle = items.some((item) =>
		["ToggleMenuFlyoutItem", "RadioMenuFlyoutItem"].includes(menuItemKind(item))
	)
	const hasIcon = items.some((item) => Boolean(menuItemIcon(item)))
	return Math.max(
		96,
		Math.min(
			320,
			...items.map((item) => {
				const label = String(menuItemText(item) ?? "")
				const accelerator = menuItemAccelerator(item)
				return (
					30 +
					label.length * 7.2 +
					(hasToggle ? 28 : 0) +
					(hasIcon ? 28 : 0) +
					(accelerator ? 24 + accelerator.length * 6.5 : 0)
				)
			})
		)
	)
}

export function WinMenuFlyout(
	props: Omit<WinProps, "onSelect"> & {
		Items?: WinMenuItem[]
		FlyoutItems?: WinMenuItem[]
		Placement?: string
		MinWidth?: string | number
		Gap?: number
		OverlayInputPassThroughElement?: boolean
		IsOpen?: boolean
		Open?: boolean
		onSelect?: (item: WinMenuItem) => void
		onClose?: () => void
	}
): React.JSX.Element {
	const items = props.Items ?? props.FlyoutItems ?? []
	const externalOpen = props.IsOpen ?? props.Open
	const [open, setOpenValue] = useState(externalOpen ?? false)
	const setOpenState = (next: boolean) => {
		setOpenValue(next)
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen")?.(next)
	}
	const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
	const [checkedState, setCheckedState] = useState<Record<string, boolean>>({})
	const menuRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
	const submenuAnchorRefs = useRef<Record<string, HTMLElement | null>>({})
	const submenuOpenTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const submenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const focusFrameRef = useRef<number | undefined>(undefined)
	const [, setLayoutVersion] = useState(0)
	useEffect(() => {
		if (externalOpen !== undefined) setOpenValue(externalOpen)
	}, [externalOpen])
	const closeMenu = () => {
		if (submenuOpenTimerRef.current) clearTimeout(submenuOpenTimerRef.current)
		if (submenuCloseTimerRef.current) clearTimeout(submenuCloseTimerRef.current)
		submenuOpenTimerRef.current = undefined
		submenuCloseTimerRef.current = undefined
		setOpenState(false)
		setOpenSubmenu(null)
		callback<unknown>(props, "onClose", "Close")?.(undefined)
	}
	const setOpen = (next: boolean) => {
		if (next) setOpenState(true)
		else closeMenu()
	}
	const hasToggleItems = (source: WinMenuItem[]): boolean =>
		source.some(
			(item) =>
				["ToggleMenuFlyoutItem", "RadioMenuFlyoutItem"].includes(menuItemKind(item)) ||
				(item.Items ? hasToggleItems(item.Items) : false)
		)
	const hasIconItems = (source: WinMenuItem[]): boolean =>
		source.some(
			(item) => Boolean(menuItemIcon(item)) || (item.Items ? hasIconItems(item.Items) : false)
		)
	const hasToggle = hasToggleItems(items)
	const hasIcon = hasIconItems(items)
	const itemKey = (prefix: string, index: number) => `${prefix}-${index}`
	const clearSubmenuTimers = () => {
		if (submenuOpenTimerRef.current) clearTimeout(submenuOpenTimerRef.current)
		if (submenuCloseTimerRef.current) clearTimeout(submenuCloseTimerRef.current)
		submenuOpenTimerRef.current = undefined
		submenuCloseTimerRef.current = undefined
	}
	const closeSubmenu = () => {
		if (submenuOpenTimerRef.current) clearTimeout(submenuOpenTimerRef.current)
		submenuOpenTimerRef.current = undefined
		setOpenSubmenu(null)
	}
	const queueCloseSubmenu = () => {
		if (submenuOpenTimerRef.current) clearTimeout(submenuOpenTimerRef.current)
		if (submenuCloseTimerRef.current) clearTimeout(submenuCloseTimerRef.current)
		submenuOpenTimerRef.current = undefined
		submenuCloseTimerRef.current = setTimeout(() => {
			setOpenSubmenu(null)
			submenuCloseTimerRef.current = undefined
		}, 400)
	}
	const queueOpenSubmenu = (key: string, target: HTMLElement, immediate = false) => {
		if (submenuCloseTimerRef.current) clearTimeout(submenuCloseTimerRef.current)
		submenuCloseTimerRef.current = undefined
		submenuAnchorRefs.current[key] = target
		if (openSubmenu === key) return
		if (submenuOpenTimerRef.current) clearTimeout(submenuOpenTimerRef.current)
		if (immediate) {
			setOpenSubmenu(key)
			return
		}
		submenuOpenTimerRef.current = setTimeout(() => {
			setOpenSubmenu(key)
			submenuOpenTimerRef.current = undefined
		}, 400)
	}
	const submenuStyle = (key: string, children: WinMenuItem[]): WinStyle => {
		const anchor = submenuAnchorRefs.current[key]
		if (!anchor) return {}
		const rect = anchor.getBoundingClientRect()
		const estimatedHeight = estimateMenuHeight(children)
		const estimatedWidth = estimateMenuWidth(children)
		const maxTop = Math.max(8, window.innerHeight - estimatedHeight - 8)
		const alignedTop = Math.min(Math.max(8, rect.top - 4), maxTop)
		const opensLeft =
			rect.right + estimatedWidth + 8 > window.innerWidth && rect.left >= estimatedWidth + 8
		return {
			position: "fixed",
			top: `${alignedTop}px`,
			...(opensLeft
				? { left: `${Math.max(8, rect.left - estimatedWidth - 4)}px`, right: "auto" }
				: {
						left: `${Math.min(window.innerWidth - estimatedWidth - 8, rect.right - 4)}px`,
						right: "auto"
					}),
			"--win-menu-submenu-max-height": `${Math.max(120, window.innerHeight - alignedTop - 8)}px`
		}
	}
	const isChecked = (item: WinMenuItem, key: string) =>
		checkedState[key] ?? Boolean(item.IsChecked)
	const selectableIndexes = (source: WinMenuItem[]) =>
		source.reduce<number[]>((result, item, index) => {
			if (menuItemKind(item) !== "MenuFlyoutSeparator" && !menuItemDisabled(item))
				result.push(index)
			return result
		}, [])
	const focusItem = (key: string) => itemRefs.current[key]?.focus({ preventScroll: true })
	const selectItem = (
		item: WinMenuItem,
		index: number,
		key: string,
		event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
	) => {
		if (menuItemDisabled(item)) return
		const kind = menuItemKind(item)
		if (kind === "ToggleMenuFlyoutItem") {
			setCheckedState((current) => ({ ...current, [key]: !isChecked(item, key) }))
		}
		if (kind === "RadioMenuFlyoutItem") {
			const groupName = item.GroupName
			setCheckedState((current) => {
				const next = { ...current, [key]: true }
				if (groupName) {
					const updateGroup = (source: WinMenuItem[], prefix: string) => {
						source.forEach((candidate, candidateIndex) => {
							const candidateKey = itemKey(prefix, candidateIndex)
							if (candidate.GroupName === groupName)
								next[candidateKey] = candidate === item
							if (candidate.Items) updateGroup(candidate.Items, candidateKey)
						})
					}
					updateGroup(items, "root")
				}
				return next
			})
		}
		const command = item.Command
		if (typeof command?.Execute === "function") {
			;(command.Execute as (parameter: unknown) => void)(item.CommandParameter)
		}
		if (typeof item.Click === "function") {
			;(item.Click as (event: unknown, menuItem: WinMenuItem) => void)(event, item)
		}
		callback<WinMenuItem>(props, "onSelect", "Select")?.(item)
		callback<unknown>(props, "onItemClick", "ItemClick")?.({ item, index })
		closeMenu()
	}
	const handleItemKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		item: WinMenuItem,
		index: number,
		key: string,
		source: WinMenuItem[],
		prefix: string,
		parentKey?: string
	) => {
		const kind = menuItemKind(item)
		const children = item.Items ?? []
		const focusable = selectableIndexes(source)
		const currentPosition = focusable.indexOf(index)
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault()
			if (focusable.length === 0) return
			const delta = event.key === "ArrowDown" ? 1 : -1
			const nextPosition = (currentPosition + delta + focusable.length) % focusable.length
			focusItem(itemKey(prefix, focusable[nextPosition]))
			return
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault()
			const nextIndex = event.key === "Home" ? focusable[0] : focusable[focusable.length - 1]
			if (nextIndex !== undefined) focusItem(itemKey(prefix, nextIndex))
			return
		}
		if (event.key === "ArrowRight" && children.length > 0) {
			event.preventDefault()
			queueOpenSubmenu(key, event.currentTarget, true)
			requestAnimationFrame(() =>
				focusItem(itemKey(key, selectableIndexes(children)[0] ?? 0))
			)
			return
		}
		if (event.key === "ArrowLeft" && parentKey) {
			event.preventDefault()
			closeSubmenu()
			clearSubmenuTimers()
			focusItem(parentKey)
			return
		}
		if (event.key === "Escape") {
			event.preventDefault()
			if (parentKey) {
				setOpenSubmenu(null)
				focusItem(parentKey)
			} else closeMenu()
			return
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			if (children.length > 0 && kind !== "ToggleMenuFlyoutItem")
				queueOpenSubmenu(key, event.currentTarget, true)
			else selectItem(item, index, key, event)
		}
	}
	const renderItemContent = (item: WinMenuItem, key: string, includeChevron: boolean) => (
		<>
			{hasToggle && (
				<span className="win-menu-leading-slot win-menu-check-slot" aria-hidden="true">
					{isChecked(item, key) && (
						<span className="win-menu-check-glyph">
							{menuItemKind(item) === "RadioMenuFlyoutItem" ? "\uE915" : "\uE73E"}
						</span>
					)}
				</span>
			)}
			{hasIcon && (
				<span className="win-menu-leading-slot win-menu-icon-slot" aria-hidden="true">
					{menuItemIcon(item)}
				</span>
			)}
			<span className="win-menu-item-label">{menuItemText(item)}</span>
			{menuItemAccelerator(item) && (
				<span className="win-menu-item-accelerator">{menuItemAccelerator(item)}</span>
			)}
			{includeChevron && (
				<span className="win-menu-item-chevron" aria-hidden="true">
					{"\uE974"}
				</span>
			)}
		</>
	)
	const renderSubmenu = (key: string, children: WinMenuItem[]) =>
		openSubmenu === key ? (
			typeof document === "undefined" ? (
				<div
					className="win-menu-submenu"
					role="menu"
					style={submenuStyle(key, children)}
					onPointerEnter={clearSubmenuTimers}
					onPointerLeave={queueCloseSubmenu}
				>
					{renderItems(children, key, key)}
				</div>
			) : (
				createPortal(
					<div
						className="win-menu-submenu"
						role="menu"
						style={submenuStyle(key, children)}
						onPointerEnter={clearSubmenuTimers}
						onPointerLeave={queueCloseSubmenu}
					>
						{renderItems(children, key, key)}
					</div>,
					document.body
				)
			)
		) : null
	const renderItems = (source: WinMenuItem[], prefix: string, parentKey?: string): ReactNode =>
		source.map((item, index) => {
			const key = itemKey(prefix, index)
			const kind = menuItemKind(item)
			if (kind === "MenuFlyoutSeparator") {
				return <div key={key} className="win-menu-separator" role="separator" />
			}
			const disabled = menuItemDisabled(item)
			const children = item.Items ?? []
			const hasChildren = children.length > 0
			const isSubmenuOpen = openSubmenu === key
			const role =
				kind === "RadioMenuFlyoutItem"
					? "menuitemradio"
					: kind === "ToggleMenuFlyoutItem"
						? "menuitemcheckbox"
						: "menuitem"
			const itemStyle: WinStyle = {
				color: item.Foreground,
				background: item.Background
			}
			const firstIndex = selectableIndexes(source)[0] ?? -1
			const onPointerEnter = (event: React.PointerEvent<HTMLElement>) => {
				clearSubmenuTimers()
				if (hasChildren) queueOpenSubmenu(key, event.currentTarget, false)
				else closeSubmenu()
			}
			const onPointerLeave = hasChildren ? queueCloseSubmenu : undefined
			if (kind === "SplitMenuFlyoutItem") {
				return (
					<div
						key={key}
						className={cx(
							"win-menu-item-wrapper",
							"win-menu-split-wrapper",
							"has-submenu",
							isSubmenuOpen ? "submenu-open" : undefined
						)}
						onPointerEnter={onPointerEnter}
						onPointerLeave={onPointerLeave}
					>
						<button
							ref={(element) => {
								itemRefs.current[key] = element
							}}
							type="button"
							className="win-menu-item win-menu-split-primary"
							role="menuitem"
							tabIndex={index === firstIndex ? 0 : -1}
							disabled={disabled}
							aria-disabled={disabled}
							style={itemStyle}
							onClick={(event) => selectItem(item, index, key, event)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault()
									selectItem(item, index, key, event)
								} else {
									handleItemKeyDown(
										event,
										item,
										index,
										key,
										source,
										prefix,
										parentKey
									)
								}
							}}
						>
							{renderItemContent(item, key, false)}
						</button>
						<button
							type="button"
							className="win-menu-split-secondary"
							aria-label={`${String(menuItemText(item) ?? "")} submenu`}
							aria-haspopup="menu"
							aria-expanded={isSubmenuOpen}
							disabled={disabled}
							onPointerEnter={(event) =>
								queueOpenSubmenu(key, event.currentTarget, false)
							}
							onClick={(event) => queueOpenSubmenu(key, event.currentTarget, true)}
							onKeyDown={(event) =>
								handleItemKeyDown(
									event,
									item,
									index,
									key,
									source,
									prefix,
									parentKey
								)
							}
						>
							{"\uE974"}
						</button>
						{renderSubmenu(key, children)}
					</div>
				)
			}
			return (
				<div
					key={key}
					className={cx("win-menu-item-wrapper", hasChildren ? "has-submenu" : undefined)}
					onPointerEnter={onPointerEnter}
					onPointerLeave={onPointerLeave}
				>
					<button
						ref={(element) => {
							itemRefs.current[key] = element
							submenuAnchorRefs.current[key] = element
						}}
						type="button"
						className={cx(
							"win-menu-item",
							hasChildren ? "has-submenu" : undefined,
							isSubmenuOpen ? "submenu-open" : undefined,
							isChecked(item, key) ? "checked" : undefined
						)}
						role={role}
						tabIndex={index === firstIndex ? 0 : -1}
						disabled={disabled}
						aria-disabled={disabled}
						aria-haspopup={hasChildren ? "menu" : undefined}
						aria-expanded={hasChildren ? isSubmenuOpen : undefined}
						aria-checked={role === "menuitem" ? undefined : isChecked(item, key)}
						style={itemStyle}
						onClick={(event) => {
							if (hasChildren) queueOpenSubmenu(key, event.currentTarget, true)
							else selectItem(item, index, key, event)
						}}
						onKeyDown={(event) =>
							handleItemKeyDown(event, item, index, key, source, prefix, parentKey)
						}
					>
						{renderItemContent(item, key, hasChildren)}
					</button>
					{renderSubmenu(key, children)}
				</div>
			)
		})
	const focusFirstItem = () => {
		const index = selectableIndexes(items)[0]
		if (index !== undefined) {
			if (focusFrameRef.current !== undefined) cancelAnimationFrame(focusFrameRef.current)
			focusFrameRef.current = requestAnimationFrame(() => {
				focusItem(itemKey("root", index))
				focusFrameRef.current = undefined
			})
		}
	}
	useEffect(() => {
		if (open) {
			setOpenSubmenu(null)
			focusFirstItem()
		} else {
			clearSubmenuTimers()
			setOpenSubmenu(null)
		}
	}, [open])
	useEffect(() => {
		if (!open) return undefined
		const updateLayout = () => setLayoutVersion((version) => version + 1)
		window.addEventListener("resize", updateLayout)
		window.addEventListener("scroll", updateLayout, true)
		return () => {
			window.removeEventListener("resize", updateLayout)
			window.removeEventListener("scroll", updateLayout, true)
		}
	}, [open])
	useEffect(
		() => () => {
			clearSubmenuTimers()
			if (focusFrameRef.current !== undefined) cancelAnimationFrame(focusFrameRef.current)
		},
		[]
	)
	return (
		<WinFlyout
			{...props}
			IsOpen={open}
			onValueChange={setOpen}
			Trigger={props.Trigger ?? props.trigger}
		>
			<div
				ref={menuRef}
				className="win-menu-flyout"
				role="menu"
				tabIndex={-1}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault()
						closeMenu()
						return
					}
					if (event.defaultPrevented) return
					const acceleratorIndex = items.findIndex(
						(item) => !menuItemDisabled(item) && matchesMenuAccelerator(item, event)
					)
					if (acceleratorIndex >= 0) {
						event.preventDefault()
						selectItem(
							items[acceleratorIndex],
							acceleratorIndex,
							itemKey("root", acceleratorIndex),
							event
						)
					}
				}}
				onBlur={() => {
					window.setTimeout(() => {
						if (
							open &&
							!document.activeElement?.closest(
								".win-flyout, .win-menu-submenu, .win-menu-bar"
							)
						)
							closeMenu()
					}, 0)
				}}
			>
				{renderItems(items, "root")}
			</div>
			{props.children}
		</WinFlyout>
	)
}
