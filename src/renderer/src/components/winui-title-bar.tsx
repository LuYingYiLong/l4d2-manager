// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { ReactNode } from "react"
import { callback, commonStyle, cssLength, cx } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

type WinTitleBarProps = WinProps & {
	Title?: ReactNode
	Subtitle?: ReactNode
	IconSource?: string | Record<string, unknown>
	LeftHeader?: ReactNode
	RightHeader?: ReactNode
	IsBackButtonVisible?: boolean
	IsBackButtonEnabled?: boolean
	IsPaneToggleButtonVisible?: boolean
	PreferredHeightOption?: "Default" | "Tall" | "Compact" | string
	AutoRefreshDragRegions?: boolean
	TitleBarContentHorizontalAlignment?: string
	TitleBarContentVerticalAlignment?: string
	TitleBarLeftHeaderHorizontalAlignment?: string
	TitleBarLeftHeaderVerticalAlignment?: string
	TitleBarRightHeaderHorizontalAlignment?: string
	TitleBarRightHeaderVerticalAlignment?: string
}

export interface WinTitleBarHandle {
	RecomputeDragRegions: () => void
	readonly IsCompact: boolean
	readonly IsNarrow: boolean
	SetIsDragRegion: (element: HTMLElement, value: boolean | null | undefined) => void
	GetIsDragRegion: (element: HTMLElement) => boolean | null
	ClearIsDragRegion: (element: HTMLElement) => void
}

const titleBarSymbolGlyphs: Record<string, string> = {
	Accept: "\uE8FB",
	Cancel: "\uE711",
	Home: "\uE80F",
	Refresh: "\uE72C",
	Find: "\uE721",
	Settings: "\uE713",
	Favorite: "\uE734"
}

function titleBarCssAlignment(value: unknown): string {
	return (
		(
			{ Left: "start", Center: "center", Right: "end", Stretch: "stretch" } as Record<
				string,
				string
			>
		)[String(value ?? "Center")] ?? "center"
	)
}

function titleBarFlexAlignment(value: unknown): string {
	return (
		({ Left: "flex-start", Center: "center", Right: "flex-end" } as Record<string, string>)[
			String(value ?? "Center")
		] ?? "center"
	)
}

function titleBarVerticalAlignment(value: unknown): string {
	return (
		(
			{ Top: "start", Center: "center", Bottom: "end", Stretch: "stretch" } as Record<
				string,
				string
			>
		)[String(value ?? "Center")] ?? "center"
	)
}

function decodeTitleBarGlyph(value: unknown): string {
	const glyph = String(value ?? "")
	if (glyph.startsWith("\\u")) return String.fromCodePoint(Number.parseInt(glyph.slice(2), 16))
	if (glyph.startsWith("&#x") && glyph.endsWith(";"))
		return String.fromCodePoint(Number.parseInt(glyph.slice(3, -1), 16))
	if (glyph.startsWith("0x")) return String.fromCodePoint(Number.parseInt(glyph, 16))
	if (/^[0-9A-Fa-f]{4,5}$/.test(glyph)) return String.fromCodePoint(Number.parseInt(glyph, 16))
	return glyph
}

function titleBarLooksLikeImage(value: unknown): boolean {
	const source = String(value ?? "")
	return (
		/^(data:|blob:|https?:|\/)/i.test(source) ||
		/\.(png|jpe?g|gif|svg|ico|webp|bmp)([?#]|$)/i.test(source)
	)
}

export const WinTitleBar = forwardRef<WinTitleBarHandle, WinTitleBarProps>(
	function WinTitleBar(props, ref): React.JSX.Element {
		const rootRef = useRef<HTMLElement>(null)
		const contentRef = useRef<HTMLDivElement>(null)
		const [isCompact, setIsCompact] = useState(false)
		const [isNarrow, setIsNarrow] = useState(false)
		const [isDeactivated, setIsDeactivated] = useState(false)
		const [backPressed, setBackPressed] = useState(false)
		const [panePressed, setPanePressed] = useState(false)
		const compactThreshold = useRef<number | null>(null)
		const contentDesiredWidth = useRef(240)
		const initialDocumentTitle = useRef<string | null>(null)
		const appliedDocumentTitle = useRef<string | null>(null)
		const title = props.Title as ReactNode
		const subtitle = props.Subtitle as ReactNode
		const content = (props.children ?? props.Content) as ReactNode
		const leftHeader = props.LeftHeader as ReactNode
		const rightHeader = props.RightHeader as ReactNode
		const hasContent = content !== undefined && content !== null
		const isTall = props.PreferredHeightOption === "Tall"
		const isCompactHeight = props.PreferredHeightOption === "Compact"
		const isExpandedHeight =
			!isCompactHeight &&
			(isTall || hasContent || Boolean(leftHeader) || Boolean(rightHeader))
		const negativeInsetSpacing =
			Boolean(props.IsBackButtonVisible) !== Boolean(props.IsPaneToggleButtonVisible)
		const isEnabled = props.IsEnabled !== false
		const updateCompactMode = () => {
			const root = rootRef.current
			const contentElement = contentRef.current
			if (!root || !contentElement) return
			const firstChild = contentElement.firstElementChild
			if (firstChild) {
				const width = firstChild.getBoundingClientRect().width
				if (width > contentDesiredWidth.current) contentDesiredWidth.current = width
			}
			const rootWidth = root.getBoundingClientRect().width
			const overflows = contentElement.clientWidth < contentDesiredWidth.current - 1
			setIsNarrow(rootWidth < 480)
			if (!isCompact && overflows && compactThreshold.current === null) {
				compactThreshold.current = rootWidth
				setIsCompact(true)
			} else if (
				isCompact &&
				compactThreshold.current !== null &&
				rootWidth >= compactThreshold.current + 32
			) {
				compactThreshold.current = null
				setIsCompact(false)
			}
		}
		const recomputeDragRegions = () => {
			const root = rootRef.current
			if (!root) return
			root.querySelectorAll("[IsDragRegion]").forEach((element) => {
				const value = element.getAttribute("IsDragRegion")
				if (value !== "true" && value !== "false") element.removeAttribute("IsDragRegion")
			})
			void root.getBoundingClientRect()
			updateCompactMode()
		}
		const setIsDragRegion = (element: HTMLElement, value: boolean | null | undefined) => {
			if (value === true || value === false)
				element.setAttribute("IsDragRegion", String(value))
			else element.removeAttribute("IsDragRegion")
			recomputeDragRegions()
		}
		const getIsDragRegion = (element: HTMLElement): boolean | null => {
			const value = element.getAttribute("IsDragRegion")
			if (value === "true") return true
			if (value === "false") return false
			return null
		}
		const clearIsDragRegion = (element: HTMLElement) => {
			element.removeAttribute("IsDragRegion")
			recomputeDragRegions()
		}
		useImperativeHandle(
			ref,
			() => ({
				RecomputeDragRegions: recomputeDragRegions,
				get IsCompact() {
					return isCompact
				},
				get IsNarrow() {
					return isNarrow
				},
				SetIsDragRegion: setIsDragRegion,
				GetIsDragRegion: getIsDragRegion,
				ClearIsDragRegion: clearIsDragRegion
			}),
			[isCompact, isNarrow]
		)
		useEffect(() => {
			const onFocus = () => setIsDeactivated(false)
			const onBlur = () => setIsDeactivated(true)
			setIsDeactivated(typeof document !== "undefined" ? !document.hasFocus() : false)
			window.addEventListener("focus", onFocus)
			window.addEventListener("blur", onBlur)
			initialDocumentTitle.current = document.title
			if (typeof title === "string" && title && document.title !== title) {
				appliedDocumentTitle.current = title
				document.title = title
			}
			const observer =
				typeof ResizeObserver !== "undefined"
					? new ResizeObserver(updateCompactMode)
					: undefined
			if (rootRef.current) observer?.observe(rootRef.current)
			if (contentRef.current) observer?.observe(contentRef.current)
			const mutationObserver =
				typeof MutationObserver !== "undefined" && contentRef.current
					? new MutationObserver(() => {
							updateCompactMode()
							if (props.AutoRefreshDragRegions) recomputeDragRegions()
						})
					: undefined
			if (mutationObserver && contentRef.current)
				mutationObserver.observe(contentRef.current, {
					childList: true,
					subtree: true,
					attributes: true,
					characterData: true
				})
			updateCompactMode()
			return () => {
				window.removeEventListener("focus", onFocus)
				window.removeEventListener("blur", onBlur)
				observer?.disconnect()
				mutationObserver?.disconnect()
				if (
					appliedDocumentTitle.current &&
					document.title === appliedDocumentTitle.current
				) {
					document.title = initialDocumentTitle.current ?? ""
				}
			}
		}, [props.AutoRefreshDragRegions, title])
		const iconSource = props.IconSource as string | Record<string, unknown> | undefined
		const iconObject =
			iconSource && typeof iconSource === "object"
				? (iconSource as Record<string, unknown>)
				: undefined
		const isBackButtonVisible = props.IsBackButtonVisible as boolean | undefined
		const isPaneToggleButtonVisible = props.IsPaneToggleButtonVisible as boolean | undefined
		const iconImage =
			typeof iconSource === "string"
				? titleBarLooksLikeImage(iconSource)
				: Boolean(
						iconObject?.ImageSource ??
						iconObject?.UriSource ??
						iconObject?.Source ??
						iconObject?.src
					)
		const imageSource =
			typeof iconSource === "string"
				? iconSource
				: String(
						iconObject?.ImageSource ??
							iconObject?.UriSource ??
							iconObject?.Source ??
							iconObject?.src ??
							""
					)
		const glyphValue =
			typeof iconSource === "string"
				? decodeTitleBarGlyph(iconSource)
				: iconObject?.Glyph !== undefined
					? decodeTitleBarGlyph(iconObject.Glyph)
					: (titleBarSymbolGlyphs[String(iconObject?.Symbol ?? "")] ??
						String(iconObject?.Symbol ?? ""))
		const iconGlyphStyle: WinStyle = {
			...(iconObject?.FontFamily ? { fontFamily: String(iconObject.FontFamily) } : {}),
			...(iconObject?.FontSize !== undefined
				? { fontSize: cssLength(iconObject.FontSize) }
				: {}),
			...(iconObject?.Foreground ? { color: String(iconObject.Foreground) } : {})
		}
		const className = typeof props.className === "string" ? props.className : undefined
		const legacyClassName = typeof props.class === "string" ? props.class : undefined
		const background = props.Background as string | undefined
		const foreground = props.Foreground as string | undefined
		const rootStyle: WinStyle = {
			...(props.style as WinStyle | undefined),
			...commonStyle(props),
			...(background ? { background } : {}),
			...(foreground ? { color: foreground, "--TitleBarForegroundBrush": foreground } : {})
		}
		const contentStyle: WinStyle = {
			alignItems: titleBarVerticalAlignment(
				props.TitleBarContentVerticalAlignment ?? "Center"
			),
			justifyContent: isCompact
				? "flex-start"
				: titleBarFlexAlignment(props.TitleBarContentHorizontalAlignment ?? "Center"),
			...(isCompact ? { padding: "var(--TitleBarCompactContentMargin)" } : {})
		}
		const titleBarText = title ?? ""
		const handleBack = () => {
			if (props.IsBackButtonEnabled === false || !isEnabled) return
			callback<unknown>(props, "onBackRequested", "BackRequested")?.(undefined)
		}
		const handlePaneToggle = () =>
			callback<unknown>(props, "onPaneToggleRequested", "PaneToggleRequested")?.(undefined)
		return (
			<header
				ref={rootRef}
				className={cx(
					"win-titlebar",
					isExpandedHeight ? "is-expanded-height" : "is-compact-height",
					isCompact ? "is-compact" : undefined,
					isNarrow ? "is-narrow" : undefined,
					isDeactivated ? "is-deactivated" : undefined,
					negativeInsetSpacing ? "is-negative-inset-spacing" : undefined,
					className,
					legacyClassName
				)}
				style={rootStyle}
			>
				<div className="win-titlebar-left-padding" aria-hidden="true" />
				{isBackButtonVisible && (
					<button
						type="button"
						className={cx(
							"win-titlebar-back-button",
							backPressed ? "pressed" : undefined
						)}
						disabled={!isEnabled || props.IsBackButtonEnabled === false}
						aria-label="Back"
						onPointerDown={() => setBackPressed(true)}
						onPointerUp={() => setBackPressed(false)}
						onPointerLeave={() => setBackPressed(false)}
						onClick={handleBack}
					>
						<span className="icon animated-icon animated-icon-back" aria-hidden="true">
							{"\uE72B"}
						</span>
					</button>
				)}
				{isPaneToggleButtonVisible && (
					<button
						type="button"
						className={cx(
							"win-titlebar-pane-toggle-button",
							panePressed ? "pressed" : undefined
						)}
						data-nav-pane-toggle="true"
						aria-label="Navigation menu"
						onPointerDown={() => setPanePressed(true)}
						onPointerUp={() => setPanePressed(false)}
						onPointerLeave={() => setPanePressed(false)}
						onClick={handlePaneToggle}
					>
						<span
							className="icon animated-icon animated-icon-hamburger"
							aria-hidden="true"
						>
							{"\uE700"}
						</span>
					</button>
				)}
				{leftHeader && (
					<div
						className="win-titlebar-left-header"
						style={{
							justifySelf: titleBarCssAlignment(
								props.TitleBarLeftHeaderHorizontalAlignment ?? "Left"
							),
							alignSelf: titleBarVerticalAlignment(
								props.TitleBarLeftHeaderVerticalAlignment ?? "Center"
							)
						}}
					>
						{leftHeader}
					</div>
				)}
				<div className="win-titlebar-left-header-padding" aria-hidden="true" />
				{iconSource && (
					<div className="win-titlebar-icon" aria-hidden="true">
						{iconImage ? (
							<img src={imageSource} alt="" />
						) : (
							<span className="win-titlebar-icon-glyph" style={iconGlyphStyle}>
								{glyphValue}
							</span>
						)}
					</div>
				)}
				{titleBarText && <div className="win-titlebar-title">{titleBarText}</div>}
				{subtitle && <div className="win-titlebar-subtitle">{subtitle}</div>}
				{hasContent && (
					<div
						ref={contentRef}
						className={cx(
							"win-titlebar-content",
							isCompact ? "is-compact" : undefined,
							props.TitleBarContentHorizontalAlignment === "Stretch"
								? "is-content-stretch"
								: undefined
						)}
						style={contentStyle}
					>
						{content}
					</div>
				)}
				{rightHeader && (
					<div
						className="win-titlebar-right-header"
						style={{
							justifySelf: titleBarCssAlignment(
								props.TitleBarRightHeaderHorizontalAlignment ?? "Right"
							),
							alignSelf: titleBarVerticalAlignment(
								props.TitleBarRightHeaderVerticalAlignment ?? "Center"
							)
						}}
					>
						{rightHeader}
					</div>
				)}
				<div className="win-titlebar-min-drag-region" aria-hidden="true" />
				<div className="win-titlebar-right-padding" aria-hidden="true" />
			</header>
		)
	}
)
