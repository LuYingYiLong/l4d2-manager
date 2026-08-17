// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { alignments, callback, commonStyle, cx, domProps } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

export interface WinScrollViewerHandle {
	ChangeView: (
		horizontalOffset?: number | null,
		verticalOffset?: number | null,
		zoomFactor?: number | null
	) => boolean
	ZoomTo: (zoomFactor: number) => number
	ZoomToFactor: (zoomFactor: number) => number
	ZoomBy: (zoomFactorDelta: number) => number
	ScrollTo: (horizontalOffset: number, verticalOffset: number) => number
	ScrollBy: (horizontalOffsetDelta: number, verticalOffsetDelta: number) => number
	AddScrollVelocity: (
		offsetsVelocity: { x?: number; y?: number } | [number, number],
		inertiaDecayRate?: number
	) => number
	CancelScrollVelocity: () => void
	readonly ZoomFactor: number
	readonly HorizontalOffset: number
	readonly VerticalOffset: number
	readonly ViewportWidth: number
	readonly ViewportHeight: number
	readonly ExtentWidth: number
	readonly ExtentHeight: number
	readonly ScrollableWidth: number
	readonly ScrollableHeight: number
	readonly ComputedHorizontalScrollBarVisibility: "Visible" | "Collapsed"
	readonly ComputedVerticalScrollBarVisibility: "Visible" | "Collapsed"
}

export type ScrollViewerScrollMode = "Disabled" | "Enabled" | "Auto"
export type ScrollViewerScrollBarVisibility = "Disabled" | "Auto" | "Hidden" | "Visible"

export const WinScrollViewer = forwardRef<
	WinScrollViewerHandle,
	WinProps & {
		ZoomMode?: "Disabled" | "Enabled"
		MinZoomFactor?: number
		MaxZoomFactor?: number
		ZoomFactor?: number
		HorizontalScrollMode?: ScrollViewerScrollMode
		VerticalScrollMode?: ScrollViewerScrollMode
		HorizontalScrollBarVisibility?: ScrollViewerScrollBarVisibility
		VerticalScrollBarVisibility?: ScrollViewerScrollBarVisibility
		IsVerticalScrollChainingEnabled?: boolean
		IsHorizontalScrollChainingEnabled?: boolean
		IsTabStop?: boolean
	}
>(function WinScrollViewer(props, ref): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null)
	const viewportRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const verticalBarRef = useRef<HTMLDivElement>(null)
	const horizontalBarRef = useRef<HTMLDivElement>(null)
	const initialZoomFactor = typeof props.ZoomFactor === "number" ? props.ZoomFactor : 1
	const [zoomFactor, setZoomFactor] = useState<number>(initialZoomFactor)
	const zoomFactorRef = useRef(zoomFactor)
	const customClassName = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const customStyle = (props.style ?? {}) as WinStyle
	const [metrics, setMetrics] = useState({
		scrollLeft: 0,
		scrollTop: 0,
		scrollWidth: 0,
		scrollHeight: 0,
		clientWidth: 0,
		clientHeight: 0
	})
	const [isScrolling, setIsScrolling] = useState(false)
	const [isZooming, setIsZooming] = useState(false)
	const isZoomingRef = useRef(false)
	const [verticalExpanded, setVerticalExpanded] = useState(false)
	const [horizontalExpanded, setHorizontalExpanded] = useState(false)
	const [verticalContracting, setVerticalContracting] = useState(false)
	const [horizontalContracting, setHorizontalContracting] = useState(false)
	const [showVertical, setShowVertical] = useState(false)
	const [showHorizontal, setShowHorizontal] = useState(false)
	const [isDraggingVertical, setIsDraggingVertical] = useState(false)
	const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false)
	const [isWheelScrolling, setIsWheelScrolling] = useState(false)
	const [isLineScrolling, setIsLineScrolling] = useState(false)
	const [verticalPointerOver, setVerticalPointerOver] = useState(false)
	const [horizontalPointerOver, setHorizontalPointerOver] = useState(false)
	const directManipulationRef = useRef(false)
	const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const verticalHoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const horizontalHoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	)
	const verticalContractTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const horizontalContractTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const verticalContractAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	)
	const horizontalContractAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined
	)
	const verticalInteractionTokenRef = useRef(0)
	const horizontalInteractionTokenRef = useRef(0)
	const lastNonMouseScrollBarPointerTimeRef = useRef(0)
	const activeVerticalDragPointerIdRef = useRef<number | null>(null)
	const activeHorizontalDragPointerIdRef = useRef<number | null>(null)
	const activeLineScrollRef = useRef<
		{ orientation: "vertical" | "horizontal"; direction: number; lastTime: number } | undefined
	>(undefined)
	const lineScrollFrameRef = useRef<number | undefined>(undefined)
	const smoothFrameRef = useRef<number | undefined>(undefined)
	const velocityFrameRef = useRef<number | undefined>(undefined)
	const smoothTargetRef = useRef({ left: 0, top: 0 })
	const smoothExpectedRef = useRef({ left: 0, top: 0 })
	const smoothExpectedActiveRef = useRef(false)
	const velocityRef = useRef({ x: 0, y: 0, lastTime: 0, decay: 0.9995 })
	const velocityExpectedRef = useRef({ left: 0, top: 0 })
	const velocityExpectedActiveRef = useRef(false)
	const dragCleanupRef = useRef<(() => void) | undefined>(undefined)
	const touchStartRef = useRef({ distance: 0, zoom: 1 })
	const scrollControllerSmallChange = 16
	const scrollControllerVelocityNeededPerPixel = 7.600855902349023
	const scrollControllerMinMaxEpsilon = 0.001

	const refreshMetrics = () => {
		const viewport = viewportRef.current
		if (!viewport) return
		setMetrics({
			scrollLeft: viewport.scrollLeft,
			scrollTop: viewport.scrollTop,
			scrollWidth: viewport.scrollWidth,
			scrollHeight: viewport.scrollHeight,
			clientWidth: viewport.clientWidth,
			clientHeight: viewport.clientHeight
		})
	}
	const maxScrollLeft = Math.max(0, metrics.scrollWidth - metrics.clientWidth)
	const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
	const hasVerticalScrollBar =
		props.VerticalScrollMode !== "Disabled" &&
		props.VerticalScrollBarVisibility !== "Disabled" &&
		props.VerticalScrollBarVisibility !== "Hidden" &&
		(props.VerticalScrollBarVisibility === "Visible" ||
			metrics.scrollHeight > metrics.clientHeight + 1)
	const hasHorizontalScrollBar =
		props.HorizontalScrollMode !== "Disabled" &&
		props.HorizontalScrollBarVisibility !== "Disabled" &&
		props.HorizontalScrollBarVisibility !== "Hidden" &&
		(props.HorizontalScrollBarVisibility === "Visible" ||
			metrics.scrollWidth > metrics.clientWidth + 1)
	const getTrackMetrics = (orientation: "vertical" | "horizontal") => {
		const viewport = viewportRef.current
		if (!viewport) return { start: 12, length: 0 }
		const bar = orientation === "vertical" ? verticalBarRef.current : horizontalBarRef.current
		const rect = bar?.getBoundingClientRect()
		const extent = rect
			? orientation === "vertical"
				? rect.height
				: rect.width
			: orientation === "vertical"
				? viewport.clientHeight
				: viewport.clientWidth
		const crossBar = orientation === "vertical" ? hasHorizontalScrollBar : hasVerticalScrollBar
		return { start: 12, length: Math.max(30, extent - 24 - (crossBar ? 12 : 0)) }
	}
	const verticalThumbStyle: WinStyle = (() => {
		const track = getTrackMetrics("vertical")
		const thumb = Math.max(
			30,
			(metrics.clientHeight / Math.max(1, metrics.scrollHeight)) * track.length
		)
		const travel = Math.max(0, track.length - thumb)
		return {
			height: thumb,
			transform: `translateY(${track.start + (metrics.scrollTop / Math.max(1, maxScrollTop)) * travel}px)`
		}
	})()
	const horizontalThumbStyle: WinStyle = (() => {
		const track = getTrackMetrics("horizontal")
		const thumb = Math.max(
			30,
			(metrics.clientWidth / Math.max(1, metrics.scrollWidth)) * track.length
		)
		const travel = Math.max(0, track.length - thumb)
		return {
			width: thumb,
			transform: `translateX(${track.start + (metrics.scrollLeft / Math.max(1, maxScrollLeft)) * travel}px)`
		}
	})()
	const emitViewChanged = (intermediate: boolean) => {
		const viewport = viewportRef.current
		if (!viewport) return
		const view = {
			HorizontalOffset: viewport.scrollLeft,
			VerticalOffset: viewport.scrollTop,
			ZoomFactor: zoomFactorRef.current
		}
		if (intermediate) {
			callback<unknown>(
				props,
				"onViewChanging",
				"ViewChanging"
			)?.({
				NextView: view,
				FinalView: view,
				IsInertial: false
			})
		}
		callback<unknown>(props, "onViewChanged", "ViewChanged")?.({ IsIntermediate: intermediate })
	}
	const beginDirectManipulation = () => {
		if (directManipulationRef.current) return
		directManipulationRef.current = true
		callback<unknown>(props, "onDirectManipulationStarted", "DirectManipulationStarted")?.({})
	}
	const completeDirectManipulation = () => {
		if (!directManipulationRef.current) return
		directManipulationRef.current = false
		callback<unknown>(
			props,
			"onDirectManipulationCompleted",
			"DirectManipulationCompleted"
		)?.({})
	}
	const stopSmoothScroll = () => {
		if (smoothFrameRef.current !== undefined) cancelAnimationFrame(smoothFrameRef.current)
		smoothFrameRef.current = undefined
		setIsWheelScrolling(false)
		smoothExpectedActiveRef.current = false
		const viewport = viewportRef.current
		if (viewport)
			smoothTargetRef.current = { left: viewport.scrollLeft, top: viewport.scrollTop }
	}
	const stopVelocity = () => {
		if (velocityFrameRef.current !== undefined) cancelAnimationFrame(velocityFrameRef.current)
		velocityFrameRef.current = undefined
		velocityExpectedActiveRef.current = false
	}
	const cancelPendingAnimatedScrollForDirectInput = () => {
		cancelLineScroll(false)
		stopVelocity()
		stopSmoothScroll()
	}
	const animateToTarget = () => {
		const viewport = viewportRef.current
		if (!viewport) return
		if (
			smoothExpectedActiveRef.current &&
			(Math.abs(viewport.scrollLeft - smoothExpectedRef.current.left) >= 0.75 ||
				Math.abs(viewport.scrollTop - smoothExpectedRef.current.top) >= 0.75)
		) {
			stopSmoothScroll()
			return
		}
		const dx = smoothTargetRef.current.left - viewport.scrollLeft
		const dy = smoothTargetRef.current.top - viewport.scrollTop
		if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
			viewport.scrollLeft = smoothTargetRef.current.left
			viewport.scrollTop = smoothTargetRef.current.top
			smoothExpectedRef.current = {
				left: viewport.scrollLeft,
				top: viewport.scrollTop
			}
			stopSmoothScroll()
			refreshMetrics()
			emitViewChanged(false)
			return
		}
		const controllerStep = Math.min(
			0.45,
			Math.max(0.24, 1 / Math.sqrt(scrollControllerVelocityNeededPerPixel))
		)
		viewport.scrollLeft += dx * controllerStep
		viewport.scrollTop += dy * controllerStep
		if (Math.abs(smoothTargetRef.current.left - viewport.scrollLeft) < 1)
			viewport.scrollLeft = smoothTargetRef.current.left
		if (Math.abs(smoothTargetRef.current.top - viewport.scrollTop) < 1)
			viewport.scrollTop = smoothTargetRef.current.top
		smoothExpectedRef.current = {
			left: viewport.scrollLeft,
			top: viewport.scrollTop
		}
		smoothExpectedActiveRef.current = true
		refreshMetrics()
		emitViewChanged(true)
		smoothFrameRef.current = requestAnimationFrame(animateToTarget)
	}
	const requestScrollBy = (deltaX: number, deltaY: number, animated = true) => {
		const viewport = viewportRef.current
		if (!viewport) return false
		const baseLeft =
			smoothFrameRef.current === undefined
				? viewport.scrollLeft
				: smoothTargetRef.current.left
		const baseTop =
			smoothFrameRef.current === undefined ? viewport.scrollTop : smoothTargetRef.current.top
		smoothTargetRef.current = {
			left: Math.max(0, Math.min(maxScrollLeft, baseLeft + deltaX)),
			top: Math.max(0, Math.min(maxScrollTop, baseTop + deltaY))
		}
		if (smoothTargetRef.current.left < scrollControllerMinMaxEpsilon)
			smoothTargetRef.current.left = 0
		if (maxScrollLeft - smoothTargetRef.current.left < scrollControllerMinMaxEpsilon)
			smoothTargetRef.current.left = maxScrollLeft
		if (smoothTargetRef.current.top < scrollControllerMinMaxEpsilon)
			smoothTargetRef.current.top = 0
		if (maxScrollTop - smoothTargetRef.current.top < scrollControllerMinMaxEpsilon)
			smoothTargetRef.current.top = maxScrollTop
		const changed =
			Math.abs(smoothTargetRef.current.left - viewport.scrollLeft) > 0.01 ||
			Math.abs(smoothTargetRef.current.top - viewport.scrollTop) > 0.01
		if (!changed) return false
		stopVelocity()
		if (!animated) {
			const target = { ...smoothTargetRef.current }
			stopSmoothScroll()
			viewport.scrollLeft = target.left
			viewport.scrollTop = target.top
			smoothExpectedRef.current = {
				left: viewport.scrollLeft,
				top: viewport.scrollTop
			}
			refreshMetrics()
			emitViewChanged(false)
			return true
		}
		setIsWheelScrolling(true)
		if (smoothFrameRef.current === undefined)
			smoothFrameRef.current = requestAnimationFrame(animateToTarget)
		return true
	}
	const stopSmoothScrollIfExternalScroll = () => {
		const viewport = viewportRef.current
		if (!viewport || smoothFrameRef.current === undefined) return
		if (
			!smoothExpectedActiveRef.current ||
			Math.abs(viewport.scrollLeft - smoothExpectedRef.current.left) >= 0.75 ||
			Math.abs(viewport.scrollTop - smoothExpectedRef.current.top) >= 0.75
		) {
			stopSmoothScroll()
		}
	}
	const stopVelocityIfExternalScroll = () => {
		const viewport = viewportRef.current
		if (!viewport || velocityFrameRef.current === undefined) return
		if (
			!velocityExpectedActiveRef.current ||
			Math.abs(viewport.scrollLeft - velocityExpectedRef.current.left) >= 0.75 ||
			Math.abs(viewport.scrollTop - velocityExpectedRef.current.top) >= 0.75
		) {
			stopVelocity()
		}
	}
	const handleViewportKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const viewport = viewportRef.current
		if (!viewport) return
		const smallChange = 16
		const pageChange = Math.max(smallChange, viewport.clientHeight - smallChange)
		const horizontalEnabled = props.HorizontalScrollMode !== "Disabled"
		const verticalEnabled = props.VerticalScrollMode !== "Disabled"
		let deltaX = 0
		let deltaY = 0
		let handled = true
		switch (event.key) {
			case "ArrowLeft":
				deltaX = horizontalEnabled ? -smallChange : 0
				break
			case "ArrowRight":
				deltaX = horizontalEnabled ? smallChange : 0
				break
			case "ArrowUp":
				deltaY = verticalEnabled ? -smallChange : 0
				break
			case "ArrowDown":
				deltaY = verticalEnabled ? smallChange : 0
				break
			case "PageUp":
				deltaY = verticalEnabled ? -pageChange : 0
				break
			case "PageDown":
				deltaY = verticalEnabled ? pageChange : 0
				break
			case " ":
				deltaY = verticalEnabled ? (event.shiftKey ? -pageChange : pageChange) : 0
				break
			case "Home":
				deltaX = horizontalEnabled && event.ctrlKey ? -viewport.scrollLeft : 0
				deltaY = verticalEnabled ? -viewport.scrollTop : 0
				break
			case "End":
				deltaX =
					horizontalEnabled && event.ctrlKey ? maxScrollLeft - viewport.scrollLeft : 0
				deltaY = verticalEnabled ? maxScrollTop - viewport.scrollTop : 0
				break
			default:
				handled = false
		}
		if (!handled) return
		if (event.key === "Home" || event.key === "End") {
			cancelPendingAnimatedScrollForDirectInput()
			const targetHorizontal = event.key === "Home" ? 0 : maxScrollLeft
			const targetVertical = event.key === "Home" ? 0 : maxScrollTop
			deltaX = horizontalEnabled && event.ctrlKey ? targetHorizontal - viewport.scrollLeft : 0
			deltaY = verticalEnabled ? targetVertical - viewport.scrollTop : 0
		}
		if (deltaX !== 0 || deltaY !== 0 || ["Home", "End"].includes(event.key)) {
			event.preventDefault()
			requestScrollBy(deltaX, deltaY, true)
		}
	}
	const zoomTo = (factor: number) => {
		const next = Math.max(
			typeof props.MinZoomFactor === "number" ? props.MinZoomFactor : 0.1,
			Math.min(typeof props.MaxZoomFactor === "number" ? props.MaxZoomFactor : 10, factor)
		)
		zoomFactorRef.current = next
		setZoomFactor(next)
		refreshMetrics()
		emitViewChanged(true)
	}
	const endZoom = () => {
		if (!isZoomingRef.current) return
		isZoomingRef.current = false
		setIsZooming(false)
		emitViewChanged(false)
	}
	const handleScroll = () => {
		stopSmoothScrollIfExternalScroll()
		stopVelocityIfExternalScroll()
		beginDirectManipulation()
		setIsScrolling(true)
		setShowVertical(hasVerticalScrollBar)
		setShowHorizontal(hasHorizontalScrollBar)
		refreshMetrics()
		emitViewChanged(true)
		if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
		scrollTimerRef.current = setTimeout(() => {
			setIsScrolling(false)
			emitViewChanged(false)
			completeDirectManipulation()
		}, 150)
	}
	const clearScrollBarTimers = (orientation: "vertical" | "horizontal") => {
		if (orientation === "vertical") {
			if (verticalHoverExpandTimerRef.current)
				clearTimeout(verticalHoverExpandTimerRef.current)
			if (verticalContractTimerRef.current) clearTimeout(verticalContractTimerRef.current)
			if (verticalContractAnimationTimerRef.current)
				clearTimeout(verticalContractAnimationTimerRef.current)
			verticalHoverExpandTimerRef.current = undefined
			verticalContractTimerRef.current = undefined
			verticalContractAnimationTimerRef.current = undefined
		} else {
			if (horizontalHoverExpandTimerRef.current)
				clearTimeout(horizontalHoverExpandTimerRef.current)
			if (horizontalContractTimerRef.current) clearTimeout(horizontalContractTimerRef.current)
			if (horizontalContractAnimationTimerRef.current)
				clearTimeout(horizontalContractAnimationTimerRef.current)
			horizontalHoverExpandTimerRef.current = undefined
			horizontalContractTimerRef.current = undefined
			horizontalContractAnimationTimerRef.current = undefined
		}
	}
	const interactionToken = (orientation: "vertical" | "horizontal") =>
		orientation === "vertical"
			? verticalInteractionTokenRef.current
			: horizontalInteractionTokenRef.current
	const bumpInteractionToken = (orientation: "vertical" | "horizontal") => {
		if (orientation === "vertical") {
			verticalInteractionTokenRef.current += 1
			return verticalInteractionTokenRef.current
		}
		horizontalInteractionTokenRef.current += 1
		return horizontalInteractionTokenRef.current
	}
	const beginScrollBarInteraction = (orientation: "vertical" | "horizontal") => {
		const token = bumpInteractionToken(orientation)
		clearScrollBarTimers(orientation)
		if (orientation === "vertical") {
			setVerticalContracting(false)
			setShowVertical(hasVerticalScrollBar)
		} else {
			setHorizontalContracting(false)
			setShowHorizontal(hasHorizontalScrollBar)
		}
		return token
	}
	const expandBarAfterLayout = (
		orientation: "vertical" | "horizontal",
		token = interactionToken(orientation)
	) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (token !== interactionToken(orientation)) return
				if (orientation === "vertical") {
					if (!hasVerticalScrollBar) return
					setVerticalContracting(false)
					setVerticalExpanded(true)
				} else {
					if (!hasHorizontalScrollBar) return
					setHorizontalContracting(false)
					setHorizontalExpanded(true)
				}
			})
		})
	}
	const expandBar = (orientation: "vertical" | "horizontal") => {
		beginScrollBarInteraction(orientation)
		if (orientation === "vertical") {
			setShowVertical(hasVerticalScrollBar)
			setVerticalContracting(false)
			setVerticalExpanded(hasVerticalScrollBar)
		} else {
			setShowHorizontal(hasHorizontalScrollBar)
			setHorizontalContracting(false)
			setHorizontalExpanded(hasHorizontalScrollBar)
		}
	}
	const scheduleContract = (orientation: "vertical" | "horizontal") => {
		const token = bumpInteractionToken(orientation)
		const timerRef =
			orientation === "vertical" ? verticalContractTimerRef : horizontalContractTimerRef
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = setTimeout(() => {
			if (token !== interactionToken(orientation)) return
			if (orientation === "vertical") {
				if (!verticalExpanded) return
				setVerticalContracting(true)
				setVerticalExpanded(false)
				verticalContractAnimationTimerRef.current = setTimeout(() => {
					if (token === interactionToken(orientation)) setVerticalContracting(false)
				}, 667)
			} else {
				if (!horizontalExpanded) return
				setHorizontalContracting(true)
				setHorizontalExpanded(false)
				horizontalContractAnimationTimerRef.current = setTimeout(() => {
					if (token === interactionToken(orientation)) setHorizontalContracting(false)
				}, 667)
			}
		}, 500)
	}
	const markNonMousePointer = (event: React.PointerEvent) => {
		if (event.pointerType !== "mouse")
			lastNonMouseScrollBarPointerTimeRef.current = performance.now()
	}
	const isSyntheticHoverAfterTouch = () =>
		performance.now() - lastNonMouseScrollBarPointerTimeRef.current < 800
	const triggerHapticFeedback = (event: React.PointerEvent) => {
		if (event.pointerType === "mouse") return
		try {
			navigator.vibrate?.(12)
		} catch {
			// Some browsers expose vibrate but reject it on unsupported hardware.
		}
	}
	const getScrollBarLineDirection = (
		orientation: "vertical" | "horizontal",
		event: React.PointerEvent<HTMLDivElement>
	) => {
		const rect = event.currentTarget.getBoundingClientRect()
		const coordinate =
			orientation === "vertical" ? event.clientY - rect.top : event.clientX - rect.left
		const extent = orientation === "vertical" ? rect.height : rect.width
		if (coordinate <= 12) return -1
		if (coordinate >= extent - 12) return 1
		return 0
	}
	const scrollLine = (
		orientation: "vertical" | "horizontal",
		direction: number,
		distance = scrollControllerSmallChange
	) =>
		requestScrollBy(
			orientation === "horizontal" ? direction * distance : 0,
			orientation === "vertical" ? direction * distance : 0,
			true
		)
	const runLineScroll = (time: number) => {
		const active = activeLineScrollRef.current
		if (!active) return
		const elapsed = Math.min(50, Math.max(0, time - active.lastTime))
		active.lastTime = time
		if (!scrollLine(active.orientation, active.direction, (320 * elapsed) / 1000)) {
			cancelLineScroll(false)
			return
		}
		lineScrollFrameRef.current = requestAnimationFrame(runLineScroll)
	}
	const startLineScroll = (
		orientation: "vertical" | "horizontal",
		direction: number,
		event?: React.PointerEvent<HTMLElement>
	) => {
		if (!viewportRef.current) return
		if (event) {
			markNonMousePointer(event)
			triggerHapticFeedback(event)
			event.currentTarget.setPointerCapture?.(event.pointerId)
		}
		expandBar(orientation)
		stopLineScroll()
		activeLineScrollRef.current = { orientation, direction, lastTime: performance.now() }
		setIsLineScrolling(true)
		if (!scrollLine(orientation, direction)) {
			cancelLineScroll(false)
			return
		}
		document.addEventListener("pointerup", stopLineScroll)
		document.addEventListener("pointercancel", stopLineScroll)
		lineScrollFrameRef.current = requestAnimationFrame(runLineScroll)
	}
	const stopLineScroll = () => cancelLineScroll(true)
	const cancelLineScroll = (shouldScheduleContract: boolean) => {
		const previousOrientation = activeLineScrollRef.current?.orientation
		activeLineScrollRef.current = undefined
		setIsLineScrolling(false)
		if (lineScrollFrameRef.current !== undefined)
			cancelAnimationFrame(lineScrollFrameRef.current)
		lineScrollFrameRef.current = undefined
		document.removeEventListener("pointerup", stopLineScroll)
		document.removeEventListener("pointercancel", stopLineScroll)
		if (shouldScheduleContract && previousOrientation) {
			if (previousOrientation === "vertical" && !verticalPointerOver && !isDraggingVertical)
				scheduleContract("vertical")
			if (
				previousOrientation === "horizontal" &&
				!horizontalPointerOver &&
				!isDraggingHorizontal
			)
				scheduleContract("horizontal")
		}
	}
	const handleScrollBarPointerEnter = (
		orientation: "vertical" | "horizontal",
		event: React.PointerEvent<HTMLDivElement>
	) => {
		if (event.pointerType !== "mouse" || isSyntheticHoverAfterTouch()) return
		if (orientation === "vertical") setVerticalPointerOver(true)
		else setHorizontalPointerOver(true)
		const token = beginScrollBarInteraction(orientation)
		expandBarAfterLayout(orientation, token)
	}
	const handleScrollBarPointerLeave = (orientation: "vertical" | "horizontal") => {
		if (orientation === "vertical") {
			setVerticalPointerOver(false)
			if (!isDraggingVertical && !activeLineScrollRef.current) scheduleContract("vertical")
			return
		}
		setHorizontalPointerOver(false)
		if (!isDraggingHorizontal && !activeLineScrollRef.current) scheduleContract("horizontal")
	}
	const startTrackScroll = (
		orientation: "vertical" | "horizontal",
		event: React.PointerEvent<HTMLDivElement>
	) => {
		if (event.target !== event.currentTarget) return
		if (event.pointerType !== "mouse") {
			markNonMousePointer(event)
			triggerHapticFeedback(event)
			const direction = getScrollBarLineDirection(orientation, event)
			if (direction !== 0) {
				event.preventDefault()
				startLineScroll(orientation, direction, event)
				return
			}
			expandBar(orientation)
			event.preventDefault()
			return
		}
		const bar = event.currentTarget
		const rect = bar.getBoundingClientRect()
		const coordinate =
			orientation === "vertical" ? event.clientY - rect.top : event.clientX - rect.left
		const thumb = orientation === "vertical" ? verticalThumbStyle : horizontalThumbStyle
		const transform = String(thumb.transform ?? "")
		const current = Number.parseFloat(transform.match(/[-\d.]+/)?.[0] ?? "12")
		const size = Number(orientation === "vertical" ? thumb.height : thumb.width) || 30
		const direction = coordinate < current ? -1 : coordinate > current + size ? 1 : 0
		if (direction !== 0) {
			requestScrollBy(
				orientation === "horizontal" ? direction * metrics.clientWidth * 0.9 : 0,
				orientation === "vertical" ? direction * metrics.clientHeight * 0.9 : 0,
				true
			)
		}
		expandBar(orientation)
	}
	const startThumbDrag = (
		orientation: "vertical" | "horizontal",
		event: React.PointerEvent<HTMLDivElement>
	) => {
		event.preventDefault()
		event.stopPropagation()
		markNonMousePointer(event)
		triggerHapticFeedback(event)
		cancelLineScroll(false)
		stopVelocity()
		stopSmoothScroll()
		expandBar(orientation)
		const viewport = viewportRef.current
		if (!viewport) return
		const startCoordinate = orientation === "vertical" ? event.clientY : event.clientX
		const startOffset = orientation === "vertical" ? viewport.scrollTop : viewport.scrollLeft
		const cleanup = () => {
			document.removeEventListener("pointermove", move)
			document.removeEventListener("pointerup", end)
			document.removeEventListener("pointercancel", end)
			dragCleanupRef.current = undefined
			if (orientation === "vertical") {
				activeVerticalDragPointerIdRef.current = null
				setIsDraggingVertical(false)
			} else {
				activeHorizontalDragPointerIdRef.current = null
				setIsDraggingHorizontal(false)
			}
		}
		const move = (pointer: globalThis.PointerEvent) => {
			const currentViewport = viewportRef.current
			if (!currentViewport) return
			const activePointerId =
				orientation === "vertical"
					? activeVerticalDragPointerIdRef.current
					: activeHorizontalDragPointerIdRef.current
			if (activePointerId !== null && pointer.pointerId !== activePointerId) return
			const delta =
				(orientation === "vertical" ? pointer.clientY : pointer.clientX) - startCoordinate
			const track = getTrackMetrics(orientation)
			const thumbSize =
				Number(
					orientation === "vertical"
						? verticalThumbStyle.height
						: horizontalThumbStyle.width
				) || 30
			const travel = Math.max(1, track.length - thumbSize)
			const max = orientation === "vertical" ? maxScrollTop : maxScrollLeft
			const next = Math.max(0, Math.min(max, startOffset + (delta / travel) * max))
			if (orientation === "vertical") currentViewport.scrollTop = next
			else currentViewport.scrollLeft = next
			refreshMetrics()
			pointer.preventDefault()
		}
		const end = () => cleanup()
		dragCleanupRef.current?.()
		dragCleanupRef.current = cleanup
		event.currentTarget.setPointerCapture?.(event.pointerId)
		if (orientation === "vertical") {
			activeVerticalDragPointerIdRef.current = event.pointerId
			setIsDraggingVertical(true)
		} else {
			activeHorizontalDragPointerIdRef.current = event.pointerId
			setIsDraggingHorizontal(true)
		}
		document.addEventListener("pointermove", move)
		document.addEventListener("pointerup", end)
		document.addEventListener("pointercancel", end)
	}
	const handleTouchStart = (event: globalThis.TouchEvent) => {
		cancelPendingAnimatedScrollForDirectInput()
		if (props.ZoomMode !== "Enabled" || event.touches.length !== 2) return
		beginDirectManipulation()
		const [first, second] = Array.from(event.touches)
		touchStartRef.current = {
			distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
			zoom: zoomFactorRef.current
		}
	}
	const handleTouchMove = (event: globalThis.TouchEvent) => {
		if (props.ZoomMode !== "Enabled" || event.touches.length !== 2) return
		const [first, second] = Array.from(event.touches)
		const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
		if (touchStartRef.current.distance <= 0) return
		event.preventDefault()
		isZoomingRef.current = true
		setIsZooming(true)
		zoomTo((distance / touchStartRef.current.distance) * touchStartRef.current.zoom)
	}
	const handleTouchEnd = () => {
		if (isZoomingRef.current) {
			endZoom()
			completeDirectManipulation()
		}
	}
	const normalizeWheelDelta = (event: globalThis.WheelEvent) => {
		let deltaX = event.deltaX
		let deltaY = event.deltaY
		if (event.deltaMode === 1) {
			deltaX *= 16
			deltaY *= 16
		} else if (event.deltaMode === 2 && viewportRef.current) {
			deltaX *= viewportRef.current.clientWidth
			deltaY *= viewportRef.current.clientHeight
		}
		return { deltaX, deltaY }
	}
	const handleScrollBarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		const { deltaX, deltaY } = normalizeWheelDelta(event.nativeEvent)
		if (requestScrollBy(deltaX, deltaY, true)) {
			event.preventDefault()
			event.stopPropagation()
			return
		}
		if (
			(props.IsVerticalScrollChainingEnabled === false && deltaY !== 0) ||
			(props.IsHorizontalScrollChainingEnabled === false && deltaX !== 0)
		) {
			event.preventDefault()
			event.stopPropagation()
		}
	}
	useEffect(() => {
		setShowVertical(hasVerticalScrollBar)
		setShowHorizontal(hasHorizontalScrollBar)
	}, [hasVerticalScrollBar, hasHorizontalScrollBar])
	useEffect(() => {
		const viewport = viewportRef.current
		if (!viewport) return undefined
		const onWheel = (event: globalThis.WheelEvent) => {
			cancelPendingAnimatedScrollForDirectInput()
			if (event.ctrlKey && props.ZoomMode === "Enabled") {
				zoomTo(zoomFactorRef.current * (event.deltaY < 0 ? 1.1 : 0.9))
				event.preventDefault()
				return
			}
			if (props.IsVerticalScrollChainingEnabled === false) {
				const atTop = viewport.scrollTop <= 0
				const atBottom =
					viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1
				if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom))
					event.preventDefault()
			}
			if (props.IsHorizontalScrollChainingEnabled === false) {
				const atLeft = viewport.scrollLeft <= 0
				const atRight =
					viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1
				if ((event.deltaX < 0 && atLeft) || (event.deltaX > 0 && atRight))
					event.preventDefault()
			}
		}
		viewport.addEventListener("wheel", onWheel, { passive: false })
		viewport.addEventListener("touchstart", handleTouchStart, { passive: false })
		viewport.addEventListener("touchmove", handleTouchMove, { passive: false })
		viewport.addEventListener("touchend", handleTouchEnd)
		return () => {
			viewport.removeEventListener("wheel", onWheel)
			viewport.removeEventListener("touchstart", handleTouchStart)
			viewport.removeEventListener("touchmove", handleTouchMove)
			viewport.removeEventListener("touchend", handleTouchEnd)
		}
	}, [
		props.ZoomMode,
		props.IsVerticalScrollChainingEnabled,
		props.IsHorizontalScrollChainingEnabled
	])
	useEffect(() => {
		const root = rootRef.current
		const viewport = viewportRef.current
		const content = contentRef.current
		if (!root || !viewport || !content) return undefined
		refreshMetrics()
		const observer =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(refreshMetrics) : undefined
		observer?.observe(root)
		observer?.observe(viewport)
		observer?.observe(content)
		return () => observer?.disconnect()
	}, [])
	useEffect(() => {
		if (typeof props.ZoomFactor === "number") {
			zoomFactorRef.current = props.ZoomFactor
			setZoomFactor(props.ZoomFactor)
		}
	}, [props.ZoomFactor])
	useEffect(
		() => () => {
			if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
			if (verticalHoverExpandTimerRef.current)
				clearTimeout(verticalHoverExpandTimerRef.current)
			if (horizontalHoverExpandTimerRef.current)
				clearTimeout(horizontalHoverExpandTimerRef.current)
			if (verticalContractTimerRef.current) clearTimeout(verticalContractTimerRef.current)
			if (horizontalContractTimerRef.current) clearTimeout(horizontalContractTimerRef.current)
			if (verticalContractAnimationTimerRef.current)
				clearTimeout(verticalContractAnimationTimerRef.current)
			if (horizontalContractAnimationTimerRef.current)
				clearTimeout(horizontalContractAnimationTimerRef.current)
			stopLineScroll()
			stopSmoothScroll()
			stopVelocity()
			dragCleanupRef.current?.()
		},
		[]
	)
	const changeView = (
		horizontalOffset?: number | null,
		verticalOffset?: number | null,
		zoom?: number | null
	) => {
		const viewport = viewportRef.current
		if (!viewport) return false
		cancelPendingAnimatedScrollForDirectInput()
		const previousScrollBehavior = viewport.style.scrollBehavior
		viewport.style.scrollBehavior = "auto"
		if (horizontalOffset !== null && horizontalOffset !== undefined)
			viewport.scrollLeft = horizontalOffset
		if (verticalOffset !== null && verticalOffset !== undefined)
			viewport.scrollTop = verticalOffset
		viewport.style.scrollBehavior = previousScrollBehavior
		if (zoom !== null && zoom !== undefined) zoomTo(zoom)
		refreshMetrics()
		emitViewChanged(false)
		return true
	}
	const addScrollVelocity = (
		offsets: { x?: number; y?: number } | [number, number],
		decay = 0.9995
	) => {
		cancelPendingAnimatedScrollForDirectInput()
		velocityRef.current = {
			x: Array.isArray(offsets) ? offsets[0] : (offsets.x ?? 0),
			y: Array.isArray(offsets) ? offsets[1] : (offsets.y ?? 0),
			lastTime: performance.now(),
			decay
		}
		velocityExpectedActiveRef.current = true
		const run = (time: number) => {
			const viewport = viewportRef.current
			if (!viewport) return
			const velocity = velocityRef.current
			const elapsed = Math.min(0.05, Math.max(0, (time - velocity.lastTime) / 1000))
			velocity.lastTime = time
			const beforeLeft = viewport.scrollLeft
			const beforeTop = viewport.scrollTop
			viewport.scrollLeft += velocity.x * elapsed
			viewport.scrollTop += velocity.y * elapsed
			velocityExpectedRef.current = {
				left: viewport.scrollLeft,
				top: viewport.scrollTop
			}
			refreshMetrics()
			emitViewChanged(true)
			const multiplier = Math.pow(velocity.decay, elapsed * 1000)
			velocity.x *= multiplier
			velocity.y *= multiplier
			const moved = beforeLeft !== viewport.scrollLeft || beforeTop !== viewport.scrollTop
			if (!moved || (Math.abs(velocity.x) < 0.5 && Math.abs(velocity.y) < 0.5)) {
				velocityFrameRef.current = undefined
				velocityExpectedActiveRef.current = false
				emitViewChanged(false)
				return
			}
			velocityFrameRef.current = requestAnimationFrame(run)
		}
		velocityFrameRef.current = requestAnimationFrame(run)
		return 0
	}
	useImperativeHandle(ref, () => ({
		ChangeView: changeView,
		ZoomTo: (factor) => {
			zoomTo(factor)
			return 0
		},
		ZoomToFactor: (factor) => {
			zoomTo(factor)
			return 0
		},
		ZoomBy: (delta) => {
			zoomTo(zoomFactorRef.current + delta)
			return 0
		},
		ScrollTo: (left, top) => {
			changeView(left, top)
			return 0
		},
		ScrollBy: (left, top) => {
			requestScrollBy(left, top, true)
			return 0
		},
		AddScrollVelocity: addScrollVelocity,
		CancelScrollVelocity: stopVelocity,
		get ZoomFactor() {
			return zoomFactorRef.current
		},
		get HorizontalOffset() {
			return viewportRef.current?.scrollLeft ?? 0
		},
		get VerticalOffset() {
			return viewportRef.current?.scrollTop ?? 0
		},
		get ViewportWidth() {
			return viewportRef.current?.clientWidth ?? 0
		},
		get ViewportHeight() {
			return viewportRef.current?.clientHeight ?? 0
		},
		get ExtentWidth() {
			return viewportRef.current?.scrollWidth ?? 0
		},
		get ExtentHeight() {
			return viewportRef.current?.scrollHeight ?? 0
		},
		get ScrollableWidth() {
			return Math.max(
				0,
				(viewportRef.current?.scrollWidth ?? 0) - (viewportRef.current?.clientWidth ?? 0)
			)
		},
		get ScrollableHeight() {
			return Math.max(
				0,
				(viewportRef.current?.scrollHeight ?? 0) - (viewportRef.current?.clientHeight ?? 0)
			)
		},
		get ComputedHorizontalScrollBarVisibility() {
			return hasHorizontalScrollBar ? "Visible" : "Collapsed"
		},
		get ComputedVerticalScrollBarVisibility() {
			return hasVerticalScrollBar ? "Visible" : "Collapsed"
		}
	}))
	const scrollViewerStyle: WinStyle = { ...customStyle, ...commonStyle(props) }
	const horizontalAlignment =
		typeof props.HorizontalAlignment === "string" ? props.HorizontalAlignment : undefined
	const verticalAlignment =
		typeof props.VerticalAlignment === "string" ? props.VerticalAlignment : undefined
	if (horizontalAlignment) {
		scrollViewerStyle.justifySelf = alignments[horizontalAlignment] ?? "stretch"
	}
	if (verticalAlignment) {
		scrollViewerStyle.alignSelf = alignments[verticalAlignment] ?? "stretch"
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={rootRef}
			className={cx(
				"win-scroll-viewer",
				props.ZoomMode === "Enabled" ? "zoom-mode-enabled" : "zoom-mode-disabled",
				isScrolling ? "scrolling" : undefined,
				isZooming ? "zooming" : undefined,
				isWheelScrolling ? "wheel-scrolling" : undefined,
				isLineScrolling ? "line-scrolling" : undefined,
				hasVerticalScrollBar ? "has-vertical-scrollbar" : undefined,
				hasHorizontalScrollBar ? "has-horizontal-scrollbar" : undefined,
				hasVerticalScrollBar &&
					hasHorizontalScrollBar &&
					(verticalExpanded || horizontalExpanded)
					? "scrollbar-corner-visible"
					: undefined,
				verticalContracting ? "vertical-contracting" : undefined,
				horizontalContracting ? "horizontal-contracting" : undefined,
				customClassName,
				legacyClassName
			)}
			style={scrollViewerStyle}
		>
			<div
				ref={viewportRef}
				className="win-scroll-viewer-viewport"
				tabIndex={props.IsTabStop ? 0 : -1}
				role={props.IsTabStop ? "region" : undefined}
				aria-label={props["aria-label"] as string | undefined}
				style={{
					overflowX:
						props.HorizontalScrollMode === "Disabled" ||
						props.HorizontalScrollBarVisibility === "Disabled"
							? "hidden"
							: props.HorizontalScrollBarVisibility === "Visible" ||
								  props.HorizontalScrollBarVisibility === "Hidden"
								? "scroll"
								: "auto",
					overflowY:
						props.VerticalScrollMode === "Disabled" ||
						props.VerticalScrollBarVisibility === "Disabled"
							? "hidden"
							: props.VerticalScrollBarVisibility === "Visible" ||
								  props.VerticalScrollBarVisibility === "Hidden"
								? "scroll"
								: "auto",
					overflowAnchor: "none"
				}}
				onKeyDown={handleViewportKeyDown}
				onScroll={handleScroll}
			>
				<div
					ref={contentRef}
					className="scroll-content"
					style={{
						display: "block",
						width: "100%",
						minWidth: 0,
						minHeight: "max-content",
						zoom: props.ZoomMode === "Enabled" ? zoomFactor : 1
					}}
				>
					{props.children as ReactNode}
				</div>
			</div>
			{hasVerticalScrollBar && (
				<div
					ref={verticalBarRef}
					className={cx(
						"scrollbar scrollbar-vertical",
						showVertical ? "visible" : undefined,
						verticalExpanded ? "expanded" : undefined,
						verticalContracting ? "contracting" : undefined,
						isDraggingVertical ? "dragging" : undefined,
						isLineScrolling || isWheelScrolling ? "line-scrolling" : undefined,
						hasHorizontalScrollBar ? "has-cross-scrollbar" : undefined
					)}
					onPointerEnter={(event) => handleScrollBarPointerEnter("vertical", event)}
					onPointerLeave={() => handleScrollBarPointerLeave("vertical")}
					onPointerDown={(event) => startTrackScroll("vertical", event)}
					onWheel={handleScrollBarWheel}
				>
					<button
						className="scrollbar-button decrease icon"
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						onPointerDown={(event) => {
							event.stopPropagation()
							startLineScroll("vertical", -1, event)
						}}
						onPointerUp={stopLineScroll}
						onPointerCancel={stopLineScroll}
					>
						
					</button>
					<div className="scrollbar-track" />
					<div
						className="scrollbar-thumb"
						style={verticalThumbStyle}
						onPointerDown={(event) => startThumbDrag("vertical", event)}
					/>
					<button
						className="scrollbar-button increase icon"
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						onPointerDown={(event) => {
							event.stopPropagation()
							startLineScroll("vertical", 1, event)
						}}
						onPointerUp={stopLineScroll}
						onPointerCancel={stopLineScroll}
					>
						
					</button>
				</div>
			)}
			{hasHorizontalScrollBar && (
				<div
					ref={horizontalBarRef}
					className={cx(
						"scrollbar scrollbar-horizontal",
						showHorizontal ? "visible" : undefined,
						horizontalExpanded ? "expanded" : undefined,
						horizontalContracting ? "contracting" : undefined,
						isDraggingHorizontal ? "dragging" : undefined,
						isLineScrolling || isWheelScrolling ? "line-scrolling" : undefined,
						hasVerticalScrollBar ? "has-cross-scrollbar" : undefined
					)}
					onPointerEnter={(event) => handleScrollBarPointerEnter("horizontal", event)}
					onPointerLeave={() => handleScrollBarPointerLeave("horizontal")}
					onPointerDown={(event) => startTrackScroll("horizontal", event)}
					onWheel={handleScrollBarWheel}
				>
					<button
						className="scrollbar-button decrease icon"
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						onPointerDown={(event) => {
							event.stopPropagation()
							startLineScroll("horizontal", -1, event)
						}}
						onPointerUp={stopLineScroll}
						onPointerCancel={stopLineScroll}
					>
						
					</button>
					<div className="scrollbar-track" />
					<div
						className="scrollbar-thumb"
						style={horizontalThumbStyle}
						onPointerDown={(event) => startThumbDrag("horizontal", event)}
					/>
					<button
						className="scrollbar-button increase icon"
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						onPointerDown={(event) => {
							event.stopPropagation()
							startLineScroll("horizontal", 1, event)
						}}
						onPointerUp={stopLineScroll}
						onPointerCancel={stopLineScroll}
					>
						
					</button>
				</div>
			)}
			{hasVerticalScrollBar && hasHorizontalScrollBar && <div className="scrollbar-corner" />}
		</div>
	)
})
