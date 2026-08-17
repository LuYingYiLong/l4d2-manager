// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import { WinButton, WinTextBlock } from "./winui-primitives"
import { WinComboBox } from "./winui-comboboxes"
import { WinNumberBox, WinTextBox } from "./winui-inputs"
import { callback, commonStyle, cx, useControllable } from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle, WinValue } from "./winui-shared"

type WinRgbColor = {
	r: number
	g: number
	b: number
}

type WinHsvColor = {
	h: number
	s: number
	v: number
}

function colorNumber(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)))
}

function colorPercent(value: number): number {
	return Math.max(0, Math.min(1, Number(value) || 0))
}

function parseColor(value: unknown): { rgb: WinRgbColor; alpha: number } {
	const fallback = { rgb: { r: 0, g: 103, b: 192 }, alpha: 1 }
	if (typeof value !== "string") return fallback
	const source = value.trim()
	const hex = source.replace(/^#/, "")
	if (/^[\da-f]{3,4}$/i.test(hex)) {
		const expanded = hex
			.split("")
			.map((part) => part + part)
			.join("")
		return {
			rgb: {
				r: Number.parseInt(expanded.slice(0, 2), 16),
				g: Number.parseInt(expanded.slice(2, 4), 16),
				b: Number.parseInt(expanded.slice(4, 6), 16)
			},
			alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1
		}
	}
	if (/^[\da-f]{6,8}$/i.test(hex))
		return {
			rgb: {
				r: Number.parseInt(hex.slice(0, 2), 16),
				g: Number.parseInt(hex.slice(2, 4), 16),
				b: Number.parseInt(hex.slice(4, 6), 16)
			},
			alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
		}
	const rgbMatch = source.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
	)
	if (rgbMatch)
		return {
			rgb: {
				r: colorNumber(Number(rgbMatch[1])),
				g: colorNumber(Number(rgbMatch[2])),
				b: colorNumber(Number(rgbMatch[3]))
			},
			alpha: rgbMatch[4] === undefined ? 1 : colorPercent(Number(rgbMatch[4]))
		}
	return fallback
}

function rgbToHsv(rgb: WinRgbColor): WinHsvColor {
	const r = rgb.r / 255
	const g = rgb.g / 255
	const b = rgb.b / 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const delta = max - min
	let h = 0
	if (delta !== 0) {
		if (max === r) h = 60 * (((g - b) / delta) % 6)
		else if (max === g) h = 60 * ((b - r) / delta + 2)
		else h = 60 * ((r - g) / delta + 4)
	}
	if (h < 0) h += 360
	return { h, s: max === 0 ? 0 : delta / max, v: max }
}

function hsvToRgb(hsv: WinHsvColor): WinRgbColor {
	const h = ((hsv.h % 360) + 360) % 360
	const s = colorPercent(hsv.s)
	const v = colorPercent(hsv.v)
	const chroma = v * s
	const sector = h / 60
	const x = chroma * (1 - Math.abs((sector % 2) - 1))
	const match = v - chroma
	let rgb: [number, number, number]
	if (sector < 1) rgb = [chroma, x, 0]
	else if (sector < 2) rgb = [x, chroma, 0]
	else if (sector < 3) rgb = [0, chroma, x]
	else if (sector < 4) rgb = [0, x, chroma]
	else if (sector < 5) rgb = [x, 0, chroma]
	else rgb = [chroma, 0, x]
	return {
		r: colorNumber((rgb[0] + match) * 255),
		g: colorNumber((rgb[1] + match) * 255),
		b: colorNumber((rgb[2] + match) * 255)
	}
}

function rgbToHex(rgb: WinRgbColor, alpha = 1, includeAlpha = false): string {
	const parts = [rgb.r, rgb.g, rgb.b].map((part) =>
		colorNumber(part).toString(16).padStart(2, "0")
	)
	if (includeAlpha)
		parts.push(
			colorNumber(colorPercent(alpha) * 255)
				.toString(16)
				.padStart(2, "0")
		)
	return `#${parts.join("")}`.toUpperCase()
}

function hsvCssColor(hsv: WinHsvColor): string {
	const rgb = hsvToRgb({ h: hsv.h, s: hsv.s, v: 1 })
	return `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
}

type WinColorPickerProps = WinProps &
	WinChangeProps<string> & {
		Color?: string
		modelValue?: string
		ColorSpectrumShape?: string
		colorSpectrumShape?: string
		IsMoreButtonVisible?: boolean
		IsColorPreviewVisible?: boolean
		isColorPreviewVisible?: boolean
		IsColorSliderVisible?: boolean
		isColorSliderVisible?: boolean
		IsColorChannelTextInputVisible?: boolean
		isColorChannelTextInputVisible?: boolean
		IsHexInputVisible?: boolean
		isHexInputVisible?: boolean
		IsAlphaEnabled?: boolean
		isAlphaEnabled?: boolean
		IsAlphaSliderVisible?: boolean
		isAlphaSliderVisible?: boolean
		IsAlphaTextInputVisible?: boolean
		isAlphaTextInputVisible?: boolean
		previousColor?: string
	}

export function WinColorPicker(props: WinColorPickerProps): React.JSX.Element {
	const externalColor =
		props.Color ??
		props.modelValue ??
		(typeof props.value === "string" ? props.value : undefined)
	const defaultColor = String(props.defaultValue ?? "#0067C0")
	const initial = parseColor(externalColor ?? defaultColor)
	const [color, setColor] = useControllable(
		externalColor,
		defaultColor,
		callback<string>(props, "onValueChange", "onUpdate:Color", "onUpdate:modelValue")
	)
	const [hsv, setHsv] = useState<WinHsvColor>(() => rgbToHsv(initial.rgb))
	const [alpha, setAlpha] = useState(initial.alpha)
	const [hexText, setHexText] = useState(() =>
		rgbToHex(initial.rgb, initial.alpha, Boolean(props.IsAlphaEnabled ?? props.isAlphaEnabled))
	)
	const [moreExpanded, setMoreExpanded] = useState(false)
	const [selectedModelIndex, setSelectedModelIndex] = useState(0)
	const spectrumRef = useRef<HTMLDivElement>(null)
	const valueTrackRef = useRef<HTMLDivElement>(null)
	const alphaTrackRef = useRef<HTMLDivElement>(null)
	const draggingRef = useRef<"spectrum" | "value" | "alpha" | undefined>(undefined)
	const lastColorRef = useRef(String(color))
	const showPreview = props.IsColorPreviewVisible ?? props.isColorPreviewVisible ?? true
	const showSlider = props.IsColorSliderVisible ?? props.isColorSliderVisible ?? true
	const showChannels =
		props.IsColorChannelTextInputVisible ?? props.isColorChannelTextInputVisible ?? true
	const showHex = props.IsHexInputVisible ?? props.isHexInputVisible ?? true
	const alphaEnabled = props.IsAlphaEnabled ?? props.isAlphaEnabled ?? false
	const showAlphaSlider = props.IsAlphaSliderVisible ?? props.isAlphaSliderVisible ?? true
	const showAlphaText =
		props.IsAlphaTextInputVisible ?? props.isAlphaTextInputVisible ?? alphaEnabled
	const moreVisible = props.IsMoreButtonVisible === true
	const detailsVisible = !moreVisible || moreExpanded
	const spectrumShape = String(props.ColorSpectrumShape ?? props.colorSpectrumShape ?? "Box")
	const isRingSpectrum = spectrumShape.toLowerCase() === "ring"
	const rgb = hsvToRgb(hsv)
	const currentHex = rgbToHex(rgb, alpha, alphaEnabled)
	const valueOverlay = `rgba(0, 0, 0, ${1 - hsv.v})`
	const spectrumBackground = isRingSpectrum
		? [
				`linear-gradient(${valueOverlay}, ${valueOverlay})`,
				"radial-gradient(circle, rgb(255 255 255 / 100%) 0%, rgb(255 255 255 / 0%) 68%)",
				"conic-gradient(from 0deg, #f00 0deg, #ff0 60deg, #0f0 120deg, #0ff 180deg, #00f 240deg, #f0f 300deg, #f00 360deg)"
			].join(", ")
		: [
				`linear-gradient(${valueOverlay}, ${valueOverlay})`,
				"linear-gradient(to bottom, rgb(255 255 255 / 100%), rgb(255 255 255 / 0%))",
				"linear-gradient(to right, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)"
			].join(", ")
	const spectrumThumbColor =
		hsv.v > 0.5 && hsv.s < 0.5 ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.9)"
	const spectrumThumbPosition: WinStyle = isRingSpectrum
		? {
				left: `${50 + Math.sin((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
				top: `${50 - Math.cos((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
				"--spectrum-thumb-color": spectrumThumbColor
			}
		: {
				left: `${(hsv.h / 360) * 100}%`,
				top: `${(1 - hsv.s) * 100}%`,
				"--spectrum-thumb-color": spectrumThumbColor
			}
	const emitColor = (nextHsv: WinHsvColor, nextAlpha = alpha) => {
		const next = rgbToHex(hsvToRgb(nextHsv), nextAlpha, alphaEnabled)
		setHsv(nextHsv)
		setAlpha(nextAlpha)
		setHexText(next)
		setColor(next)
		if (next !== lastColorRef.current) {
			callback<unknown>(
				props,
				"onColorChanged",
				"ColorChanged"
			)?.({
				OldColor: lastColorRef.current,
				NewColor: next
			})
			lastColorRef.current = next
		}
	}
	useEffect(() => {
		const parsed = parseColor(String(color))
		setHsv(rgbToHsv(parsed.rgb))
		setAlpha(parsed.alpha)
		setHexText(rgbToHex(parsed.rgb, parsed.alpha, alphaEnabled))
		lastColorRef.current = String(color)
	}, [color, alphaEnabled])
	const updateTrack = (
		track: HTMLDivElement | null,
		clientX: number,
		callbackValue: (percent: number) => void
	) => {
		if (!track) return
		const rect = track.getBoundingClientRect()
		callbackValue(Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))))
	}
	const updateSpectrum = (clientX: number, clientY: number) => {
		const spectrum = spectrumRef.current
		if (!spectrum) return
		const rect = spectrum.getBoundingClientRect()
		if (isRingSpectrum) {
			const radius = Math.min(rect.width, rect.height) / 2
			const dx = clientX - (rect.left + rect.width / 2)
			const dy = clientY - (rect.top + rect.height / 2)
			let hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90
			if (hue < 0) hue += 360
			const saturation = Math.min(1, Math.hypot(dx, dy) / Math.max(1, radius))
			emitColor({ ...hsv, h: hue % 360, s: saturation })
			return
		}
		const x = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
		const y = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)))
		emitColor({ ...hsv, h: x * 360, s: 1 - y })
	}
	const startDrag = (
		kind: "spectrum" | "value" | "alpha",
		event: React.PointerEvent<HTMLDivElement>
	) => {
		draggingRef.current = kind
		event.currentTarget.setPointerCapture(event.pointerId)
		if (kind === "spectrum") updateSpectrum(event.clientX, event.clientY)
		else if (kind === "value")
			updateTrack(valueTrackRef.current, event.clientX, (percent) =>
				emitColor({ ...hsv, v: percent })
			)
		else updateTrack(alphaTrackRef.current, event.clientX, (percent) => emitColor(hsv, percent))
	}
	const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!draggingRef.current) return
		if (draggingRef.current === "spectrum") updateSpectrum(event.clientX, event.clientY)
		else if (draggingRef.current === "value")
			updateTrack(valueTrackRef.current, event.clientX, (percent) =>
				emitColor({ ...hsv, v: percent })
			)
		else updateTrack(alphaTrackRef.current, event.clientX, (percent) => emitColor(hsv, percent))
	}
	const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId)
		draggingRef.current = undefined
	}
	const updateRgb = (channel: keyof WinRgbColor, value: number) => {
		const next = { ...rgb, [channel]: colorNumber(value) }
		emitColor(rgbToHsv(next))
	}
	const updateHsv = (channel: keyof WinHsvColor, value: number) => {
		const next = {
			...hsv,
			[channel]:
				channel === "h" ? Math.max(0, Math.min(359, value)) : colorPercent(value / 100)
		}
		emitColor(next)
	}
	const handleHexText = (value: string) => {
		const normalized = value.startsWith("#") ? value : `#${value}`
		setHexText(value)
		const parsed = parseColor(normalized)
		if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(normalized))
			emitColor(rgbToHsv(parsed.rgb), alphaEnabled ? parsed.alpha : alpha)
	}
	const commonPickerStyle: WinStyle = {
		...props.style,
		...commonStyle(props),
		"--cp-spectrum-size": "256px",
		"--cp-preview-width": "44px",
		"--cp-preview-gap": "12px",
		"--cp-total-width": showPreview ? "312px" : "256px"
	}
	return (
		<div
			className={cx(
				"win-color-picker",
				showPreview ? "cp-has-preview" : "cp-no-preview",
				props.className,
				props.class
			)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={commonPickerStyle}
		>
			{props.Header && <WinTextBlock className="picker-header" Text={props.Header} />}
			<div className="cp-spectrum-grid">
				<div
					ref={spectrumRef}
					className={cx("cp-spectrum-area", isRingSpectrum ? "cp-ring" : undefined)}
					style={
						{
							"--cp-hue": String(hsv.h),
							backgroundImage: spectrumBackground
						} as WinStyle
					}
					tabIndex={0}
					role="slider"
					aria-label="Color spectrum"
					aria-valuemin={0}
					aria-valuemax={360}
					aria-valuenow={Math.round(hsv.h)}
					aria-valuetext={`Hue ${Math.round(hsv.h)}°, Saturation ${Math.round(
						hsv.s * 100
					)}%, Value ${Math.round(hsv.v * 100)}%`}
					onPointerDown={(event) => startDrag("spectrum", event)}
					onPointerMove={moveDrag}
					onPointerUp={stopDrag}
					onPointerCancel={stopDrag}
					onKeyDown={(event) => {
						if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
							event.preventDefault()
							emitColor({
								...hsv,
								h: (hsv.h + (event.key === "ArrowRight" ? 1 : -1) + 360) % 360
							})
						} else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
							event.preventDefault()
							emitColor({
								...hsv,
								s: Math.max(
									0,
									Math.min(1, hsv.s + (event.key === "ArrowUp" ? 0.01 : -0.01))
								)
							})
						}
					}}
				>
					<div className="cp-spectrum-thumb" style={spectrumThumbPosition} />
				</div>
				{showPreview && (
					<div className="cp-preview-bar">
						<div className="cp-preview-current" style={{ background: currentHex }} />
						{props.previousColor && (
							<div
								className="cp-preview-previous"
								style={{ background: props.previousColor }}
							/>
						)}
					</div>
				)}
			</div>
			{showSlider && (
				<div className="cp-sliders">
					<div
						className="cp-slider-row"
						onPointerDown={(event) => startDrag("value", event)}
						onPointerMove={moveDrag}
						onPointerUp={stopDrag}
						onPointerCancel={stopDrag}
						role="slider"
						aria-label="Value"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(hsv.v * 100)}
						aria-valuetext={`${Math.round(hsv.v * 100)}%`}
					>
						<div
							ref={valueTrackRef}
							className="cp-value-track"
							style={{
								background: `linear-gradient(to right, #000, ${hsvCssColor(hsv)})`
							}}
						>
							<div className="cp-slider-thumb" style={{ left: `${hsv.v * 100}%` }} />
						</div>
					</div>
					{alphaEnabled && showAlphaSlider && (
						<div
							className="cp-slider-row"
							onPointerDown={(event) => startDrag("alpha", event)}
							onPointerMove={moveDrag}
							onPointerUp={stopDrag}
							onPointerCancel={stopDrag}
							role="slider"
							aria-label="Opacity"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round(alpha * 100)}
							aria-valuetext={`${Math.round(alpha * 100)}%`}
						>
							<div
								ref={alphaTrackRef}
								className="cp-alpha-track"
								style={{ "--cp-alpha-color": hsvCssColor(hsv) } as WinStyle}
							>
								<div
									className="cp-slider-thumb"
									style={{ left: `${alpha * 100}%` }}
								/>
							</div>
						</div>
					)}
				</div>
			)}
			{moreVisible && (
				<div className="cp-more-row">
					<WinButton
						className="cp-more-button"
						Style="SubtleButtonStyle"
						onClick={() => setMoreExpanded((expanded) => !expanded)}
					>
						<WinTextBlock className="cp-more-label" Text="More" />
						<span className="icon" aria-hidden="true">
							{moreExpanded ? "\uE70D" : "\uE70E"}
						</span>
					</WinButton>
				</div>
			)}
			{detailsVisible && (
				<div className="cp-details-grid">
					<WinComboBox
						Width={120}
						Items={["RGB", "HSV"]}
						SelectedIndex={selectedModelIndex}
						PlaceholderText="Color model"
						{...{
							"onUpdate:SelectedIndex": (value: WinValue) =>
								setSelectedModelIndex(Number(value))
						}}
					/>
					{showHex && (
						<WinTextBox
							className="cp-hex-box"
							Value={hexText}
							MaxWidth={132}
							MaxLength={alphaEnabled ? 9 : 7}
							aria-label="Hex color"
							onValueChange={handleHexText}
						/>
					)}
					{showChannels && selectedModelIndex === 0 && (
						<>
							<WinNumberBox
								Width={120}
								Value={rgb.r}
								Minimum={0}
								Maximum={255}
								onValueChange={(value) => updateRgb("r", Number(value))}
							/>
							<WinTextBlock Text="Red" />
							<WinNumberBox
								Width={120}
								Value={rgb.g}
								Minimum={0}
								Maximum={255}
								onValueChange={(value) => updateRgb("g", Number(value))}
							/>
							<WinTextBlock Text="Green" />
							<WinNumberBox
								Width={120}
								Value={rgb.b}
								Minimum={0}
								Maximum={255}
								onValueChange={(value) => updateRgb("b", Number(value))}
							/>
							<WinTextBlock Text="Blue" />
						</>
					)}
					{showChannels && selectedModelIndex === 1 && (
						<>
							<WinNumberBox
								Width={120}
								Value={Math.round(hsv.h)}
								Minimum={0}
								Maximum={359}
								onValueChange={(value) => updateHsv("h", Number(value))}
							/>
							<WinTextBlock Text="Hue" />
							<WinNumberBox
								Width={120}
								Value={Math.round(hsv.s * 100)}
								Minimum={0}
								Maximum={100}
								onValueChange={(value) => updateHsv("s", Number(value))}
							/>
							<WinTextBlock Text="Saturation" />
							<WinNumberBox
								Width={120}
								Value={Math.round(hsv.v * 100)}
								Minimum={0}
								Maximum={100}
								onValueChange={(value) => updateHsv("v", Number(value))}
							/>
							<WinTextBlock Text="Value" />
						</>
					)}
					{showAlphaText && alphaEnabled && (
						<>
							<WinNumberBox
								Width={120}
								Value={Math.round(alpha * 100)}
								Minimum={0}
								Maximum={100}
								onValueChange={(value) =>
									emitColor(hsv, colorPercent(Number(value) / 100))
								}
							/>
							<WinTextBlock Text="Opacity" />
						</>
					)}
				</div>
			)}
		</div>
	)
}
