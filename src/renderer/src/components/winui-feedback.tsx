// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinButton, WinTextBlock } from "./winui-primitives"
import {
	alignments,
	callback,
	commonStyle,
	contentOf,
	cssLength,
	cx,
	domProps,
	useControllable,
	xamlThickness
} from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle } from "./winui-shared"

export function WinRichTextBlock(props: WinProps): React.JSX.Element {
	return <WinTextBlock {...props} className={cx("win-rich-text-block", props.className)} />
}

export function WinProgressBar(
	props: WinProps & {
		Value?: number
		Minimum?: number
		Maximum?: number
		IsIndeterminate?: boolean | string
		ShowError?: boolean | string
		ShowPaused?: boolean | string
		Visibility?: string
		MinHeight?: string | number
	}
): React.JSX.Element {
	const toFiniteNumber = (value: unknown, fallback: number) => {
		const number = Number(value)
		return Number.isFinite(number) ? number : fallback
	}
	const isTrue = (value: unknown) => value === true || value === "True" || value === "true"
	const cssCornerRadius = (value: unknown) => {
		if (value === "" || value === undefined || value === null) return undefined
		const parts = String(value)
			.split(",")
			.map((part) => cssLength(part.trim()))
		if (parts.length === 1) return parts[0]
		if (parts.length === 4) return parts.join(" ")
		return cssLength(value)
	}
	const brushValue = (value: unknown) => {
		if (typeof value === "string") return value
		if (value && typeof value === "object") {
			const record = value as Record<string, unknown>
			return String(record.Color ?? record.color ?? record.Value ?? record.value ?? "")
		}
		return undefined
	}
	const alignmentStyle = (value: unknown, axis: "horizontal" | "vertical") => {
		const alignment = String(value ?? "").toLowerCase()
		if (axis === "vertical")
			return (
				{ center: "center", top: "flex-start", bottom: "flex-end", stretch: "stretch" }[
					alignment
				] ?? "center"
			)
		return (
			{ left: "flex-start", center: "center", right: "flex-end", stretch: "stretch" }[
				alignment
			] ?? "stretch"
		)
	}
	const minimum = toFiniteNumber(props.Minimum, 0)
	const maximum = toFiniteNumber(props.Maximum, 100)
	const range = maximum - minimum
	const value = toFiniteNumber(props.Value, minimum)
	const progressValue = range > 0 ? Math.min(maximum, Math.max(minimum, value)) : minimum
	const percent = range > 0 ? ((progressValue - minimum) / range) * 100 : 0
	const visibility = String(props.Visibility ?? "Visible")
	const isCollapsed = visibility === "Collapsed"
	const isIndeterminate = isTrue(props.IsIndeterminate) && visibility === "Visible"
	const showError = isTrue(props.ShowError)
	const showPaused = isTrue(props.ShowPaused)
	const visualState = isIndeterminate
		? showError
			? "IndeterminateError"
			: showPaused
				? "IndeterminatePaused"
				: "Indeterminate"
		: showError
			? "Error"
			: showPaused
				? "Paused"
				: "Determinate"
	const foreground = brushValue(props.Foreground)
	const background = brushValue(props.Background)
	const borderBrush = brushValue(props.BorderBrush)
	const style: WinStyle = {
		...props.style,
		width: props.Width === undefined || props.Width === "" ? "100%" : cssLength(props.Width),
		height: cssLength(props.Height) ?? cssLength(props.MinHeight ?? 3),
		minHeight: cssLength(props.MinHeight ?? 3),
		margin: xamlThickness(props.Margin),
		padding: xamlThickness(props.Padding),
		borderWidth: xamlThickness(props.BorderThickness),
		borderStyle: xamlThickness(props.BorderThickness) ? "solid" : undefined,
		borderColor:
			borderBrush ??
			"var(--ProgressBarBorderBrush, var(--ControlStrokeColorDefaultBrush, var(--ctrl-border)))",
		borderRadius: cssCornerRadius(props.CornerRadius ?? 1.5),
		display: isCollapsed ? "none" : "inline-block",
		visibility: visibility === "Hidden" ? "hidden" : undefined,
		alignSelf: alignmentStyle(props.VerticalAlignment, "vertical"),
		justifySelf: alignmentStyle(props.HorizontalAlignment, "horizontal"),
		"--ProgressBarForeground": foreground,
		"--ProgressBarBackground": background,
		"--ProgressBarBorderBrush": borderBrush,
		"--ProgressBarMinHeight": cssLength(props.MinHeight ?? 3),
		"--ProgressBarCornerRadius": cssCornerRadius(props.CornerRadius ?? 1.5)
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-progress-bar",
				isIndeterminate ? "is-indeterminate" : undefined,
				visualState === "Paused" || visualState === "IndeterminatePaused"
					? "is-paused"
					: undefined,
				visualState === "Error" || visualState === "IndeterminateError"
					? "is-error"
					: undefined,
				props.IsEnabled === false ? "is-disabled" : undefined,
				isCollapsed ? "is-collapsed" : undefined,
				"state-" + visualState,
				props.class,
				props.className
			)}
			style={style}
			role="progressbar"
			aria-valuemin={isIndeterminate ? undefined : minimum}
			aria-valuemax={isIndeterminate ? undefined : maximum}
			aria-valuenow={isIndeterminate ? undefined : progressValue}
			aria-busy={isIndeterminate ? true : undefined}
		>
			<div className="LayoutRoot">
				<div className="ProgressBarRoot">
					<div className="ProgressBarClip">
						<div className="ProgressBarTrack" />
						<div
							className="DeterminateProgressBarIndicator"
							style={{ width: percent + "%" }}
						/>
						<div className="IndeterminateProgressBarIndicator" />
						<div className="IndeterminateProgressBarIndicator2" />
					</div>
				</div>
			</div>
		</div>
	)
}

export function WinProgressRing(
	props: WinProps & {
		IsActive?: boolean | string
		IsIndeterminate?: boolean | string
		Value?: number
		Minimum?: number
		Maximum?: number
		Visibility?: string
		IsHitTestVisible?: boolean
		IsTabStop?: boolean
	}
): React.JSX.Element {
	const isTrue = (value: unknown) => value === true || value === "True" || value === "true"
	const isActive = props.IsActive === undefined ? true : isTrue(props.IsActive)
	const isIndeterminate =
		props.IsIndeterminate === undefined ? true : isTrue(props.IsIndeterminate)
	const minimumCandidate = Number(props.Minimum ?? 0)
	const minimum = Number.isFinite(minimumCandidate) ? minimumCandidate : 0
	const maximumCandidate = Number(props.Maximum ?? 100)
	const maximum = Math.max(minimum, Number.isFinite(maximumCandidate) ? maximumCandidate : 100)
	const valueCandidate = Number(props.Value ?? 0)
	const progressValue = Number.isFinite(valueCandidate)
		? Math.min(maximum, Math.max(minimum, valueCandidate))
		: minimum
	const range = maximum - minimum
	const progressFraction = range > 0 ? (progressValue - minimum) / range : 0
	const visibility = String(props.Visibility ?? "Visible")
	const indeterminateRef = useRef<SVGCircleElement>(null)
	const indeterminateBRef = useRef<SVGCircleElement>(null)
	const animationFrame = useRef<number | undefined>(undefined)
	const animationStart = useRef(0)
	const previousValue = useRef(props.Value)
	const brushValue = (value: unknown) => {
		if (typeof value === "string") return value
		if (value && typeof value === "object") {
			const record = value as Record<string, unknown>
			return String(record.Color ?? record.color ?? record.Value ?? record.value ?? "")
		}
		return undefined
	}
	const stopIndeterminateAnimation = () => {
		if (animationFrame.current !== undefined) {
			window.cancelAnimationFrame(animationFrame.current)
			animationFrame.current = undefined
		}
		animationStart.current = 0
	}
	const setTrim = (
		element: SVGCircleElement | null,
		start: number,
		end: number,
		opacity: number
	) => {
		if (!element) return
		const length = Math.max(0.0001, (end - start) * 100)
		const gap = Math.max(0.0001, 100 - length)
		element.style.strokeDasharray = `${length} ${gap}`
		element.style.strokeDashoffset = `${-start * 100}`
		element.style.opacity = String(opacity)
	}
	const renderIndeterminateFrame = (timestamp: number) => {
		if (!animationStart.current) animationStart.current = timestamp
		const progress = ((timestamp - animationStart.current) % 2000) / 2000
		const firstHalf = progress < 0.5
		const localProgress = firstHalf ? progress * 2 : (progress - 0.5) * 2
		const rotationProgress = firstHalf ? localProgress * 0.5 : 0.5 + localProgress * 0.5
		const transform = `rotate(${rotationProgress * 900 - 90} 50 50)`
		indeterminateRef.current?.setAttribute("transform", transform)
		indeterminateBRef.current?.setAttribute("transform", transform)
		if (firstHalf) {
			setTrim(indeterminateRef.current, 0, 0.5, 0)
			setTrim(indeterminateBRef.current, 0, 0.0001 + localProgress * 0.5, 1)
		} else {
			setTrim(indeterminateRef.current, localProgress * 0.5, 0.5, 1)
			setTrim(indeterminateBRef.current, 0, 0.5, 0)
		}
		animationFrame.current = window.requestAnimationFrame(renderIndeterminateFrame)
	}
	useEffect(() => {
		stopIndeterminateAnimation()
		if (isActive && isIndeterminate && typeof window !== "undefined")
			animationFrame.current = window.requestAnimationFrame(renderIndeterminateFrame)
		return stopIndeterminateAnimation
	}, [isActive, isIndeterminate])
	useEffect(() => {
		if (previousValue.current !== undefined && !Object.is(previousValue.current, props.Value))
			callback<{ OldValue: number; NewValue: number }>(
				props,
				"onValueChanged",
				"ValueChanged"
			)?.({
				OldValue: Number(previousValue.current),
				NewValue: Number(props.Value)
			})
		previousValue.current = props.Value
	}, [props.Value])
	const width = cssLength(props.Width === undefined || props.Width === "" ? 32 : props.Width)
	const height = cssLength(props.Height === undefined || props.Height === "" ? 32 : props.Height)
	const foreground = brushValue(props.Foreground) ?? "var(--accent-base)"
	const background = brushValue(props.Background) ?? "transparent"
	const rootStyle: WinStyle = {
		...props.style,
		...commonStyle(props),
		width,
		height,
		minWidth: cssLength(
			props.MinWidth === undefined || props.MinWidth === "" ? 16 : props.MinWidth
		),
		minHeight: cssLength(
			props.MinHeight === undefined || props.MinHeight === "" ? 16 : props.MinHeight
		),
		maxWidth: cssLength(props.MaxWidth),
		maxHeight: cssLength(props.MaxHeight),
		margin: props.Margin === undefined ? undefined : xamlThickness(props.Margin),
		alignSelf: alignments[props.VerticalAlignment ?? "Center"] ?? "center",
		justifySelf: alignments[props.HorizontalAlignment ?? "Center"] ?? "center",
		pointerEvents: props.IsHitTestVisible === true ? undefined : "none",
		"--ProgressRingForeground": foreground,
		"--ProgressRingBackground": background
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-progress-ring",
				isActive ? "is-active" : "is-inactive",
				isIndeterminate ? "is-indeterminate" : "is-determinate",
				props.IsEnabled === false ? "is-disabled" : undefined,
				visibility === "Hidden" ? "is-hidden" : undefined,
				visibility === "Collapsed" ? "is-collapsed" : undefined,
				props.className,
				props.class
			)}
			style={rootStyle}
			tabIndex={props.IsTabStop === true ? 0 : -1}
			role="progressbar"
			aria-valuenow={!isIndeterminate && isActive ? progressValue : undefined}
			aria-valuemin={!isIndeterminate && isActive ? minimum : undefined}
			aria-valuemax={!isIndeterminate && isActive ? maximum : undefined}
			aria-busy={isIndeterminate && isActive ? true : undefined}
			aria-hidden={!isActive ? true : undefined}
		>
			<div className="LayoutRoot">
				<svg
					className="ProgressRingVisual"
					viewBox="0 0 100 100"
					role="presentation"
					aria-hidden="true"
				>
					<circle className="ProgressRingTrack" cx="50" cy="50" r="42" />
					<circle
						className="ProgressRingDeterminateIndicator"
						cx="50"
						cy="50"
						r="42"
						pathLength={100}
						style={{ strokeDashoffset: `${100 - progressFraction * 100}` }}
					/>
					<circle
						ref={indeterminateRef}
						className="ProgressRingIndeterminateIndicator ProgressRingIndeterminateIndicatorA"
						cx="50"
						cy="50"
						r="42"
						pathLength={100}
					/>
					<circle
						ref={indeterminateBRef}
						className="ProgressRingIndeterminateIndicator ProgressRingIndeterminateIndicatorB"
						cx="50"
						cy="50"
						r="42"
						pathLength={100}
					/>
				</svg>
			</div>
		</div>
	)
}
export function WinRating(
	props: WinProps &
		WinChangeProps<number> & {
			Value?: number
			modelValue?: number
			MaxRating?: number
			max?: number
			PlaceholderValue?: number
			Caption?: ReactNode
			InitialSetValue?: number
			IsClearEnabled?: boolean
			IsReadOnly?: boolean
			disabled?: boolean
		}
): React.JSX.Element {
	const noValue = -1
	const maxRating = Math.max(1, Math.trunc(Number(props.max ?? props.MaxRating ?? 5)) || 5)
	const initialSetCandidate = Number(props.InitialSetValue ?? 1)
	const initialSetValue = Number.isFinite(initialSetCandidate)
		? Math.max(1, Math.min(maxRating, initialSetCandidate))
		: 1
	const externalValue = props.Value ?? props.modelValue ?? props.value
	const coerce = (next: unknown) => {
		const number = Number(next)
		if (!Number.isFinite(number) || number < 0) return noValue
		if (number <= 1) return 1
		return Math.min(maxRating, number)
	}
	const [value, setValue] = useControllable(
		externalValue === undefined ? undefined : coerce(externalValue),
		coerce(props.defaultValue ?? noValue),
		callback<number>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Value",
			"onUpdate:modelValue"
		)
	)
	const [isPointerOver, setIsPointerOver] = useState(false)
	const [isPointerDown, setIsPointerDown] = useState(false)
	const [pointerRating, setPointerRating] = useState(0)
	const itemsRef = useRef<HTMLDivElement>(null)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const readOnly = props.IsReadOnly === true
	const placeholder = coerce(props.PlaceholderValue)
	const displayedValue =
		isPointerOver && !readOnly && enabled
			? Math.max(0, Math.min(maxRating, pointerRating))
			: value > noValue
				? value
				: placeholder > noValue
					? placeholder
					: 0
	const stateClass = !enabled
		? "state-disabled"
		: isPointerOver && !readOnly
			? value > noValue
				? "state-pointer-over-set"
				: "state-pointer-over-placeholder"
			: value > noValue
				? "state-set"
				: placeholder > noValue
					? "state-placeholder"
					: "state-unset"
	const ratingFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const target = itemsRef.current
		if (!target) return 0
		const rect = target.getBoundingClientRect()
		const raw = ((event.clientX - rect.left) / Math.max(1, rect.width)) * maxRating
		return Math.max(0, Math.min(maxRating, Math.ceil(raw)))
	}
	const updatePointerRating = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!enabled || readOnly) return
		setPointerRating(ratingFromPointer(event))
	}
	const commitRating = (next: number, originatedFromMouse = false) => {
		const bounded = Math.max(0, Math.min(maxRating, next))
		let resolved = value
		if (value > noValue || bounded !== 0) {
			if (props.IsClearEnabled === false && bounded <= 0) resolved = 1
			else if (
				bounded === value &&
				props.IsClearEnabled !== false &&
				(bounded !== maxRating || originatedFromMouse)
			)
				resolved = noValue
			else if (bounded > 0) resolved = bounded
			else resolved = noValue
		}
		const oldValue = value
		setValue(resolved)
		if (!Object.is(oldValue, resolved))
			callback<{ OldValue: number; NewValue: number }>(
				props,
				"onValueChanged",
				"ValueChanged"
			)?.({ OldValue: oldValue, NewValue: resolved })
	}
	const changeRatingBy = (change: number) => {
		if (change === 0) return
		let ratingValue: number
		if (value !== noValue) {
			if (Math.trunc(value) !== value)
				ratingValue = change === -1 ? Math.trunc(value) : Math.trunc(value) + change
			else ratingValue = value + change
		} else ratingValue = initialSetValue
		commitRating(ratingValue)
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!enabled || readOnly) return
		if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault()
			changeRatingBy(1)
		} else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault()
			changeRatingBy(-1)
		} else if (event.key === "Home") {
			event.preventDefault()
			commitRating(0)
		} else if (event.key === "End") {
			event.preventDefault()
			commitRating(maxRating)
		}
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-rating-control",
				stateClass,
				readOnly ? "is-readonly" : undefined,
				!enabled ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
			role="slider"
			aria-valuemin={0}
			aria-valuemax={maxRating}
			aria-valuenow={Math.max(0, value)}
			aria-readonly={readOnly}
			aria-disabled={!enabled}
			tabIndex={enabled ? 0 : -1}
			onKeyDown={handleKeyDown}
		>
			<div className="win-rating-caption-stack">
				<div
					ref={itemsRef}
					className="win-rating-background-stack"
					onPointerEnter={(event) => {
						setIsPointerOver(true)
						updatePointerRating(event)
					}}
					onPointerMove={updatePointerRating}
					onPointerLeave={() => {
						if (!isPointerDown) setIsPointerOver(false)
					}}
					onPointerCancel={() => {
						setIsPointerDown(false)
						setIsPointerOver(false)
					}}
					onLostPointerCapture={() => setIsPointerDown(false)}
					onPointerDown={(event) => {
						if (!enabled || readOnly) return
						setIsPointerDown(true)
						event.currentTarget.setPointerCapture(event.pointerId)
						setIsPointerOver(true)
						updatePointerRating(event)
					}}
					onPointerUp={(event) => {
						if (!enabled || readOnly) return
						commitRating(ratingFromPointer(event))
						setIsPointerDown(false)
						if (event.currentTarget.hasPointerCapture(event.pointerId))
							event.currentTarget.releasePointerCapture(event.pointerId)
						const isStillOver = event.currentTarget.matches(":hover")
						setIsPointerOver(isStillOver)
						if (isStillOver) updatePointerRating(event)
					}}
				>
					{Array.from({ length: maxRating }, (_, index) => (
						<span
							key={`background-${index}`}
							className="win-rating-item win-rating-background-item"
							aria-hidden="true"
						>
							<span className="win-rating-glyph" aria-hidden="true">
								{"\uE734"}
							</span>
						</span>
					))}
				</div>
				{props.Caption && (
					<WinTextBlock className="win-rating-caption" Text={props.Caption} />
				)}
			</div>
			<div className="win-rating-foreground-presenter" aria-hidden="true">
				<div className="win-rating-foreground-outer">
					<div className="win-rating-foreground-stack">
						{Array.from({ length: maxRating }, (_, index) => (
							<span
								key={`foreground-${index}`}
								className="win-rating-item win-rating-foreground-item"
								style={{
									clipPath: `inset(0 ${
										100 - Math.max(0, Math.min(1, displayedValue - index)) * 100
									}% 0 0)`
								}}
							>
								<span className="win-rating-glyph" aria-hidden="true">
									{"\uE735"}
								</span>
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

export function WinInfoBadge(
	props: WinProps & { Value?: ReactNode; Icon?: ReactNode }
): React.JSX.Element {
	return (
		<span
			className={cx("win-info-badge", props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Icon}
			{props.Value ?? contentOf(props, props.children)}
		</span>
	)
}
export function WinInfoBar(
	props: WinProps & {
		Severity?: "Informational" | "Success" | "Warning" | "Error" | string
		IsOpen?: boolean
		IsIconVisible?: boolean
		IsClosable?: boolean
		IconSource?: ReactNode
		ActionButton?: ReactNode
		CloseButtonStyle?: string
		CloseButtonCommand?: Record<string, unknown> | ((parameter: unknown) => void)
		CloseButtonCommandParameter?: unknown
	}
): React.JSX.Element {
	const [isVisible, setIsVisible] = useState(Boolean(props.IsOpen))
	const rootRef = useRef<HTMLElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const wasOpenRef = useRef(false)
	const [isVertical, setIsVertical] = useState(false)
	const severity = String(props.Severity ?? "Informational")
		.toLowerCase()
		.replace(/^[a-z]/, (value) => value.toUpperCase())
	const severityKey = severity.toLowerCase()
	const severityGlyphs: Record<string, string> = {
		informational: "\uF167",
		success: "\uEC61",
		warning: "\uE814",
		error: "\uEB90"
	}
	const symbolGlyphs: Record<string, string> = {
		Accept: "\uE8FB",
		Cancel: "\uE711",
		Important: "\uE7BA",
		Info: "\uF13F",
		Sync: "\uE895",
		Warning: "\uF13C"
	}
	const decodeGlyph = (value: unknown): string => {
		const glyph = String(value ?? "")
		if (glyph.startsWith("\\u"))
			return String.fromCodePoint(Number.parseInt(glyph.slice(2), 16))
		if (glyph.startsWith("&#x") && glyph.endsWith(";"))
			return String.fromCodePoint(Number.parseInt(glyph.slice(3, -1), 16))
		if (glyph.startsWith("0x")) return String.fromCodePoint(Number.parseInt(glyph, 16))
		if (/^[0-9A-Fa-f]{4,5}$/.test(glyph))
			return String.fromCodePoint(Number.parseInt(glyph, 16))
		return glyph
	}
	const iconRecord =
		props.IconSource && typeof props.IconSource === "object"
			? (props.IconSource as unknown as Record<string, unknown>)
			: undefined
	const iconGlyph = iconRecord
		? iconRecord.Glyph !== undefined
			? decodeGlyph(iconRecord.Glyph)
			: (symbolGlyphs[String(iconRecord.Symbol ?? "")] ?? String(iconRecord.Symbol ?? ""))
		: typeof props.IconSource === "string"
			? decodeGlyph(props.IconSource)
			: ""
	const iconFontFamily = String(iconRecord?.FontFamily ?? "WinUIOnWebIcons")
	const iconForeground = String(iconRecord?.Foreground ?? "")
	const hasBannerContent = Boolean(props.Title || props.Message || props.ActionButton)
	const content = props.children ?? props.Content
	const close = (reason: string) => {
		if (!isVisible) return
		const args = { Reason: reason, Cancel: false }
		callback<{ Reason: string; Cancel: boolean }>(props, "onClosing", "Closing")?.(args)
		if (args.Cancel) return
		callback<boolean>(props, "onValueChange", "onUpdate:IsOpen")?.(false)
		setIsVisible(false)
		callback<unknown>(props, "onClosed", "Closed")?.({ Reason: reason })
	}
	const closeButtonClick = () => {
		callback<unknown>(props, "onCloseButtonClick", "CloseButtonClick")?.(null)
		const command = props.CloseButtonCommand
		if (typeof command === "function") command(props.CloseButtonCommandParameter)
		else if (typeof command?.Execute === "function")
			(command.Execute as (parameter: unknown) => void)(props.CloseButtonCommandParameter)
		close("CloseButton")
	}
	useEffect(() => {
		if (props.IsOpen !== undefined) setIsVisible(Boolean(props.IsOpen))
	}, [props.IsOpen])
	useEffect(() => {
		if (isVisible && !wasOpenRef.current) callback<unknown>(props, "onOpened", "Opened")?.({})
		wasOpenRef.current = isVisible
	}, [isVisible])
	useEffect(() => {
		if (!isVisible) return undefined
		const root = rootRef.current
		const panel = panelRef.current
		if (!root || !panel) return undefined
		const updateOrientation = () => {
			const items = [
				panel.querySelector<HTMLElement>(":scope > .win-infobar-title"),
				panel.querySelector<HTMLElement>(":scope > .win-infobar-message"),
				panel.querySelector<HTMLElement>(":scope > .win-infobar-action")
			].filter((element): element is HTMLElement => {
				if (!element) return false
				const style = window.getComputedStyle(element)
				return style.display !== "none" && element.getBoundingClientRect().width > 0
			})
			const availableWidth = panel.getBoundingClientRect().width
			if (availableWidth <= 0 || items.length === 0) return
			const totalWidth = items.reduce((total, item, index) => {
				const marginLeft =
					index > 0 ? Number.parseFloat(window.getComputedStyle(item).marginLeft) || 0 : 0
				return total + item.getBoundingClientRect().width + marginLeft
			}, 0)
			const tallestItem = items.reduce(
				(height, item) => Math.max(height, item.getBoundingClientRect().height + 14),
				0
			)
			setIsVertical(items.length === 1 || totalWidth > availableWidth || tallestItem > 48)
		}
		updateOrientation()
		if (typeof ResizeObserver === "undefined") return undefined
		const observer = new ResizeObserver(updateOrientation)
		observer.observe(root)
		observer.observe(panel)
		return () => observer.disconnect()
	}, [isVisible])
	if (!isVisible) return <></>
	return (
		<section
			ref={rootRef}
			className={cx(
				"win-info-bar",
				"win-infobar",
				`win-infobar-${severityKey}`,
				`severity-${severityKey}`,
				isVertical ? "is-vertical" : undefined,
				hasBannerContent ? "banner-content" : "no-banner-content",
				props.className,
				props.class
			)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={{
				...props.style,
				...commonStyle(props),
				...(props.Background ? { "--InfoBarBackground": props.Background } : {}),
				...(props.Foreground ? { "--InfoBarForeground": props.Foreground } : {}),
				...(props.BorderBrush ? { "--InfoBarBorderBrush": props.BorderBrush } : {}),
				...(props.BorderThickness !== undefined
					? { "--InfoBarBorderThickness": xamlThickness(props.BorderThickness) }
					: {}),
				...(props.CornerRadius !== undefined
					? { "--InfoBarCornerRadius": xamlThickness(props.CornerRadius) }
					: {})
			}}
			role="alert"
			aria-live={severityKey === "error" ? "assertive" : "polite"}
		>
			<div className="win-info-bar-layout win-infobar-layout">
				{props.IsIconVisible !== false && (
					<div
						className={cx(
							"win-info-bar-icon",
							props.IconSource
								? "win-infobar-user-icon-box"
								: "win-infobar-standard-icon-area"
						)}
						aria-hidden="true"
					>
						<WinTextBlock
							className={cx(
								"win-infobar-standard-icon",
								props.IconSource ? "win-infobar-user-icon" : undefined
							)}
							Text={
								iconGlyph ||
								severityGlyphs[severityKey] ||
								severityGlyphs.informational
							}
							FontFamily={iconFontFamily}
							Foreground={
								props.IconSource
									? iconForeground
									: "var(--InfoBarSeverityIconBackground)"
							}
							FontSize={16}
							LineHeight={16}
						/>
					</div>
				)}
				<div
					ref={panelRef}
					className={cx(
						"win-info-bar-panel",
						"win-infobar-panel",
						hasBannerContent ? "has-banner-content" : "no-banner-content",
						props.Title ? "has-title" : undefined,
						props.Message ? "has-message" : undefined,
						props.ActionButton ? "has-action" : undefined,
						isVertical ? "is-vertical" : undefined
					)}
				>
					{props.Title && (
						<WinTextBlock
							className="win-info-bar-title win-infobar-title"
							Text={props.Title}
							Foreground={props.Foreground}
							FontWeight={600}
						/>
					)}
					{props.Message && (
						<WinTextBlock
							className="win-info-bar-message win-infobar-message"
							Text={props.Message}
							Foreground={props.Foreground}
						/>
					)}
					{props.ActionButton && (
						<div className="win-info-bar-action win-infobar-action">
							{props.ActionButton}
						</div>
					)}
				</div>
				{content !== undefined && content !== null && (
					<div className="win-info-bar-content-area win-infobar-content-area">
						{content}
					</div>
				)}
				{props.IsClosable !== false && (
					<WinButton
						className="win-info-bar-close-button win-infobar-close-button"
						Style={props.CloseButtonStyle ?? "SubtleButtonStyle"}
						aria-label="Close"
						onClick={closeButtonClick}
					>
						<span aria-hidden="true">{"\uE711"}</span>
					</WinButton>
				)}
			</div>
		</section>
	)
}
