// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinButton, WinTextBlock } from "./winui-primitives"
import {
	alignments,
	callback,
	commonStyle,
	cssLength,
	cx,
	domProps,
	useControllable,
	xamlThickness
} from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

export function WinToolTip(
	props: WinProps & {
		Target?: ReactNode
		Placement?: string
		PlacementPoint?: { x?: number; y?: number }
		InitialShowDelay?: number
		BetweenShowDelay?: number
		IsEnabled?: boolean
		ShowOnDisabled?: boolean
		PlacementTarget?: unknown
		PlacementRect?: {
			x?: number
			y?: number
			left?: number
			top?: number
			width?: number
			height?: number
		}
		MaxWidth?: string | number
		HorizontalOffset?: string | number
		VerticalOffset?: string | number
	}
): React.JSX.Element {
	const hostRef = useRef<HTMLSpanElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)
	const tooltipId = `win-tooltip-${useId().replace(/:/g, "")}`
	const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const pointerRef = useRef<{ x: number; y: number } | null>(null)
	const [hoveringHost, setHoveringHost] = useState(false)
	const [hoveringTooltip, setHoveringTooltip] = useState(false)
	const [position, setPosition] = useState({ top: 0, left: 0 })
	const [isPositioned, setIsPositioned] = useState(false)
	const hasShownRef = useRef(false)
	const lastHiddenAtRef = useRef(0)
	const [open, setOpen] = useControllable<boolean>(props.IsOpen ?? props.Open, false, (value) =>
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen")?.(value)
	)
	const content = props.Content ?? props.Text
	const contentText =
		typeof content === "string" || typeof content === "number" ? String(content) : ""
	const enabled = props.IsEnabled !== false

	const clearTimers = () => {
		if (openTimerRef.current !== undefined) clearTimeout(openTimerRef.current)
		if (closeTimerRef.current !== undefined) clearTimeout(closeTimerRef.current)
		openTimerRef.current = undefined
		closeTimerRef.current = undefined
	}
	const setTooltipOpen = (next: boolean) => {
		if (!enabled && next) return
		setOpen(next)
		if (next) {
			hasShownRef.current = true
			callback<unknown>(props, "onOpened", "Opened")?.(undefined)
		} else {
			lastHiddenAtRef.current = performance.now()
			callback<unknown>(props, "onClosed", "Closed")?.(undefined)
		}
	}
	const targetElement = () => {
		const placementTarget = props.PlacementTarget
		if (placementTarget instanceof HTMLElement) return placementTarget
		if (typeof placementTarget === "string")
			return document.querySelector<HTMLElement>(placementTarget) ?? hostRef.current
		if (placementTarget && typeof placementTarget === "object") {
			const record = placementTarget as { current?: unknown; $el?: unknown }
			if (record.current instanceof HTMLElement) return record.current
			if (record.$el instanceof HTMLElement) return record.$el
		}
		return hostRef.current
	}
	const show = (immediate = false) => {
		if (!enabled || !content) return
		const target = targetElement()
		const targetIsDisabled = Boolean(
			target?.matches(":disabled") || target?.querySelector(":disabled")
		)
		if (targetIsDisabled && props.ShowOnDisabled !== true) return
		clearTimers()
		if (open) return
		const betweenDelay = Math.max(0, props.BetweenShowDelay ?? 200)
		const initialDelay = Math.max(0, props.InitialShowDelay ?? 800)
		const recentlyHidden =
			hasShownRef.current && performance.now() - lastHiddenAtRef.current < betweenDelay
		const delay = immediate ? 0 : recentlyHidden ? betweenDelay : initialDelay
		openTimerRef.current = setTimeout(() => {
			setIsPositioned(false)
			setTooltipOpen(true)
		}, delay)
	}
	const hide = (force = false) => {
		clearTimers()
		if (!force && (hoveringHost || hoveringTooltip)) return
		if (open) setTooltipOpen(false)
	}
	const updatePosition = () => {
		if (!open || !targetElement() || !tooltipRef.current) return
		const placementRect = props.PlacementRect
		const targetRect = placementRect
			? {
					left: Number(placementRect.left ?? placementRect.x ?? 0),
					top: Number(placementRect.top ?? placementRect.y ?? 0),
					width: Number(placementRect.width ?? 0),
					height: Number(placementRect.height ?? 0),
					right:
						Number(placementRect.left ?? placementRect.x ?? 0) +
						Number(placementRect.width ?? 0),
					bottom:
						Number(placementRect.top ?? placementRect.y ?? 0) +
						Number(placementRect.height ?? 0)
				}
			: targetElement()?.getBoundingClientRect()
		if (!targetRect) return
		const tooltipRect = tooltipRef.current.getBoundingClientRect()
		const placement = String(props.Placement ?? "Mouse").toLowerCase()
		const horizontalOffset = Number(props.HorizontalOffset ?? 0)
		const verticalOffset = Number(props.VerticalOffset ?? 0)
		const pointer = props.PlacementPoint ?? pointerRef.current
		const pointerX = pointer?.x ?? targetRect.left + targetRect.width / 2
		const pointerY = pointer?.y ?? targetRect.top + targetRect.height / 2
		const gap = 20
		const centerLeft = targetRect.left + (targetRect.width - tooltipRect.width) / 2
		const centerTop = targetRect.top + (targetRect.height - tooltipRect.height) / 2
		const candidates: Record<string, { top: number; left: number }> = {
			top: {
				top: targetRect.top - tooltipRect.height - gap - verticalOffset,
				left: centerLeft
			},
			bottom: { top: targetRect.bottom + gap + verticalOffset, left: centerLeft },
			left: {
				top: centerTop,
				left: targetRect.left - tooltipRect.width - gap - horizontalOffset
			},
			right: { top: centerTop, left: targetRect.right + gap + horizontalOffset },
			mouse: { top: pointerY + gap + verticalOffset, left: pointerX + horizontalOffset }
		}
		const fits = (candidate: { top: number; left: number }) =>
			candidate.top >= 8 &&
			candidate.left >= 8 &&
			candidate.top + tooltipRect.height <= window.innerHeight - 8 &&
			candidate.left + tooltipRect.width <= window.innerWidth - 8
		const order =
			placement === "top"
				? ["top", "bottom", "right", "left"]
				: placement === "left"
					? ["left", "right", "bottom", "top"]
					: placement === "right"
						? ["right", "left", "bottom", "top"]
						: placement === "mouse"
							? ["mouse", "bottom", "top"]
							: ["bottom", "top", "right", "left"]
		const resolved = order.find((candidate) => fits(candidates[candidate])) ?? order[0]
		const next = candidates[resolved]
		setPosition({
			top: Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, next.top)),
			left: Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, next.left))
		})
		setIsPositioned(true)
	}

	useEffect(() => {
		if (!open) return undefined
		const frame = requestAnimationFrame(updatePosition)
		const onViewportChanged = () => updatePosition()
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") hide(true)
		}
		window.addEventListener("resize", onViewportChanged)
		window.addEventListener("scroll", onViewportChanged, true)
		document.addEventListener("keydown", onKeyDown, true)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("resize", onViewportChanged)
			window.removeEventListener("scroll", onViewportChanged, true)
			document.removeEventListener("keydown", onKeyDown, true)
		}
	}, [open])
	useEffect(() => {
		return () => clearTimers()
	}, [])
	useEffect(() => {
		if (!open) return undefined
		const frame = requestAnimationFrame(updatePosition)
		return () => cancelAnimationFrame(frame)
	}, [
		open,
		props.Placement,
		props.PlacementPoint,
		props.PlacementRect,
		props.HorizontalOffset,
		props.VerticalOffset
	])

	return (
		<>
			<span
				ref={hostRef}
				className="win-tooltip-anchor win-tooltip-host"
				aria-describedby={open ? tooltipId : undefined}
				aria-label={contentText || undefined}
				onPointerEnter={(event) => {
					if (event.pointerType !== "touch") {
						pointerRef.current = { x: event.clientX, y: event.clientY }
						setHoveringHost(true)
						show(false)
					}
				}}
				onPointerMove={(event) => {
					if (event.pointerType !== "touch")
						pointerRef.current = { x: event.clientX, y: event.clientY }
				}}
				onPointerLeave={() => {
					setHoveringHost(false)
					hide()
				}}
				onFocus={() => show(false)}
				onBlur={() => {
					setHoveringHost(false)
					hide()
				}}
			>
				{props.Target ?? props.children}
			</span>
			{open && typeof document !== "undefined"
				? createPortal(
						<div
							ref={tooltipRef}
							id={tooltipId}
							className={cx(
								"win-tooltip",
								`placement-${String(props.Placement ?? "Mouse").toLowerCase()}`
							)}
							role="tooltip"
							style={{
								top: position.top,
								left: position.left,
								visibility: isPositioned ? "visible" : "hidden",
								maxWidth: cssLength(props.MaxWidth ?? 320),
								padding: xamlThickness(props.Padding),
								borderColor: props.BorderBrush,
								borderWidth: cssLength(props.BorderThickness),
								borderRadius: cssLength(props.CornerRadius),
								fontFamily: props.FontFamily,
								fontSize: cssLength(props.FontSize),
								background: props.Background,
								color: props.Foreground
							}}
							onPointerEnter={() => {
								setHoveringTooltip(true)
								clearTimers()
							}}
							onPointerLeave={() => {
								setHoveringTooltip(false)
								hide()
							}}
						>
							{content}
						</div>,
						document.body
					)
				: null}
		</>
	)
}
export function WinToolTipService(props: WinProps): React.JSX.Element {
	return <>{props.children}</>
}
type WinTeachingTipProps = WinProps & {
	Target?: unknown
	target?: unknown
	HeroContent?: ReactNode
	IconSource?: ReactNode
	title?: ReactNode
	subtitle?: ReactNode
	content?: ReactNode
	PreferredPlacement?: string
	preferredPlacement?: string
	PlacementMargin?: number | string
	ShouldConstrainToRootBounds?: boolean
	IsLightDismissEnabled?: boolean
	TailVisibility?: string
	HeroContentPlacement?: string
	ActionButtonContent?: ReactNode
	ActionButtonStyle?: string | WinStyle
	CloseButtonContent?: ReactNode
	CloseButtonStyle?: string | WinStyle
	ActionButtonCommand?: unknown
	ActionButtonCommandParameter?: unknown
	CloseButtonCommand?: unknown
	CloseButtonCommandParameter?: unknown
	isTargeted?: boolean
}

function teachingTipTarget(value: unknown): HTMLElement | null {
	if (value instanceof HTMLElement) return value
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>
		const current = record.current
		if (current instanceof HTMLElement) return current
		const element = record.$el
		if (element instanceof HTMLElement) return element
		const valueRef = record.value
		if (valueRef instanceof HTMLElement) return valueRef
		if (valueRef && typeof valueRef === "object") {
			const valueElement = (valueRef as Record<string, unknown>).$el
			if (valueElement instanceof HTMLElement) return valueElement
		}
	}
	return null
}

type TeachingTipThickness = {
	top: number
	right: number
	bottom: number
	left: number
}

function teachingTipNumber(value: unknown): number {
	const number = Number(value)
	return Number.isFinite(number) ? number : 0
}

function teachingTipThickness(value: unknown): TeachingTipThickness {
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>
		return {
			top: teachingTipNumber(record.top ?? record.Top),
			right: teachingTipNumber(record.right ?? record.Right),
			bottom: teachingTipNumber(record.bottom ?? record.Bottom),
			left: teachingTipNumber(record.left ?? record.Left)
		}
	}
	const parts = String(value ?? "0")
		.split(",")
		.map((part) => Number(part.trim()))
		.filter(Number.isFinite)
	if (parts.length === 1)
		return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] }
	if (parts.length === 2)
		return { top: parts[1], right: parts[0], bottom: parts[1], left: parts[0] }
	if (parts.length === 4)
		return { top: parts[1], right: parts[2], bottom: parts[3], left: parts[0] }
	return { top: 0, right: 0, bottom: 0, left: 0 }
}

function normalizeTeachingTipPlacement(value: unknown): string {
	const normalized = String(value ?? "Auto").toLowerCase()
	const placements = [
		"Top",
		"Bottom",
		"Left",
		"Right",
		"TopRight",
		"TopLeft",
		"BottomRight",
		"BottomLeft",
		"LeftTop",
		"LeftBottom",
		"RightTop",
		"RightBottom",
		"Center"
	]
	return placements.find((placement) => placement.toLowerCase() === normalized) ?? "Auto"
}

function teachingTipSide(placement: string): "Top" | "Bottom" | "Left" | "Right" | "Center" {
	if (placement.startsWith("Top")) return "Top"
	if (placement.startsWith("Bottom")) return "Bottom"
	if (placement.startsWith("Left")) return "Left"
	if (placement.startsWith("Right")) return "Right"
	return "Center"
}

function teachingTipOpposite(placement: string): string {
	switch (teachingTipSide(placement)) {
		case "Top":
			return "Bottom"
		case "Bottom":
			return "Top"
		case "Left":
			return "Right"
		case "Right":
			return "Left"
		default:
			return "Center"
	}
}

function teachingTipClamp(value: number, min: number, max: number): number {
	if (max < min) return min
	return Math.max(min, Math.min(max, value))
}

export interface WinTeachingTipHandle {
	close: () => void
	Close: () => void
	updatePosition: () => void
}

export const WinTeachingTip = forwardRef<WinTeachingTipHandle, WinTeachingTipProps>(
	function WinTeachingTip(props, ref): React.JSX.Element | null {
		const tipRef = useRef<HTMLElement>(null)
		const closeRef = useRef<() => void>(() => undefined)
		const wasOpenRef = useRef(false)
		const [localOpen, setLocalOpen] = useState(false)
		const [position, setPosition] = useState({
			top: 12,
			left: 12,
			tailLeft: 160,
			tailCross: 60
		})
		const [actualPlacement, setActualPlacement] = useState("Bottom")
		const open = props.IsOpen ?? props.visible ?? localOpen
		const target = teachingTipTarget(props.Target ?? props.target)
		const targeted = props.isTargeted ?? Boolean(target)
		const lightDismiss = props.IsLightDismissEnabled === true
		const placement = normalizeTeachingTipPlacement(
			props.PreferredPlacement ?? props.preferredPlacement
		)
		const themeName = String(props.Theme ?? props.theme ?? "").toLowerCase()
		const themeClass =
			themeName === "light" || themeName === "dark"
				? `win-theme-scope theme-${themeName}`
				: undefined
		const margin = useMemo(
			() => teachingTipThickness(props.PlacementMargin),
			[props.PlacementMargin]
		)
		const heroContent = props.HeroContent as ReactNode
		const title = (props.Title || props.title) as ReactNode
		const subtitle = (props.Subtitle || props.subtitle) as ReactNode
		const tipContent = (props.Content ?? props.content ?? props.children) as ReactNode
		const actionContent = props.ActionButtonContent as ReactNode
		const closeButtonContent = props.CloseButtonContent as ReactNode
		const close = () => {
			if (!open) return
			callback<unknown>(
				props,
				"onCloseButtonClick",
				"CloseButtonClick",
				"onClose",
				"close"
			)?.(undefined)
			setLocalOpen(false)
			callback<boolean>(
				props,
				"onValueChange",
				"onUpdate:IsOpen",
				"onUpdate:visible"
			)?.(false)
			callback<unknown>(props, "onClosed", "Closed")?.(undefined)
		}
		closeRef.current = close
		const invokeAction = () => {
			const command = props.ActionButtonCommand
			if (typeof command === "function") command(props.ActionButtonCommandParameter)
			else if (command && typeof command === "object") {
				const record = command as Record<string, unknown>
				if (typeof record.Execute === "function")
					(record.Execute as (parameter: unknown) => void)(
						props.ActionButtonCommandParameter
					)
			}
			callback<unknown>(
				props,
				"onActionButtonClick",
				"ActionButtonClick",
				"onAction",
				"action"
			)?.(undefined)
			setLocalOpen(false)
			callback<boolean>(
				props,
				"onValueChange",
				"onUpdate:IsOpen",
				"onUpdate:visible"
			)?.(false)
			callback<unknown>(props, "onClosed", "Closed")?.(undefined)
		}
		const invokeCloseButton = () => {
			const command = props.CloseButtonCommand
			if (typeof command === "function") command(props.CloseButtonCommandParameter)
			else if (command && typeof command === "object") {
				const record = command as Record<string, unknown>
				if (typeof record.Execute === "function")
					(record.Execute as (parameter: unknown) => void)(
						props.CloseButtonCommandParameter
					)
			}
			close()
		}
		const updatePosition = () => {
			const anchorRect = target?.getBoundingClientRect()
			const tip = tipRef.current
			const width = tip?.offsetWidth ?? 320
			const height = tip?.offsetHeight ?? 120
			const viewportMargin = 8
			const tailEnabled =
				targeted && String(props.TailVisibility ?? "Auto").toLowerCase() !== "collapsed"
			const tailInset = tailEnabled ? 9 : 0
			const candidatePlacements =
				placement === "Auto"
					? ["Bottom", "Top", "Right", "Left"]
					: [placement, teachingTipOpposite(placement), "Bottom", "Top", "Right", "Left"]
			const uniqueCandidates = [...new Set(candidatePlacements)]
			const sideOf = (candidate: string) => teachingTipSide(candidate)
			const fits = (candidate: string) => {
				if (!anchorRect) return true
				const side = sideOf(candidate)
				if (side === "Center") return true
				if (side === "Top")
					return anchorRect.top - height - margin.top - tailInset >= viewportMargin
				if (side === "Bottom")
					return (
						anchorRect.bottom + height + margin.bottom + tailInset <=
						window.innerHeight - viewportMargin
					)
				if (side === "Left")
					return anchorRect.left - width - margin.left - tailInset >= viewportMargin
				return (
					anchorRect.right + width + margin.right + tailInset <=
					window.innerWidth - viewportMargin
				)
			}
			const actual = uniqueCandidates.find(fits) ?? uniqueCandidates[0] ?? "Bottom"
			const side = sideOf(actual)
			let rawTop = viewportMargin
			let rawLeft = viewportMargin
			if (!anchorRect) {
				rawTop = side === "Center" ? (window.innerHeight - height) / 2 : viewportMargin
				rawLeft = side === "Center" ? (window.innerWidth - width) / 2 : viewportMargin
			} else if (side === "Top" || side === "Bottom") {
				rawTop =
					side === "Top"
						? anchorRect.top - height - margin.top - tailInset
						: anchorRect.bottom + margin.bottom + tailInset
				if (actual.endsWith("Right")) rawLeft = anchorRect.right - width
				else if (actual.endsWith("Left")) rawLeft = anchorRect.left
				else rawLeft = anchorRect.left + (anchorRect.width - width) / 2
			} else if (side === "Left" || side === "Right") {
				rawLeft =
					side === "Left"
						? anchorRect.left - width - margin.left - tailInset
						: anchorRect.right + margin.right + tailInset
				if (actual.endsWith("Top")) rawTop = anchorRect.top
				else if (actual.endsWith("Bottom")) rawTop = anchorRect.bottom - height
				else rawTop = anchorRect.top + (anchorRect.height - height) / 2
			} else {
				rawTop = anchorRect.top + (anchorRect.height - height) / 2
				rawLeft = anchorRect.left + (anchorRect.width - width) / 2
			}
			const top =
				props.ShouldConstrainToRootBounds === false
					? rawTop
					: teachingTipClamp(
							rawTop,
							viewportMargin + margin.top,
							window.innerHeight - height - viewportMargin - margin.bottom
						)
			const left =
				props.ShouldConstrainToRootBounds === false
					? rawLeft
					: teachingTipClamp(
							rawLeft,
							viewportMargin + margin.left,
							window.innerWidth - width - viewportMargin - margin.right
						)
			const targetCenterX = anchorRect
				? anchorRect.left + anchorRect.width / 2
				: left + width / 2
			const targetCenterY = anchorRect
				? anchorRect.top + anchorRect.height / 2
				: top + height / 2
			const tailLeft = teachingTipClamp(targetCenterX - left, 18, Math.max(18, width - 18))
			const tailCross = teachingTipClamp(targetCenterY - top, 18, Math.max(18, height - 18))
			setActualPlacement(actual)
			setPosition({ top, left, tailLeft, tailCross })
		}
		useEffect(() => {
			if (!open) return undefined
			const frame = window.requestAnimationFrame(updatePosition)
			const onResize = () => updatePosition()
			const onKeyDown = (event: globalThis.KeyboardEvent) => {
				if (event.key === "Escape" && lightDismiss) closeRef.current()
			}
			const onPointerDown = (event: globalThis.PointerEvent) => {
				if (
					lightDismiss &&
					event.target instanceof Node &&
					!tipRef.current?.contains(event.target) &&
					!target?.contains(event.target)
				)
					closeRef.current()
			}
			window.addEventListener("resize", onResize)
			window.addEventListener("scroll", onResize, true)
			if (lightDismiss) {
				document.addEventListener("keydown", onKeyDown, true)
			}
			document.addEventListener("pointerdown", onPointerDown, true)
			return () => {
				window.cancelAnimationFrame(frame)
				window.removeEventListener("resize", onResize)
				window.removeEventListener("scroll", onResize, true)
				if (lightDismiss) document.removeEventListener("keydown", onKeyDown, true)
				document.removeEventListener("pointerdown", onPointerDown, true)
			}
		}, [
			open,
			target,
			placement,
			margin,
			lightDismiss,
			props.ShouldConstrainToRootBounds,
			props.TailVisibility,
			props.Title,
			props.Subtitle,
			props.Content,
			props.ActionButtonContent,
			props.CloseButtonContent
		])
		useEffect(() => {
			if (open && !wasOpenRef.current)
				callback<unknown>(props, "onOpened", "Opened")?.(undefined)
			wasOpenRef.current = Boolean(open)
		}, [open])
		useImperativeHandle(ref, () => ({ close, Close: close, updatePosition }))
		const icon =
			props.IconSource === "Refresh" ? "\uE72C" : (props.IconSource as ReactNode | undefined)
		const className = typeof props.className === "string" ? props.className : undefined
		const legacyClassName = typeof props.class === "string" ? props.class : undefined
		const hasTail =
			targeted && String(props.TailVisibility ?? "Auto").toLowerCase() !== "collapsed"
		const tailPoints = actualPlacement === "Top" ? "0,0 10,10 20,0" : "0,10 10,0 20,10"
		const actionButtonStyle: WinStyle | undefined =
			props.ActionButtonStyle && typeof props.ActionButtonStyle === "object"
				? (props.ActionButtonStyle as WinStyle)
				: undefined
		const closeButtonStyle: WinStyle | undefined =
			props.CloseButtonStyle && typeof props.CloseButtonStyle === "object"
				? (props.CloseButtonStyle as WinStyle)
				: undefined
		return open && typeof document !== "undefined"
			? createPortal(
					<section
						ref={tipRef}
						className={cx(
							"win-teaching-tip",
							targeted ? "is-targeted" : "is-untargeted",
							lightDismiss ? "is-light-dismiss" : "is-normal-dismiss",
							`placement-${actualPlacement.toLowerCase()}`,
							`placement-side-${teachingTipSide(actualPlacement).toLowerCase()}`,
							`hero-placement-${String(props.HeroContentPlacement ?? "Auto").toLowerCase()}`,
							themeClass,
							className,
							legacyClassName
						)}
						style={
							{
								top: position.top,
								left: position.left,
								"--teaching-tip-tail-left": `${position.tailLeft}px`,
								"--teaching-tip-tail-cross": `${position.tailCross}px`,
								"--teaching-tip-background": lightDismiss
									? "var(--TeachingTipTransientBackground, var(--AcrylicInAppFillColorDefaultBrush, var(--flyout-bg)))"
									: "var(--TeachingTipBackgroundBrush, var(--SolidBackgroundFillColorTertiaryBrush, var(--ctrl-fill-tertiary, var(--flyout-bg))))"
							} as WinStyle
						}
						role="dialog"
						onPointerDown={(event) => event.stopPropagation()}
					>
						{heroContent && <div className="win-teaching-tip-hero">{heroContent}</div>}
						<div
							className={cx(
								"win-teaching-tip-main",
								!closeButtonContent && !lightDismiss
									? "has-alternate-close"
									: undefined
							)}
						>
							{icon && <div className="win-teaching-tip-icon">{icon}</div>}
							<div className="win-teaching-tip-text">
								{title && (
									<WinTextBlock className="win-teaching-tip-title" Text={title} />
								)}
								{subtitle && (
									<WinTextBlock
										className="win-teaching-tip-subtitle"
										Text={subtitle}
									/>
								)}
								{tipContent && (
									<div className="win-teaching-tip-content">{tipContent}</div>
								)}
							</div>
							{!closeButtonContent && !lightDismiss && (
								<button
									type="button"
									className="win-teaching-tip-close"
									aria-label="Close"
									onClick={close}
								>
									{"\uE711"}
								</button>
							)}
						</div>
						{(actionContent || closeButtonContent) && (
							<div
								className={cx(
									"win-teaching-tip-actions",
									actionContent && closeButtonContent
										? "both-buttons-visible"
										: undefined
								)}
							>
								{actionContent && (
									<WinButton
										className="win-teaching-tip-action-button"
										Style={
											typeof props.ActionButtonStyle === "string"
												? props.ActionButtonStyle
												: ""
										}
										style={actionButtonStyle}
										onClick={invokeAction}
									>
										{actionContent}
									</WinButton>
								)}
								{closeButtonContent && (
									<WinButton
										className="win-teaching-tip-close-button"
										Style={
											typeof props.CloseButtonStyle === "string"
												? props.CloseButtonStyle
												: ""
										}
										style={closeButtonStyle}
										onClick={invokeCloseButton}
									>
										{closeButtonContent}
									</WinButton>
								)}
							</div>
						)}
						{hasTail && (
							<svg
								className="win-teaching-tip-tail"
								viewBox="0 0 20 10"
								aria-hidden="true"
							>
								<polygon points={tailPoints} />
								<polyline points={tailPoints} />
							</svg>
						)}
					</section>,
					document.body
				)
			: null
	}
)
export function WinExpander(
	props: WinProps & {
		IsExpanded?: boolean
		Header?: ReactNode
		Description?: ReactNode
		HeaderIcon?: ReactNode
		HeaderControls?: ReactNode
		ExpandDirection?: string
		Padding?: string | number
		HorizontalContentAlignment?: string
		VerticalContentAlignment?: string
	}
): React.JSX.Element {
	const [expanded, setExpanded] = useControllable(
		props.IsExpanded,
		false,
		callback<boolean>(props, "onValueChange", "onUpdate:IsExpanded")
	)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const expandUp = String(props.ExpandDirection ?? "Down").toLowerCase() === "up"
	const isInteractiveHeaderChild = (event: React.SyntheticEvent<HTMLDivElement>) => {
		const target = event.target
		if (!(target instanceof Element)) return false
		const interactive = target.closest(
			'button, a[href], input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [role="option"], [role="radio"], [role="switch"], [role="tab"], [role="textbox"], [tabindex]:not([tabindex="-1"])'
		)
		return Boolean(
			interactive &&
			interactive !== event.currentTarget &&
			event.currentTarget.contains(interactive)
		)
	}
	const toggleExpanded = () => {
		if (!enabled) return
		const next = !expanded
		setExpanded(next)
		if (next) callback<unknown>(props, "onExpanding", "Expanding")?.(undefined)
		else callback<unknown>(props, "onCollapsed", "Collapsed")?.(undefined)
	}
	const contentStyle: WinStyle = {
		padding: xamlThickness(props.Padding === undefined ? 16 : props.Padding),
		alignItems: alignments[props.HorizontalContentAlignment ?? "Stretch"] ?? "stretch",
		justifyContent:
			{ Top: "flex-start", Center: "center", Bottom: "flex-end", Stretch: "flex-start" }[
				props.VerticalContentAlignment ?? "Stretch"
			] ?? "flex-start"
	}
	const rootStyle: WinStyle = {
		...props.style,
		...commonStyle(props)
	}
	if (props.Height !== undefined && props.Height !== "") {
		const height = cssLength(props.Height)
		if (height) {
			rootStyle.minHeight = height
			const numericHeight = Number(props.Height)
			rootStyle["--win-expander-header-height"] = Number.isFinite(numericHeight)
				? Math.max(0, numericHeight - 2) + "px"
				: `calc(${height} - 2px)`
		}
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-expander",
				expanded ? "is-expanded" : undefined,
				expandUp ? "expand-up" : undefined,
				props.Header ||
					props.Content ||
					props.Description ||
					props.HeaderIcon ||
					props.HeaderControls
					? "has-header-content"
					: undefined,
				props.HeaderControls ? "has-header-controls" : undefined,
				!enabled ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={rootStyle}
		>
			<div
				className="win-expander-header"
				role="button"
				aria-expanded={expanded}
				aria-disabled={!enabled}
				tabIndex={enabled ? 0 : -1}
				onClick={(event) => {
					if (!isInteractiveHeaderChild(event)) toggleExpanded()
				}}
				onKeyDown={(event) => {
					if (
						!event.defaultPrevented &&
						!isInteractiveHeaderChild(event) &&
						(event.key === "Enter" || event.key === " ")
					) {
						event.preventDefault()
						toggleExpanded()
					}
				}}
			>
				<div className="win-expander-header-main">
					{props.HeaderIcon && (
						<span className="win-expander-header-icon" aria-hidden="true">
							{props.HeaderIcon}
						</span>
					)}
					<div className="win-expander-header-content">
						{(props.Header ?? props.Content) && (
							<WinTextBlock
								className="win-expander-header-text"
								FontSize={14}
								LineHeight={20}
								TextWrapping="Wrap"
							>
								{props.Header ?? props.Content}
							</WinTextBlock>
						)}
						{props.Description && (
							<WinTextBlock
								className="win-expander-description"
								FontSize={12}
								LineHeight={16}
								Foreground="var(--text-secondary)"
								TextWrapping="Wrap"
							>
								{props.Description}
							</WinTextBlock>
						)}
					</div>
				</div>
				{props.HeaderControls && (
					<div className="win-expander-header-controls">{props.HeaderControls}</div>
				)}
				<span className="win-expander-chevron" aria-hidden="true">
					<span className="win-expander-arrow">{"\uE70D"}</span>
				</span>
			</div>
			<div className="win-expander-grid">
				<div className="win-expander-inner">
					<div className="win-expander-content" style={contentStyle}>
						{props.children}
					</div>
				</div>
			</div>
		</div>
	)
}
