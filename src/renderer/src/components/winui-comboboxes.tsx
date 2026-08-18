// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinTextBlock } from "./winui-primitives"
import { WinTextBox } from "./winui-inputs"
import { WinScrollViewer } from "./winui-scrolling"
import { callback, commonStyle, cx, domProps, itemLabel, itemsOf } from "./winui-shared"
import type {
	WinChangeProps,
	WinItem,
	WinItemProps,
	WinProps,
	WinStyle,
	WinValue
} from "./winui-shared"

type ComboFlyoutDirection = "top" | "bottom"
const comboFlyoutShadowDelay = 160
const comboFlyoutClipMargin = 32

type ComboFlyoutRect = {
	left: number
	top: number
	right: number
	bottom: number
}

export type WinComboBoxProbePhase =
	| "pointer-down"
	| "pointer-up"
	| "pointer-cancel"
	| "click"
	| "open-request"
	| "open-state"
	| "position-request"
	| "position-run"
	| "position-result"
	| "reveal-queued"
	| "reveal-frame"
	| "reveal-start"
	| "reveal-sample"
	| "reveal-finish"
	| "reveal-cancel"
	| "reveal-skipped"

export type WinComboBoxProbeEvent = {
	sequence: number
	elapsed: number
	phase: WinComboBoxProbePhase
	cycle: number
	open: boolean
	flyoutReady: boolean
	detail?: Record<string, boolean | number | string | null>
}

const comboFlyoutClamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value))

const comboFlyoutClipPath = (rect: ComboFlyoutRect) =>
	`polygon(${rect.left}px ${rect.top}px, ${rect.right}px ${rect.top}px, ${rect.right}px ${rect.bottom}px, ${rect.left}px ${rect.bottom}px)`

const getComboFlyoutStartRect = (
	flyout: HTMLElement,
	originElement: HTMLElement | null,
	direction: ComboFlyoutDirection,
	stripSize = 36
): ComboFlyoutRect => {
	const flyoutRect = flyout.getBoundingClientRect()
	const width = flyoutRect.width
	const height = flyoutRect.height
	if (originElement) {
		const originRect = originElement.getBoundingClientRect()
		return {
			left: comboFlyoutClamp(originRect.left - flyoutRect.left, 0, width),
			top: comboFlyoutClamp(originRect.top - flyoutRect.top, 0, height),
			right: comboFlyoutClamp(originRect.right - flyoutRect.left, 0, width),
			bottom: comboFlyoutClamp(originRect.bottom - flyoutRect.top, 0, height)
		}
	}
	if (direction === "bottom") {
		return {
			left: 0,
			top: Math.max(0, height - stripSize),
			right: width,
			bottom: height
		}
	}
	return {
		left: 0,
		top: 0,
		right: width,
		bottom: Math.min(height, stripSize)
	}
}

const playComboFlyoutReveal = (
	flyout: HTMLElement,
	originElement: HTMLElement | null,
	direction: ComboFlyoutDirection
): Animation | undefined => {
	if (typeof flyout.animate !== "function") {
		flyout.style.clipPath = ""
		return undefined
	}
	const width = flyout.getBoundingClientRect().width
	const height = flyout.getBoundingClientRect().height
	if (width <= 0 || height <= 0) return undefined
	const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	if (reducedMotion) {
		flyout.style.clipPath = ""
		return undefined
	}
	const startRect = getComboFlyoutStartRect(flyout, originElement, direction)
	const endRect = {
		left: -comboFlyoutClipMargin,
		top: -comboFlyoutClipMargin,
		right: width + comboFlyoutClipMargin,
		bottom: height + comboFlyoutClipMargin
	}
	const startClipPath = comboFlyoutClipPath(startRect)
	const endClipPath = comboFlyoutClipPath(endRect)
	flyout.style.willChange = "clip-path"
	const animation = flyout.animate([{ clipPath: startClipPath }, { clipPath: endClipPath }], {
		duration: 800,
		easing: "cubic-bezier(0.092, 1.003, 0.028, 0.997)",
		fill: "none"
	})
	return animation
}

export function WinComboBox(
	props: WinItemProps &
		WinChangeProps<WinValue> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			SelectedValue?: WinValue
			SelectedValuePath?: string
			DisplayMemberPath?: string
			IsDropDownOpen?: boolean
			IsEditable?: boolean
			MaxDropDownHeight?: number
			PlaceholderText?: string
			DebugProbe?: (event: WinComboBoxProbeEvent) => void
		}
): React.JSX.Element {
	const items = useMemo(() => itemsOf(props), [props.ItemsSource, props.Items])
	const comboId = useId().replace(/:/g, "")
	const comboRef = useRef<HTMLDivElement>(null)
	const editableRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const displayRef = useRef<HTMLButtonElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const flyoutRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
	const getPathValue = (item: WinItem, path?: string): unknown => {
		if (!path) return item
		return path.split(".").reduce<unknown>((value, key) => {
			if (value && typeof value === "object") return (value as Record<string, unknown>)[key]
			return undefined
		}, item)
	}
	const getLabel = (item: WinItem): ReactNode => {
		const value = getPathValue(item, props.DisplayMemberPath)
		if (value === null || value === undefined) return ""
		if (typeof value !== "object") return String(value)
		return itemLabel(value as WinItem)
	}
	const findSelectedValueIndex = (value: WinValue) =>
		items.findIndex((item) => Object.is(getPathValue(item, props.SelectedValuePath), value))
	const initialSelectedIndex =
		props.SelectedIndex ??
		(typeof props.value === "number"
			? props.value
			: props.SelectedItem !== undefined
				? items.findIndex((item) => Object.is(item, props.SelectedItem))
				: props.SelectedValue !== undefined
					? findSelectedValueIndex(props.SelectedValue)
					: -1)
	const [selected, setSelected] = useState(initialSelectedIndex >= 0 ? initialSelectedIndex : -1)
	const [open, setOpen] = useState(props.IsDropDownOpen ?? props.IsOpen ?? props.Open ?? false)
	const chevronRef = useRef<HTMLSpanElement>(null)
	const chevronPressed = useRef(false)
	const chevronPressDone = useRef(false)
	const [position, setPosition] = useState({
		top: 0,
		left: 0,
		width: 0,
		maxHeight: 324,
		opensUp: false,
		maxWidth: 0
	})
	const positionRef = useRef(position)
	const positionFrameRef = useRef<number | null>(null)
	const [flyoutReady, setFlyoutReady] = useState(false)
	const [inputDeviceType, setInputDeviceType] = useState<"Mouse" | "Touch" | "Keyboard">("Mouse")
	const [currentText, setCurrentText] = useState(
		props.Text === undefined || props.Text === null ? "" : String(props.Text)
	)
	const [isEditing, setIsEditing] = useState(false)
	const [highlightedIndex, setHighlightedIndex] = useState(-1)
	const comboRevealRef = useRef<Animation | null>(null)
	const comboShadowTimerRef = useRef<number | null>(null)
	const revealSampleFrameRef = useRef<number | null>(null)
	const pendingRevealRef = useRef(false)
	const revealCycleRef = useRef(0)
	const revealScheduledCycleRef = useRef<number | null>(null)
	const revealStartedCycleRef = useRef<number | null>(null)
	const previousOpenRef = useRef(false)
	const probeSequenceRef = useRef(0)
	const probeStartedAtRef = useRef(
		typeof performance === "undefined" ? Date.now() : performance.now()
	)
	const selectedItem = selected >= 0 ? items[selected] : undefined
	const visibleIndexes = items.map((_, index) => index)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const emitProbe = (phase: WinComboBoxProbePhase, detail?: WinComboBoxProbeEvent["detail"]) => {
		if (!props.DebugProbe) return
		const now = typeof performance === "undefined" ? Date.now() : performance.now()
		probeSequenceRef.current += 1
		props.DebugProbe({
			sequence: probeSequenceRef.current,
			elapsed: now - probeStartedAtRef.current,
			phase,
			cycle: revealCycleRef.current,
			open,
			flyoutReady,
			detail
		})
	}
	const invalidateComboFlyoutReveal = () => {
		revealCycleRef.current += 1
		revealScheduledCycleRef.current = null
		pendingRevealRef.current = false
	}
	const clearComboFlyoutClipPath = () => {
		if (!flyoutRef.current) return
		flyoutRef.current.style.clipPath = ""
		flyoutRef.current.style.willChange = ""
	}
	const setComboFlyoutShadowVisible = (visible: boolean) => {
		flyoutRef.current?.classList.toggle("combo-flyout-shadow-visible", visible)
	}
	const clearComboFlyoutShadowTimer = () => {
		if (comboShadowTimerRef.current === null) return
		window.clearTimeout(comboShadowTimerRef.current)
		comboShadowTimerRef.current = null
	}
	const stopRevealSampling = () => {
		if (revealSampleFrameRef.current === null) return
		cancelAnimationFrame(revealSampleFrameRef.current)
		revealSampleFrameRef.current = null
	}
	const cancelComboFlyoutReveal = (reason: string) => {
		stopRevealSampling()
		clearComboFlyoutShadowTimer()
		const current = comboRevealRef.current
		comboRevealRef.current = null
		if (current) {
			current.cancel()
			emitProbe("reveal-cancel", { reason })
		}
		clearComboFlyoutClipPath()
		setComboFlyoutShadowVisible(reason.startsWith("position-changed"))
	}
	const startComboFlyoutReveal = (cycle = revealCycleRef.current) => {
		if (cycle !== revealCycleRef.current || revealStartedCycleRef.current === cycle) return
		const flyout = flyoutRef.current
		if (!flyout) return
		revealStartedCycleRef.current = cycle
		setComboFlyoutShadowVisible(false)
		cancelComboFlyoutReveal("superseded-before-start")
		const selectedIndex = visibleIndexes.includes(selected)
			? selected
			: Math.floor(visibleIndexes.length / 2)
		const originElement = props.IsEditable ? null : (itemRefs.current[selectedIndex] ?? null)
		const current = playComboFlyoutReveal(
			flyout,
			originElement,
			positionRef.current.opensUp ? "bottom" : "top"
		)
		if (!current) {
			setComboFlyoutShadowVisible(true)
			emitProbe("reveal-skipped", { reason: "animation-unavailable" })
			return
		}
		comboRevealRef.current = current
		comboShadowTimerRef.current = window.setTimeout(() => {
			comboShadowTimerRef.current = null
			if (comboRevealRef.current === current) setComboFlyoutShadowVisible(true)
		}, comboFlyoutShadowDelay)
		emitProbe("reveal-start", {
			direction: positionRef.current.opensUp ? "bottom" : "top",
			selectedIndex,
			animationCount: flyout.getAnimations().length
		})
		let lastSampleBucket = -1
		let lastCurrentTime = -1
		const sampleAnimation = () => {
			if (comboRevealRef.current !== current) return
			const currentTime = Number(current.currentTime ?? 0)
			const sampleBucket = Math.min(4, Math.floor((currentTime / 800) * 4))
			const timeWentBackwards = lastCurrentTime >= 0 && currentTime + 1 < lastCurrentTime
			if (sampleBucket > lastSampleBucket || timeWentBackwards) {
				lastSampleBucket = sampleBucket
				emitProbe("reveal-sample", {
					currentTime: Math.round(currentTime),
					progress: Math.round((currentTime / 800) * 100),
					animationCount: flyout.getAnimations().length,
					timeWentBackwards
				})
			}
			lastCurrentTime = currentTime
			revealSampleFrameRef.current = requestAnimationFrame(sampleAnimation)
		}
		sampleAnimation()
		current.onfinish = () => {
			if (comboRevealRef.current !== current) return
			comboRevealRef.current = null
			stopRevealSampling()
			clearComboFlyoutShadowTimer()
			clearComboFlyoutClipPath()
			setComboFlyoutShadowVisible(true)
			emitProbe("reveal-finish", { animationCount: flyout.getAnimations().length })
		}
		current.oncancel = () => {
			if (comboRevealRef.current !== current) return
			comboRevealRef.current = null
			stopRevealSampling()
			clearComboFlyoutShadowTimer()
			clearComboFlyoutClipPath()
			setComboFlyoutShadowVisible(false)
			emitProbe("reveal-cancel", { reason: "animation-cancelled-externally" })
		}
	}
	const onInputKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
		setInputDeviceType("Keyboard")
		if (event.key !== "Escape" || !open) return
		event.preventDefault()
		setOpenState(false)
		setIsEditing(false)
		requestAnimationFrame(focusDisplay)
	}
	const onPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
		setInputDeviceType(event.pointerType === "touch" ? "Touch" : "Mouse")
		emitProbe("pointer-down", {
			pointerType: event.pointerType,
			button: event.button,
			target:
				event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : "unknown"
		})
	}
	const onPointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
		emitProbe("pointer-up", {
			pointerType: event.pointerType,
			button: event.button,
			target:
				event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : "unknown"
		})
	}
	const onPointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
		emitProbe("pointer-cancel", {
			pointerType: event.pointerType,
			target:
				event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : "unknown"
		})
	}
	const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
		emitProbe("click", {
			detail: event.detail,
			target:
				event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : "unknown"
		})
	}
	const focusDisplay = () => {
		if (props.IsEditable) displayRef.current?.focus()
		else buttonRef.current?.focus()
	}
	const getItemLayoutHeight = (visibleIndex: number) => {
		const itemIndex = visibleIndexes[visibleIndex]
		const item = itemIndex === undefined ? undefined : itemRefs.current[itemIndex]
		if (!item || typeof window === "undefined") return inputDeviceType === "Touch" ? 48 : 36
		const style = window.getComputedStyle(item)
		return (
			item.getBoundingClientRect().height +
			Number.parseFloat(style.marginTop || "0") +
			Number.parseFloat(style.marginBottom || "0")
		)
	}
	const updatePosition = (source = "direct") => {
		const anchor = props.IsEditable ? editableRef.current : buttonRef.current
		if (!anchor || typeof window === "undefined") return
		emitProbe("position-run", { source })
		const rect = anchor.getBoundingClientRect()
		const maxPopupHeight = Math.min(props.MaxDropDownHeight ?? 504, window.innerHeight)
		const itemCount = visibleIndexes.length
		let popupTop = props.IsEditable ? rect.bottom : rect.top
		let popupHeight = Math.min(
			maxPopupHeight,
			Math.max(
				inputDeviceType === "Touch" ? 48 : 36,
				itemCount * (inputDeviceType === "Touch" ? 48 : 36) + 8
			)
		)
		if (!props.IsEditable && itemCount > 0) {
			let centerIndex = visibleIndexes.indexOf(selected)
			if (centerIndex < 0) centerIndex = Math.floor(itemCount / 2)
			if (rect.bottom >= window.innerHeight) {
				popupTop = window.innerHeight - rect.height
			}
			let currentItemHeight = getItemLayoutHeight(centerIndex)
			let layoutTop = Math.max(popupTop + rect.height / 2 - currentItemHeight / 2 - 4, 0)
			const upperLimit = Math.max(popupTop + rect.height / 2 - maxPopupHeight / 2, 0)
			let layoutBottom = Math.min(layoutTop + currentItemHeight + 8, window.innerHeight)
			const lowerLimit = Math.min(upperLimit + maxPopupHeight, window.innerHeight)
			let itemIndexAbove = centerIndex - 1
			let itemIndexBelow = centerIndex + 1
			let totalItems = 1
			const maxItemsOnSide = Math.min(4, itemCount)
			const maxItems = Math.min(9, itemCount)
			if (layoutTop + currentItemHeight + 8 > window.innerHeight) {
				layoutTop = Math.max(
					layoutTop - (layoutTop + currentItemHeight + 8 - window.innerHeight),
					0
				)
			}
			while (itemIndexAbove >= 0 && totalItems < maxItemsOnSide) {
				currentItemHeight = getItemLayoutHeight(itemIndexAbove)
				if (layoutTop - currentItemHeight < upperLimit) break
				layoutTop -= currentItemHeight
				totalItems += 1
				itemIndexAbove -= 1
			}
			while (itemIndexBelow < itemCount && totalItems < maxItems) {
				currentItemHeight = getItemLayoutHeight(itemIndexBelow)
				if (
					layoutBottom + currentItemHeight >= lowerLimit ||
					layoutBottom - layoutTop >= maxPopupHeight
				)
					break
				layoutBottom += currentItemHeight
				totalItems += 1
				itemIndexBelow += 1
			}
			while ((itemIndexAbove >= 0 || itemIndexBelow < itemCount) && totalItems < maxItems) {
				const addAbove = itemIndexAbove >= 0
				const currentIndex = addAbove ? itemIndexAbove : itemIndexBelow
				currentItemHeight = getItemLayoutHeight(currentIndex)
				if (
					layoutBottom - layoutTop + currentItemHeight > maxPopupHeight ||
					(layoutTop - currentItemHeight < 0 &&
						layoutBottom + currentItemHeight >= window.innerHeight)
				)
					break
				if (layoutTop - currentItemHeight <= 0) layoutBottom += currentItemHeight
				else layoutTop -= currentItemHeight
				totalItems += 1
				if (addAbove) itemIndexAbove -= 1
				else itemIndexBelow += 1
			}
			popupTop = layoutTop
			popupHeight = layoutBottom - layoutTop
		} else if (props.IsEditable) {
			popupHeight = Math.min(popupHeight, window.innerHeight - popupTop)
			if (popupTop + popupHeight > window.innerHeight && rect.top - popupHeight >= 0) {
				popupTop = rect.top - popupHeight
			}
		}
		popupHeight = Math.max(rect.height, Math.min(popupHeight, maxPopupHeight))
		const margin = 8
		const nextPosition = {
			top: popupTop,
			left: Math.max(0, Math.min(window.innerWidth - rect.width, rect.left)),
			width: rect.width,
			maxHeight: popupHeight,
			opensUp: popupTop < rect.top,
			maxWidth: Math.max(0, window.innerWidth - margin * 2)
		}
		const previousPosition = positionRef.current
		const positionChanged =
			previousPosition.top !== nextPosition.top ||
			previousPosition.left !== nextPosition.left ||
			previousPosition.width !== nextPosition.width ||
			previousPosition.maxHeight !== nextPosition.maxHeight ||
			previousPosition.opensUp !== nextPosition.opensUp ||
			previousPosition.maxWidth !== nextPosition.maxWidth
		if (positionChanged && comboRevealRef.current)
			cancelComboFlyoutReveal(`position-changed:${source}`)
		positionRef.current = nextPosition
		if (positionChanged) setPosition(nextPosition)
		if (!flyoutReady) setFlyoutReady(true)
		emitProbe("position-result", {
			source,
			changed: positionChanged,
			top: Math.round(nextPosition.top),
			left: Math.round(nextPosition.left),
			height: Math.round(nextPosition.maxHeight)
		})
	}
	const schedulePosition = (source: string) => {
		const coalesced = positionFrameRef.current !== null
		emitProbe("position-request", { source, coalesced })
		if (typeof window === "undefined" || coalesced || !open) return
		positionFrameRef.current = window.requestAnimationFrame(() => {
			positionFrameRef.current = null
			updatePosition(source)
		})
	}
	const setOpenState = (next: boolean) => {
		emitProbe("open-request", {
			next,
			accepted: enabled && next !== open
		})
		if (!enabled || next === open) return
		if (next) {
			setFlyoutReady(false)
		} else {
			invalidateComboFlyoutReveal()
			cancelComboFlyoutReveal("close-request")
			setFlyoutReady(false)
		}
		setOpen(next)
		callback<boolean>(props, "onUpdate:IsDropDownOpen", "onUpdate:IsOpen")?.(next)
		callback<unknown>(
			props,
			next ? "onDropDownOpened" : "onDropDownClosed",
			next ? "DropDownOpened" : "DropDownClosed"
		)?.(undefined)
	}
	const onChevronDown = () => {
		chevronPressed.current = true
		chevronPressDone.current = false
		const chevron = chevronRef.current
		if (chevron) {
			chevron.classList.remove("releasing")
			chevron.classList.add("pressing")
		}
	}
	const onChevronUp = () => {
		if (!chevronPressed.current) return
		releaseChevron()
	}
	const releaseChevron = () => {
		if (!chevronPressed.current) return
		chevronPressed.current = false
		if (chevronPressDone.current) {
			const chevron = chevronRef.current
			chevron?.classList.remove("pressing")
			chevron?.classList.add("releasing")
		}
	}
	const onChevronAnimEnd = (event: React.AnimationEvent<HTMLSpanElement>) => {
		const chevron = event.currentTarget
		if (chevron.classList.contains("pressing") && event.animationName === "chevron-press") {
			chevronPressDone.current = true
			if (!chevronPressed.current) {
				chevron.classList.remove("pressing")
				chevron.classList.add("releasing")
			}
		} else if (
			chevron.classList.contains("releasing") &&
			event.animationName === "chevron-release"
		) {
			chevron.classList.remove("releasing")
			chevronPressDone.current = false
		}
	}
	useEffect(() => {
		if (props.SelectedIndex !== undefined) setSelected(props.SelectedIndex)
		else if (typeof props.value === "number") setSelected(props.value)
		else if (props.SelectedItem !== undefined)
			setSelected(items.findIndex((item) => Object.is(item, props.SelectedItem)))
		else if (props.SelectedValue !== undefined)
			setSelected(findSelectedValueIndex(props.SelectedValue))
	}, [
		props.SelectedIndex,
		props.SelectedItem,
		props.SelectedValue,
		props.SelectedValuePath,
		props.value,
		items
	])
	useEffect(() => {
		const externalOpen = props.IsDropDownOpen ?? props.IsOpen ?? props.Open
		if (externalOpen === undefined || externalOpen === open) return
		if (externalOpen) {
			setFlyoutReady(false)
		} else {
			invalidateComboFlyoutReveal()
			cancelComboFlyoutReveal("external-close")
			setFlyoutReady(false)
		}
		setOpen(externalOpen)
	}, [props.IsDropDownOpen, props.IsOpen, props.Open])
	useEffect(() => {
		if (previousOpenRef.current === open) return
		previousOpenRef.current = open
		if (!open) {
			emitProbe("open-state", { value: false })
			return
		}
		revealCycleRef.current += 1
		revealScheduledCycleRef.current = null
		revealStartedCycleRef.current = null
		pendingRevealRef.current = true
		emitProbe("open-state", { value: true })
	}, [open])
	useLayoutEffect(() => {
		if (!open || !flyoutReady || !pendingRevealRef.current) return undefined
		const cycle = revealCycleRef.current
		if (revealScheduledCycleRef.current === cycle) return undefined
		revealScheduledCycleRef.current = cycle
		pendingRevealRef.current = false
		emitProbe("reveal-queued")
		emitProbe("reveal-frame", { frame: 0, phase: "layout" })
		startComboFlyoutReveal(cycle)
		return undefined
	}, [flyoutReady, open])
	useEffect(() => {
		if (props.Text !== undefined && props.Text !== null) setCurrentText(String(props.Text))
	}, [props.Text])
	useEffect(() => {
		if (!open) {
			if (positionFrameRef.current !== null) {
				cancelAnimationFrame(positionFrameRef.current)
				positionFrameRef.current = null
			}
			pendingRevealRef.current = false
			cancelComboFlyoutReveal("closed-effect")
			setFlyoutReady(false)
			setHighlightedIndex(-1)
			return undefined
		}
		setHighlightedIndex(
			visibleIndexes.includes(selected) ? selected : (visibleIndexes[0] ?? -1)
		)
		updatePosition("open-effect")
		const focusFrame = requestAnimationFrame(() => {
			const index = visibleIndexes.includes(selected) ? selected : (visibleIndexes[0] ?? -1)
			if (!props.IsEditable && index >= 0) itemRefs.current[index]?.focus()
		})
		const onWindowResize = () => schedulePosition("window-resize")
		const onWindowScroll = () => schedulePosition("window-scroll")
		const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault()
				setOpenState(false)
				setIsEditing(false)
				requestAnimationFrame(focusDisplay)
			}
		}
		const onDocumentPointerDown = (event: globalThis.PointerEvent) => {
			const target = event.target
			if (
				target instanceof Node &&
				(comboRef.current?.contains(target) || flyoutRef.current?.contains(target))
			)
				return
			setOpenState(false)
			setIsEditing(false)
		}
		window.addEventListener("resize", onWindowResize)
		window.addEventListener("scroll", onWindowScroll, true)
		document.addEventListener("keydown", onDocumentKeyDown, true)
		document.addEventListener("pointerdown", onDocumentPointerDown, true)
		const observer =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => schedulePosition("resize-observer"))
				: undefined
		if (observer && comboRef.current) observer.observe(comboRef.current)
		return () => {
			cancelAnimationFrame(focusFrame)
			if (positionFrameRef.current !== null) {
				cancelAnimationFrame(positionFrameRef.current)
				positionFrameRef.current = null
			}
			window.removeEventListener("resize", onWindowResize)
			window.removeEventListener("scroll", onWindowScroll, true)
			document.removeEventListener("keydown", onDocumentKeyDown, true)
			document.removeEventListener("pointerdown", onDocumentPointerDown, true)
			observer?.disconnect()
		}
	}, [open, visibleIndexes.length, inputDeviceType])
	const setSelection = (index: number) => {
		const item = items[index]
		if (item === undefined) return
		const oldItem = selectedItem
		const changed = selected !== index || !Object.is(oldItem, item)
		setSelected(index)
		callback<number>(props, "onValueChange", "onChangeValue", "onUpdate:SelectedIndex")?.(index)
		if (changed) {
			callback<WinItem>(props, "onUpdate:SelectedItem")?.(item)
			callback<WinValue>(
				props,
				"onUpdate:SelectedValue"
			)?.(getPathValue(item, props.SelectedValuePath) as WinValue)
			callback<unknown>(
				props,
				"onSelectionChanged",
				"SelectionChanged"
			)?.({
				AddedItems: [item],
				RemovedItems: oldItem === undefined ? [] : [oldItem]
			})
		}
		const label = String(getLabel(item))
		setCurrentText(label)
		callback<string>(props, "onUpdate:Text")?.(label)
	}
	const choose = (index: number) => {
		const item = items[index]
		if (item === undefined) return
		setSelection(index)
		setHighlightedIndex(-1)
		setIsEditing(false)
		setOpenState(false)
		requestAnimationFrame(focusDisplay)
	}
	const moveSelection = (delta: number) => {
		if (items.length === 0) return
		const next = Math.min(
			items.length - 1,
			Math.max(0, selected < 0 ? (delta > 0 ? 0 : items.length - 1) : selected + delta)
		)
		setSelection(next)
	}
	const focusItem = (index: number) => {
		const next = visibleIndexes[Math.max(0, Math.min(visibleIndexes.length - 1, index))]
		if (next === undefined) return
		setHighlightedIndex(next)
		itemRefs.current[next]?.focus()
		itemRefs.current[next]?.scrollIntoView({ block: "nearest" })
	}
	const openAndFocus = () => {
		if (!enabled) return
		setOpenState(true)
		requestAnimationFrame(() => {
			const index = Math.max(0, visibleIndexes.indexOf(selected))
			focusItem(index)
		})
	}
	const toggle = () => {
		if (!enabled) return
		if (open) setOpenState(false)
		else openAndFocus()
	}
	const beginEditing = () => {
		if (!enabled) return
		setIsEditing(true)
		setCurrentText(
			String(selectedItem === undefined ? currentText || "" : getLabel(selectedItem))
		)
		setOpenState(true)
		requestAnimationFrame(() => {
			inputRef.current?.focus()
			inputRef.current?.select()
		})
	}
	const toggleEditableDropDown = () => {
		if (open) {
			setOpenState(false)
			setIsEditing(false)
			requestAnimationFrame(focusDisplay)
		} else {
			setIsEditing(true)
			setOpenState(true)
			requestAnimationFrame(() => inputRef.current?.focus())
		}
	}
	const submitText = () => {
		const index = items.findIndex((item) => String(getLabel(item)) === currentText)
		const args = { Text: currentText, Handled: false }
		callback<typeof args>(props, "onTextSubmitted", "TextSubmitted")?.(args)
		if (!args.Handled && index >= 0) choose(index)
		else {
			setOpenState(false)
			setIsEditing(false)
			requestAnimationFrame(focusDisplay)
		}
	}
	const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === "ArrowDown" && !event.altKey && !open) {
			event.preventDefault()
			moveSelection(1)
		} else if (event.key === "ArrowUp" && !open) {
			event.preventDefault()
			moveSelection(-1)
		} else if (
			event.key === "ArrowDown" ||
			event.key === "F4" ||
			event.key === "Enter" ||
			event.key === " "
		) {
			event.preventDefault()
			openAndFocus()
		}
	}
	const onEditableDisplayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === "Enter" || event.key === "F2" || event.key === " ") {
			event.preventDefault()
			beginEditing()
		} else if (event.key === "F4" || (event.altKey && event.key === "ArrowDown")) {
			event.preventDefault()
			openAndFocus()
		} else if (event.key === "ArrowDown") {
			event.preventDefault()
			moveSelection(1)
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			moveSelection(-1)
		}
	}
	const onEditableKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault()
			submitText()
		} else if (event.key === "Escape") {
			event.preventDefault()
			setOpenState(false)
			setIsEditing(false)
			requestAnimationFrame(focusDisplay)
		} else if (event.key === "ArrowDown" && !open) {
			event.preventDefault()
			openAndFocus()
		}
	}
	const onPopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const activeIndex = Number(
			(event.target as HTMLElement).getAttribute("data-index") ?? highlightedIndex
		)
		if (event.key === "Escape") {
			event.preventDefault()
			event.stopPropagation()
			setOpenState(false)
			setIsEditing(false)
			requestAnimationFrame(focusDisplay)
		} else if (event.key === "ArrowDown") {
			event.preventDefault()
			event.stopPropagation()
			focusItem(Number.isFinite(activeIndex) ? visibleIndexes.indexOf(activeIndex) + 1 : 0)
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			event.stopPropagation()
			focusItem(Number.isFinite(activeIndex) ? visibleIndexes.indexOf(activeIndex) - 1 : 0)
		} else if (event.key === "Home") {
			event.preventDefault()
			event.stopPropagation()
			focusItem(0)
		} else if (event.key === "End") {
			event.preventDefault()
			event.stopPropagation()
			focusItem(visibleIndexes.length - 1)
		} else if (event.key === "Enter" || event.key === " ") {
			if (!Number.isFinite(activeIndex)) return
			event.preventDefault()
			event.stopPropagation()
			choose(activeIndex)
		}
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={comboRef}
			className={cx(
				"win-combo-box",
				open ? "is-drop-down-open" : undefined,
				props.IsEditable ? "is-editable" : undefined,
				!enabled ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
			onKeyDownCapture={onInputKeyDownCapture}
			onPointerDownCapture={onPointerDownCapture}
			onPointerUpCapture={onPointerUpCapture}
			onPointerCancelCapture={onPointerCancelCapture}
			onClickCapture={onClickCapture}
		>
			{props.Header && <WinTextBlock Text={props.Header} className="win-combo-header" />}
			{props.IsEditable ? (
				<div ref={editableRef} className="win-combo-editable">
					{isEditing ? (
						<input
							ref={inputRef}
							className="win-combo-edit-input"
							role="combobox"
							value={currentText}
							placeholder={props.PlaceholderText}
							aria-label={String(props.Header ?? props.PlaceholderText ?? "Select")}
							aria-controls={comboId}
							aria-expanded={open}
							aria-haspopup="listbox"
							aria-activedescendant={
								highlightedIndex >= 0
									? `${comboId}-option-${highlightedIndex}`
									: undefined
							}
							disabled={!enabled}
							onChange={(event) => {
								setCurrentText(event.currentTarget.value)
								setOpenState(true)
								callback<string>(
									props,
									"onUpdate:Text"
								)?.(event.currentTarget.value)
							}}
							onKeyDown={onEditableKeyDown}
						/>
					) : (
						<button
							ref={displayRef}
							type="button"
							className="win-btn DefaultButtonStyle win-combo-button win-combo-edit-display"
							role="combobox"
							aria-label={String(props.Header ?? props.PlaceholderText ?? "Select")}
							aria-controls={comboId}
							aria-expanded={open}
							aria-haspopup="listbox"
							disabled={!enabled}
							onClick={beginEditing}
							onKeyDown={onEditableDisplayKeyDown}
						>
							<span
								className={cx(
									"win-combo-content",
									selectedItem === undefined ? "is-placeholder" : undefined
								)}
							>
								{selectedItem === undefined
									? (props.PlaceholderText ?? "Select")
									: getLabel(selectedItem)}
							</span>
						</button>
					)}
					<button
						type="button"
						className="win-combo-drop-down-button"
						aria-label="Open selection"
						disabled={!enabled}
						onClick={toggleEditableDropDown}
						onPointerDown={(event) => {
							event.preventDefault()
							onChevronDown()
						}}
						onPointerUp={onChevronUp}
						onPointerCancel={releaseChevron}
						onPointerLeave={releaseChevron}
					/>
					<span
						ref={chevronRef}
						className="chevron-animate win-combo-chevron"
						aria-hidden="true"
						onAnimationEnd={onChevronAnimEnd}
					/>
				</div>
			) : (
				<button
					ref={buttonRef}
					type="button"
					className="win-btn DefaultButtonStyle win-combo-button win-combo-btn"
					role="combobox"
					aria-label={String(props.Header ?? props.PlaceholderText ?? "Select")}
					aria-controls={comboId}
					aria-expanded={open}
					aria-haspopup="listbox"
					aria-activedescendant={
						highlightedIndex >= 0 ? `${comboId}-option-${highlightedIndex}` : undefined
					}
					disabled={!enabled}
					onClick={toggle}
					onKeyDown={onButtonKeyDown}
					onPointerDown={onChevronDown}
					onPointerUp={onChevronUp}
					onPointerCancel={releaseChevron}
					onPointerLeave={releaseChevron}
				>
					<span
						className={cx(
							"win-combo-content",
							selectedItem === undefined ? "is-placeholder" : undefined
						)}
					>
						{selectedItem === undefined
							? (props.PlaceholderText ?? "Select")
							: getLabel(selectedItem)}
					</span>
					<span
						ref={chevronRef}
						className="chevron-animate win-combo-chevron"
						aria-hidden="true"
						onAnimationEnd={onChevronAnimEnd}
					/>
				</button>
			)}
			{open &&
				typeof document !== "undefined" &&
				createPortal(
					<>
						<div
							className="win-combo-overlay"
							aria-hidden="true"
							onContextMenu={(event) => {
								event.preventDefault()
								setOpenState(false)
							}}
							onPointerDown={() => setOpenState(false)}
						/>
						<div
							ref={flyoutRef}
							id={comboId}
							className={cx(
								"win-combo-flyout",
								"win-theme-scope",
								position.opensUp ? "opens-up" : "opens-down",
								flyoutReady ? "is-positioned" : undefined,
								inputDeviceType === "Touch" ? "touch-input" : undefined,
								props.IsEditable
									? position.opensUp
										? "edge-square-bottom"
										: "edge-square-top"
									: undefined
							)}
							role="listbox"
							aria-label={String(props.Header ?? props.PlaceholderText ?? "Select")}
							style={{
								top: position.top,
								left: position.left,
								minWidth: position.width,
								maxWidth: position.maxWidth,
								height: position.maxHeight + 2,
								maxHeight: position.maxHeight + 2,
								width: "max-content",
								visibility: flyoutReady ? "visible" : "hidden"
							}}
							onKeyDownCapture={onPopupKeyDown}
							onPointerDown={(event) => event.stopPropagation()}
						>
							<WinScrollViewer
								className="win-combo-scroll-viewer"
								HorizontalScrollMode="Disabled"
								HorizontalScrollBarVisibility="Disabled"
								VerticalScrollMode="Auto"
								VerticalScrollBarVisibility="Auto"
								IsVerticalScrollChainingEnabled={false}
								IsTabStop={false}
							>
								<div className="win-combo-items-presenter">
									{visibleIndexes.map((itemIndex) => {
										const item = items[itemIndex]
										return (
											<button
												key={itemIndex}
												ref={(element) => {
													itemRefs.current[itemIndex] = element
												}}
												id={`${comboId}-option-${itemIndex}`}
												data-index={itemIndex}
												type="button"
												role="option"
												aria-selected={selected === itemIndex}
												aria-posinset={itemIndex + 1}
												aria-setsize={items.length}
												tabIndex={selected === itemIndex ? 0 : -1}
												className={cx(
													"win-combo-item",
													selected === itemIndex ? "selected" : undefined,
													highlightedIndex === itemIndex
														? "highlighted"
														: undefined
												)}
												onPointerEnter={() =>
													setHighlightedIndex(itemIndex)
												}
												onClick={() => choose(itemIndex)}
											>
												<span className="win-combo-item-layout">
													{selected === itemIndex && (
														<span
															className="win-combo-item-pill"
															aria-hidden="true"
														/>
													)}
													<span className="win-combo-item-content">
														{getLabel(item)}
													</span>
												</span>
											</button>
										)
									})}
								</div>
							</WinScrollViewer>
						</div>
					</>,
					document.body
				)}
		</div>
	)
}
type WinSuggestion = string | number | Record<string, unknown>

type WinAutoSuggestBoxProps = WinProps &
	WinChangeProps<string> & {
		Text?: string
		Value?: string
		PlaceholderText?: string
		QueryIcon?: ReactNode
		ItemsSource?: WinSuggestion[]
		TextMemberPath?: string
		UpdateTextOnSelect?: boolean
		IsSuggestionListOpen?: boolean
		MaxSuggestionListHeight?: number | string
		AutoMaximizeSuggestionArea?: boolean
		DesiredCandidateWindowAlignment?: "Default" | "BottomEdge" | string
		LightDismissOverlayMode?: string
		TextBoxStyle?: unknown
		KeepInteriorCornersSquare?: boolean
		OpenOnFocus?: boolean
	}

export function WinAutoSuggestBox(props: WinAutoSuggestBoxProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null)
	const anchorRef = useRef<HTMLDivElement>(null)
	const popupRef = useRef<HTMLDivElement>(null)
	const suggestionRefs = useRef<Record<number, HTMLButtonElement | null>>({})
	const items = (props.ItemsSource ??
		(props.Items as WinSuggestion[] | undefined) ??
		[]) as WinSuggestion[]
	const externalText =
		props.Text !== undefined
			? String(props.Text)
			: props.Value !== undefined
				? String(props.Value)
				: props.value !== undefined
					? String(props.value)
					: undefined
	const [text, setText] = useState(externalText ?? "")
	const [open, setOpen] = useState(Boolean(props.IsSuggestionListOpen))
	const previousExternalTextRef = useRef(externalText)
	const itemsRef = useRef(items)
	const listBoxId = `win-asb-listbox-${useId().replace(/:/g, "")}`
	const [highlightedIndex, setHighlightedIndex] = useState(-1)
	const [isFocused, setIsFocused] = useState(false)
	const [shouldOpenForUserInput, setShouldOpenForUserInput] = useState(false)
	const [isComposing, setIsComposing] = useState(false)
	const [openDirection, setOpenDirection] = useState<"up" | "down">("down")
	const [popupStyle, setPopupStyle] = useState<WinStyle>({})
	const enabled = props.IsEnabled !== false
	const visible = open && enabled && items.length > 0
	const desiredCandidateWindowAlignment = props.DesiredCandidateWindowAlignment ?? "BottomEdge"
	const textMemberPath = props.TextMemberPath ?? ""
	const getSuggestionPathValue = (item: WinSuggestion, path: string): unknown => {
		let current: unknown = item
		for (const segment of path.split(".")) {
			if (!current || typeof current !== "object") return undefined
			current = (current as Record<string, unknown>)[segment]
		}
		return current
	}
	const getSuggestionText = (item: WinSuggestion): string => {
		if (item && typeof item === "object") {
			const record = item as Record<string, unknown>
			const value =
				(textMemberPath ? getSuggestionPathValue(item, textMemberPath) : undefined) ??
				record.title ??
				record.text ??
				record.name ??
				record.label ??
				""
			return String(value)
		}
		return String(item ?? "")
	}
	const getSuggestionSubtitle = (item: WinSuggestion): string => {
		if (!item || typeof item !== "object") return ""
		return String((item as Record<string, unknown>).subtitle ?? "")
	}
	const isNoResultsItem = (item: WinSuggestion) =>
		Boolean(
			item &&
			typeof item === "object" &&
			((item as Record<string, unknown>).noResults === true ||
				getSuggestionText(item).trim().toLowerCase() === "no results found")
		)
	const selectableIndexes = items.reduce<number[]>((result, item, index) => {
		if (!isNoResultsItem(item)) result.push(index)
		return result
	}, [])
	const updatePopupPosition = () => {
		const anchor = anchorRef.current
		if (!anchor) return
		const field = anchor.querySelector<HTMLElement>(".win-textbox-border")
		const rect = field?.getBoundingClientRect() ?? anchor.getBoundingClientRect()
		const viewport = window.visualViewport
		const viewportTop = viewport?.offsetTop ?? 0
		const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
		const requestedHeight =
			typeof props.MaxSuggestionListHeight === "number"
				? props.MaxSuggestionListHeight
				: Number(props.MaxSuggestionListHeight ?? 300) || 300
		const candidateGap =
			isComposing && desiredCandidateWindowAlignment === "BottomEdge" ? 40 : 0
		const spaceBelow = viewportBottom - rect.bottom - candidateGap - 8
		const spaceAbove = rect.top - viewportTop - candidateGap - 8
		const direction: "up" | "down" =
			candidateGap > 0 ||
			spaceBelow >= Math.min(requestedHeight, 160) ||
			spaceBelow >= spaceAbove
				? "down"
				: "up"
		const maxHeight = props.AutoMaximizeSuggestionArea
			? Math.max(120, direction === "up" ? spaceAbove : spaceBelow)
			: Math.min(requestedHeight, Math.max(80, direction === "up" ? spaceAbove : spaceBelow))
		setOpenDirection(direction)
		setPopupStyle(
			direction === "up"
				? {
						left: rect.left,
						bottom: window.innerHeight - rect.top + candidateGap,
						width: rect.width,
						maxHeight,
						"--asb-popup-radius": "8px 8px 0 0"
					}
				: {
						left: rect.left,
						top: rect.bottom + candidateGap,
						width: rect.width,
						maxHeight,
						"--asb-popup-radius": "0 0 8px 8px"
					}
		)
	}
	const setSuggestionOpen = (next: boolean) => {
		const shouldOpen = next && items.length > 0 && enabled
		if (shouldOpen) {
			setHighlightedIndex(-1)
			updatePopupPosition()
		}
		setOpen(shouldOpen)
		callback<boolean>(
			props,
			"onUpdate:IsSuggestionListOpen",
			"onSuggestionListOpenChange"
		)?.(shouldOpen)
		callback<unknown>(props, shouldOpen ? "onOpened" : "onClosed")?.(undefined)
	}
	const handleTextChange = (next: string) => {
		setText(next)
		setShouldOpenForUserInput(true)
		callback<string>(
			props,
			"onUpdate:Text",
			"onValueChange",
			"onChangeValue",
			"onUpdate:Value",
			"onUpdate:modelValue"
		)?.(next)
		callback<unknown>(props, "onTextChanged", "TextChanged")?.({ Reason: "UserInput" })
		if (isFocused) {
			window.setTimeout(() => {
				if (isFocused) setSuggestionOpen(itemsRef.current.length > 0)
			}, 0)
		}
	}
	const submitQuery = (chosenSuggestion: WinSuggestion | null = null, queryText = text) => {
		setShouldOpenForUserInput(false)
		callback<unknown>(
			props,
			"onQuerySubmitted",
			"QuerySubmitted"
		)?.({
			QueryText: queryText,
			ChosenSuggestion: chosenSuggestion
		})
		setSuggestionOpen(false)
	}
	const chooseSuggestion = (index: number) => {
		const item = items[index]
		if (item === undefined || isNoResultsItem(item)) return
		const nextText = getSuggestionText(item)
		callback<unknown>(props, "onSuggestionChosen", "SuggestionChosen")?.({ SelectedItem: item })
		if (props.UpdateTextOnSelect !== false) {
			setText(nextText)
			callback<string>(
				props,
				"onUpdate:Text",
				"onValueChange",
				"onChangeValue",
				"onUpdate:Value",
				"onUpdate:modelValue"
			)?.(nextText)
			callback<unknown>(
				props,
				"onTextChanged",
				"TextChanged"
			)?.({
				Reason: "SuggestionChosen"
			})
		}
		submitQuery(item, nextText)
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (event.nativeEvent.isComposing) return
		if (!visible || selectableIndexes.length === 0) {
			if (event.key === "Enter") submitQuery()
			return
		}
		const current = selectableIndexes.indexOf(highlightedIndex)
		if (event.key === "ArrowDown") {
			event.preventDefault()
			setHighlightedIndex(
				selectableIndexes[Math.min(current + 1, selectableIndexes.length - 1)]
			)
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			setHighlightedIndex(selectableIndexes[Math.max(current - 1, 0)])
		} else if (event.key === "Home") {
			event.preventDefault()
			setHighlightedIndex(selectableIndexes[0])
		} else if (event.key === "End") {
			event.preventDefault()
			setHighlightedIndex(selectableIndexes[selectableIndexes.length - 1])
		} else if (event.key === "Enter") {
			event.preventDefault()
			if (highlightedIndex >= 0) chooseSuggestion(highlightedIndex)
			else submitQuery()
		} else if (event.key === "Escape") {
			event.preventDefault()
			setShouldOpenForUserInput(false)
			setSuggestionOpen(false)
		}
	}
	useEffect(() => {
		itemsRef.current = items
		const shouldSyncOpen = open || (isFocused && shouldOpenForUserInput)
		const nextOpen = items.length > 0 && enabled
		if (shouldSyncOpen && nextOpen !== open) setSuggestionOpen(nextOpen)
	}, [items, open, isFocused, shouldOpenForUserInput, enabled])
	useEffect(() => {
		if (!visible || highlightedIndex < 0) return
		suggestionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" })
	}, [highlightedIndex, visible])
	useEffect(() => {
		if (!visible) return undefined
		const update = () => updatePopupPosition()
		window.addEventListener("resize", update)
		window.addEventListener("scroll", update, true)
		window.visualViewport?.addEventListener("resize", update)
		return () => {
			window.removeEventListener("resize", update)
			window.removeEventListener("scroll", update, true)
			window.visualViewport?.removeEventListener("resize", update)
		}
	}, [
		visible,
		isComposing,
		props.MaxSuggestionListHeight,
		props.AutoMaximizeSuggestionArea,
		desiredCandidateWindowAlignment
	])
	useEffect(() => {
		if (props.IsSuggestionListOpen !== undefined) setOpen(Boolean(props.IsSuggestionListOpen))
	}, [props.IsSuggestionListOpen])
	useEffect(() => {
		if (externalText === undefined || Object.is(previousExternalTextRef.current, externalText))
			return
		previousExternalTextRef.current = externalText
		setText(externalText)
		callback<unknown>(
			props,
			"onTextChanged",
			"TextChanged"
		)?.({
			Reason: "ProgrammaticChange"
		})
	}, [externalText])
	useEffect(() => {
		if (!visible) return undefined
		const onDocumentPointerDown = (event: globalThis.PointerEvent) => {
			const target = event.target as Node
			if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target))
				setShouldOpenForUserInput(false)
			if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target))
				setSuggestionOpen(false)
		}
		document.addEventListener("pointerdown", onDocumentPointerDown, true)
		return () => document.removeEventListener("pointerdown", onDocumentPointerDown, true)
	}, [visible])
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			ref={rootRef}
			className={cx(
				"win-auto-suggest-box",
				visible
					? openDirection === "up"
						? "is-suggestion-open-up"
						: "is-suggestion-open-down"
					: undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Header && <div className="win-asb-header">{props.Header}</div>}
			<div ref={anchorRef} className="win-asb-anchor">
				<WinTextBox
					Text={text}
					PlaceholderText={props.PlaceholderText}
					IsEnabled={enabled}
					className="win-asb-textbox"
					role="combobox"
					aria-label={
						typeof props.Header === "string"
							? props.Header
							: typeof props.PlaceholderText === "string"
								? props.PlaceholderText
								: undefined
					}
					aria-controls={listBoxId}
					aria-expanded={visible}
					aria-autocomplete="list"
					aria-activedescendant={
						highlightedIndex >= 0
							? `${listBoxId}-option-${highlightedIndex}`
							: undefined
					}
					onValueChange={handleTextChange}
					onKeyDown={handleKeyDown}
					onFocus={() => {
						setIsFocused(true)
						if (props.OpenOnFocus !== false && items.length > 0) setSuggestionOpen(true)
					}}
					onBlur={() => {
						setIsFocused(false)
						setShouldOpenForUserInput(false)
						window.setTimeout(() => {
							if (!popupRef.current?.contains(document.activeElement))
								setSuggestionOpen(false)
						}, 120)
					}}
					onCompositionStart={() => setIsComposing(true)}
					onCompositionEnd={() => {
						setIsComposing(false)
						if (visible) requestAnimationFrame(updatePopupPosition)
					}}
				>
					{props.QueryIcon && (
						<button
							type="button"
							className="win-textbox-action-button win-textbox-action-query win-asb-query-button"
							disabled={!enabled}
							aria-label="Submit query"
							onPointerDown={(event) => event.preventDefault()}
							onClick={() => submitQuery()}
						>
							<span className="win-asb-icon">
								{props.QueryIcon === "Find" ? "\uE721" : props.QueryIcon}
							</span>
						</button>
					)}
				</WinTextBox>
			</div>
			{props.Description && <div className="win-asb-description">{props.Description}</div>}
			{visible &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={popupRef}
						id={listBoxId}
						className={cx(
							"win-asb-popup win-theme-scope",
							openDirection === "up" ? "opens-up" : "opens-down"
						)}
						style={popupStyle}
						role="listbox"
						onPointerDown={(event) => event.stopPropagation()}
					>
						<WinScrollViewer
							className="win-asb-popup-scroll"
							VerticalScrollMode="Auto"
							VerticalScrollBarVisibility="Auto"
							HorizontalScrollMode="Disabled"
							HorizontalScrollBarVisibility="Disabled"
						>
							<div className="win-asb-results">
								{items.map((item, index) => (
									<button
										key={`${getSuggestionText(item)}-${index}`}
										id={`${listBoxId}-option-${index}`}
										ref={(element) => {
											suggestionRefs.current[index] = element
										}}
										type="button"
										role="option"
										disabled={isNoResultsItem(item)}
										aria-selected={highlightedIndex === index}
										className={cx(
											"win-asb-item",
											highlightedIndex === index
												? "is-highlighted"
												: undefined,
											isNoResultsItem(item) ? "is-disabled" : undefined
										)}
										onPointerEnter={() =>
											!isNoResultsItem(item) && setHighlightedIndex(index)
										}
										onClick={() => {
											chooseSuggestion(index)
											anchorRef.current
												?.querySelector<
													HTMLInputElement | HTMLTextAreaElement
												>("input, textarea")
												?.blur()
										}}
									>
										<span className="win-asb-item-title">
											{getSuggestionText(item)}
										</span>
										{getSuggestionSubtitle(item) && (
											<span className="win-asb-item-subtitle">
												{getSuggestionSubtitle(item)}
											</span>
										)}
									</button>
								))}
							</div>
						</WinScrollViewer>
					</div>,
					document.body
				)}
		</div>
	)
}
