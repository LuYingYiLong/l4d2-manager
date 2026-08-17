// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { MouseEvent, ReactNode } from "react"
import { WinButton } from "./winui-primitives"
import { WinScrollViewer } from "./winui-scrolling"
import type { WinScrollViewerHandle } from "./winui-scrolling"
import { callback, commonStyle, cx } from "./winui-shared"
import type { WinProps } from "./winui-shared"

type WinParallaxViewProps = WinProps & {
	Child?: ReactNode
	child?: ReactNode
	HorizontalShift?: number
	horizontalShift?: number
	VerticalShift?: number
	verticalShift?: number
	IsHorizontalShiftClamped?: boolean
	isHorizontalShiftClamped?: boolean
	IsVerticalShiftClamped?: boolean
	isVerticalShiftClamped?: boolean
	MaxHorizontalShiftRatio?: number
	maxHorizontalShiftRatio?: number
	MaxVerticalShiftRatio?: number
	maxVerticalShiftRatio?: number
	HorizontalSourceStartOffset?: number
	horizontalSourceStartOffset?: number
	HorizontalSourceEndOffset?: number
	horizontalSourceEndOffset?: number
	VerticalSourceStartOffset?: number
	verticalSourceStartOffset?: number
	VerticalSourceEndOffset?: number
	verticalSourceEndOffset?: number
}

export function WinParallaxView(props: WinParallaxViewProps): React.JSX.Element {
	const sourceRef = useRef<WinScrollViewerHandle>(null)
	const frameRef = useRef<number | undefined>(undefined)
	const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 })
	const horizontalShift = props.HorizontalShift ?? props.horizontalShift ?? 0
	const verticalShift = props.VerticalShift ?? props.verticalShift ?? 0
	const horizontalClamped =
		props.IsHorizontalShiftClamped ?? props.isHorizontalShiftClamped ?? true
	const verticalClamped = props.IsVerticalShiftClamped ?? props.isVerticalShiftClamped ?? true
	const horizontalRatio = props.MaxHorizontalShiftRatio ?? props.maxHorizontalShiftRatio ?? 1
	const verticalRatio = props.MaxVerticalShiftRatio ?? props.maxVerticalShiftRatio ?? 1
	const updateParallax = () => {
		const source = sourceRef.current
		if (!source) return
		setScrollPosition({ x: source.HorizontalOffset, y: source.VerticalOffset })
	}
	const scheduleParallax = () => {
		if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current)
		frameRef.current = window.requestAnimationFrame(() => {
			frameRef.current = undefined
			updateParallax()
		})
	}
	useEffect(() => {
		updateParallax()
		return () => {
			if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current)
		}
	}, [])
	useEffect(() => {
		updateParallax()
	}, [
		horizontalShift,
		verticalShift,
		horizontalClamped,
		verticalClamped,
		horizontalRatio,
		verticalRatio,
		props.HorizontalSourceStartOffset,
		props.horizontalSourceStartOffset,
		props.HorizontalSourceEndOffset,
		props.horizontalSourceEndOffset,
		props.VerticalSourceStartOffset,
		props.verticalSourceStartOffset,
		props.VerticalSourceEndOffset,
		props.verticalSourceEndOffset
	])
	const horizontalScrollable = Math.max(0, sourceRef.current?.ScrollableWidth ?? 0)
	const verticalScrollable = Math.max(0, sourceRef.current?.ScrollableHeight ?? 0)
	const horizontalStart =
		props.HorizontalSourceStartOffset ?? props.horizontalSourceStartOffset ?? 0
	const horizontalEnd = props.HorizontalSourceEndOffset ?? props.horizontalSourceEndOffset ?? 0
	const verticalStart = props.VerticalSourceStartOffset ?? props.verticalSourceStartOffset ?? 0
	const verticalEnd = props.VerticalSourceEndOffset ?? props.verticalSourceEndOffset ?? 0
	const horizontalRange = Math.max(0, horizontalScrollable - horizontalStart - horizontalEnd)
	const verticalRange = Math.max(0, verticalScrollable - verticalStart - verticalEnd)
	const horizontalProgress =
		horizontalRange > 0
			? Math.max(0, Math.min(1, (scrollPosition.x - horizontalStart) / horizontalRange))
			: 0
	const verticalProgress =
		verticalRange > 0
			? Math.max(0, Math.min(1, (scrollPosition.y - verticalStart) / verticalRange))
			: 0
	const horizontalOffset = horizontalClamped
		? Math.max(
				-Math.abs(horizontalShift * horizontalRatio),
				Math.min(
					Math.abs(horizontalShift * horizontalRatio),
					horizontalShift * horizontalProgress * horizontalRatio
				)
			)
		: horizontalShift * horizontalProgress * horizontalRatio
	const verticalOffset = verticalClamped
		? Math.max(
				-Math.abs(verticalShift * verticalRatio),
				Math.min(
					Math.abs(verticalShift * verticalRatio),
					verticalShift * verticalProgress * verticalRatio
				)
			)
		: verticalShift * verticalProgress * verticalRatio
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	return (
		<div
			className={cx("win-parallax-view", className, legacyClassName)}
			style={{ ...commonStyle(props), ...props.style }}
		>
			<div
				className="parallax-child"
				style={{
					transform: `translate3d(${horizontalOffset}px, ${verticalOffset}px, 0)`,
					willChange: "transform"
				}}
			>
				{props.Child ?? props.child}
			</div>
			<WinScrollViewer
				ref={sourceRef}
				className="parallax-source"
				VerticalScrollMode="Auto"
				VerticalScrollBarVisibility="Auto"
				HorizontalScrollMode="Auto"
				HorizontalScrollBarVisibility="Auto"
				onViewChanged={scheduleParallax}
			>
				{props.children ?? props.Content}
			</WinScrollViewer>
		</div>
	)
}

export function WinPullToRefresh(props: WinProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null)
	const pointerId = useRef<number | null>(null)
	const startPosition = useRef(0)
	const [pullDistance, setPullDistance] = useState(0)
	const [isPulling, setIsPulling] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const isEnabled = props.IsEnabled !== false
	const threshold = Number(props.RefreshThreshold ?? 100)
	const direction = String(props.PullDirection ?? "TopToBottom")
	const isVertical = direction === "TopToBottom" || direction === "BottomToTop"
	const sign = direction === "BottomToTop" || direction === "RightToLeft" ? -1 : 1
	const currentDistance = pullDistance * sign
	const progress = Math.min(1, Math.max(0, currentDistance / threshold))
	const ready = currentDistance >= threshold
	const completeRefresh = () => {
		setIsRefreshing(false)
		setPullDistance(0)
	}
	const requestRefresh = () => {
		setIsRefreshing(true)
		const deferral = { Complete: completeRefresh }
		callback<unknown>(
			props,
			"onRefreshRequested",
			"RefreshRequested"
		)?.({
			GetDeferral: () => deferral,
			Complete: completeRefresh
		})
		callback<unknown>(props, "onRefresh", "refresh")?.(completeRefresh)
	}
	const beginPull = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isEnabled || isRefreshing || (event.pointerType === "mouse" && event.button !== 0))
			return
		const target = event.currentTarget
		if (target.scrollTop > 0) return
		pointerId.current = event.pointerId
		startPosition.current = isVertical ? event.clientY : event.clientX
		setIsPulling(true)
		target.setPointerCapture(event.pointerId)
	}
	const movePull = (event: React.PointerEvent<HTMLDivElement>) => {
		if (pointerId.current !== event.pointerId || !isPulling || !isEnabled) return
		const current = isVertical ? event.clientY : event.clientX
		const delta = (current - startPosition.current) * sign
		if (delta <= 0) return
		event.preventDefault()
		setPullDistance(Math.min(threshold * 2.5, delta))
	}
	const endPull = (event: React.PointerEvent<HTMLDivElement>) => {
		if (pointerId.current !== event.pointerId) return
		pointerId.current = null
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId)
		setIsPulling(false)
		if (currentDistance >= threshold) requestRefresh()
		else setPullDistance(0)
	}
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const pullOffset = isRefreshing
		? 50
		: currentDistance <= threshold
			? currentDistance * 0.5
			: threshold * 0.5 + (currentDistance - threshold) * 0.15
	const icon = (props.RefreshVisualizer ?? props.Icon ?? "\uE72C") as ReactNode
	return (
		<div
			ref={rootRef}
			className={cx(
				"win-pull-to-refresh",
				isPulling ? "is-pulling" : undefined,
				isRefreshing ? "is-refreshing" : undefined,
				className,
				legacyClassName
			)}
			style={{ ...commonStyle(props), touchAction: isVertical ? "pan-x" : "pan-y" }}
			onPointerDown={beginPull}
			onPointerMove={movePull}
			onPointerUp={endPull}
			onPointerCancel={endPull}
		>
			<div
				className="ptr-indicator"
				style={{
					transform: `translate(${isVertical ? 0 : pullOffset * sign}px, ${isVertical ? pullOffset * sign : 0}px)`
				}}
				aria-hidden="true"
			>
				<span
					className={cx(
						"ptr-icon-wrapper",
						isRefreshing ? "is-refreshing" : undefined,
						ready ? "is-ready" : undefined
					)}
					style={{
						opacity: isRefreshing ? 1 : 0.3 + progress * 0.7,
						transform: `rotate(${isRefreshing ? 0 : -180 + progress * 180}deg) scale(${ready ? 1.2 : 1})`
					}}
				>
					{icon}
				</span>
			</div>
			<div
				className="ptr-content"
				style={{
					transform: `translate(${isVertical ? 0 : pullOffset * sign}px, ${isVertical ? pullOffset * sign : 0}px)`
				}}
			>
				{props.children ?? props.Content}
			</div>
		</div>
	)
}
export function WinRefreshContainer(props: WinProps): React.JSX.Element {
	return <WinPullToRefresh {...props} className={cx("win-refresh-container", props.className)} />
}
export function WinRefreshVisualizer(props: WinProps): React.JSX.Element {
	const stateValue = props["refreshState"] ?? props.RefreshState ?? props.State ?? "Idle"
	const stateNames = ["Idle", "Peeking", "Interacting", "Pending", "Refreshing"]
	const state =
		typeof stateValue === "number"
			? (stateNames[stateValue] ?? "Idle")
			: (stateNames.find((name) => name.toLowerCase() === String(stateValue).toLowerCase()) ??
				"Idle")
	const stateNumber = stateNames.indexOf(state)
	const previousState = useRef(state)
	useEffect(() => {
		if (previousState.current === state) return
		const args = {
			oldState: stateNames.indexOf(previousState.current),
			newState: stateNumber,
			OldState: previousState.current,
			NewState: state
		}
		callback<unknown>(props, "onRefreshStateChanged", "RefreshStateChanged")?.(args)
		previousState.current = state
	}, [state, stateNumber])
	const isRefreshing = state === "Refreshing"
	const isPeeking = state === "Peeking"
	const isIdle = state === "Idle"
	const orientation = String(props.Orientation ?? props.orientation ?? "Top").toLowerCase()
	const orientationRotation =
		orientation === "bottom"
			? 180
			: orientation === "left"
				? -90
				: orientation === "right"
					? 90
					: 0
	const content = props.children ?? props.Content ?? props.content
	return (
		<div
			className={cx(
				"win-refresh-visualizer",
				`state-${state.toLowerCase()}`,
				`orientation-${orientation}`,
				props.class
			)}
			data-orientation={orientation}
			style={{
				...props.style,
				...commonStyle(props),
				opacity: isIdle ? 0 : 1,
				color:
					state === "Pending" || state === "Refreshing"
						? "var(--win-accent-color, var(--accent-base, #0078d4))"
						: "var(--win-text-secondary, var(--text-secondary, #605e5c))",
				transform: `rotate(${orientationRotation}deg) scale(${isPeeking ? 0.8 : 1})`
			}}
			aria-hidden="true"
		>
			{content ?? (
				<svg
					className={cx("win-refresh-icon", isRefreshing ? "is-spinning" : undefined)}
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
				</svg>
			)}
		</div>
	)
}
export function WinRepeatButton(
	props: WinProps & { Delay?: number; Interval?: number }
): React.JSX.Element {
	const { onClick, Click, Delay, Interval, ...buttonProps } = props
	const delayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const intervalTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
	const stop = () => {
		if (delayTimer.current !== undefined) {
			clearTimeout(delayTimer.current)
			delayTimer.current = undefined
		}
		if (intervalTimer.current !== undefined) {
			clearInterval(intervalTimer.current)
			intervalTimer.current = undefined
		}
	}
	const fire = (event: React.PointerEvent<HTMLButtonElement>) => {
		onClick?.(event as unknown as MouseEvent<HTMLElement>)
		Click?.(event as unknown as MouseEvent<HTMLElement>)
	}
	const start = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (props.IsEnabled === false) return
		stop()
		event.currentTarget.setPointerCapture(event.pointerId)
		fire(event)
		delayTimer.current = setTimeout(() => {
			intervalTimer.current = setInterval(() => fire(event), Interval ?? 150)
		}, Delay ?? 250)
	}
	useEffect(() => stop, [])
	return (
		<WinButton
			{...buttonProps}
			className={cx("win-repeat-button", props.className)}
			onPointerDown={start}
			onPointerUp={stop}
			onPointerLeave={stop}
			onPointerCancel={stop}
			onContextMenu={(event) => event.preventDefault()}
			onClick={(event) => event.preventDefault()}
		/>
	)
}
