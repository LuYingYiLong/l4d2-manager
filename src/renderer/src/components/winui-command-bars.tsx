// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useMemo, useRef, useState } from "react"
import type { HTMLAttributes, MouseEvent, ReactNode } from "react"
import { WinButton, WinTextBlock } from "./winui-primitives"
import { WinFlyout } from "./winui-dialogs"
import {
	WinMenuFlyout,
	menuItemDisabled,
	menuItemText,
	matchesMenuAccelerator
} from "./winui-menu-flyout"
import type { WinMenuItem } from "./winui-menu-flyout"
import {
	alignments,
	callback,
	commonStyle,
	contentOf,
	cssLength,
	cx,
	domProps,
	itemsOf,
	useControllable,
	xamlThickness
} from "./winui-shared"
import type { WinChangeProps, WinItemProps, WinProps, WinStyle } from "./winui-shared"

export function WinPageHeader(props: WinProps): React.JSX.Element {
	return (
		<header className={cx("win-page-header", props.class)}>
			<WinTextBlock
				Text={props.Title ?? props.Header ?? props.Content}
				FontSize={28}
				FontWeight={600}
			/>
			{props.children}
		</header>
	)
}
type WinAppBarCommand = {
	Label?: string
	Description?: string
	IconSource?: string | { Symbol?: string }
	CanExecute?: (parameter?: unknown) => boolean
	Execute?: (parameter?: unknown) => void
}

type WinAppBarFlyoutController = {
	ShowAt?: (target?: HTMLElement | null) => void
	Hide?: () => void
	Toggle?: () => void
	readonly IsOpen?: boolean
}

type WinAppBarButtonProps = WinProps & {
	Command?: WinAppBarCommand
	CommandParameter?: unknown
	Flyout?:
		| WinMenuItem[]
		| { Items?: WinMenuItem[]; Placement?: string; Theme?: string }
		| WinAppBarFlyoutController
	Icon?: ReactNode
	Label?: string
	IsChecked?: boolean | null
	IsCompact?: boolean
	LabelPosition?: "Default" | "Right" | "Collapsed"
	Visibility?: "Visible" | "Collapsed"
	AllowFocusOnInteraction?: boolean
	KeyboardAccelerators?: Array<{ Key: string; Modifiers?: string[] }>
	KeyboardAcceleratorTextOverride?: string
}

const appBarSymbolGlyphs: Record<string, string> = {
	Accept: "\uE8FB",
	Add: "\uE710",
	AttachCamera: "\uE8A2",
	Back: "\uE72B",
	Cancel: "\uE711",
	Close: "\uE711",
	Copy: "\uE8C8",
	Cut: "\uE8C6",
	Delete: "\uE74D",
	Dislike: "\uE8E0",
	Edit: "\uE70F",
	Favorite: "\uE734",
	Flag: "\uE7C1",
	FontDecrease: "\uE8A0",
	FontIncrease: "\uE8A1",
	Forward: "\uE72A",
	Like: "\uE8E1",
	Help: "\uE897",
	More: "\uE712",
	OpenFile: "\uE8E5",
	Paste: "\uE77F",
	Pause: "\uE769",
	Play: "\uE768",
	Redo: "\uE7A6",
	Refresh: "\uE72C",
	Save: "\uE74E",
	SelectAll: "\uE8B3",
	Send: "\uE724",
	Setting: "\uE713",
	Share: "\uE72D",
	Sort: "\uE8CB",
	Stop: "\uE71A",
	Undo: "\uE7A7"
}

function appBarIconGlyph(icon: ReactNode): ReactNode {
	if (typeof icon !== "string") return icon
	return appBarSymbolGlyphs[icon] ?? icon
}

function isAppBarFlyoutController(
	flyout: WinAppBarButtonProps["Flyout"]
): flyout is WinAppBarFlyoutController {
	return Boolean(
		flyout &&
		!Array.isArray(flyout) &&
		!(flyout as { Items?: WinMenuItem[] }).Items &&
		(typeof (flyout as WinAppBarFlyoutController).ShowAt === "function" ||
			typeof (flyout as WinAppBarFlyoutController).Toggle === "function" ||
			typeof (flyout as WinAppBarFlyoutController).Hide === "function")
	)
}

function appBarFlyoutItems(flyout: WinAppBarButtonProps["Flyout"]): WinMenuItem[] {
	if (Array.isArray(flyout)) return flyout
	if (flyout && "Items" in flyout && Array.isArray(flyout.Items)) return flyout.Items
	return []
}

export function WinAppBarButton(props: WinAppBarButtonProps): React.JSX.Element {
	const buttonRef = useRef<HTMLButtonElement>(null)
	const [pointerOver, setPointerOver] = useState(false)
	const [pressed, setPressed] = useState(false)
	const [flyoutOpen, setFlyoutOpen] = useState(false)
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
	const command = props.Command
	const label = props.Label ?? command?.Label ?? ""
	const icon =
		props.Icon ??
		(typeof command?.IconSource === "string" ? command.IconSource : command?.IconSource?.Symbol)
	const isEnabled = props.IsEnabled ?? command?.CanExecute?.(props.CommandParameter) ?? true
	const isCompact = props.IsCompact === true
	const labelPosition = props.LabelPosition ?? "Default"
	const isLabelCollapsed = labelPosition === "Collapsed"
	const flyoutItems = appBarFlyoutItems(props.Flyout)
	const hasMenuFlyout = flyoutItems.length > 0
	const externalFlyout = isAppBarFlyoutController(props.Flyout) ? props.Flyout : undefined
	const hasFlyout = hasMenuFlyout || Boolean(externalFlyout)
	const flyoutDefinition =
		props.Flyout && !Array.isArray(props.Flyout) && "Items" in props.Flyout
			? props.Flyout
			: undefined
	const automationName = props["AutomationProperties.Name"]
	const tooltip =
		props["ToolTipService.ToolTip"] ??
		(isCompact || isLabelCollapsed ? (command?.Description ?? label) : undefined)
	const effectiveIcon = appBarIconGlyph(icon)
	const buttonStyle: WinStyle = {
		...props.style,
		...commonStyle(props),
		...(props.Background
			? { background: undefined, "--AppBarButtonBackground": props.Background }
			: {}),
		...(props.Foreground
			? { color: undefined, "--AppBarButtonForeground": props.Foreground }
			: {}),
		...(props.BorderBrush ? { "--AppBarButtonBorderBrush": props.BorderBrush } : {}),
		...(props.BorderThickness !== undefined
			? { "--AppBarButtonBorderThickness": xamlThickness(props.BorderThickness) }
			: {}),
		...(props.CornerRadius !== undefined
			? { "--AppBarButtonCornerRadius": cssLength(props.CornerRadius) }
			: {})
	}
	const updateAnchor = () => setAnchorRect(buttonRef.current?.getBoundingClientRect() ?? null)
	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (!isEnabled) return
		command?.Execute?.(props.CommandParameter)
		if (externalFlyout) externalFlyout.ShowAt?.(buttonRef.current)
		else if (hasMenuFlyout) {
			updateAnchor()
			setFlyoutOpen((current) => !current)
		}
		setPressed(false)
		props.onClick?.(event)
		props.Click?.(event as unknown as MouseEvent<HTMLElement>)
	}
	useEffect(() => {
		if (!props.KeyboardAccelerators?.length || !isEnabled) return undefined
		const accelerator = props.KeyboardAccelerators[0]
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			const modifiers = accelerator.Modifiers ?? []
			const matches =
				event.key.toLowerCase() === accelerator.Key.toLowerCase() &&
				event.ctrlKey === modifiers.includes("Control") &&
				event.shiftKey === modifiers.includes("Shift") &&
				event.altKey === modifiers.includes("Alt")
			if (!matches) return
			event.preventDefault()
			buttonRef.current?.click()
		}
		document.addEventListener("keydown", onKeyDown, true)
		return () => document.removeEventListener("keydown", onKeyDown, true)
	}, [isEnabled, props.KeyboardAccelerators])
	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				className={cx(
					"win-appbar-button",
					isCompact ? "compact" : undefined,
					props.Visibility === "Collapsed" ? "collapsed" : undefined,
					pointerOver && isEnabled ? "pointer-over" : undefined,
					pressed && isEnabled ? "pressed" : undefined,
					labelPosition === "Right" ? "label-right" : undefined,
					isLabelCollapsed ? "label-collapsed" : undefined,
					hasFlyout ? "has-flyout" : undefined,
					props.IsChecked === true || props.IsChecked === null
						? "appbar-toggle-button-checked"
						: undefined,
					props.className,
					props.class
				)}
				style={buttonStyle}
				disabled={!isEnabled}
				aria-label={String(automationName ?? label) || undefined}
				aria-haspopup={hasFlyout ? (hasMenuFlyout ? "menu" : "dialog") : undefined}
				aria-expanded={hasFlyout ? (externalFlyout?.IsOpen ?? flyoutOpen) : undefined}
				aria-pressed={
					props.IsChecked === undefined
						? undefined
						: props.IsChecked === null
							? "mixed"
							: props.IsChecked
				}
				title={typeof tooltip === "string" ? tooltip : undefined}
				onClick={handleClick}
				onPointerEnter={(event) => setPointerOver(event.pointerType !== "touch")}
				onPointerLeave={() => {
					setPointerOver(false)
					setPressed(false)
				}}
				onPointerDown={(event) => {
					setPressed(true)
					if (!props.AllowFocusOnInteraction) event.preventDefault()
				}}
				onPointerUp={() => setPressed(false)}
				onPointerCancel={() => setPressed(false)}
				onLostPointerCapture={() => setPressed(false)}
			>
				<span className="appbar-button-inner-border" aria-hidden="true" />
				<span className="appbar-button-content-root">
					{(props.children || effectiveIcon) && (
						<span className="appbar-button-icon">
							{props.children ?? <span className="symbol-icon">{effectiveIcon}</span>}
						</span>
					)}
					{!isCompact && !isLabelCollapsed && label && (
						<span className="appbar-button-label">{label}</span>
					)}
					{hasFlyout && (
						<span className="icon appbar-button-chevron" aria-hidden="true">
							{"\uE974"}
						</span>
					)}
				</span>
			</button>
			{hasMenuFlyout && (
				<WinMenuFlyout
					IsOpen={flyoutOpen}
					AnchorRect={anchorRect}
					Items={flyoutItems}
					Placement={flyoutDefinition?.Placement ?? "Bottom"}
					Theme={flyoutDefinition?.Theme}
					onClose={() => setFlyoutOpen(false)}
					onSelect={(item: WinMenuItem) =>
						callback<WinMenuItem>(props, "onSelect", "Select")?.(item)
					}
				/>
			)}
		</>
	)
}

export function WinAppBarToggleButton(
	props: WinAppBarButtonProps & WinChangeProps<boolean> & { IsThreeState?: boolean }
): React.JSX.Element {
	const external = props.IsChecked ?? props.modelValue ?? props.value
	const [checked, setChecked] = useControllable<boolean | null>(
		external,
		Boolean(props.defaultValue),
		(value) =>
			callback<boolean | null>(
				props,
				"onValueChange",
				"onUpdate:IsChecked",
				"onUpdate:modelValue",
				"onUpdate:Value"
			)?.(value)
	)
	return (
		<WinAppBarButton
			{...props}
			IsChecked={checked}
			className={cx("win-appbar-toggle-button", props.className)}
			onClick={(event) => {
				const next = props.IsThreeState
					? checked === false
						? true
						: checked === true
							? null
							: false
					: !checked
				setChecked(next)
				callback<MouseEvent<HTMLElement>>(
					props,
					next === true
						? "onChecked"
						: next === false
							? "onUnchecked"
							: "onIndeterminate",
					"Checked",
					"Unchecked",
					"Indeterminate"
				)?.(event)
				props.onClick?.(event)
			}}
		/>
	)
}

export function WinAppBarSeparator(props: WinProps): React.JSX.Element {
	return (
		<span
			className={cx("win-appbar-separator", props.className, props.class)}
			role="separator"
			aria-hidden="true"
		>
			<span className="separator-line" aria-hidden="true" />
		</span>
	)
}

type WinCommandBarCommand = {
	Component?: React.ElementType
	Props?: Record<string, unknown>
	Key?: string
	Click?: (event?: MouseEvent<HTMLElement>) => void
}

type WinCommandBarProps = WinProps & {
	IsSticky?: boolean
	DefaultLabelPosition?: "Bottom" | "Right" | "Collapsed"
	PrimaryCommands?: WinCommandBarCommand[]
	SecondaryCommands?: WinCommandBarCommand[]
	IsDynamicOverflowEnabled?: boolean
	OverflowButtonVisibility?: "Auto" | "Visible" | "Collapsed"
	["AutomationProperties.Name"]?: string
}

function commandBarMenuItem(command: WinCommandBarCommand): WinMenuItem {
	if (command.Component === WinAppBarSeparator) return { Kind: "MenuFlyoutSeparator" }
	const commandProps = command.Props ?? {}
	const uiCommand = commandProps.Command as WinAppBarCommand | undefined
	const label =
		typeof commandProps.Label === "string" ? commandProps.Label : (uiCommand?.Label ?? "")
	const iconSource = commandProps.Icon ?? uiCommand?.IconSource
	const icon: ReactNode =
		typeof iconSource === "string" ? appBarIconGlyph(iconSource) : (iconSource as ReactNode)
	const parameter = commandProps.CommandParameter
	const enabled =
		commandProps.IsEnabled === undefined
			? (uiCommand?.CanExecute?.(parameter) ?? true)
			: commandProps.IsEnabled !== false
	return {
		Kind: "MenuFlyoutItem",
		Text: label,
		Icon: icon,
		IsEnabled: enabled,
		KeyboardAccelerators:
			commandProps.KeyboardAccelerators as WinMenuItem["KeyboardAccelerators"],
		KeyboardAcceleratorTextOverride: commandProps.KeyboardAcceleratorTextOverride as
			string | undefined,
		Command: {
			Execute: () => {
				uiCommand?.Execute?.(parameter)
				command.Click?.()
			}
		}
	}
}

export function WinCommandBar(props: WinCommandBarProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null)
	const primaryRef = useRef<HTMLDivElement>(null)
	const overflowRef = useRef<HTMLButtonElement>(null)
	const externalOpen = props.IsOpen ?? props.Open
	const [localOpen, setLocalOpen] = useState(externalOpen ?? false)
	const [overflowOpen, setOverflowOpen] = useState(false)
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
	const primaryCommands = useMemo(() => props.PrimaryCommands ?? [], [props.PrimaryCommands])
	const secondaryCommands = useMemo(
		() => props.SecondaryCommands ?? [],
		[props.SecondaryCommands]
	)
	const [visiblePrimary, setVisiblePrimary] = useState(primaryCommands)
	const [overflowPrimary, setOverflowPrimary] = useState<WinCommandBarCommand[]>([])
	const overflowCalculation = useRef(0)
	const measuredWidthRef = useRef<number | null>(null)
	const commandWidthsRef = useRef<Record<number, number>>({})
	const open = localOpen
	const labelPosition = props.DefaultLabelPosition ?? "Bottom"
	const dynamicOverflow = props.IsDynamicOverflowEnabled !== false
	const overflowVisibility = props.OverflowButtonVisibility ?? "Auto"
	const isSticky = props.IsSticky === true
	const horizontalAlignment = String(props.HorizontalAlignment ?? "Stretch")
	const isHorizontallyStretched = horizontalAlignment === "Stretch"
	const setOpen = (next: boolean) => {
		setLocalOpen(next)
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen")?.(next)
	}
	const overflowItems = [
		...overflowPrimary.map(commandBarMenuItem),
		...(overflowPrimary.length && secondaryCommands.length
			? [{ Kind: "MenuFlyoutSeparator" }]
			: []),
		...secondaryCommands.map(commandBarMenuItem)
	]
	const showOverflow =
		overflowVisibility !== "Collapsed" &&
		overflowItems.length > 0 &&
		(overflowVisibility === "Visible" ||
			secondaryCommands.length > 0 ||
			overflowPrimary.length > 0)
	const renderOverflowButton =
		overflowVisibility !== "Collapsed" &&
		(overflowVisibility === "Visible" ||
			secondaryCommands.length > 0 ||
			(dynamicOverflow && primaryCommands.length > 0))
	const applyOverflowPartition = (
		visible: WinCommandBarCommand[],
		overflow: WinCommandBarCommand[]
	) => {
		setVisiblePrimary((current) =>
			current.length === visible.length &&
			current.every((command, index) => command === visible[index])
				? current
				: visible
		)
		setOverflowPrimary((current) =>
			current.length === overflow.length &&
			current.every((command, index) => command === overflow[index])
				? current
				: overflow
		)
	}
	const updateAnchor = () => setAnchorRect(overflowRef.current?.getBoundingClientRect() ?? null)
	const calculateOverflow = (force = true) => {
		const calculationId = ++overflowCalculation.current
		if (!dynamicOverflow || overflowVisibility === "Collapsed") {
			applyOverflowPartition(primaryCommands, [])
			measuredWidthRef.current = null
			return
		}
		const frame = globalThis.requestAnimationFrame
		const measure = async () => {
			if (calculationId !== overflowCalculation.current) return
			const root = rootRef.current
			const content = primaryRef.current
			if (!root || !content) return
			const rootWidth = root.clientWidth
			if (
				!force &&
				measuredWidthRef.current !== null &&
				Math.abs(measuredWidthRef.current - rootWidth) < 1
			)
				return
			const readCommandWidths = () => {
				const commandElements = Array.from(
					content.querySelectorAll<HTMLElement>("[data-command-index]")
				)
				for (const element of commandElements) {
					const index = Number(element.dataset.commandIndex)
					if (Number.isInteger(index) && index >= 0)
						commandWidthsRef.current[index] = element.getBoundingClientRect().width
				}
				return primaryCommands.map((_, index) => commandWidthsRef.current[index])
			}
			let commandWidths = readCommandWidths()
			if (
				commandWidths.some((width) => width === undefined) &&
				content.querySelectorAll("[data-command-index]").length < primaryCommands.length
			) {
				applyOverflowPartition(primaryCommands, [])
				await new Promise<void>((resolve) => {
					if (frame) frame(() => resolve())
					else globalThis.setTimeout(resolve, 0)
				})
				if (calculationId !== overflowCalculation.current) return
				commandWidths = readCommandWidths()
			}
			if (calculationId !== overflowCalculation.current) return
			const children = Array.from(content.children) as HTMLElement[]
			if (!children.length) return
			const hasCompleteCommandWidths =
				commandWidths.every((width): width is number => width !== undefined) &&
				primaryCommands.length > 0
			const measuredChildren = hasCompleteCommandWidths
				? commandWidths
				: children.map((child) => child.getBoundingClientRect().width)
			const contentWidth = measuredChildren.reduce((total, width) => total + width, 0)
			const alwaysNeedsOverflow =
				secondaryCommands.length > 0 || overflowVisibility === "Visible"
			const available = Math.max(0, root.clientWidth - (renderOverflowButton ? 52 : 0))
			if (!alwaysNeedsOverflow && contentWidth <= available) {
				applyOverflowPartition(primaryCommands, [])
				measuredWidthRef.current = rootWidth
				return
			}
			let width = 0
			let visibleCount = 0
			for (const childWidth of measuredChildren) {
				if (width + childWidth > available) break
				width += childWidth
				visibleCount += 1
			}
			if (visibleCount < primaryCommands.length) {
				callback<unknown>(
					props,
					"onDynamicOverflowItemsChanging",
					"DynamicOverflowItemsChanging"
				)?.(undefined)
				applyOverflowPartition(
					primaryCommands.slice(0, visibleCount),
					primaryCommands.slice(visibleCount)
				)
			} else {
				applyOverflowPartition(primaryCommands, [])
			}
			measuredWidthRef.current = rootWidth
		}
		if (frame) frame(() => void measure())
		else globalThis.setTimeout(() => void measure(), 0)
	}
	useEffect(() => {
		commandWidthsRef.current = {}
		measuredWidthRef.current = null
	}, [labelPosition, primaryCommands])
	useEffect(() => {
		calculateOverflow(true)
	}, [dynamicOverflow, overflowVisibility, labelPosition, primaryCommands, secondaryCommands])
	useEffect(() => {
		const root = rootRef.current
		if (!root) return undefined
		const observer =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => calculateOverflow(false))
				: undefined
		observer?.observe(root)
		window.addEventListener("resize", updateAnchor)
		return () => {
			observer?.disconnect()
			window.removeEventListener("resize", updateAnchor)
		}
	}, [primaryCommands, secondaryCommands])
	const openBar = () => {
		if (!open) {
			callback<unknown>(props, "onOpening", "Opening")?.(undefined)
			setOpen(true)
			callback<unknown>(props, "onOpened", "Opened")?.(undefined)
		}
		updateAnchor()
		if (overflowItems.length) setOverflowOpen(true)
	}
	const closeBar = (force = true) => {
		if (!open || (!force && isSticky)) return
		callback<unknown>(props, "onClosing", "Closing")?.(undefined)
		setOverflowOpen(false)
		setOpen(false)
		callback<unknown>(props, "onClosed", "Closed")?.(undefined)
	}
	useEffect(() => {
		if (externalOpen === undefined) return
		setLocalOpen(externalOpen)
		if (externalOpen) {
			updateAnchor()
			if (overflowItems.length > 0) setOverflowOpen(true)
		} else setOverflowOpen(false)
	}, [externalOpen, overflowItems.length])
	useEffect(() => {
		if (!open || overflowItems.length > 0 || isSticky) return undefined
		const closeOnDocumentPointerDown = (event: globalThis.PointerEvent) => {
			const path = event.composedPath()
			if (
				path.some(
					(element) =>
						element instanceof Element && element.classList.contains("win-commandbar")
				)
			)
				return
			closeBar(true)
		}
		document.addEventListener("pointerdown", closeOnDocumentPointerDown, true)
		return () => document.removeEventListener("pointerdown", closeOnDocumentPointerDown, true)
	}, [open, overflowItems.length, isSticky])
	const invokeCommand = (command: WinCommandBarCommand, event: MouseEvent<HTMLElement>) => {
		command.Click?.(event)
		if (open && !isSticky) closeBar(false)
	}
	const renderCommand = (command: WinCommandBarCommand, index: number, prefix = "primary") => {
		const Component = command.Component ?? WinAppBarButton
		const commandProps = command.Props ?? {}
		const commandIndex = prefix === "primary" ? primaryCommands.indexOf(command) : index
		return (
			<span
				key={command.Key ?? `${prefix}-${index}`}
				className="commandbar-command-slot"
				data-command-index={commandIndex >= 0 ? commandIndex : undefined}
			>
				<Component
					{...commandProps}
					LabelPosition={labelPosition === "Bottom" ? "Default" : labelPosition}
					Click={(event: MouseEvent<HTMLElement>) => invokeCommand(command, event)}
				/>
			</span>
		)
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={rootRef}
			className={cx(
				"win-commandbar",
				open ? "open" : undefined,
				showOverflow ? "has-overflow" : undefined,
				labelPosition === "Bottom" ? "label-bottom" : undefined,
				labelPosition === "Right" ? "label-right" : undefined,
				labelPosition === "Collapsed" ? "label-collapsed" : undefined,
				props.className,
				props.class
			)}
			role="toolbar"
			aria-label={props["AutomationProperties.Name"] ?? "Command bar"}
			aria-expanded={open}
			style={{
				...props.style,
				...commonStyle(props),
				...(props.Width === undefined && !isHorizontallyStretched
					? {
							width: "max-content",
							maxWidth: props.MaxWidth === undefined ? "100%" : undefined
						}
					: {}),
				alignSelf: alignments[horizontalAlignment] ?? "stretch",
				boxSizing: "border-box",
				...(props.Background
					? { background: undefined, "--CommandBarBackground": props.Background }
					: {}),
				...(props.Foreground
					? { color: undefined, "--CommandBarForeground": props.Foreground }
					: {}),
				...(props.CornerRadius !== undefined
					? { "--CommandBarCornerRadius": cssLength(props.CornerRadius) }
					: {})
			}}
			onKeyDown={(event) => {
				if (event.key !== "Escape") return
				event.preventDefault()
				closeBar()
			}}
		>
			<div className="commandbar-surface">
				<div ref={primaryRef} className="commandbar-primary-content">
					{props.children ??
						visiblePrimary.map((command, index) => renderCommand(command, index))}
				</div>
				{renderOverflowButton && (
					<button
						ref={overflowRef}
						type="button"
						className={cx(
							"commandbar-overflow-button",
							!showOverflow ? "is-placeholder" : undefined,
							overflowOpen ? "is-active" : undefined
						)}
						aria-label={open ? "Less options" : "More options"}
						aria-expanded={showOverflow && open}
						aria-hidden={!showOverflow}
						tabIndex={showOverflow ? undefined : -1}
						disabled={!showOverflow}
						title={open ? "See less" : "See more"}
						onClick={(event) => {
							event.stopPropagation()
							if (open) closeBar()
							else openBar()
						}}
					>
						<span className="commandbar-ellipsis" aria-hidden="true">
							{"\uE712"}
						</span>
					</button>
				)}
			</div>
			{overflowItems.length > 0 && (
				<WinMenuFlyout
					IsOpen={overflowOpen}
					AnchorRect={anchorRect}
					Items={overflowItems}
					Placement="BottomEdgeAlignedRight"
					MinWidth={160}
					Gap={0}
					OverlayInputPassThroughElement
					Theme={props.Theme}
					onClose={() => {
						setOverflowOpen(false)
						closeBar()
					}}
					onSelect={() => {
						setOverflowOpen(false)
						closeBar()
					}}
				/>
			)}
		</div>
	)
}

export type WinCommandBarFlyoutCommand = {
	Name?: string
	Label: string
	Icon?: string
	Click?: (command: WinCommandBarFlyoutCommand, event: MouseEvent<HTMLElement>) => void
	IsEnabled?: boolean
	IsToggle?: boolean
	IsChecked?: boolean
	KeyboardAcceleratorTextOverride?: string
	Flyout?: unknown
}

export function WinCommandBarFlyout(
	props: WinProps & {
		AnchorRect?: DOMRect | null
		PrimaryCommands?: WinCommandBarFlyoutCommand[]
		SecondaryCommands?: WinCommandBarFlyoutCommand[]
		AlwaysExpanded?: boolean
		Placement?: string
		ShowMode?: "Standard" | "Transient" | string
	}
): React.JSX.Element {
	const primaryCommands = props.PrimaryCommands ?? []
	const secondaryCommands = props.SecondaryCommands ?? []
	const alwaysExpanded = props.AlwaysExpanded === true
	const [localOpen, setLocalOpen] = useState(false)
	const [secondaryOpen, setSecondaryOpen] = useState(alwaysExpanded)
	const open = props.IsOpen ?? props.Open ?? localOpen
	const setOpen = (next: boolean) => {
		if (props.IsOpen === undefined && props.Open === undefined) setLocalOpen(next)
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen")?.(next)
	}
	useEffect(() => {
		setSecondaryOpen(alwaysExpanded)
	}, [alwaysExpanded])
	const close = () => {
		if (!open) return
		callback<unknown>(props, "onClosing", "Closing")?.(undefined)
		setOpen(false)
		callback<unknown>(props, "onClose", "Close")?.(undefined)
		callback<unknown>(props, "onClosed", "Closed")?.(undefined)
	}
	const invoke = (command: WinCommandBarFlyoutCommand, event: MouseEvent<HTMLElement>) => {
		if (command.IsEnabled === false) return
		command.Click?.(command, event)
		props.Click?.(event)
		callback<unknown>(props, "onCommandClick", "CommandClick")?.({ command, event })
		close()
	}
	const convertedPrimary: WinCommandBarCommand[] = primaryCommands.map((command, index) => ({
		Component: command.IsToggle ? WinAppBarToggleButton : WinAppBarButton,
		Props: {
			Icon: command.Icon,
			Label: command.Label,
			IsEnabled: command.IsEnabled,
			IsChecked: command.IsChecked,
			KeyboardAcceleratorTextOverride: command.KeyboardAcceleratorTextOverride,
			AllowFocusOnInteraction: false,
			Command: {
				CanExecute: () => command.IsEnabled !== false,
				Execute: () => undefined
			}
		},
		Key: command.Name ?? `${command.Label}-${index}`,
		Click: (event) => {
			if (event) invoke(command, event)
		}
	}))
	return (
		<WinFlyout
			IsOpen={open}
			AnchorRect={props.AnchorRect}
			Placement={props.Placement ?? "Auto"}
			MinWidth={props.MinWidth ?? 0}
			Theme={props.Theme}
			IsLightDismissEnabled={props.IsLightDismissEnabled}
			className={cx("win-commandbar-flyout", props.className, props.class)}
			onValueChange={setOpen}
			onOpening={() => callback<unknown>(props, "onOpening", "Opening")?.(undefined)}
			onOpened={() => callback<unknown>(props, "onOpened", "Opened")?.(undefined)}
		>
			<div
				className={cx("win-cbf-content-root", secondaryOpen ? "is-expanded" : undefined)}
				role="menu"
			>
				<div className="win-cbf-primary-items-root">
					{primaryCommands.length > 0 && (
						<div className="win-cbf-primary-items-control" role="toolbar">
							<WinCommandBar
								className="win-cbf-commandbar"
								IsOpen
								IsSticky
								IsDynamicOverflowEnabled={false}
								OverflowButtonVisibility="Collapsed"
								DefaultLabelPosition="Bottom"
								HorizontalAlignment="Left"
								PrimaryCommands={convertedPrimary}
								SecondaryCommands={[]}
							/>
						</div>
					)}
					{secondaryCommands.length > 0 && !alwaysExpanded && (
						<button
							type="button"
							className="win-cbf-more-button"
							aria-label={secondaryOpen ? "See less" : "See more"}
							aria-expanded={secondaryOpen}
							onClick={() => setSecondaryOpen((current) => !current)}
						>
							<span className="win-cbf-ellipsis-icon" aria-hidden="true">
								{"\uE712"}
							</span>
						</button>
					)}
				</div>
				{secondaryCommands.length > 0 && (alwaysExpanded || secondaryOpen) && (
					<div className="win-cbf-outer-overflow-content-root">
						<div className="win-cbf-overflow-content-root">
							<div className="win-cbf-secondary-items-control" role="menu">
								{secondaryCommands.map((command, index) => (
									<button
										key={command.Name ?? `${command.Label}-${index}`}
										type="button"
										className={cx(
											"win-cbf-overflow-button",
											command.IsToggle ? "has-check" : undefined,
											command.Icon ? "has-menu-icon" : undefined,
											command.IsChecked ? "is-checked" : undefined,
											command.KeyboardAcceleratorTextOverride
												? "has-keyboard-accelerator"
												: undefined,
											command.Flyout ? "has-flyout" : undefined
										)}
										disabled={command.IsEnabled === false}
										role="menuitem"
										aria-label={command.Label}
										aria-pressed={
											command.IsToggle
												? Boolean(command.IsChecked)
												: undefined
										}
										onClick={(event) => invoke(command, event)}
									>
										{command.IsToggle && (
											<span
												className="win-cbf-overflow-check"
												aria-hidden="true"
											>
												{"\uE73E"}
											</span>
										)}
										{command.Icon && (
											<span
												className="win-cbf-overflow-icon"
												aria-hidden="true"
											>
												{appBarIconGlyph(command.Icon)}
											</span>
										)}
										<span className="win-cbf-overflow-label">
											{command.Label}
										</span>
										{command.KeyboardAcceleratorTextOverride && (
											<span className="win-cbf-overflow-accelerator">
												{command.KeyboardAcceleratorTextOverride}
											</span>
										)}
										{Boolean(command.Flyout) && (
											<span
												className="win-cbf-overflow-chevron"
												aria-hidden="true"
											>
												{"\uE76C"}
											</span>
										)}
									</button>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		</WinFlyout>
	)
}
export type WinButtonMenuProps = Omit<WinProps, "onSelect"> & {
	Items?: WinMenuItem[]
	Options?: WinMenuItem[]
	Flyout?: WinMenuItem[] | { Items?: WinMenuItem[]; Placement?: string }
	onSelect?: (item: WinMenuItem) => void
	Select?: (item: WinMenuItem) => void
}

function buttonMenuDefinition(props: WinButtonMenuProps) {
	const flyout = props.Flyout
	const source =
		props.Items ??
		(Array.isArray(flyout)
			? flyout
			: flyout && typeof flyout === "object"
				? flyout.Items
				: undefined) ??
		props.Options ??
		[]
	const items = source.map((item) =>
		typeof item === "string" ? { Text: item, Value: item } : item
	) as WinMenuItem[]
	const placement =
		!Array.isArray(flyout) && flyout && typeof flyout === "object"
			? flyout.Placement
			: undefined
	return { items, placement }
}

function buttonMenuSelect(props: WinButtonMenuProps, item: WinMenuItem) {
	callback<WinMenuItem>(props, "onSelect", "Select")?.(item)
	callback<unknown>(props, "onItemClick", "ItemClick")?.(item)
}

function buttonClickHandler(props: WinButtonMenuProps, event: MouseEvent<HTMLElement>) {
	callback<MouseEvent<HTMLElement>>(props, "onClick")?.(event)
	callback<MouseEvent<HTMLElement>>(props, "Click")?.(event)
}

function buttonPropsWithoutMenu(props: WinButtonMenuProps) {
	const {
		Items: _items,
		Options: _options,
		Flyout: _flyout,
		onClick: _onClick,
		Click: _Click,
		onSelect: _onSelect,
		Select: _Select,
		children: _children,
		className: _className,
		class: _class,
		...buttonProps
	} = props
	return buttonProps
}

export function WinDropDownButton(props: WinButtonMenuProps): React.JSX.Element {
	const { items, placement } = buttonMenuDefinition(props)
	const buttonProps = buttonPropsWithoutMenu(props)
	const [menuOpen, setMenuOpen] = useState(false)
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
	const [chevronClass, setChevronClass] = useState("")
	const wrapRef = useRef<HTMLDivElement>(null)
	const chevronPressed = useRef(false)
	const chevronPressDone = useRef(false)
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const onChevronDown = () => {
		chevronPressed.current = true
		chevronPressDone.current = false
		setChevronClass("pressing")
	}
	const releaseChevron = () => {
		if (chevronClass === "") return
		chevronPressed.current = false
		if (chevronPressDone.current) setChevronClass("releasing")
	}
	const onChevronUp = () => {
		if (!chevronPressed.current) return
		releaseChevron()
	}
	const onChevronAnimationEnd = (event: React.AnimationEvent<HTMLSpanElement>) => {
		if (chevronClass === "pressing" && event.animationName === "chevron-press") {
			chevronPressDone.current = true
			if (!chevronPressed.current) setChevronClass("releasing")
		} else if (chevronClass === "releasing" && event.animationName === "chevron-release") {
			chevronPressDone.current = false
			setChevronClass("")
		}
	}
	const toggle = (event: MouseEvent<HTMLButtonElement>) => {
		if (props.IsEnabled === false) return
		buttonClickHandler(props, event)
		if (menuOpen) {
			setMenuOpen(false)
			return
		}
		setAnchorRect(wrapRef.current?.getBoundingClientRect() ?? null)
		setMenuOpen(true)
	}
	return (
		<div ref={wrapRef} className="win-dropdown-btn-wrap">
			<WinButton
				{...buttonProps}
				className={cx("win-dropdown-btn", className, legacyClassName)}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onClick={toggle}
				onMouseDown={onChevronDown}
				onMouseUp={onChevronUp}
				onMouseLeave={releaseChevron}
			>
				<span className="win-dropdown-content">
					{contentOf(props as WinProps, props.children as ReactNode)}
				</span>
				<span
					className={cx(
						"icon",
						"win-dd-chevron",
						"chevron-animate",
						chevronClass,
						menuOpen ? "open" : undefined
					)}
					aria-hidden="true"
					onAnimationEnd={onChevronAnimationEnd}
				/>
			</WinButton>
			<WinMenuFlyout
				Items={items}
				Open={menuOpen}
				AnchorRect={anchorRect}
				onValueChange={setMenuOpen}
				Placement={placement ?? "Bottom"}
				Theme={props.Theme}
				IsLightDismissEnabled={props.IsLightDismissEnabled}
				OverlayInputPassThroughElement
				onClose={() => setMenuOpen(false)}
				onSelect={(item) => {
					buttonMenuSelect(props, item)
					setMenuOpen(false)
				}}
			/>
		</div>
	)
}

export function WinSplitButton(props: WinButtonMenuProps): React.JSX.Element {
	const { items, placement } = buttonMenuDefinition(props)
	const segmentProps = buttonPropsWithoutMenu(props)
	const {
		style: _style,
		Width: _width,
		Height: _height,
		MinWidth: _minWidth,
		MinHeight: _minHeight,
		MaxWidth: _maxWidth,
		MaxHeight: _maxHeight,
		Padding: _padding,
		Margin: _margin,
		VerticalAlignment: _verticalAlignment,
		...buttonProps
	} = segmentProps
	const [menuOpen, setMenuOpen] = useState(false)
	const [chevronClass, setChevronClass] = useState("")
	const chevronPressed = useRef(false)
	const chevronPressDone = useRef(false)
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const verticalAlignment =
		typeof props.VerticalAlignment === "string" ? props.VerticalAlignment : undefined
	const rootStyle: WinStyle = {
		...(props.style as WinStyle | undefined),
		...(props.MinWidth !== undefined && props.MinWidth !== ""
			? {
					minWidth: cssLength(props.MinWidth),
					"--SplitButtonMainMinWidth": cssLength(props.MinWidth)
				}
			: {}),
		...(props.MinHeight !== undefined && props.MinHeight !== ""
			? { minHeight: cssLength(props.MinHeight) }
			: {}),
		...(props.Padding !== undefined && props.Padding !== ""
			? { "--SplitButtonPadding": xamlThickness(props.Padding) }
			: {}),
		...(props.Margin !== undefined && props.Margin !== ""
			? { margin: xamlThickness(props.Margin) }
			: {}),
		...(verticalAlignment ? { alignSelf: verticalAlignment.toLowerCase() } : {})
	}
	const onChevronDown = () => {
		chevronPressed.current = true
		chevronPressDone.current = false
		setChevronClass("pressing")
	}
	const releaseChevron = () => {
		if (chevronClass === "") return
		chevronPressed.current = false
		if (chevronPressDone.current) setChevronClass("releasing")
	}
	const onChevronAnimationEnd = (event: React.AnimationEvent<HTMLSpanElement>) => {
		if (chevronClass === "pressing" && event.animationName === "chevron-press") {
			chevronPressDone.current = true
			if (!chevronPressed.current) setChevronClass("releasing")
		} else if (chevronClass === "releasing" && event.animationName === "chevron-release") {
			chevronPressDone.current = false
			setChevronClass("")
		}
	}
	return (
		<div
			className={cx(
				"win-split-button",
				menuOpen ? "is-open" : undefined,
				className,
				legacyClassName
			)}
			style={rootStyle}
		>
			<WinButton
				{...buttonProps}
				className="win-split-main-button"
				onClick={(event) => buttonClickHandler(props, event)}
			>
				{contentOf(props as WinProps, props.children as ReactNode)}
			</WinButton>
			<span className="win-btn-separator" aria-hidden="true" />
			<WinMenuFlyout
				Items={items}
				Open={menuOpen}
				onValueChange={setMenuOpen}
				Placement={placement ?? "Bottom"}
				Theme={props.Theme}
				IsLightDismissEnabled={props.IsLightDismissEnabled}
				OverlayInputPassThroughElement
				Trigger={
					<WinButton
						{...buttonProps}
						className="win-btn-chevron"
						Width={35}
						MinWidth={35}
						Padding="0,0,12,0"
						aria-label="Open menu"
						aria-haspopup="menu"
						onPointerDown={onChevronDown}
						onPointerUp={releaseChevron}
						onPointerLeave={releaseChevron}
						onPointerCancel={releaseChevron}
						onLostPointerCapture={releaseChevron}
						onBlur={releaseChevron}
					>
						<span
							className={cx("chevron-animate", chevronClass)}
							aria-hidden="true"
							onAnimationEnd={onChevronAnimationEnd}
						/>
					</WinButton>
				}
				onSelect={(item) => buttonMenuSelect(props, item)}
			/>
		</div>
	)
}
export function WinMenuBar(props: WinItemProps): React.JSX.Element {
	const menuBarRef = useRef<HTMLElement>(null)
	const items = itemsOf(props) as WinMenuItem[]
	const [openIndex, setOpenIndex] = useState<number | null>(null)
	const [focusedIndex, setFocusedIndex] = useState(0)
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
	const focusItem = (index: number, direction = 1) => {
		if (items.length === 0) return null
		const step = direction < 0 ? -1 : 1
		let next = ((index % items.length) + items.length) % items.length
		for (let attempt = 0; attempt < items.length && isDisabled(items[next]); attempt += 1)
			next = (next + step + items.length) % items.length
		if (isDisabled(items[next])) return null
		setFocusedIndex(next)
		menuBarRef.current
			?.querySelectorAll<HTMLButtonElement>(".win-menu-bar-button")
			[next]?.focus()
		return next
	}
	const updateAnchor = (index: number) => {
		const button =
			menuBarRef.current?.querySelectorAll<HTMLButtonElement>(".win-menu-bar-button")[index]
		if (button) setAnchorRect(button.getBoundingClientRect())
	}
	const isDisabled = (item: WinMenuItem) => menuItemDisabled(item)
	const openMenu = (index: number) => {
		const item = items[index]
		if (!item || isDisabled(item) || !item.Items?.length) return
		setFocusedIndex(index)
		setOpenIndex(index)
		requestAnimationFrame(() => updateAnchor(index))
	}
	const closeMenu = (restoreFocus = false) => {
		setOpenIndex(null)
		if (restoreFocus) requestAnimationFrame(() => focusItem(focusedIndex))
	}
	const focusAndUpdateOpenMenu = (index: number, direction = 1) => {
		const next = focusItem(index, direction)
		if (next === null || openIndex === null) return
		if (items[next]?.Items?.length) openMenu(next)
		else closeMenu()
	}
	const invokeTopLevelItem = (item: WinMenuItem) => {
		if (isDisabled(item)) return
		const command = item.Command
		if (typeof command?.Execute === "function") {
			;(command.Execute as (parameter: unknown) => void)(item.CommandParameter)
		}
		if (typeof item.Click === "function") {
			;(item.Click as (event: unknown, menuItem: WinMenuItem) => void)(undefined, item)
		}
		callback<WinMenuItem>(props, "onItemClick", "ItemClick")?.(item)
	}
	const menuBarLabel = (item: WinMenuItem) =>
		(item.Title ?? item.Text ?? item.Label ?? menuItemText(item)) as ReactNode
	const moveFocus = (direction: number) => {
		if (items.length === 0) return
		let next = focusedIndex
		for (let step = 0; step < items.length; step += 1) {
			next = (next + direction + items.length) % items.length
			if (!isDisabled(items[next])) {
				focusAndUpdateOpenMenu(next, direction)
				return
			}
		}
	}
	useEffect(() => {
		if (openIndex === null) return undefined
		const update = () => updateAnchor(openIndex)
		const onPointerDown = (event: globalThis.PointerEvent) => {
			const target = event.target
			if (menuBarRef.current?.contains(target as Node)) return
			if (
				target instanceof Element &&
				target.closest(".win-flyout, .win-menu-flyout, .win-menu-submenu")
			)
				return
			closeMenu()
		}
		window.addEventListener("resize", update)
		window.addEventListener("scroll", update, true)
		document.addEventListener("pointerdown", onPointerDown, true)
		return () => {
			window.removeEventListener("resize", update)
			window.removeEventListener("scroll", update, true)
			document.removeEventListener("pointerdown", onPointerDown, true)
		}
	}, [openIndex])
	useEffect(() => {
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (openIndex !== null) return
			for (const menuItem of items) {
				for (const item of menuItem.Items ?? []) {
					if (matchesMenuAccelerator(item, event as unknown as React.KeyboardEvent)) {
						event.preventDefault()
						invokeTopLevelItem(item)
						return
					}
				}
			}
		}
		document.addEventListener("keydown", onKeyDown)
		return () => document.removeEventListener("keydown", onKeyDown)
	}, [openIndex, items])
	return (
		<>
			<nav
				ref={menuBarRef}
				className={cx("win-menu-bar", props.class)}
				role="menubar"
				aria-label={String(props["AutomationProperties.Name"] ?? "Menu")}
			>
				{props.children ??
					items.map((item, index) => {
						const hasChildren = Boolean(item.Items?.length)
						const disabled = isDisabled(item)
						const open = openIndex === index
						return (
							<div
								key={index}
								className={cx("win-menu-bar-item", open ? "is-open" : undefined)}
								role="none"
							>
								<button
									className="win-menu-bar-button"
									type="button"
									role="menuitem"
									disabled={disabled}
									aria-disabled={disabled}
									aria-haspopup={hasChildren ? "menu" : undefined}
									aria-expanded={hasChildren ? open : undefined}
									tabIndex={focusedIndex === index ? 0 : -1}
									onFocus={() => setFocusedIndex(index)}
									onPointerEnter={(event) => {
										if (
											event.pointerType !== "touch" &&
											openIndex !== null &&
											!disabled
										) {
											if (hasChildren) openMenu(index)
											else closeMenu()
										}
									}}
									onClick={() => {
										if (hasChildren) {
											if (open) closeMenu()
											else openMenu(index)
										} else invokeTopLevelItem(item)
									}}
									onKeyDown={(event) => {
										if (event.key === "ArrowRight") {
											event.preventDefault()
											moveFocus(1)
										} else if (event.key === "ArrowLeft") {
											event.preventDefault()
											moveFocus(-1)
										} else if (event.key === "Home" || event.key === "End") {
											event.preventDefault()
											focusAndUpdateOpenMenu(
												event.key === "Home" ? 0 : items.length - 1,
												event.key === "Home" ? 1 : -1
											)
										} else if (
											event.key === "ArrowDown" ||
											event.key === "Enter" ||
											event.key === " "
										) {
											if (event.key === "ArrowDown" && hasChildren) {
												event.preventDefault()
												openMenu(index)
											} else if (event.key !== "ArrowDown") {
												event.preventDefault()
												if (hasChildren) openMenu(index)
												else invokeTopLevelItem(item)
											}
										} else if (event.key === "Escape") {
											event.preventDefault()
											closeMenu(true)
										}
									}}
								>
									{menuBarLabel(item)}
								</button>
							</div>
						)
					})}
			</nav>
			<WinMenuFlyout
				Items={items[openIndex ?? -1]?.Items ?? []}
				IsOpen={openIndex !== null}
				AnchorRect={anchorRect ?? undefined}
				Placement="BottomEdgeAlignedLeft"
				Gap={0}
				MinWidth={anchorRect?.width ?? 96}
				OverlayInputPassThroughElement
				onValueChange={(value) => {
					if (!value) closeMenu()
				}}
				onSelect={(item) => {
					callback<WinMenuItem>(props, "onItemClick", "ItemClick")?.(item)
					closeMenu(true)
				}}
			/>
		</>
	)
}
