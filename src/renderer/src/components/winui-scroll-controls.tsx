// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useRef, useState } from "react"
import type { HTMLAttributes } from "react"
import { WinScrollViewer } from "./winui-scrolling"
import { callback, commonStyle, cx, domProps, useControllable } from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle } from "./winui-shared"

export function WinScrollView(props: WinProps): React.JSX.Element {
	return <WinScrollViewer {...props} className={cx("win-scroll-view", props.className)} />
}
export function WinHorizontalScrollContainer(props: WinProps): React.JSX.Element {
	return (
		<WinScrollViewer
			{...props}
			className={cx("win-horizontal-scroll", props.className)}
			HorizontalScrollMode="Enabled"
			VerticalScrollMode="Disabled"
		/>
	)
}

type WinScrollBarProps = WinProps &
	Omit<WinChangeProps<number>, "defaultValue"> & {
		Orientation?: "Vertical" | "Horizontal" | string
		IndicatorMode?: "None" | "TouchIndicator" | "MouseIndicator" | string
		ViewportSize?: number
		Minimum?: number
		Maximum?: number
		SmallChange?: number
		LargeChange?: number
		VisualMode?: "Thin" | "Normal" | string
		orientation?: string
		indicatorMode?: string
		viewportSize?: number
		minimum?: number
		maximum?: number
		smallChange?: number
		largeChange?: number
		visualMode?: string
	}

export function WinScrollBar(props: WinScrollBarProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null)
	const orientation = String(props.Orientation ?? props.orientation ?? "Vertical")
	const isVertical = orientation.toLowerCase() !== "horizontal"
	const indicatorMode = String(props.IndicatorMode ?? props.indicatorMode ?? "MouseIndicator")
	const visualMode = String(props.VisualMode ?? props.visualMode ?? "Normal")
	const minimum = Number(props.Minimum ?? props.minimum ?? 0)
	const maximum = Math.max(minimum, Number(props.Maximum ?? props.maximum ?? 100))
	const range = Math.max(0, maximum - minimum)
	const viewportSize = Math.max(0, Number(props.ViewportSize ?? props.viewportSize ?? 0))
	const controlledValue = props.Value ?? props.modelValue ?? props.value
	const [value, setValue] = useControllable<number>(
		controlledValue === undefined ? undefined : Number(controlledValue),
		Number(props.defaultValue ?? minimum),
		(value) =>
			callback<number>(
				props,
				"onValueChange",
				"onChangeValue",
				"onUpdate:Value",
				"onUpdate:modelValue"
			)?.(value)
	)
	const [isHovered, setIsHovered] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const dragStateRef = useRef<{
		pointerId: number
		startValue: number
		startPosition: number
		trackSize: number
		thumbSize: number
	} | null>(null)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const clampedValue = Math.max(minimum, Math.min(maximum, Number(value) || minimum))
	const thumbSizePercent =
		range <= 0 || viewportSize <= 0
			? range <= 0
				? 100
				: 10
			: Math.max(10, Math.min(100, (viewportSize / (range + viewportSize)) * 100))
	const thumbPositionPercent =
		range <= 0 ? 0 : ((clampedValue - minimum) / range) * (100 - thumbSizePercent)
	const emitScrollValue = (next: number) => {
		if (!enabled) return
		const bounded = Math.max(minimum, Math.min(maximum, next))
		setValue(bounded)
		callback<number>(props, "onScroll", "Scroll", "onValueChanged", "ValueChanged")?.(bounded)
	}
	const positionFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const root = rootRef.current
		if (!root) return clampedValue
		const rect = root.getBoundingClientRect()
		const trackSize = isVertical ? rect.height : rect.width
		if (trackSize <= 0 || range <= 0) return minimum
		const pointerPosition = isVertical ? event.clientY - rect.top : event.clientX - rect.left
		const thumbSize = (thumbSizePercent / 100) * trackSize
		const availableSpace = Math.max(1, trackSize - thumbSize)
		const targetPosition = Math.max(
			0,
			Math.min(availableSpace, pointerPosition - thumbSize / 2)
		)
		return minimum + (targetPosition / availableSpace) * range
	}
	const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!enabled || event.target !== event.currentTarget) return
		if (event.pointerType === "mouse" && event.button !== 0) return
		event.preventDefault()
		emitScrollValue(positionFromPointer(event))
	}
	const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return
		const root = rootRef.current
		if (!root) return
		event.preventDefault()
		event.stopPropagation()
		const rect = root.getBoundingClientRect()
		const trackSize = isVertical ? rect.height : rect.width
		dragStateRef.current = {
			pointerId: event.pointerId,
			startValue: clampedValue,
			startPosition: isVertical ? event.clientY : event.clientX,
			trackSize,
			thumbSize: (thumbSizePercent / 100) * trackSize
		}
		root.setPointerCapture(event.pointerId)
		setIsDragging(true)
	}
	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragStateRef.current
		if (!enabled || !drag || drag.pointerId !== event.pointerId || range <= 0) return
		const currentPosition = isVertical ? event.clientY : event.clientX
		const availableSpace = Math.max(1, drag.trackSize - drag.thumbSize)
		const delta = currentPosition - drag.startPosition
		const next = drag.startValue + (delta / availableSpace) * range
		event.preventDefault()
		emitScrollValue(next)
	}
	const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragStateRef.current
		if (!drag || drag.pointerId !== event.pointerId) return
		if (rootRef.current?.hasPointerCapture(event.pointerId))
			rootRef.current.releasePointerCapture(event.pointerId)
		dragStateRef.current = null
		setIsDragging(false)
	}
	const rootStyle: WinStyle = {
		...props.style,
		...commonStyle(props),
		"--scrollbar-thumb-size": `${thumbSizePercent}%`,
		"--scrollbar-thumb-position": `${thumbPositionPercent}%`
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={rootRef}
			className={cx(
				"win-scrollbar",
				isVertical ? "vertical" : "horizontal",
				`mode-${indicatorMode.toLowerCase()}`,
				visualMode.toLowerCase() === "thin" ? "thin" : undefined,
				!isHovered && !isDragging ? "auto-hide" : undefined,
				isHovered ? "hovered" : undefined,
				isDragging ? "dragging" : undefined,
				!enabled ? "disabled" : undefined,
				props.className,
				props.class
			)}
			role="scrollbar"
			aria-orientation={isVertical ? "vertical" : "horizontal"}
			aria-valuemin={minimum}
			aria-valuemax={maximum}
			aria-valuenow={clampedValue}
			aria-disabled={!enabled}
			tabIndex={enabled ? 0 : -1}
			style={rootStyle}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onPointerDown={handleTrackPointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
			onKeyDown={(event) => {
				const smallChange = Number(props.SmallChange ?? props.smallChange ?? 1)
				const largeChange = Number(props.LargeChange ?? props.largeChange ?? 10)
				const decrement = event.key === (isVertical ? "ArrowUp" : "ArrowLeft")
				const increment = event.key === (isVertical ? "ArrowDown" : "ArrowRight")
				if (event.key === "Home") {
					event.preventDefault()
					emitScrollValue(minimum)
				} else if (event.key === "End") {
					event.preventDefault()
					emitScrollValue(maximum)
				} else if (decrement || increment) {
					event.preventDefault()
					emitScrollValue(clampedValue + (increment ? smallChange : -smallChange))
				} else if (event.key === "PageUp" || event.key === "PageDown") {
					event.preventDefault()
					emitScrollValue(
						clampedValue + (event.key === "PageDown" ? largeChange : -largeChange)
					)
				}
			}}
		>
			<div className="win-scrollbar-track" onPointerDown={handleTrackPointerDown}>
				<div
					className="win-scrollbar-thumb"
					style={
						isVertical
							? { height: `${thumbSizePercent}%`, top: `${thumbPositionPercent}%` }
							: { width: `${thumbSizePercent}%`, left: `${thumbPositionPercent}%` }
					}
					onPointerDown={handleThumbPointerDown}
				/>
			</div>
		</div>
	)
}
