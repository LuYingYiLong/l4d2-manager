// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { WinButton } from "./winui-primitives"
import { callback, cx, itemLabel, itemsOf, useControllable } from "./winui-shared"
import type { WinChangeProps, WinItemProps, WinValue } from "./winui-shared"

export type WinPickerColumnHandle = {
	flush: () => number
}

export const WinPickerColumn = forwardRef<
	WinPickerColumnHandle,
	WinItemProps &
		WinChangeProps<WinValue> & {
			SelectedIndex?: number
			CanScrollUp?: boolean
			CanScrollDown?: boolean
			canScrollUp?: boolean
			canScrollDown?: boolean
		}
>(function WinPickerColumn(props, ref): React.JSX.Element {
	const items = useMemo(() => itemsOf(props), [props.ItemsSource, props.Items])
	const wrap = props.Wrap !== false
	const selectedExternal: number | undefined =
		typeof props.SelectedIndex === "number"
			? props.SelectedIndex
			: typeof props.value === "number"
				? props.value
				: undefined
	const [selected, setSelected] = useControllable<number>(
		selectedExternal,
		Math.max(0, selectedExternal ?? 0),
		(index) =>
			callback<number>(props, "onValueChange", "onUpdate:SelectedIndex", "onChange")?.(index)
	)
	const scrollRef = useRef<HTMLDivElement>(null)
	const maskRef = useRef<HTMLDivElement>(null)
	const settleTimer = useRef<number | undefined>(undefined)
	const backstopTimer = useRef<number | undefined>(undefined)
	const repeatDelayTimer = useRef<number | undefined>(undefined)
	const repeatTimer = useRef<number | undefined>(undefined)
	const rebasingRef = useRef(false)
	const animationFrameRef = useRef<number>(0)
	const animationTargetRef = useRef<number | null>(null)
	const animatingRef = useRef(false)
	const lastEmittedRef = useRef(-1)
	const selfChangeRef = useRef(false)
	const gestureRef = useRef({
		gestureMode: "none" as "none" | "mouse" | "trackpad" | "touch",
		lastWheelTime: 0,
		lastScrollTime: 0,
		eventCount: 0,
		wheelAccum: 0,
		touchContact: false,
		touchContactActive: false,
		lastTouchPointerTime: 0,
		momentumDetected: false,
		fingerOffConfirmed: false,
		ownScrollPending: 0
	})
	const [scrollTop, setScrollTop] = useState(0)
	const [settled, setSettled] = useState(false)
	const [settledSlot, setSettledSlot] = useState(-1)
	const itemHeight = 40
	const visibleItems = 7
	const columnsHeight = visibleItems * itemHeight
	const offset = (columnsHeight - itemHeight) / 2
	const blockHeight = Math.max(itemHeight, items.length * itemHeight)
	const middleBlock = wrap ? Math.max(2, Math.ceil(offset / blockHeight) + 1) : 0
	const repeatCount = wrap
		? middleBlock + 1 + Math.ceil((columnsHeight - offset) / blockHeight)
		: 0
	const slotCount = wrap
		? Math.max(1, items.length * repeatCount)
		: Math.max(visibleItems + 2, items.length)
	const startSlot = wrap ? 0 : Math.max(0, Math.ceil((slotCount - items.length) / 2))
	const base = wrap ? middleBlock * blockHeight - offset : -offset
	const contentHeight = slotCount * itemHeight
	const scrollEndActive =
		typeof window !== "undefined" &&
		("onscrollend" in window ||
			(typeof Element !== "undefined" &&
				("onscrollend" in Element.prototype || "scrollend" in Element.prototype)))
	const clampIndex = (index: number) =>
		Math.max(0, Math.min(Math.max(0, items.length - 1), index))
	const wrapIndex = (index: number) =>
		items.length === 0 ? 0 : ((index % items.length) + items.length) % items.length
	const scrollTopForIndex = (index: number) => {
		const logicalIndex = wrap ? wrapIndex(index) : clampIndex(index)
		return wrap
			? base + logicalIndex * itemHeight
			: (startSlot + logicalIndex) * itemHeight - offset
	}
	const pickTargetCopy = (from: number, absoluteTarget: number, direction: number) => {
		if (!wrap) return absoluteTarget
		const reachable: number[] = []
		const maxScroll = slotCount * itemHeight - columnsHeight
		for (let copy = -1; copy <= 1; copy += 1) {
			const target = absoluteTarget + copy * blockHeight
			if (target >= 0 && target <= maxScroll) reachable.push(target)
		}
		let best: number | null = null
		for (const target of reachable) {
			if (direction > 0 && target < from) continue
			if (direction < 0 && target > from) continue
			if (best === null || Math.abs(target - from) < Math.abs(best - from)) best = target
		}
		if (best === null) {
			for (const target of reachable) {
				if (best === null || Math.abs(target - from) < Math.abs(best - from)) best = target
			}
		}
		return best ?? absoluteTarget
	}
	const rawFloat = () => {
		if (!scrollRef.current || !wrap) return 0
		return (scrollRef.current.scrollTop - base) / itemHeight
	}
	const selectedIndex = () => {
		if (!scrollRef.current || items.length === 0) return 0
		const current = scrollRef.current.scrollTop
		if (wrap) return wrapIndex(Math.round((current - base) / itemHeight))
		const rawSlot = Math.round((current + offset) / itemHeight)
		return clampIndex(
			Math.max(startSlot, Math.min(startSlot + items.length - 1, rawSlot)) - startSlot
		)
	}
	const syncMask = () => {
		if (!scrollRef.current || !maskRef.current) return
		maskRef.current.style.transform = `translate3d(0, ${-scrollRef.current.scrollTop}px, 0)`
		setScrollTop(scrollRef.current.scrollTop)
	}
	const rebaseScroll = () => {
		if (!scrollRef.current || !wrap || items.length === 0 || rebasingRef.current) return
		const current = scrollRef.current.scrollTop
		const lowerBound = base - blockHeight
		const upperBound = base + blockHeight
		let next = current
		if (current < lowerBound) next = current + blockHeight
		else if (current > upperBound) next = current - blockHeight
		if (next === current) return
		rebasingRef.current = true
		gestureRef.current.ownScrollPending += 1
		scrollRef.current.scrollTop = next
		rebasingRef.current = false
	}
	const cancelBackstop = () => {
		window.clearTimeout(backstopTimer.current)
		backstopTimer.current = undefined
	}
	const cancelSnap = () => {
		window.clearTimeout(settleTimer.current)
		settleTimer.current = undefined
	}
	const interruptScroll = () => {
		cancelAnimationFrame(animationFrameRef.current)
		animationFrameRef.current = 0
		animatingRef.current = false
		animationTargetRef.current = null
		gestureRef.current.ownScrollPending = 0
		cancelSnap()
		cancelBackstop()
		setSettled(false)
		setSettledSlot(-1)
	}
	const setSettledState = () => {
		if (!scrollRef.current || slotCount <= 0) return
		setSettled(true)
		setSettledSlot(
			((Math.round((scrollRef.current.scrollTop + offset) / itemHeight) % slotCount) +
				slotCount) %
				slotCount
		)
	}
	const emitChange = (index: number) => {
		selfChangeRef.current = index !== selected
		lastEmittedRef.current = index
		setSelected(index)
	}
	const emitSettledChange = () => {
		const index = selectedIndex()
		if (index !== lastEmittedRef.current) emitChange(index)
		setSettledState()
	}
	const finishAnimation = () => {
		if (!scrollRef.current) return
		rebaseScroll()
		syncMask()
		animationTargetRef.current = wrap
			? Math.round((scrollRef.current.scrollTop - base) / itemHeight)
			: null
		emitSettledChange()
	}
	const animateTo = (target: number, duration: number) => {
		if (!scrollRef.current || items.length === 0) return
		cancelAnimationFrame(animationFrameRef.current)
		cancelSnap()
		setSettled(false)
		setSettledSlot(-1)
		const from = scrollRef.current.scrollTop
		if (Math.abs(target - from) < 1) {
			scrollRef.current.scrollTop = target
			gestureRef.current.ownScrollPending += 1
			animatingRef.current = false
			finishAnimation()
			return
		}
		animatingRef.current = true
		gestureRef.current.ownScrollPending += 1
		const startedAt = performance.now()
		const frame = (now: number) => {
			const progress = Math.min(1, (now - startedAt) / duration)
			const eased = 1 - Math.pow(1 - progress, 3)
			if (scrollRef.current) scrollRef.current.scrollTop = from + (target - from) * eased
			syncMask()
			if (progress < 1) animationFrameRef.current = requestAnimationFrame(frame)
			else {
				animatingRef.current = false
				finishAnimation()
			}
		}
		animationFrameRef.current = requestAnimationFrame(frame)
	}
	const snapToNearest = () => {
		if (!scrollRef.current || items.length === 0) return
		const target = wrap
			? base + Math.round(rawFloat()) * itemHeight
			: scrollTopForIndex(selectedIndex())
		animateTo(target, 120)
	}
	const scheduleBackstop = () => {
		if (!scrollEndActive) return
		cancelBackstop()
		backstopTimer.current = window.setTimeout(() => {
			backstopTimer.current = undefined
			if (gestureRef.current.ownScrollPending > 0 || animatingRef.current) return
			rebaseScroll()
			syncMask()
			snapToNearest()
		}, 3000)
	}
	const onScrollEnd = () => {
		if (!scrollEndActive) return
		if (gestureRef.current.ownScrollPending > 0) {
			gestureRef.current.ownScrollPending -= 1
			return
		}
		cancelBackstop()
		if (animatingRef.current || gestureRef.current.gestureMode === "mouse") return
		cancelSnap()
		setSettled(false)
		setSettledSlot(-1)
		rebaseScroll()
		syncMask()
		snapToNearest()
	}
	const onScroll = () => {
		const gesture = gestureRef.current
		const now = performance.now()
		gesture.lastScrollTime = now
		if (gesture.gestureMode === "touch") {
			if (gesture.fingerOffConfirmed) gesture.momentumDetected = true
		} else if (gesture.gestureMode === "trackpad" && now - gesture.lastWheelTime > 40) {
			gesture.momentumDetected = true
		}
		if (!animatingRef.current && !scrollEndActive) rebaseScroll()
		syncMask()
		if (scrollEndActive) {
			if (!animatingRef.current && gesture.ownScrollPending === 0) {
				setSettled(false)
				setSettledSlot(-1)
				scheduleBackstop()
			}
			return
		}
		if (gesture.gestureMode === "trackpad" && !animatingRef.current) scheduleSnap()
	}
	const maybeSnap = () => {
		const gesture = gestureRef.current
		if (
			(gesture.gestureMode !== "trackpad" && gesture.gestureMode !== "touch") ||
			animatingRef.current ||
			!scrollRef.current ||
			items.length === 0
		)
			return
		const now = performance.now()
		if (gesture.touchContactActive && now - gesture.lastTouchPointerTime > 3000)
			gesture.touchContactActive = false
		const fingerStillDown = gesture.touchContactActive && gesture.touchContact
		const idleNeeded = gesture.fingerOffConfirmed
			? gesture.momentumDetected
				? 80
				: 0
			: gesture.momentumDetected
				? 80
				: 800
		const quiet =
			now - gesture.lastScrollTime >= idleNeeded && now - gesture.lastWheelTime >= idleNeeded
		const touchLiftGrace =
			gesture.gestureMode === "touch" &&
			gesture.fingerOffConfirmed &&
			!gesture.momentumDetected
				? now - gesture.lastScrollTime >= 120
				: true
		if (fingerStillDown || !quiet || !touchLiftGrace) {
			settleTimer.current = window.setTimeout(maybeSnap, 50)
			return
		}
		if (settled && selectedIndex() === lastEmittedRef.current) return
		const target = wrap
			? base + Math.round(rawFloat()) * itemHeight
			: scrollTopForIndex(selectedIndex())
		animateTo(target, 120)
	}
	const scheduleSnap = () => {
		cancelSnap()
		settleTimer.current = window.setTimeout(maybeSnap, 50)
	}
	const step = (direction: number) => {
		if (!scrollRef.current || items.length === 0) return
		if (wrap) {
			const raw =
				animationTargetRef.current !== null
					? animationTargetRef.current + direction
					: Math.round(rawFloat()) + direction
			const target = pickTargetCopy(
				scrollRef.current.scrollTop,
				base + raw * itemHeight,
				direction
			)
			animationTargetRef.current = Math.round((target - base) / itemHeight)
			animateTo(target, 150)
		} else {
			const current =
				animationTargetRef.current !== null ? animationTargetRef.current : selectedIndex()
			const target = clampIndex(current + direction)
			if (target === current) return
			animationTargetRef.current = target
			animateTo(scrollTopForIndex(target), 150)
		}
	}
	const scrollToSlot = (slot: number) => {
		if (!scrollRef.current) return
		const from = scrollRef.current.scrollTop
		const target = slot * itemHeight - offset
		const direction = target >= from ? 1 : -1
		const finalTarget = pickTargetCopy(from, target, direction)
		animationTargetRef.current = null
		animateTo(finalTarget, Math.min(400, 150 + Math.abs(finalTarget - from) * 0.25))
	}
	const wheelDeltaPx = (event: WheelEvent) => {
		if (event.deltaMode === 1) return event.deltaY * 16
		if (event.deltaMode === 2) return event.deltaY * columnsHeight
		return event.deltaY
	}
	const onWheel = (event: WheelEvent) => {
		const gesture = gestureRef.current
		interruptScroll()
		gesture.touchContact = true
		gesture.fingerOffConfirmed = false
		gesture.momentumDetected = false
		const now = performance.now()
		if (gesture.touchContactActive && now - gesture.lastTouchPointerTime > 3000)
			gesture.touchContactActive = false
		if (now - gesture.lastWheelTime > 400) {
			gesture.gestureMode = "none"
			gesture.wheelAccum = 0
			gesture.eventCount = 0
		}
		gesture.lastWheelTime = now
		gesture.eventCount += 1
		const delta = wheelDeltaPx(event)
		if (gesture.gestureMode === "none")
			gesture.gestureMode = Math.abs(delta) >= 40 ? "mouse" : "trackpad"
		else if (gesture.gestureMode === "mouse" && gesture.eventCount >= 6 && Math.abs(delta) < 25)
			gesture.gestureMode = "trackpad"
		if (gesture.gestureMode === "mouse") {
			event.preventDefault()
			cancelSnap()
			if (Math.abs(delta) >= 40) {
				step(delta > 0 ? 1 : -1)
				gesture.wheelAccum = 0
			} else {
				gesture.wheelAccum += delta
				if (Math.abs(gesture.wheelAccum) >= itemHeight) {
					step(gesture.wheelAccum > 0 ? 1 : -1)
					gesture.wheelAccum = 0
				}
			}
		}
	}
	const isContactPointer = (event: PointerEvent) =>
		event.pointerType === "touch" ||
		event.pointerType === "pen" ||
		event.pointerType === "touchpad"
	const onPointerDown = (event: PointerEvent) => {
		if (!isContactPointer(event)) return
		interruptScroll()
		const gesture = gestureRef.current
		gesture.lastTouchPointerTime = performance.now()
		gesture.touchContactActive = true
		gesture.touchContact = true
		gesture.fingerOffConfirmed = false
		gesture.momentumDetected = false
		if (event.pointerType === "touch" || event.pointerType === "pen")
			gesture.gestureMode = "touch"
	}
	const onPointerMove = (event: PointerEvent) => {
		if (!isContactPointer(event)) return
		if (event.pointerType !== "touchpad" && event.buttons === 0) return
		interruptScroll()
		const gesture = gestureRef.current
		gesture.lastTouchPointerTime = performance.now()
		gesture.touchContactActive = true
		gesture.touchContact = true
	}
	const onPointerUp = (event: PointerEvent) => {
		if (!isContactPointer(event)) return
		const gesture = gestureRef.current
		gesture.lastTouchPointerTime = performance.now()
		gesture.touchContactActive = true
		gesture.touchContact = false
		gesture.fingerOffConfirmed = true
		cancelBackstop()
		if (gesture.gestureMode === "touch" || gesture.gestureMode === "trackpad") scheduleSnap()
	}
	const jumpToValue = () => {
		if (!scrollRef.current || items.length === 0) return
		cancelAnimationFrame(animationFrameRef.current)
		animationFrameRef.current = 0
		cancelSnap()
		cancelBackstop()
		animatingRef.current = false
		animationTargetRef.current = null
		gestureRef.current.ownScrollPending += 1
		scrollRef.current.scrollTop = scrollTopForIndex(selected)
		syncMask()
		lastEmittedRef.current = selected
		setSettledState()
	}
	const flush = () => {
		cancelAnimationFrame(animationFrameRef.current)
		animationFrameRef.current = 0
		cancelSnap()
		cancelBackstop()
		animatingRef.current = false
		animationTargetRef.current = null
		const index = selectedIndex()
		if (index !== lastEmittedRef.current) emitChange(index)
		setSettledState()
		return index
	}
	const stopRepeating = () => {
		if (repeatDelayTimer.current !== undefined) {
			window.clearTimeout(repeatDelayTimer.current)
			repeatDelayTimer.current = undefined
		}
		if (repeatTimer.current !== undefined) {
			window.clearInterval(repeatTimer.current)
			repeatTimer.current = undefined
		}
	}
	const startRepeating = (direction: number) => {
		stopRepeating()
		repeatDelayTimer.current = window.setTimeout(() => {
			repeatTimer.current = window.setInterval(() => step(direction), 80)
		}, 400)
	}
	useEffect(() => {
		if (selfChangeRef.current) selfChangeRef.current = false
		else jumpToValue()
		return () => {
			window.clearTimeout(settleTimer.current)
			cancelBackstop()
			stopRepeating()
		}
	}, [items.length, selected])
	useEffect(() => {
		const element = scrollRef.current
		if (!element) return undefined
		element.addEventListener("wheel", onWheel, { passive: false })
		if (scrollEndActive) element.addEventListener("scrollend", onScrollEnd)
		window.addEventListener("pointerdown", onPointerDown, true)
		window.addEventListener("pointermove", onPointerMove, true)
		window.addEventListener("pointerup", onPointerUp, true)
		window.addEventListener("pointercancel", onPointerUp, true)
		return () => {
			element.removeEventListener("wheel", onWheel)
			if (scrollEndActive) element.removeEventListener("scrollend", onScrollEnd)
			window.removeEventListener("pointerdown", onPointerDown, true)
			window.removeEventListener("pointermove", onPointerMove, true)
			window.removeEventListener("pointerup", onPointerUp, true)
			window.removeEventListener("pointercancel", onPointerUp, true)
			cancelAnimationFrame(animationFrameRef.current)
			cancelSnap()
			cancelBackstop()
			stopRepeating()
		}
	}, [items.length, selected, scrollEndActive])
	useImperativeHandle(ref, () => ({ flush }), [items.length, selected])
	const renderedItems = Array.from({ length: slotCount }, (_, index) => {
		if (wrap) return items.length > 0 ? items[index % items.length] : ""
		const itemIndex = index - startSlot
		return itemIndex >= 0 && itemIndex < items.length ? items[itemIndex] : ""
	})
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const canScrollUp = Boolean(props.CanScrollUp ?? props.canScrollUp ?? true)
	const canScrollDown = Boolean(props.CanScrollDown ?? props.canScrollDown ?? true)
	return (
		<div className={cx("picker-col-root", "win-picker-column", className, legacyClassName)}>
			<WinButton
				className={cx(
					"picker-arrow picker-arrow-up",
					!canScrollUp ? "picker-arrow-hidden" : undefined
				)}
				Style="SubtleButtonStyle"
				Padding="0"
				MinWidth="0"
				MinHeight="0"
				CornerRadius="0"
				FontSize="8"
				IsEnabled={canScrollUp}
				aria-label="Previous"
				onPointerDown={() => startRepeating(-1)}
				onPointerUp={stopRepeating}
				onPointerCancel={stopRepeating}
				onPointerLeave={stopRepeating}
				onClick={() => step(-1)}
			>
				<span className="icon" aria-hidden="true">
					{"\uEDDB"}
				</span>
			</WinButton>
			<div
				ref={scrollRef}
				className="picker-col-scroll"
				tabIndex={0}
				role="listbox"
				aria-label={String(props.AriaLabel ?? "")}
				onScroll={onScroll}
				onKeyDown={(event) => {
					if (event.key === "ArrowUp") {
						event.preventDefault()
						if (canScrollUp) step(-1)
					} else if (event.key === "ArrowDown") {
						event.preventDefault()
						if (canScrollDown) step(1)
					}
				}}
			>
				<div className="picker-list" style={{ height: contentHeight }}>
					{renderedItems.map((item, index) => (
						<div
							key={`${index}-${itemLabel(item)}`}
							className="picker-item"
							role="option"
							onClick={() => scrollToSlot(index)}
						>
							{itemLabel(item)}
						</div>
					))}
				</div>
			</div>
			<div className="picker-mask" aria-hidden="true">
				<div
					ref={maskRef}
					className="picker-mask-list"
					style={{
						height: contentHeight,
						transform: `translate3d(0, ${-scrollTop}px, 0)`
					}}
				>
					{renderedItems.map((item, index) => (
						<div
							key={`mask-${index}-${itemLabel(item)}`}
							className={cx(
								"picker-item",
								"picker-mask-item",
								settled && settledSlot === index ? "settled" : undefined
							)}
						>
							{itemLabel(item)}
						</div>
					))}
				</div>
			</div>
			<WinButton
				className={cx(
					"picker-arrow picker-arrow-down",
					!canScrollDown ? "picker-arrow-hidden" : undefined
				)}
				Style="SubtleButtonStyle"
				Padding="0"
				MinWidth="0"
				MinHeight="0"
				CornerRadius="0"
				FontSize="8"
				IsEnabled={canScrollDown}
				aria-label="Next"
				onPointerDown={() => startRepeating(1)}
				onPointerUp={stopRepeating}
				onPointerCancel={stopRepeating}
				onPointerLeave={stopRepeating}
				onClick={() => step(1)}
			>
				<span className="icon" aria-hidden="true">
					{"\uEDDC"}
				</span>
			</WinButton>
		</div>
	)
})
