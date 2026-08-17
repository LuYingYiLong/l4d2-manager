// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { callback, commonStyle, cx, domProps } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

export interface WinAnnotatedScrollBarLabel {
	text: ReactNode
	offset: number
}

export interface WinAnnotatedScrollController {
	scrollOffset?: number
	maxScrollOffset?: number
	viewport?: number
}

export interface WinAnnotatedScrollBarHandle {
	scrollTo: (offset: number) => void
	getScrollOffset: () => number
	getMaxScrollOffset: () => number
}

export const WinAnnotatedScrollBar = forwardRef<
	WinAnnotatedScrollBarHandle,
	WinProps & {
		Labels?: WinAnnotatedScrollBarLabel[]
		ScrollController?: WinAnnotatedScrollController | null
		MaxHeight?: number
		disabled?: boolean
	}
>(function WinAnnotatedScrollBar(props, ref): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null)
	const railRef = useRef<HTMLDivElement>(null)
	const [railHeight, setRailHeight] = useState(0)
	const [isPointerOver, setIsPointerOver] = useState(false)
	const [isPressed, setIsPressed] = useState(false)
	const [detailLabel, setDetailLabel] = useState<{
		content: ReactNode
		offset: number
	} | null>(null)
	const dragRef = useRef<{
		pointerId: number
		startY: number
		startScrollOffset: number
	} | null>(null)
	const labelsProp = props.Labels as unknown as WinAnnotatedScrollBarLabel[] | undefined
	const controller = props.ScrollController as unknown as
		WinAnnotatedScrollController | null | undefined
	const maxHeight = props.MaxHeight as unknown as number | undefined
	const horizontalAlignment = props.HorizontalAlignment as unknown as string | undefined
	const className = props.className as unknown as string | undefined
	const legacyClassName = props.class as unknown as string | undefined
	const customStyle = props.style as unknown as WinStyle | undefined

	const labels = useMemo(
		() =>
			(labelsProp ?? [])
				.filter((label) => label && Number.isFinite(Number(label.offset)))
				.map((label) => ({
					...label,
					offset: Math.max(0, Math.min(100, Number(label.offset)))
				})),
		[labelsProp]
	)
	const maxScrollOffset = Math.max(0, Number(controller?.maxScrollOffset ?? 0))
	const scrollOffset = Math.max(
		0,
		Math.min(maxScrollOffset, Number(controller?.scrollOffset ?? 0))
	)
	const scrollRatio = maxScrollOffset === 0 ? 0 : scrollOffset / maxScrollOffset
	const viewport = Math.max(0, Number(controller?.viewport ?? 100))
	const contentSize = viewport + maxScrollOffset
	const rawThumbHeight =
		railHeight > 0 && contentSize > 0 ? (viewport / contentSize) * railHeight : 0
	const thumbHeight = railHeight > 0 ? Math.min(railHeight, Math.max(40, rawThumbHeight)) : 0
	const maxThumbOffset = Math.max(0, railHeight - thumbHeight)
	const thumbOffset = scrollRatio * maxThumbOffset
	const enabled = props.disabled !== true && props.IsEnabled !== false

	useEffect(() => {
		const rail = railRef.current
		if (!rail) return
		const updateSize = () => setRailHeight(rail.clientHeight)
		updateSize()
		if (typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(updateSize)
		observer.observe(rail)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!isPointerOver) setDetailLabel(null)
	}, [isPointerOver])

	const emitScrollOffset = (nextOffset: number) => {
		const clamped = Math.max(0, Math.min(maxScrollOffset, nextOffset))
		callback<number>(props, "scrollOffsetChanged", "ScrollOffsetChanged")?.(clamped)
	}

	const requestDetailLabel = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!enabled || !railRef.current || railHeight <= 0) return
		const rect = railRef.current.getBoundingClientRect()
		const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
		const eventArgs: { ScrollOffset: number; Content: ReactNode | null } = {
			ScrollOffset: ratio * maxScrollOffset,
			Content: null
		}
		callback<typeof eventArgs>(props, "DetailLabelRequested")?.(eventArgs)
		if (eventArgs.Content !== null && eventArgs.Content !== undefined) {
			setDetailLabel({ content: eventArgs.Content, offset: ratio * 100 })
		} else {
			setDetailLabel(null)
		}
	}

	const handleRailClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!enabled || !controller || (event.target as Element).closest(".scrollbar-thumb")) return
		const rect = railRef.current?.getBoundingClientRect()
		if (!rect || rect.height <= 0) return
		const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
		emitScrollOffset(ratio * maxScrollOffset)
	}

	const handleLabelClick = (label: WinAnnotatedScrollBarLabel) => {
		if (!enabled) return
		emitScrollOffset((label.offset / 100) * maxScrollOffset)
	}

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!enabled || !controller || thumbHeight <= 0) return
		event.preventDefault()
		event.currentTarget.setPointerCapture(event.pointerId)
		dragRef.current = {
			pointerId: event.pointerId,
			startY: event.clientY,
			startScrollOffset: scrollOffset
		}
		setIsPressed(true)
	}

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== event.pointerId || maxThumbOffset <= 0) return
		const deltaRatio = (event.clientY - drag.startY) / maxThumbOffset
		emitScrollOffset(drag.startScrollOffset + deltaRatio * maxScrollOffset)
	}

	const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) return
		dragRef.current = null
		setIsPressed(false)
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId)
		}
	}

	const visibleLabels = useMemo(() => {
		if (!Number.isFinite(maxHeight) || railHeight >= Number(maxHeight)) return labels
		const sorted = [...labels].sort((left, right) => left.offset - right.offset)
		const visible: WinAnnotatedScrollBarLabel[] = []
		let lastPosition = -20
		for (const label of sorted) {
			const position = (label.offset / 100) * railHeight
			if (position - lastPosition >= 24) {
				visible.push(label)
				lastPosition = position
			}
		}
		return visible
	}, [labels, maxHeight, railHeight])

	const alignment = {
		Left: "flex-start",
		Center: "center",
		Right: "flex-end",
		Stretch: "stretch"
	}[horizontalAlignment ?? "Stretch"]
	const rootStyle: WinStyle = {
		...commonStyle(props),
		...customStyle,
		...(Number.isFinite(maxHeight) ? { maxHeight: `${maxHeight}px` } : {}),
		alignSelf: alignment
	}

	useImperativeHandle(
		ref,
		() => ({
			scrollTo: emitScrollOffset,
			getScrollOffset: () => scrollOffset,
			getMaxScrollOffset: () => maxScrollOffset
		}),
		[scrollOffset, maxScrollOffset]
	)

	return (
		<div
			ref={containerRef}
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-annotated-scrollbar",
				isPointerOver && enabled ? "is-pointer-over" : undefined,
				isPressed && enabled ? "is-pressed" : undefined,
				!enabled ? "is-disabled" : undefined,
				className,
				legacyClassName
			)}
			style={rootStyle}
			onMouseEnter={() => enabled && setIsPointerOver(true)}
			onMouseLeave={() => {
				setIsPointerOver(false)
				setDetailLabel(null)
			}}
		>
			<div
				ref={railRef}
				className="scrollbar-rail"
				onClick={handleRailClick}
				onPointerMove={requestDetailLabel}
			>
				<div className="scrollbar-labels">
					{visibleLabels.map((label, index) => (
						<div
							key={`${String(label.text)}-${label.offset}-${index}`}
							className="scrollbar-label"
							style={{ top: `${(label.offset / 100) * railHeight}px` }}
							onClick={(event) => {
								event.stopPropagation()
								handleLabelClick(label)
							}}
						>
							{label.text}
						</div>
					))}
				</div>
				<div
					className="scrollbar-thumb"
					style={{
						height: `${thumbHeight}px`,
						transform: `translateY(${thumbOffset}px)`
					}}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerEnd}
					onPointerCancel={handlePointerEnd}
				/>
			</div>
			{detailLabel && (
				<div
					className="detail-label"
					style={{
						top: `${Math.max(10, Math.min(Math.max(10, railHeight - 30), (detailLabel.offset / 100) * railHeight))}px`
					}}
				>
					{detailLabel.content}
				</div>
			)}
		</div>
	)
})
