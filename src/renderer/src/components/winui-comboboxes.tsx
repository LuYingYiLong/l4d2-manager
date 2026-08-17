// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { WinTextBlock } from "./winui-primitives"
import { WinTextBox } from "./winui-inputs"
import { WinScrollViewer } from "./winui-scrolling"
import { useFlyoutAnimation } from "./useFlyoutAnimation"
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

type ComboFlyoutRect = {
	left: number
	top: number
	right: number
	bottom: number
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
		left: -15,
		top: -15,
		right: width + 15,
		bottom: height + 15
	}
	const startClipPath = comboFlyoutClipPath(startRect)
	const endClipPath = comboFlyoutClipPath(endRect)
	flyout.style.willChange = "clip-path"
	flyout.style.clipPath = startClipPath
	const animation = flyout.animate([{ clipPath: startClipPath }, { clipPath: endClipPath }], {
		duration: 800,
		easing: "cubic-bezier(0.092, 1.003, 0.028, 0.997)",
		fill: "none"
	})
	const clearClipPath = () => {
		flyout.style.clipPath = ""
		flyout.style.willChange = ""
	}
	animation.onfinish = clearClipPath
	animation.oncancel = clearClipPath
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
	const [chevronClass, setChevronClass] = useState("")
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
	const [flyoutReady, setFlyoutReady] = useState(false)
	const [inputDeviceType, setInputDeviceType] = useState<"Mouse" | "Touch" | "Keyboard">("Mouse")
	const [currentText, setCurrentText] = useState(
		props.Text === undefined || props.Text === null ? "" : String(props.Text)
	)
	const [isEditing, setIsEditing] = useState(false)
	const [highlightedIndex, setHighlightedIndex] = useState(-1)
	const animation = useFlyoutAnimation(open, {
		enterClass: "",
		exitClass: "combo-flyout-closing"
	})
	const comboRevealRef = useRef<Animation | null>(null)
	const pendingRevealRef = useRef(false)
	const selectedItem = selected >= 0 ? items[selected] : undefined
	const visibleIndexes = items.map((_, index) => index)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const cancelComboFlyoutReveal = () => {
		comboRevealRef.current?.cancel()
		comboRevealRef.current = null
		if (flyoutRef.current) {
			flyoutRef.current.style.clipPath = ""
			flyoutRef.current.style.willChange = ""
		}
	}
	const startComboFlyoutReveal = () => {
		const flyout = flyoutRef.current
		if (!flyout) return
		cancelComboFlyoutReveal()
		const selectedIndex = visibleIndexes.includes(selected)
			? selected
			: Math.floor(visibleIndexes.length / 2)
		const originElement = props.IsEditable ? null : (itemRefs.current[selectedIndex] ?? null)
		comboRevealRef.current =
			playComboFlyoutReveal(flyout, originElement, position.opensUp ? "bottom" : "top") ??
			null
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
	const updatePosition = () => {
		cancelComboFlyoutReveal()
		const anchor = props.IsEditable ? editableRef.current : buttonRef.current
		if (!anchor || typeof window === "undefined") return
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
		setPosition({
			top: popupTop,
			left: Math.max(0, Math.min(window.innerWidth - rect.width, rect.left)),
			width: rect.width,
			maxHeight: popupHeight,
			opensUp: popupTop < rect.top,
			maxWidth: Math.max(0, window.innerWidth - margin * 2)
		})
		setFlyoutReady(true)
	}
	const setOpenState = (next: boolean) => {
		if (!enabled || next === open) return
		if (next) {
			pendingRevealRef.current = true
			animation.beginOpen()
			setFlyoutReady(false)
		} else {
			pendingRevealRef.current = false
			cancelComboFlyoutReveal()
			animation.beginClose()
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
		setChevronClass("pressing")
	}
	const onChevronUp = () => {
		if (!chevronPressed.current) return
		releaseChevron()
	}
	const releaseChevron = () => {
		if (chevronClass === "") return
		chevronPressed.current = false
		if (chevronPressDone.current) setChevronClass("releasing")
	}
	const onChevronAnimEnd = (event: React.AnimationEvent<HTMLSpanElement>) => {
		if (chevronClass === "pressing" && event.animationName === "chevron-press") {
			chevronPressDone.current = true
			if (!chevronPressed.current) setChevronClass("releasing")
		} else if (chevronClass === "releasing" && event.animationName === "chevron-release") {
			setChevronClass("")
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
			pendingRevealRef.current = true
			animation.beginOpen()
			setFlyoutReady(false)
		} else {
			pendingRevealRef.current = false
			cancelComboFlyoutReveal()
			animation.beginClose()
		}
		setOpen(externalOpen)
	}, [props.IsDropDownOpen, props.IsOpen, props.Open])
	useEffect(() => {
		if (!open || !flyoutReady || !pendingRevealRef.current) return undefined
		pendingRevealRef.current = false
		let firstFrame = 0
		let secondFrame = 0
		firstFrame = requestAnimationFrame(() => {
			secondFrame = requestAnimationFrame(startComboFlyoutReveal)
		})
		return () => {
			cancelAnimationFrame(firstFrame)
			cancelAnimationFrame(secondFrame)
		}
	}, [flyoutReady, open])
	useEffect(() => {
		if (props.Text !== undefined && props.Text !== null) setCurrentText(String(props.Text))
	}, [props.Text])
	useEffect(() => {
		if (!open) {
			pendingRevealRef.current = false
			cancelComboFlyoutReveal()
			setHighlightedIndex(-1)
			return undefined
		}
		setHighlightedIndex(
			visibleIndexes.includes(selected) ? selected : (visibleIndexes[0] ?? -1)
		)
		updatePosition()
		const focusFrame = requestAnimationFrame(() => {
			const index = visibleIndexes.includes(selected) ? selected : (visibleIndexes[0] ?? -1)
			if (!props.IsEditable && index >= 0) itemRefs.current[index]?.focus()
		})
		const onViewportChanged = () => updatePosition()
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
		window.addEventListener("resize", onViewportChanged)
		window.addEventListener("scroll", onViewportChanged, true)
		document.addEventListener("keydown", onDocumentKeyDown, true)
		document.addEventListener("pointerdown", onDocumentPointerDown, true)
		const observer =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : undefined
		if (observer && comboRef.current) observer.observe(comboRef.current)
		return () => {
			cancelAnimationFrame(focusFrame)
			window.removeEventListener("resize", onViewportChanged)
			window.removeEventListener("scroll", onViewportChanged, true)
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
						className={cx("chevron-animate", "win-combo-chevron", chevronClass)}
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
						className={cx("chevron-animate", "win-combo-chevron", chevronClass)}
						aria-hidden="true"
						onAnimationEnd={onChevronAnimEnd}
					/>
				</button>
			)}
			{animation.isRendered &&
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
								flyoutReady ? animation.animationClass : undefined,
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
							onAnimationEnd={(event) => {
								if (event.target === event.currentTarget) animation.onAnimationEnd()
							}}
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
