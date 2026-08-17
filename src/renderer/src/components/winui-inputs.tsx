// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { useEffect, useRef, useState } from "react"
import type {
	ChangeEvent,
	CSSProperties,
	HTMLAttributes,
	InputHTMLAttributes,
	ReactNode
} from "react"
import { WinTextBlock } from "./winui-primitives"
import {
	callback,
	commonStyle,
	cssLength,
	cx,
	domProps,
	useControllable,
	xamlThickness
} from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle } from "./winui-shared"

export function WinSlider(
	props: WinProps &
		WinChangeProps<number> & {
			Minimum?: number
			Maximum?: number
			SmallChange?: number
			StepFrequency?: number
			Value?: number
			Orientation?: string
			TickFrequency?: number
			TickPlacement?: string
			SnapsTo?: string
			IsThumbToolTipEnabled?: boolean
			ThumbToolTipValueConverter?: unknown
			vertical?: boolean
			showTicks?: boolean
			tickFrequency?: number
			min?: number
			max?: number
			step?: number
		}
): React.JSX.Element {
	const [value, setSliderValue] = useControllable(
		props.Value ?? props.modelValue ?? props.value,
		Number(props.defaultValue ?? props.min ?? props.Minimum ?? 0),
		callback<number>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Value",
			"onUpdate:modelValue"
		)
	)
	const toFiniteNumber = (candidate: unknown, fallback: number) => {
		const number = Number(candidate)
		return Number.isFinite(number) ? number : fallback
	}
	const minimum = toFiniteNumber(props.min ?? props.Minimum, 0)
	const maximum = Math.max(minimum, toFiniteNumber(props.max ?? props.Maximum, 100))
	const isVertical =
		Boolean(props.vertical) ||
		String(props.Orientation ?? "Horizontal").toLowerCase() === "vertical"
	const step = Math.max(
		0,
		toFiniteNumber(props.step ?? props.StepFrequency ?? props.SmallChange, 1)
	)
	const tickFrequency = Math.max(0, toFiniteNumber(props.tickFrequency ?? props.TickFrequency, 0))
	const [dragValue, setDragValue] = useState<number | null>(null)
	const [isThumbPointerOver, setIsThumbPointerOver] = useState(false)
	const [isThumbPressed, setIsThumbPressed] = useState(false)
	const [isTrackInteraction, setIsTrackInteraction] = useState(false)
	const trackRef = useRef<HTMLDivElement>(null)
	const pointerIdRef = useRef<number | null>(null)
	const currentValue = Math.max(
		minimum,
		Math.min(maximum, toFiniteNumber(dragValue ?? value, minimum))
	)
	const range = Math.max(0.0001, maximum - minimum)
	const percent = ((currentValue - minimum) / range) * 100
	const tickPlacement = String(
		props.TickPlacement ?? (props.showTicks ? "Outside" : "None")
	).toLowerCase()
	const showTicks = Boolean(props.showTicks || (tickPlacement !== "none" && tickFrequency > 0))
	const sliderLengthCandidate = isVertical ? props.Height : props.Width
	const sliderLength = Math.max(
		18,
		typeof sliderLengthCandidate === "number"
			? sliderLengthCandidate
			: typeof sliderLengthCandidate === "string" &&
				  /^-?\d+(?:\.\d+)?(?:px)?$/.test(sliderLengthCandidate.trim())
				? Number.parseFloat(sliderLengthCandidate)
				: 200
	)
	const tickSourceFrequency = tickFrequency || step || 1
	const tickIntervals = Math.max(1, range / tickSourceFrequency)
	const visibleTickRange = Math.max(1, sliderLength - 18)
	const rawTickInterval = visibleTickRange / tickIntervals
	const tickVisibilityRatio =
		rawTickInterval < 20 ? Math.ceil(20 / Math.max(1, rawTickInterval)) : 1
	const ticks = showTicks
		? Array.from(
				{
					length: Math.min(1000, Math.floor(tickIntervals / tickVisibilityRatio) + 1)
				},
				(_, index) => minimum + index * tickSourceFrequency * tickVisibilityRatio
			).filter((tick) => tick <= maximum + 0.0001)
		: []
	const calcValue = (...parts: Array<string | number>) => "calc(" + parts.join("") + ")"
	const fillStyle: WinStyle = isVertical
		? { height: calcValue(percent, "% - ", (percent * 18) / 100, "px") }
		: { width: calcValue(percent, "% - ", (percent * 18) / 100, "px") }
	const thumbStyle: WinStyle = isVertical
		? { bottom: calcValue(9, "px + ", percent, "% - ", (percent * 18) / 100, "px") }
		: { left: calcValue(9, "px + ", percent, "% - ", (percent * 18) / 100, "px") }
	const snapValue = (candidate: number) => {
		const snapFrequency =
			String(props.SnapsTo ?? "StepValues").toLowerCase() === "ticks" && tickFrequency > 0
				? tickFrequency
				: step
		const clamped = Math.max(minimum, Math.min(maximum, candidate))
		if (!Number.isFinite(snapFrequency) || snapFrequency <= 0) return Number(clamped.toFixed(4))
		const snapped = minimum + Math.round((clamped - minimum) / snapFrequency) * snapFrequency
		return Number(Math.max(minimum, Math.min(maximum, snapped)).toFixed(4))
	}
	const commitValue = (candidate: number, commit = true) => {
		const oldValue = currentValue
		const clamped = Math.max(minimum, Math.min(maximum, candidate))
		const nextValue = commit ? snapValue(clamped) : Number(clamped.toFixed(4))
		if (!commit) setDragValue(nextValue)
		else setDragValue(null)
		setSliderValue(nextValue)
		if (!Object.is(oldValue, nextValue))
			callback<{ OldValue: number; NewValue: number }>(
				props,
				"onValueChanged",
				"ValueChanged"
			)?.({ OldValue: oldValue, NewValue: nextValue })
	}
	const updateFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const track = trackRef.current
		if (!track) return
		const rect = track.getBoundingClientRect()
		const usableSize = Math.max(1, (isVertical ? rect.height : rect.width) - 18)
		const ratio = isVertical
			? (rect.bottom - event.clientY - 9) / usableSize
			: (event.clientX - rect.left - 9) / usableSize
		const next = minimum + Math.max(0, Math.min(1, ratio)) * range
		commitValue(next, String(props.SnapsTo ?? "StepValues").toLowerCase() !== "ticks")
	}
	const finishPointerInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
		if (pointerIdRef.current !== event.pointerId) return
		if (String(props.SnapsTo ?? "StepValues").toLowerCase() === "ticks" && dragValue !== null)
			commitValue(dragValue, true)
		setDragValue(null)
		setIsThumbPressed(false)
		setIsTrackInteraction(false)
		pointerIdRef.current = null
		const track = trackRef.current
		if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId)
	}
	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (props.IsEnabled === false || !trackRef.current) return
		event.preventDefault()
		const target = event.target
		const startedOnThumb =
			target instanceof Element && Boolean(target.closest(".win-slider-thumb"))
		pointerIdRef.current = event.pointerId
		setIsThumbPressed(startedOnThumb)
		setIsTrackInteraction(!startedOnThumb)
		trackRef.current.setPointerCapture(event.pointerId)
		updateFromPointer(event)
	}
	const decimals = (() => {
		let count = 0
		let scaled = step
		while (count < 4 && Math.abs(scaled - Math.round(scaled)) > 0.00001) {
			count += 1
			scaled *= 10
		}
		return count
	})()
	const formatTooltipValue = (candidate: number): string => {
		const converter = props.ThumbToolTipValueConverter
		try {
			if (typeof converter === "function") {
				const converted = (converter as (value: number) => unknown)(candidate)
				if (converted !== undefined && converted !== null) return String(converted)
			}
			if (converter && typeof converter === "object") {
				const record = converter as Record<string, unknown>
				const method = record.convert ?? record.Convert
				if (typeof method === "function") {
					const converted = (method as (value: number) => unknown)(candidate)
					if (converted !== undefined && converted !== null) return String(converted)
				}
			}
		} catch {
			// Fall back to the platform's numeric formatter
		}
		return candidate.toFixed(decimals)
	}
	const tooltipVisible =
		props.IsThumbToolTipEnabled !== false &&
		(isThumbPointerOver || isThumbPressed || isTrackInteraction)
	const tickStyle = (tick: number): WinStyle => {
		const tickPercent = ((tick - minimum) / range) * 100
		const position = isVertical ? 100 - tickPercent : tickPercent
		return isVertical
			? {
					top: calcValue(9, "px + ", position, "% - ", (position * 18) / 100, "px")
				}
			: {
					left: calcValue(9, "px + ", position, "% - ", (position * 18) / 100, "px")
				}
	}
	const showTopLeftTicks = showTicks && ["outside", "topleft"].includes(tickPlacement)
	const showBottomRightTicks =
		showTicks &&
		(["outside", "bottomright", "inline"].includes(tickPlacement) || props.showTicks)
	const sliderStyle: WinStyle = {
		width:
			props.Width !== undefined && props.Width !== ""
				? cssLength(props.Width)
				: isVertical
					? "100px"
					: "200px",
		height:
			props.Height !== undefined && props.Height !== ""
				? cssLength(props.Height)
				: isVertical
					? "100px"
					: "32px",
		"--slider-percent": String(Math.max(0, Math.min(100, percent))) + "%",
		"--SliderTrackFill": props.Background,
		"--SliderFill": props.Foreground
	}
	const rootStyle: WinStyle = {
		...props.style,
		margin: props.Margin !== undefined ? xamlThickness(props.Margin) : props.style?.margin
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-slider-root",
				props.class,
				props.className,
				props.IsEnabled === false ? "is-disabled" : undefined
			)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={rootStyle}
		>
			{props.Header && <WinTextBlock className="win-slider-header" Text={props.Header} />}
			<div
				className={cx(
					"win-slider",
					isVertical ? "vertical" : undefined,
					showTicks ? "has-ticks" : undefined
				)}
				style={sliderStyle}
				ref={trackRef}
				role="slider"
				tabIndex={props.IsEnabled === false ? -1 : 0}
				aria-valuemin={minimum}
				aria-valuemax={maximum}
				aria-valuenow={currentValue}
				aria-orientation={isVertical ? "vertical" : "horizontal"}
				aria-valuetext={formatTooltipValue(currentValue)}
				onPointerDown={handlePointerDown}
				onPointerMove={(event) => {
					if (pointerIdRef.current === event.pointerId) updateFromPointer(event)
				}}
				onPointerUp={finishPointerInteraction}
				onPointerCancel={finishPointerInteraction}
				onLostPointerCapture={finishPointerInteraction}
				onKeyDown={(event) => {
					if (props.IsEnabled === false) return
					if (event.key === "ArrowRight" || event.key === "ArrowUp") {
						event.preventDefault()
						commitValue(currentValue + (step || 1))
					} else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
						event.preventDefault()
						commitValue(currentValue - (step || 1))
					} else if (event.key === "Home") {
						event.preventDefault()
						commitValue(minimum)
					} else if (event.key === "End") {
						event.preventDefault()
						commitValue(maximum)
					}
				}}
			>
				<div className="win-slider-track">
					<div className="win-slider-fill" style={fillStyle} />
				</div>
				{showTicks && (
					<div
						className={cx("win-slider-ticks", "placement-" + tickPlacement)}
						aria-hidden="true"
					>
						{showTopLeftTicks &&
							ticks.map((tick) => (
								<span
									key={"top-left-" + tick}
									className="win-slider-tick top-left"
									style={tickStyle(tick)}
								/>
							))}
						{showBottomRightTicks &&
							ticks.map((tick) => (
								<span
									key={"bottom-right-" + tick}
									className="win-slider-tick bottom-right"
									style={tickStyle(tick)}
								/>
							))}
					</div>
				)}
				<div
					className={cx(
						"win-slider-thumb",
						isThumbPointerOver && !isTrackInteraction ? "is-pointer-over" : undefined,
						isThumbPressed ? "is-pressed" : undefined
					)}
					style={thumbStyle}
					aria-hidden="true"
					onPointerEnter={() => setIsThumbPointerOver(true)}
					onPointerLeave={() => {
						if (!isThumbPressed && !isTrackInteraction) setIsThumbPointerOver(false)
					}}
				/>
				{tooltipVisible && (
					<div
						className={cx("win-slider-tooltip", isVertical ? "vertical" : undefined)}
						style={
							isVertical
								? { ...thumbStyle, left: "calc(50% - 16px)" }
								: { ...thumbStyle, bottom: "calc(100% + 8px)" }
						}
						role="tooltip"
					>
						{formatTooltipValue(currentValue)}
					</div>
				)}
			</div>
		</div>
	)
}

export function WinNumberBox(
	props: WinProps &
		WinChangeProps<number> & {
			Value?: number
			Text?: string
			Minimum?: number
			Maximum?: number
			SmallChange?: number
			LargeChange?: number
			PlaceholderText?: string
			SpinButtonPlacementMode?: "Hidden" | "Compact" | "Inline" | string
			ValidationMode?: "InvalidInputOverwritten" | "Disabled" | string
			AcceptsExpression?: boolean
			NumberFormatter?: Intl.NumberFormat
			TextAlignment?: string
		}
): React.JSX.Element {
	const minimum = props.Minimum ?? Number.NEGATIVE_INFINITY
	const maximum = props.Maximum ?? Number.POSITIVE_INFINITY
	const externalValue = props.Value ?? props.modelValue ?? props.value
	const [value, setValue] = useControllable(
		externalValue,
		Number(props.defaultValue ?? Number.NaN),
		callback<number>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Value",
			"onUpdate:modelValue"
		)
	)
	const formatValue = (next: number) => {
		if (Number.isNaN(next)) return ""
		return props.NumberFormatter?.format(next) ?? String(next)
	}
	const [text, setText] = useState(() => {
		if (typeof props.Text === "string") return props.Text
		return formatValue(Number(value))
	})
	const [compactOpen, setCompactOpen] = useState(false)
	const placement = String(props.SpinButtonPlacementMode ?? "Hidden").toLowerCase()
	const numberRootRef = useRef<HTMLDivElement>(null)
	const compactPopupRef = useRef<HTMLDivElement>(null)
	const [compactPopupPosition, setCompactPopupPosition] = useState<WinStyle>({
		position: "fixed",
		top: 0,
		left: 0,
		right: "auto"
	})
	useEffect(() => {
		setText(formatValue(Number(value)))
	}, [value, props.NumberFormatter])
	useEffect(() => {
		if (typeof props.Text === "string") setText(props.Text)
	}, [props.Text])
	const updateCompactPopupPosition = () => {
		const root = numberRootRef.current
		if (!root || typeof window === "undefined") return
		const anchor = root.querySelector<HTMLElement>(".win-textbox-border") ?? root
		const rootRect = anchor.getBoundingClientRect()
		const popupRect = compactPopupRef.current?.getBoundingClientRect()
		const popupWidth = popupRect?.width ?? 48
		const popupHeight = popupRect?.height ?? 88
		const margin = 8
		const maxLeft = Math.max(margin, window.innerWidth - popupWidth - margin)
		const left = Math.min(maxLeft, Math.max(margin, rootRect.right - 44))
		const maxTop = Math.max(margin, window.innerHeight - popupHeight - margin)
		const top = Math.min(
			maxTop,
			Math.max(margin, rootRect.top + rootRect.height / 2 - popupHeight / 2)
		)
		setCompactPopupPosition({
			position: "fixed",
			top,
			left,
			right: "auto"
		})
	}
	useEffect(() => {
		if (placement !== "compact" || !compactOpen || typeof window === "undefined") return
		const update = () => window.requestAnimationFrame(updateCompactPopupPosition)
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target
			if (
				target instanceof Node &&
				(numberRootRef.current?.contains(target) ||
					compactPopupRef.current?.contains(target))
			) {
				return
			}
			setCompactOpen(false)
		}
		const frame = window.requestAnimationFrame(updateCompactPopupPosition)
		window.addEventListener("resize", update)
		window.addEventListener("scroll", update, true)
		document.addEventListener("pointerdown", handlePointerDown, true)
		return () => {
			window.cancelAnimationFrame(frame)
			window.removeEventListener("resize", update)
			window.removeEventListener("scroll", update, true)
			document.removeEventListener("pointerdown", handlePointerDown, true)
		}
	}, [compactOpen, placement])
	const currentValue = Number(value)
	const clamp = (next: number) => Math.min(maximum, Math.max(minimum, next))
	const smallChange = Number(props.SmallChange ?? 1)
	const largeChange = Number(props.LargeChange ?? smallChange * 10)
	const canIncrease =
		props.IsEnabled !== false &&
		(Number.isNaN(currentValue) || currentValue + smallChange <= maximum)
	const canDecrease =
		props.IsEnabled !== false &&
		(Number.isNaN(currentValue) || currentValue - smallChange >= minimum)
	const sanitizeText = (next: string) => {
		const allowed = props.AcceptsExpression ? "0123456789+-*/().%^ " : "0123456789+-."
		let sanitized = Array.from(next)
			.filter((character) => allowed.includes(character))
			.join("")
		if (!props.AcceptsExpression) {
			const minus = sanitized.indexOf("-")
			sanitized = sanitized.replaceAll("-", "")
			if (minus === 0) sanitized = "-" + sanitized
			const dot = sanitized.indexOf(".")
			if (dot >= 0)
				sanitized =
					sanitized.slice(0, dot + 1) + sanitized.slice(dot + 1).replaceAll(".", "")
		}
		return sanitized
	}
	const parseText = (source: string) => {
		const normalized = source.replaceAll(",", "")
		if (!props.AcceptsExpression) {
			const parsed = Number(normalized)
			return Number.isFinite(parsed) ? parsed : Number.NaN
		}
		const expression = normalized.replaceAll("^", "**")
		if (Array.from(expression).some((character) => !"0123456789+-*/().%* ".includes(character)))
			return Number.NaN
		try {
			return Number(Function('"use strict"; return (' + expression + ");")())
		} catch {
			return Number.NaN
		}
	}
	const setNumericValue = (next: number, oldValue = currentValue) => {
		const resolved = Number.isNaN(next) ? Number.NaN : clamp(next)
		setValue(resolved)
		const formatted = formatValue(resolved)
		setText(formatted)
		callback<string>(props, "onUpdate:Text")?.(formatted)
		if (!Object.is(oldValue, resolved)) {
			callback<{ OldValue: number; NewValue: number }>(
				props,
				"onValueChanged",
				"ValueChanged"
			)?.({
				OldValue: oldValue,
				NewValue: resolved
			})
		}
		return resolved
	}
	const handleTextInput = (next: string) => {
		const sanitized = sanitizeText(next)
		setText(sanitized)
		callback<string>(props, "onUpdate:Text")?.(sanitized)
	}
	const commitText = () => {
		if (text.trim() === "") return setNumericValue(Number.NaN)
		const parsed = parseText(text)
		if (Number.isNaN(parsed)) {
			if (props.ValidationMode !== "Disabled") setText(formatValue(currentValue))
			return currentValue
		}
		return setNumericValue(parsed)
	}
	const changeBy = (delta: number) => {
		const committed = commitText()
		setNumericValue((Number.isNaN(committed) ? 0 : committed) + delta, committed)
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		if (
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			event.key.length === 1 &&
			sanitizeText(event.key) !== event.key
		) {
			event.preventDefault()
			return
		}
		if (event.key === "Enter") {
			event.preventDefault()
			commitText()
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			changeBy(event.shiftKey ? largeChange : smallChange)
		} else if (event.key === "ArrowDown") {
			event.preventDefault()
			changeBy(event.shiftKey ? -largeChange : -smallChange)
		} else if (event.key === "PageUp") {
			event.preventDefault()
			changeBy(largeChange)
		} else if (event.key === "PageDown") {
			event.preventDefault()
			changeBy(-largeChange)
		} else if (event.key === "Escape") {
			setCompactOpen(false)
		}
	}
	return (
		<div
			ref={numberRootRef}
			className={cx(
				"win-number-box",
				placement === "inline" ? "is-inline" : undefined,
				placement === "compact" ? "is-compact" : undefined,
				props.class,
				props.className,
				props.IsEnabled === false ? "is-disabled" : undefined
			)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			<div className="win-number-shell">
				<WinTextBox
					className="win-number-textbox"
					Value={text}
					Header={props.Header}
					Description={props.Description}
					PlaceholderText={props.PlaceholderText}
					InputScope={props.InputScope ?? "Decimal"}
					TextAlignment={props.TextAlignment}
					IsEnabled={props.IsEnabled}
					ShowDeleteButton={false}
					onUpdate:Value={handleTextInput}
					onFocus={() => placement === "compact" && setCompactOpen(true)}
					onBlur={() => {
						window.setTimeout(() => {
							commitText()
							setCompactOpen(false)
						}, 120)
					}}
					onKeyDown={handleKeyDown}
				>
					{placement === "inline" && (
						<div className="win-number-spin inline">
							<button
								className="win-textbox-action-button win-number-spin-button"
								type="button"
								aria-label="Increase"
								disabled={!canIncrease}
								onPointerDown={(event) => event.preventDefault()}
								onClick={() => changeBy(smallChange)}
							>
								<span aria-hidden="true">{"\uE70E"}</span>
							</button>
							<button
								className="win-textbox-action-button win-number-spin-button"
								type="button"
								aria-label="Decrease"
								disabled={!canDecrease}
								onPointerDown={(event) => event.preventDefault()}
								onClick={() => changeBy(-smallChange)}
							>
								<span aria-hidden="true">{"\uE70D"}</span>
							</button>
						</div>
					)}
					{placement === "compact" && (
						<span className="win-number-compact-indicator" aria-hidden="true">
							<span aria-hidden="true">{"\uEC8F"}</span>
						</span>
					)}
				</WinTextBox>
			</div>
			{placement === "compact" && compactOpen && typeof document !== "undefined"
				? createPortal(
						<div
							ref={compactPopupRef}
							className="win-number-compact-popup win-theme-scope"
							style={compactPopupPosition}
							onPointerDown={(event) => event.preventDefault()}
						>
							<button
								className="win-number-popup-button"
								type="button"
								aria-label="Increase"
								disabled={!canIncrease}
								onClick={() => changeBy(smallChange)}
							>
								<span aria-hidden="true">{"\uE70E"}</span>
							</button>
							<button
								className="win-number-popup-button"
								type="button"
								aria-label="Decrease"
								disabled={!canDecrease}
								onClick={() => changeBy(-smallChange)}
							>
								<span aria-hidden="true">{"\uE70D"}</span>
							</button>
						</div>,
						document.body
					)
				: null}
		</div>
	)
}

export function WinTextBox(
	props: WinProps &
		WinChangeProps<string> & {
			Value?: string
			PlaceholderText?: string
			Description?: ReactNode
			AcceptsReturn?: boolean
			IsReadOnly?: boolean
			IsSpellCheckEnabled?: boolean
			IsTextPredictionEnabled?: boolean
			CharacterCasing?: string
			TextAlignment?: string
			TextWrapping?: string
			MaxLength?: number
			ShowDeleteButton?: boolean
		}
): React.JSX.Element {
	const externalValue =
		props.Value ??
		(typeof props.Text === "string" ? props.Text : undefined) ??
		(props.value !== undefined ? String(props.value) : undefined)
	const [value, setValue] = useControllable(
		externalValue,
		String(props.defaultValue ?? ""),
		callback<string>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Value",
			"onUpdate:modelValue"
		)
	)
	const [focused, setFocused] = useState(false)
	const [hovered, setHovered] = useState(false)
	const disabled = props.IsEnabled === false
	const readOnly = props.IsReadOnly === true
	const inputMode: InputHTMLAttributes<HTMLInputElement>["inputMode"] =
		props.InputScope === "Number"
			? "numeric"
			: props.InputScope === "EmailSmtpAddress"
				? "email"
				: props.InputScope === "Url"
					? "url"
					: undefined
	const inputType =
		props.InputScope === "Password"
			? "password"
			: props.InputScope === "Number"
				? "number"
				: "text"
	const fieldStyle: WinStyle = {
		textAlign: props.TextAlignment?.toLowerCase() as CSSProperties["textAlign"],
		whiteSpace: props.TextWrapping === "NoWrap" ? "nowrap" : undefined,
		textTransform:
			props.CharacterCasing === "Upper"
				? "uppercase"
				: props.CharacterCasing === "Lower"
					? "lowercase"
					: undefined,
		fontFamily: props.FontFamily,
		fontSize: cssLength(props.FontSize),
		fontWeight: props.FontWeight,
		color: props.Foreground
	}
	const ariaLabel =
		typeof props["aria-label"] === "string"
			? props["aria-label"]
			: typeof props.Header === "string"
				? props.Header
				: undefined
	const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const nextValue = event.currentTarget.value
		setValue(nextValue)
		callback<unknown>(props, "onChange", "TextChanged")?.(event)
	}
	const handleFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setFocused(true)
		callback<unknown>(props, "onFocus", "GotFocus")?.(event)
	}
	const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setFocused(false)
		callback<unknown>(props, "onBlur", "LostFocus")?.(event)
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		callback<unknown>(props, "onKeyDown", "KeyDown")?.(event)
	}
	const clearValue = () => {
		if (disabled || readOnly) return
		setValue("")
		callback<unknown>(props, "onClear", "Clear")?.(undefined)
	}
	const rootStyle: WinStyle = {
		...props.style,
		...commonStyle(props)
	}
	const showDeleteButton =
		props.ShowDeleteButton !== false && value.length > 0 && !disabled && !readOnly
	const fieldProps = {
		value,
		placeholder: props.PlaceholderText,
		readOnly,
		disabled,
		maxLength: props.MaxLength && props.MaxLength > 0 ? props.MaxLength : undefined,
		spellCheck: props.IsSpellCheckEnabled ?? true,
		inputMode,
		autoComplete: props.IsTextPredictionEnabled === false ? "off" : "on",
		role: props.role,
		"aria-label": ariaLabel,
		"aria-controls": props["aria-controls"] as string | undefined,
		"aria-expanded": props["aria-expanded"] as boolean | undefined,
		"aria-autocomplete": props["aria-autocomplete"] as
			InputHTMLAttributes<HTMLInputElement>["aria-autocomplete"] | undefined,
		"aria-activedescendant": props["aria-activedescendant"] as string | undefined,
		style: fieldStyle,
		onChange: handleChange,
		onFocus: handleFocus,
		onBlur: handleBlur,
		onKeyDown: handleKeyDown,
		onCompositionStart: () =>
			callback<unknown>(props, "onCompositionStart", "TextCompositionStarted")?.(undefined),
		onCompositionUpdate: () =>
			callback<unknown>(props, "onCompositionUpdate", "TextCompositionChanged")?.(undefined),
		onCompositionEnd: () =>
			callback<unknown>(props, "onCompositionEnd", "TextCompositionEnded")?.(undefined)
	}
	return (
		<div
			className={cx(
				"win-textbox",
				readOnly ? "is-readonly" : undefined,
				disabled ? "is-disabled" : undefined,
				focused ? "is-focused" : undefined,
				hovered ? "is-hovered" : undefined,
				props.className,
				props.class
			)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={rootStyle}
		>
			{props.Header && <div className="win-textbox-header">{props.Header}</div>}
			<div
				className="win-textbox-border"
				onPointerEnter={() => setHovered(true)}
				onPointerLeave={() => setHovered(false)}
			>
				<div className="win-textbox-focus-border" aria-hidden="true" />
				<div className="win-textbox-content">
					{props.AcceptsReturn || props.TextWrapping === "Wrap" ? (
						<textarea
							{...fieldProps}
							className="win-textbox-field win-textbox-textarea"
							rows={props.Rows}
						/>
					) : (
						<input {...fieldProps} className="win-textbox-field" type={inputType} />
					)}
					{showDeleteButton && (
						<button
							className="win-textbox-delete-button"
							type="button"
							aria-label="Clear text"
							onPointerDown={(event) => event.preventDefault()}
							onClick={clearValue}
						>
							<span className="win-textbox-delete-button-layout">
								<span className="win-textbox-delete-glyph"></span>
							</span>
						</button>
					)}
					{props.children}
				</div>
			</div>
			{props.Description && (
				<div className="win-textbox-description">{props.Description}</div>
			)}
		</div>
	)
}

export function WinPasswordBox(
	props: WinProps & WinChangeProps<string> & { Value?: string; PlaceholderText?: string }
): React.JSX.Element {
	return (
		<WinTextBox
			{...props}
			InputScope="Password"
			className={cx("win-password-box", props.className)}
		/>
	)
}
