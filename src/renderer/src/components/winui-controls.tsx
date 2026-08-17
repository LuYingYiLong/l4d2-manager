// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useId, useRef, useState } from "react"
import type { HTMLAttributes, InputHTMLAttributes, MouseEvent, ReactNode } from "react"
import { WinTextBlock } from "./winui-primitives"
import {
	callback,
	commonStyle,
	contentOf,
	cx,
	domProps,
	itemLabel,
	itemsOf,
	useControllable
} from "./winui-shared"
import type {
	WinChangeProps,
	WinItem,
	WinItemProps,
	WinProps,
	WinStyle,
	WinValue
} from "./winui-shared"

export function WinCheckBox(
	props: WinProps &
		WinChangeProps<boolean | null> & {
			IsChecked?: boolean | null
			IsThreeState?: boolean
			ThreeState?: boolean
			isThreeState?: boolean
			indeterminate?: boolean
			disabled?: boolean
		}
): React.JSX.Element {
	const external =
		props.indeterminate === true
			? null
			: props.IsChecked !== undefined
				? props.IsChecked
				: props.modelValue !== undefined
					? props.modelValue
					: props.value
	const [currentValue, setCurrentValue] = useControllable<boolean | null>(
		external,
		props.defaultValue ?? false,
		callback<boolean | null>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:modelValue",
			"onUpdate:Value",
			"onUpdate:IsChecked"
		)
	)
	const isThreeState = props.IsThreeState ?? props.ThreeState ?? props.isThreeState ?? false
	const isChecked = currentValue === true
	const isIndeterminate = isThreeState && currentValue === null
	const isDisabled = props.IsEnabled === false || props.disabled === true
	const emitState = (next: boolean | null) => {
		setCurrentValue(next)
		if (next === true) {
			callback<boolean | null>(props, "onChecked", "Checked")?.(next)
		} else if (next === null) {
			callback<boolean | null>(props, "onIndeterminate", "Indeterminate")?.(next)
		} else {
			callback<boolean | null>(props, "onUnchecked", "Unchecked")?.(next)
		}
	}
	const toggle = () => {
		if (isDisabled) return
		if (isThreeState) {
			emitState(currentValue === false ? true : currentValue === true ? null : false)
		} else emitState(!isChecked)
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-checkbox",
				isChecked ? "is-checked" : undefined,
				!isChecked && !isIndeterminate ? "is-unchecked" : undefined,
				isIndeterminate ? "is-indeterminate" : undefined,
				isDisabled ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
			tabIndex={isDisabled ? -1 : 0}
			role="checkbox"
			aria-checked={isIndeterminate ? "mixed" : isChecked ? "true" : "false"}
			aria-disabled={isDisabled}
			onClick={(event) => {
				toggle()
				props.onClick?.(event)
				props.Click?.(event as MouseEvent<HTMLElement>)
			}}
			onKeyDown={(event) => {
				if (event.key === " " || event.key === "Enter") {
					event.preventDefault()
					toggle()
				}
				props.onKeyDown?.(event)
			}}
		>
			<span className="checkbox-box" aria-hidden="true">
				<span
					className={cx(
						"checkbox-glyph",
						"check-glyph",
						isChecked ? "checked" : undefined,
						isIndeterminate ? "hidden" : undefined
					)}
				>
					{"\uE73E"}
				</span>
				{isIndeterminate && (
					<span className="checkbox-glyph indeterminate-glyph">{"\uE73C"}</span>
				)}
			</span>
			<span className="checkbox-content">{contentOf(props, props.children)}</span>
		</div>
	)
}

export function WinRadioButton(
	props: WinProps &
		WinChangeProps<WinValue> & {
			GroupName?: string
			name?: string
			Value?: WinValue
			IsChecked?: boolean
		}
): React.JSX.Element {
	const radioValue =
		props.Value !== undefined ? props.Value : props.value !== undefined ? props.value : true
	const selected =
		props.IsChecked !== undefined
			? props.IsChecked === true
			: props.modelValue !== undefined && Object.is(props.modelValue, radioValue)
	const disabled = props.IsEnabled === false || props.disabled === true
	return (
		<label
			className={cx(
				"win-radio-button",
				selected ? "is-checked" : undefined,
				disabled ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			<input
				{...(domProps(props) as InputHTMLAttributes<HTMLInputElement>)}
				className="win-radio-input"
				type="radio"
				name={props.GroupName ?? props.name}
				checked={selected}
				disabled={disabled}
				onChange={(event) => {
					if (disabled) return
					callback<WinValue>(
						props,
						"onValueChange",
						"onChangeValue",
						"onUpdate:modelValue",
						"onUpdate:Value"
					)?.(radioValue)
					callback<boolean>(props, "onUpdate:IsChecked")?.(true)
					callback<unknown>(props, "onChecked", "Checked")?.(undefined)
					props.onChange?.(event)
				}}
			/>
			<span className="win-radio-glyph" aria-hidden="true">
				<span className="win-radio-check" />
			</span>
			<WinTextBlock className="win-radio-content">
				{contentOf(props, props.children)}
			</WinTextBlock>
		</label>
	)
}

export function WinRadioButtons(
	props: WinItemProps &
		WinChangeProps<WinValue> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			Orientation?: string
			MaxColumns?: number | string
		}
): React.JSX.Element {
	const groupName = useId()
	const items = itemsOf(props)
	const [selected, setSelected] = useControllable<number>(
		props.SelectedIndex ?? (typeof props.value === "number" ? props.value : undefined),
		-1,
		callback<number>(props, "onValueChange", "onUpdate:SelectedIndex")
	)
	const select = (index: number) => {
		const oldItem = items[selected]
		const newItem = items[index]
		setSelected(index)
		const itemValue = (item: WinItem | undefined): WinItem | null => {
			if (item === undefined) return null
			if (typeof item !== "object" || item === null) return item
			const record = item as Record<string, unknown>
			return (record.Value ?? record.value ?? item) as WinItem
		}
		callback<WinItem | null>(props, "onUpdate:SelectedItem")?.(itemValue(newItem))
		callback<{
			SelectedIndex: number
			SelectedItem: WinItem | null
			AddedItems: WinItem[]
			RemovedItems: WinItem[]
		}>(
			props,
			"onSelectionChanged",
			"SelectionChanged"
		)?.({
			SelectedIndex: index,
			SelectedItem: itemValue(newItem),
			AddedItems: newItem === undefined ? [] : [itemValue(newItem) as WinItem],
			RemovedItems: oldItem === undefined ? [] : [itemValue(oldItem) as WinItem]
		})
	}
	const maxColumns = Math.max(1, Number(props.MaxColumns ?? 1) || 1)
	const horizontal = String(props.Orientation ?? "").toLowerCase() === "horizontal"
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-radio-buttons",
				props.IsEnabled === false || props.disabled === true ? "is-disabled" : undefined,
				props.className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Header && (
				<WinTextBlock className="win-radio-buttons-header" Text={props.Header} />
			)}
			<div
				className="win-radio-buttons-items"
				style={{
					gridTemplateColumns: horizontal
						? "repeat(auto-fit, max-content)"
						: `repeat(${maxColumns}, max-content)`
				}}
			>
				{items.length > 0
					? items.map((item, index) => (
							<WinRadioButton
								key={index}
								GroupName={groupName}
								IsChecked={selected === index}
								IsEnabled={props.IsEnabled}
								Value={index}
								Content={itemLabel(item)}
								onValueChange={() => select(index)}
							/>
						))
					: props.children}
			</div>
		</div>
	)
}

export function WinToggleSwitch(
	props: WinProps &
		WinChangeProps<boolean> & {
			IsOn?: boolean
			Header?: ReactNode
			OnContent?: ReactNode
			OffContent?: ReactNode
			onContent?: ReactNode
			offContent?: ReactNode
		}
): React.JSX.Element {
	const external = props.IsOn ?? props.modelValue ?? props.value
	const [on, setOn] = useControllable(
		external,
		Boolean(props.defaultValue),
		callback<boolean>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:modelValue",
			"onUpdate:Value",
			"onUpdate:IsOn"
		)
	)
	const [isDragging, setIsDragging] = useState(false)
	const [isPressed, setIsPressed] = useState(false)
	const [currentTx, setCurrentTx] = useState(on ? 20 : 0)
	const currentTxRef = useRef(on ? 20 : 0)
	const startX = useRef(0)
	const initialOn = useRef(false)
	const moved = useRef(false)
	const didToggle = useRef(false)
	const enabled = props.IsEnabled !== false && props.disabled !== true
	const resolvedOnContent = props.OnContent ?? props.onContent ?? props.Content ?? "On"
	const resolvedOffContent = props.OffContent ?? props.offContent ?? props.Content ?? "Off"
	const setIsOn = (next: boolean) => {
		setOn(next)
		callback<{ IsOn: boolean }>(props, "Toggled")?.({ IsOn: next })
	}
	useEffect(() => {
		if (!isDragging) {
			currentTxRef.current = on ? 20 : 0
			setCurrentTx(currentTxRef.current)
		}
	}, [isDragging, on])
	const handleWrapClick = (event: MouseEvent<HTMLDivElement>) => {
		if (!enabled) return
		if (didToggle.current) didToggle.current = false
		else setIsOn(!on)
		props.Click?.(event as MouseEvent<HTMLElement>)
	}
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!enabled || (event.key !== "Enter" && event.key !== " ")) return
		event.preventDefault()
		setIsOn(!on)
	}
	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!enabled) return
		event.stopPropagation()
		setIsPressed(true)
		setIsDragging(true)
		moved.current = false
		didToggle.current = false
		startX.current = event.clientX
		initialOn.current = on
		currentTxRef.current = on ? 20 : 0
		setCurrentTx(currentTxRef.current)
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isDragging) return
		const delta = event.clientX - startX.current
		if (Math.abs(delta) > 3) moved.current = true
		const next = initialOn.current ? 20 + delta : delta
		currentTxRef.current = Math.max(0, Math.min(20, next))
		setCurrentTx(currentTxRef.current)
	}
	const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isDragging) return
		setIsDragging(false)
		setIsPressed(false)
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId)
		didToggle.current = true
		if (moved.current) {
			const shouldToggle = initialOn.current
				? currentTxRef.current <= 10
				: currentTxRef.current >= 10
			setIsOn(shouldToggle ? !initialOn.current : initialOn.current)
		} else setIsOn(!initialOn.current)
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx("win-switch-root", "win-toggle-switch", props.className, props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Header && <WinTextBlock className="win-switch-header" Text={props.Header} />}
			<div
				className={cx("win-switch-wrap", !enabled ? "is-disabled" : undefined)}
				onClick={handleWrapClick}
			>
				<div
					className={cx(
						"win-switch",
						on ? "is-on" : undefined,
						isDragging ? "dragging" : undefined,
						isPressed ? "is-pressed" : undefined,
						!enabled ? "is-disabled" : undefined
					)}
					role="switch"
					aria-checked={Boolean(on)}
					aria-disabled={!enabled}
					tabIndex={enabled ? 0 : -1}
					onKeyDown={handleKeyDown}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
				>
					<div className="track" />
					<div
						className="knob"
						style={
							isDragging || isPressed
								? ({ "--tx": currentTx + "px" } as WinStyle)
								: undefined
						}
					>
						<div className="thumb" />
					</div>
				</div>
				<WinTextBlock className="win-switch-label">
					{props.children ?? (on ? resolvedOnContent : resolvedOffContent)}
				</WinTextBlock>
			</div>
		</div>
	)
}
