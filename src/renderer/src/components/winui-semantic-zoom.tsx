// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { ReactNode } from "react"
import { callback, commonStyle, cx, xamlThickness } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

type WinSemanticZoomProps = WinProps & {
	ZoomedInView?: ReactNode
	ZoomedOutView?: ReactNode
	IsZoomedInViewActive?: boolean
	CanChangeViews?: boolean
	IsZoomOutButtonEnabled?: boolean
	IsEnabled?: boolean
	IsTabStop?: boolean
	Background?: string
	BorderBrush?: string
	BorderThickness?: string | number
	Padding?: string | number
	["ScrollViewer.ZoomMode"]?: string
}

type WinSemanticZoomRequest = {
	Item?: unknown
	OriginalSource?: HTMLElement
}

export interface WinSemanticZoomHandle {
	ToggleActiveView: (request?: WinSemanticZoomRequest) => boolean
}

type WinSemanticZoomLocation = {
	Item: unknown
	Bounds: {
		X: number
		Y: number
		Width: number
		Height: number
	}
}

export const WinSemanticZoom = forwardRef<WinSemanticZoomHandle, WinSemanticZoomProps>(
	function WinSemanticZoom(props, ref): React.JSX.Element {
		const rootRef = useRef<HTMLDivElement>(null)
		const zoomedInPresenterRef = useRef<HTMLDivElement>(null)
		const zoomedOutPresenterRef = useRef<HTMLDivElement>(null)
		const pointers = useRef(new Map<number, { x: number; y: number }>())
		const changeTimer = useRef<number | undefined>(undefined)
		const zoomButtonTimer = useRef<number | undefined>(undefined)
		const pinchStartDistance = useRef(0)
		const pinchStartFactor = useRef(1)
		const pinchStartedZoomedIn = useRef(true)
		const [isZoomedIn, setIsZoomedIn] = useState(props.IsZoomedInViewActive !== false)
		const [isChangingView, setIsChangingView] = useState(false)
		const [gestureFactor, setGestureFactor] = useState<number | null>(null)
		const [zoomButtonVisible, setZoomButtonVisible] = useState(false)
		const isEnabled = props.IsEnabled !== false
		const canChange = props.CanChangeViews !== false
		const zoomModeEnabled = String(props["ScrollViewer.ZoomMode"] ?? "Disabled") !== "Disabled"
		const semanticZoomAnimationDuration = () =>
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? 0
				: 167
		const makeLocation = (
			element: HTMLElement | null,
			item: unknown = null
		): WinSemanticZoomLocation => {
			const rootBounds = rootRef.current?.getBoundingClientRect()
			const bounds = element?.getBoundingClientRect()
			return {
				Item: item,
				Bounds: {
					X: bounds && rootBounds ? bounds.left - rootBounds.left : 0,
					Y: bounds && rootBounds ? bounds.top - rootBounds.top : 0,
					Width: bounds?.width ?? 0,
					Height: bounds?.height ?? 0
				}
			}
		}
		const createViewChangeArgs = (
			sourceIsZoomedInView: boolean,
			request?: WinSemanticZoomRequest
		) => ({
			IsSourceZoomedInView: sourceIsZoomedInView,
			SourceItem: makeLocation(
				request?.OriginalSource ??
					(sourceIsZoomedInView
						? zoomedInPresenterRef.current
						: zoomedOutPresenterRef.current),
				request?.Item
			),
			DestinationItem: makeLocation(
				sourceIsZoomedInView ? zoomedOutPresenterRef.current : zoomedInPresenterRef.current
			)
		})
		const setActiveView = (next: boolean, request?: WinSemanticZoomRequest) => {
			if (!isEnabled || !canChange || next === isZoomedIn) return false
			if (changeTimer.current !== undefined) window.clearTimeout(changeTimer.current)
			if (zoomButtonTimer.current !== undefined) window.clearTimeout(zoomButtonTimer.current)
			zoomButtonTimer.current = undefined
			setZoomButtonVisible(false)
			const args = createViewChangeArgs(isZoomedIn, request)
			setIsChangingView(true)
			setGestureFactor(null)
			callback<unknown>(props, "onViewChangeStarted", "ViewChangeStarted")?.(args)
			setIsZoomedIn(next)
			callback<boolean>(props, "onValueChange", "onUpdate:IsZoomedInViewActive")?.(next)
			changeTimer.current = window.setTimeout(() => {
				setIsChangingView(false)
				callback<unknown>(
					props,
					"onViewChangeCompleted",
					"ViewChangeCompleted"
				)?.({
					...args
				})
				changeTimer.current = undefined
			}, semanticZoomAnimationDuration())
			return true
		}
		const showZoomButton = () => {
			if (!props.IsZoomOutButtonEnabled || !isZoomedIn || isChangingView || !isEnabled) return
			setZoomButtonVisible(true)
			if (zoomButtonTimer.current !== undefined) window.clearTimeout(zoomButtonTimer.current)
			zoomButtonTimer.current = window.setTimeout(() => {
				setZoomButtonVisible(false)
				zoomButtonTimer.current = undefined
			}, semanticZoomAnimationDuration() + 3000)
		}
		const pointerDistance = () => {
			const points = [...pointers.current.values()]
			return points.length >= 2
				? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
				: 0
		}
		const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "touch") return
			pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
			rootRef.current?.setPointerCapture(event.pointerId)
			if (
				pointers.current.size === 2 &&
				isEnabled &&
				zoomModeEnabled &&
				canChange &&
				!isChangingView
			) {
				pinchStartDistance.current = pointerDistance()
				pinchStartFactor.current = isZoomedIn ? 1 : 0.5
				pinchStartedZoomedIn.current = isZoomedIn
			}
		}
		const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "touch") {
				showZoomButton()
				return
			}
			if (!pointers.current.has(event.pointerId)) return
			pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
			if (pointers.current.size !== 2 || pinchStartDistance.current <= 0 || !zoomModeEnabled)
				return
			const nextFactor = Math.max(
				0.5,
				Math.min(
					1,
					pinchStartFactor.current * (pointerDistance() / pinchStartDistance.current)
				)
			)
			setGestureFactor(nextFactor)
			event.preventDefault()
			if (pinchStartedZoomedIn.current && nextFactor < 0.9) {
				pinchStartDistance.current = 0
				setActiveView(false)
			} else if (!pinchStartedZoomedIn.current && nextFactor > 0.6) {
				pinchStartDistance.current = 0
				setActiveView(true)
			}
		}
		const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
			pointers.current.delete(event.pointerId)
			if (rootRef.current?.hasPointerCapture(event.pointerId))
				rootRef.current.releasePointerCapture(event.pointerId)
			if (pointers.current.size < 2) {
				pinchStartDistance.current = 0
				if (!isChangingView) setGestureFactor(null)
			}
		}
		useEffect(() => {
			if (
				props.IsZoomedInViewActive !== undefined &&
				props.IsZoomedInViewActive !== isZoomedIn
			)
				setActiveView(Boolean(props.IsZoomedInViewActive))
		}, [props.IsZoomedInViewActive, isZoomedIn])
		useEffect(() => {
			const element = rootRef.current
			if (!element) return
			const handleSemanticZoomRequest = (event: Event) => {
				const request = (event as CustomEvent<WinSemanticZoomRequest>).detail
				setActiveView(!isZoomedIn, request)
				event.stopPropagation()
			}
			element.addEventListener("semanticzoomrequest", handleSemanticZoomRequest)
			return () =>
				element.removeEventListener("semanticzoomrequest", handleSemanticZoomRequest)
		}, [canChange, isEnabled, isZoomedIn])
		useEffect(
			() => () => {
				if (changeTimer.current !== undefined) window.clearTimeout(changeTimer.current)
				if (zoomButtonTimer.current !== undefined)
					window.clearTimeout(zoomButtonTimer.current)
				pointers.current.clear()
			},
			[]
		)
		useImperativeHandle(
			ref,
			() => ({
				ToggleActiveView: (request) => setActiveView(!isZoomedIn, request)
			}),
			[canChange, isEnabled, isZoomedIn]
		)
		const className = typeof props.className === "string" ? props.className : undefined
		const legacyClassName = typeof props.class === "string" ? props.class : undefined
		const rootStyle: WinStyle = {
			...(props.style as WinStyle | undefined),
			...commonStyle(props),
			background: undefined,
			padding: undefined,
			border: 0
		}
		const surfaceStyle: WinStyle = {
			background: props.Background as string | undefined,
			borderColor: props.BorderBrush as string | undefined,
			borderWidth: xamlThickness(props.BorderThickness),
			borderStyle: "solid",
			padding: xamlThickness(props.Padding)
		}
		const zoomedInView = (props.ZoomedInView ?? props.children) as ReactNode
		const zoomedOutView = props.ZoomedOutView as ReactNode
		const zoomOutButtonEnabled = props.IsZoomOutButtonEnabled === true
		const factor = gestureFactor ?? (isZoomedIn ? 1 : 0.5)
		return (
			<div
				ref={rootRef}
				id={typeof props.id === "string" ? props.id : undefined}
				className={cx(
					"win-semantic-zoom",
					isZoomedIn ? "zoomed-in" : "zoomed-out",
					isChangingView ? "is-changing-view" : undefined,
					gestureFactor !== null ? "is-manipulating" : undefined,
					!isEnabled ? "is-disabled" : undefined,
					className,
					legacyClassName
				)}
				style={rootStyle}
				tabIndex={isEnabled && props.IsTabStop ? 0 : -1}
				onKeyDown={(event) => {
					if (!event.ctrlKey || event.altKey || event.metaKey || !isEnabled || !canChange)
						return
					const zoomOut =
						event.key === "-" || event.key === "_" || event.code === "NumpadSubtract"
					const zoomIn =
						event.key === "+" || event.key === "=" || event.code === "NumpadAdd"
					if (zoomOut || zoomIn) {
						const targetIsZoomedIn = zoomIn
						if (targetIsZoomedIn === isZoomedIn) return
						if (setActiveView(targetIsZoomedIn)) {
							event.preventDefault()
							event.stopPropagation()
						}
					}
				}}
				onWheel={(event) => {
					if (!event.ctrlKey || !zoomModeEnabled || !canChange || !isEnabled) return
					const zoomIn = event.deltaY < 0
					if (zoomIn !== isZoomedIn) {
						event.preventDefault()
						setActiveView(zoomIn)
					}
				}}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerEnd}
				onPointerCancel={handlePointerEnd}
			>
				<div className="semantic-zoom-scroll-viewer">
					<div className="semantic-zoom-surface" style={surfaceStyle}>
						<div
							ref={zoomedInPresenterRef}
							className="semantic-zoom-presenter zoomed-in-presenter"
							aria-hidden={!isZoomedIn}
							inert={!isZoomedIn ? true : undefined}
							style={{
								transform: gestureFactor === null ? undefined : `scale(${factor})`
							}}
						>
							{zoomedInView}
						</div>
						<div
							ref={zoomedOutPresenterRef}
							className="semantic-zoom-presenter zoomed-out-presenter"
							aria-hidden={isZoomedIn}
							inert={isZoomedIn ? true : undefined}
							style={{
								transform:
									gestureFactor === null ? undefined : `scale(${factor * 2})`
							}}
						>
							{zoomedOutView}
						</div>
					</div>
				</div>
				{zoomOutButtonEnabled && zoomButtonVisible && (
					<button
						type="button"
						className={cx("zoom-out-button", zoomButtonVisible ? "visible" : undefined)}
						tabIndex={-1}
						disabled={!isEnabled}
						aria-label="Zoom out"
						onClick={() => setActiveView(false)}
					>
						<span aria-hidden="true">{"\uE0B8"}</span>
					</button>
				)}
			</div>
		)
	}
)
