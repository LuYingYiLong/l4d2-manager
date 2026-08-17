// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import type { ReactNode } from "react"
import { WinButton, WinTextBlock } from "./winui-primitives"
import { WinScrollViewer } from "./winui-scrolling"
import { callback, cssLength, cx } from "./winui-shared"
import type { WinProps } from "./winui-shared"

export interface WinFlyoutHandle {
	ShowAt: () => void
	Hide: () => void
	Toggle: () => void
	IsOpen: boolean
}

type WinFlyoutPosition = {
	top: number
	left: number
	maxHeight: number
	minWidth: number
	opensUp: boolean
}

function getPosition(
	anchor: HTMLElement | null,
	popup: HTMLElement | null,
	placement: string,
	explicitRect?: {
		top: number
		bottom: number
		left: number
		right: number
		width?: number
		height?: number
	},
	gap = 6
): WinFlyoutPosition {
	const rect = explicitRect ?? anchor?.getBoundingClientRect()
	if (!rect)
		return {
			top: 12,
			left: 12,
			maxHeight: Math.max(120, window.innerHeight - 16),
			minWidth: 20,
			opensUp: false
		}
	const popupRect = popup?.getBoundingClientRect()
	const preferTop = placement.startsWith("Top")
	const preferCenter = placement === "Top" || placement === "Bottom"
	const preferEnd = placement.endsWith("EdgeAlignedRight")
	const opensRight = placement === "Right" || placement === "RightEdgeAlignedTop"
	const anchorWidth = rect.width ?? rect.right - rect.left
	const popupHeight = popupRect?.height ?? 0
	const margin = 8
	const spaceBelow = window.innerHeight - rect.bottom - gap - margin
	const spaceAbove = rect.top - gap - margin
	const opensUp =
		!opensRight && (preferTop || (spaceBelow < popupHeight && spaceAbove > spaceBelow))
	const top = opensRight ? rect.top : opensUp ? rect.top - gap - popupHeight : rect.bottom + gap
	const left = opensRight
		? rect.right
		: preferCenter
			? rect.left + anchorWidth / 2 - (popupRect?.width ?? 0) / 2
			: preferEnd
				? rect.right - (popupRect?.width ?? 0)
				: rect.left
	const maxLeft = Math.max(8, window.innerWidth - (popupRect?.width ?? 0) - 8)
	const maxTop = Math.max(8, window.innerHeight - (popupRect?.height ?? 0) - 8)
	return {
		top: Math.min(maxTop, Math.max(8, top)),
		left: Math.min(maxLeft, Math.max(8, left)),
		maxHeight: Math.max(120, opensUp ? spaceAbove : spaceBelow),
		minWidth: anchorWidth,
		opensUp
	}
}

export const WinFlyout = forwardRef<
	WinFlyoutHandle,
	WinProps & {
		Placement?: string
		Gap?: number
		ShowMode?: string
		IsLightDismissEnabled?: boolean
		LightDismissOverlayMode?: string
		AnchorRect?: {
			top: number
			bottom: number
			left: number
			right: number
			width?: number
			height?: number
		}
		OverlayInputPassThroughElement?: boolean
		Trigger?: ReactNode
	}
>(function WinFlyout(props, ref) {
	const [localOpen, setLocalOpen] = useState(false)
	const open = props.IsOpen ?? props.Open ?? localOpen
	const anchor = useRef<HTMLSpanElement>(null)
	const popup = useRef<HTMLDivElement>(null)
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
	const [position, setPosition] = useState<WinFlyoutPosition>({
		top: 0,
		left: 0,
		maxHeight: 0,
		minWidth: 20,
		opensUp: false
	})
	const wasOpenRef = useRef(false)
	const setOpen = (next: boolean) => {
		const externallyControlled = props.IsOpen !== undefined || props.Open !== undefined
		if (externallyControlled && next === Boolean(open)) return
		setLocalOpen(next)
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen")?.(next)
		callback<unknown>(
			props,
			next ? "onOpening" : "onClosing",
			next ? "Opening" : "Closing"
		)?.(undefined)
	}
	const openFlyout = () => {
		if (!open) setOpen(true)
	}
	const closeFlyout = () => {
		if (!open) return
		setOpen(false)
		callback<unknown>(props, "onClosed", "Closed")?.(undefined)
	}
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			wasOpenRef.current = true
			callback<unknown>(props, "onOpened", "Opened")?.(undefined)
		} else if (!open) {
			wasOpenRef.current = false
		}
	}, [open])
	useImperativeHandle(ref, () => ({
		ShowAt: openFlyout,
		Hide: closeFlyout,
		Toggle: () => (open ? closeFlyout() : openFlyout()),
		IsOpen: Boolean(open)
	}))
	useEffect(() => {
		if (!open) return undefined
		const update = () =>
			setPosition(
				getPosition(
					anchor.current,
					popup.current,
					String(props.Placement ?? "Bottom"),
					props.AnchorRect as
						| {
								top: number
								bottom: number
								left: number
								right: number
								width?: number
								height?: number
						  }
						| undefined,
					typeof props.Gap === "number" ? props.Gap : 6
				)
			)
		const onKey = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") closeFlyout()
		}
		const onWindowBlur = () => {
			if (props.IsLightDismissEnabled !== false) closeFlyout()
		}
		const onDocumentPointerDown = (event: globalThis.PointerEvent) => {
			if (!props.OverlayInputPassThroughElement || props.IsLightDismissEnabled === false)
				return
			const target = event.target as Node
			if (popup.current?.contains(target) || anchor.current?.contains(target)) return
			if (target instanceof Element && target.closest(".win-commandbar, .win-menu-bar"))
				return
			closeFlyout()
		}
		const onFullscreenChange = () => {
			const fullscreenTarget = document.fullscreenElement
			setPortalTarget(
				fullscreenTarget instanceof HTMLElement ? fullscreenTarget : document.body
			)
			requestAnimationFrame(update)
		}
		setPortalTarget(
			document.fullscreenElement instanceof HTMLElement
				? document.fullscreenElement
				: document.body
		)
		update()
		document.addEventListener("keydown", onKey, true)
		document.addEventListener("pointerdown", onDocumentPointerDown, true)
		window.addEventListener("resize", update)
		window.addEventListener("scroll", update, true)
		window.addEventListener("blur", onWindowBlur)
		document.addEventListener("fullscreenchange", onFullscreenChange)
		return () => {
			document.removeEventListener("keydown", onKey, true)
			document.removeEventListener("pointerdown", onDocumentPointerDown, true)
			window.removeEventListener("resize", update)
			window.removeEventListener("scroll", update, true)
			window.removeEventListener("blur", onWindowBlur)
			document.removeEventListener("fullscreenchange", onFullscreenChange)
		}
	}, [
		open,
		props.Placement,
		props.AnchorRect,
		props.Gap,
		props.IsLightDismissEnabled,
		props.OverlayInputPassThroughElement
	])
	const popupChildren = props.children as ReactNode
	const popupContent =
		open && typeof document !== "undefined"
			? createPortal(
					<>
						{!props.OverlayInputPassThroughElement && (
							<div
								className="win-flyout-dismiss-layer"
								onPointerDown={() =>
									props.IsLightDismissEnabled !== false && closeFlyout()
								}
							/>
						)}
						<div
							ref={popup}
							className={cx(
								"win-flyout",
								position.opensUp ? "opens-up" : "opens-down",
								typeof props.className === "string" ? props.className : undefined,
								typeof props.class === "string" ? props.class : undefined,
								props.Theme === "light"
									? "theme-light"
									: props.Theme === "dark"
										? "theme-dark"
										: undefined
							)}
							style={{
								top: position.top,
								left: position.left,
								minWidth: cssLength(props.MinWidth ?? position.minWidth),
								maxHeight: position.maxHeight || undefined
							}}
							onPointerDown={(event) => event.stopPropagation()}
						>
							<WinScrollViewer
								className="win-flyout-scroll"
								VerticalScrollMode="Auto"
								VerticalScrollBarVisibility="Auto"
								HorizontalScrollMode="Disabled"
								HorizontalScrollBarVisibility="Disabled"
							>
								{popupChildren}
							</WinScrollViewer>
						</div>
					</>,
					portalTarget ?? document.body
				)
			: null
	const trigger = (props.Trigger ?? props.trigger) as ReactNode
	return (
		<>
			<span
				ref={anchor}
				className="win-flyout-anchor"
				onClick={() => (trigger ? (open ? closeFlyout() : openFlyout()) : undefined)}
			>
				{trigger}
			</span>
			{popupContent}
		</>
	)
})

export function WinPopup(props: WinProps): React.JSX.Element {
	return <WinFlyout {...props} className={cx("win-popup", props.className)} />
}

export interface WinContentDialogHandle {
	ShowAsync: () => Promise<string>
	showAsync: () => Promise<string>
	hide: () => void
}

export const WinContentDialog = forwardRef<
	WinContentDialogHandle,
	WinProps & {
		PrimaryButtonText?: string
		SecondaryButtonText?: string
		CloseButtonText?: string
		DefaultButton?: string
		IsLightDismissEnabled?: boolean
		FullSizeDesired?: boolean
		primaryText?: string
		secondaryText?: string
		closeText?: string
		defaultButton?: string
		title?: ReactNode
		theme?: string
	}
>(function WinContentDialog(props, ref) {
	const [localOpen, setLocalOpen] = useState(false)
	const externalOpen = props.IsOpen ?? props.visible
	const open = externalOpen ?? localOpen
	const [renderedOpen, setRenderedOpen] = useState(open)
	const [isClosing, setIsClosing] = useState(false)
	const dialogRef = useRef<HTMLElement>(null)
	const lastActiveElement = useRef<HTMLElement | null>(null)
	const dialogId = `win-content-dialog-${useId().replace(/:/g, "")}`
	const pending = useRef<((result: string) => void) | undefined>(undefined)
	const close = (result = "None") => {
		if (!open) return
		if (externalOpen === undefined) setLocalOpen(false)
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen", "onUpdate:visible")?.(false)
		callback<string>(props, "onClosed", "Closed")?.(result)
		pending.current?.(result)
		pending.current = undefined
	}
	const closeFromLightDismiss = () => {
		callback<unknown>(props, "onCloseButtonClick", "CloseButtonClick", "close")?.(undefined)
		close()
	}
	const show = () => {
		setLocalOpen(true)
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen", "onUpdate:visible")?.(true)
		return new Promise<string>((resolve) => {
			pending.current = resolve
		})
	}
	useImperativeHandle(ref, () => ({ ShowAsync: show, showAsync: show, hide: () => close() }))
	useEffect(() => {
		if (open) {
			setRenderedOpen(true)
			setIsClosing(false)
		} else if (renderedOpen) setIsClosing(true)
	}, [open, renderedOpen])
	useEffect(() => {
		if (!open || !renderedOpen || typeof document === "undefined") return undefined
		lastActiveElement.current = document.activeElement as HTMLElement | null
		const frame = requestAnimationFrame(() => {
			const defaultButton = String(
				props.DefaultButton ?? props.defaultButton ?? ""
			).toLowerCase()
			const preferred = dialogRef.current?.querySelector<HTMLElement>(
				`[data-win-dialog-button="${defaultButton}"]`
			)
			const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
				'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
			)
			;(preferred ?? firstFocusable ?? dialogRef.current)?.focus({ preventScroll: true })
		})
		callback<unknown>(props, "onOpened", "Opened")?.(undefined)
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (!dialogRef.current) return
			if (event.key === "Escape") {
				event.preventDefault()
				close()
				return
			}
			if (event.key !== "Tab") return
			const focusable = Array.from(
				dialogRef.current.querySelectorAll<HTMLElement>(
					'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
				)
			)
			if (focusable.length === 0) return
			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}
		document.addEventListener("keydown", onKeyDown, true)
		return () => {
			cancelAnimationFrame(frame)
			document.removeEventListener("keydown", onKeyDown, true)
			if (lastActiveElement.current && document.contains(lastActiveElement.current))
				lastActiveElement.current.focus({ preventScroll: true })
		}
	}, [open, renderedOpen])
	if (!renderedOpen || typeof document === "undefined") return <></>
	const defaultButton = String(props.DefaultButton ?? props.defaultButton ?? "None").replace(
		/^./,
		(letter) => letter.toUpperCase()
	)
	const button = (
		text: string | undefined,
		result: string,
		enabled: boolean,
		eventName: string,
		className: string
	) =>
		text ? (
			<WinButton
				className={cx("win-content-dialog-button", className)}
				Style={defaultButton === result ? "AccentButtonStyle" : "DefaultButtonStyle"}
				data-win-dialog-button={result.toLowerCase()}
				disabled={!enabled}
				onClick={() => {
					const eventAliases =
						result === "Primary"
							? ["PrimaryButtonClick", "primary"]
							: result === "Secondary"
								? ["SecondaryButtonClick", "secondary"]
								: ["CloseButtonClick", "close"]
					callback<unknown>(props, eventName, ...eventAliases)?.(undefined)
					close(result === "Close" ? "None" : result)
				}}
			>
				{text}
			</WinButton>
		) : null
	const dialogChildren = (props.children ?? props.Content) as ReactNode
	const title = (props.Title || props.title) as ReactNode
	const primaryText = (props.PrimaryButtonText || props.primaryText) as string | undefined
	const secondaryText = (props.SecondaryButtonText || props.secondaryText) as string | undefined
	const closeText = (props.CloseButtonText || props.closeText) as string | undefined
	const primaryEnabled = props.IsPrimaryButtonEnabled as boolean | undefined
	const secondaryEnabled = props.IsSecondaryButtonEnabled as boolean | undefined
	const hasCommandButtons = Boolean(primaryText || secondaryText || closeText)
	const theme = String(props.Theme ?? props.theme ?? "").toLowerCase()
	return createPortal(
		<div
			className={cx(
				"win-content-dialog-overlay",
				"win-theme-scope",
				theme === "light" || theme === "dark" ? `theme-${theme}` : undefined,
				isClosing ? "dialog-closing" : undefined
			)}
			onAnimationEnd={(event) => {
				if (isClosing && event.target === event.currentTarget) setRenderedOpen(false)
			}}
			onPointerDown={(event) => {
				if (event.currentTarget === event.target && props.IsLightDismissEnabled)
					closeFromLightDismiss()
			}}
		>
			<section
				ref={dialogRef}
				className={cx(
					"win-content-dialog",
					props.FullSizeDesired ? "full-size" : undefined,
					isClosing ? "dialog-closing" : undefined
				)}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? `${dialogId}-title` : undefined}
				tabIndex={-1}
			>
				<WinScrollViewer
					className="win-content-dialog-content"
					VerticalScrollMode="Auto"
					VerticalScrollBarVisibility="Auto"
					HorizontalScrollMode="Disabled"
					HorizontalScrollBarVisibility="Disabled"
				>
					{title && (
						<WinTextBlock
							className="win-content-dialog-title"
							id={`${dialogId}-title`}
							Text={title}
							FontSize={20}
							FontWeight={600}
							TextWrapping="WrapWholeWords"
						/>
					)}
					<div className="win-content-dialog-body">{dialogChildren}</div>
				</WinScrollViewer>
				{hasCommandButtons && (
					<div
						className={cx(
							"win-content-dialog-command-space",
							primaryText && secondaryText && closeText
								? "all-visible"
								: primaryText && secondaryText
									? "primary-secondary-visible"
									: primaryText && closeText
										? "primary-close-visible"
										: secondaryText && closeText
											? "secondary-close-visible"
											: primaryText
												? "primary-visible"
												: secondaryText
													? "secondary-visible"
													: "close-visible"
						)}
					>
						{button(
							primaryText,
							"Primary",
							primaryEnabled !== false,
							"onPrimaryButtonClick",
							"win-content-dialog-primary"
						)}
						{button(
							secondaryText,
							"Secondary",
							secondaryEnabled !== false,
							"onSecondaryButtonClick",
							"win-content-dialog-secondary"
						)}
						{button(
							closeText,
							"Close",
							true,
							"onCloseButtonClick",
							"win-content-dialog-close"
						)}
					</div>
				)}
			</section>
		</div>,
		document.body
	)
})
