// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import type { MouseEvent, ReactNode } from "react"
import { WinButton } from "./winui-primitives"
import { WinSplitButton } from "./winui-command-bars"
import type { WinButtonMenuProps } from "./winui-command-bars"
import { callback, cx, useControllable } from "./winui-shared"
import type { WinMenuItem } from "./winui-menu-flyout"
import type { WinChangeProps, WinProps, WinValue } from "./winui-shared"

export function WinToggleButton(
	props: WinProps &
		WinChangeProps<boolean | null> & {
			IsChecked?: boolean | null
			IsThreeState?: boolean
			ThreeState?: boolean
		}
): React.JSX.Element {
	const external =
		props.IsChecked !== undefined
			? props.IsChecked
			: props.modelValue !== undefined
				? props.modelValue
				: props.value
	const [checked, setChecked] = useControllable<boolean | null>(
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
	const isThreeState = props.IsThreeState ?? props.ThreeState ?? false
	const isChecked = checked === true
	const isIndeterminate = checked === null
	const isDisabled = props.IsEnabled === false || props.disabled === true
	const nextChecked = () => {
		if (!isThreeState) return !isChecked
		if (checked === false) return true
		if (checked === true) return null
		return false
	}
	return (
		<WinButton
			{...props}
			Click={undefined}
			Style={isChecked || isIndeterminate ? "AccentButtonStyle" : ""}
			className={cx(
				"win-toggle-button",
				isChecked ? "checked is-checked" : undefined,
				isIndeterminate ? "is-indeterminate" : undefined,
				isDisabled ? "is-disabled" : undefined,
				props.className
			)}
			aria-pressed={isIndeterminate ? "mixed" : isChecked}
			onClick={(event) => {
				if (isDisabled) return
				const next = nextChecked()
				callback<MouseEvent<HTMLElement>>(props, "Click")?.(event)
				setChecked(next)
				if (next === true)
					callback<MouseEvent<HTMLElement>>(props, "onChecked", "Checked")?.(event)
				else if (next === null)
					callback<MouseEvent<HTMLElement>>(
						props,
						"onIndeterminate",
						"Indeterminate"
					)?.(event)
				else callback<MouseEvent<HTMLElement>>(props, "onUnchecked", "Unchecked")?.(event)
				props.onClick?.(event)
			}}
		>
			{props.children}
		</WinButton>
	)
}

export function WinToggleSplitButton(
	props: WinButtonMenuProps &
		WinChangeProps<boolean> & {
			IsChecked?: boolean
		}
): React.JSX.Element {
	const external =
		props.IsChecked !== undefined
			? props.IsChecked
			: props.modelValue !== undefined
				? props.modelValue
				: props.value
	const [checked, setChecked] = useControllable<boolean>(
		external,
		false,
		callback<boolean>(props, "onValueChange", "onChangeValue")
	)
	const isDisabled = props.IsEnabled === false || props.disabled === true
	const className = typeof props.className === "string" ? props.className : undefined
	const flyoutDefinition = Array.isArray(props.Flyout)
		? { Items: props.Flyout }
		: (props.Flyout ?? { Items: [] })
	const sourceItems =
		(flyoutDefinition.Items?.length
			? flyoutDefinition.Items
			: props.Options?.length
				? props.Options
				: (props["options"] as WinMenuItem[] | undefined)) ?? []
	const normalizedSourceItems = sourceItems as WinMenuItem[]
	const splitOptions: WinMenuItem[] = normalizedSourceItems.map((item, index) => {
		if (typeof item === "string") return { Text: item, Value: index }
		const record = item as Record<string, unknown>
		return {
			...item,
			Text: (item.Text ?? record.Content ?? record.label ?? String(item)) as ReactNode,
			Value: item.Value ?? index
		}
	})
	const splitFlyout = { ...flyoutDefinition, Items: splitOptions }
	const handleSelect = (item: WinMenuItem) => {
		callback<WinMenuItem>(props, "onSelect", "Select")?.(item)
		callback<WinValue>(props, "optionClick")?.(item.Value)
	}
	const handleMainClick = (event: MouseEvent<HTMLElement>) => {
		if (isDisabled) return
		const next = !checked
		setChecked(next)
		callback<boolean>(props, "onUpdate:modelValue")?.(next)
		callback<boolean>(props, "onUpdate:IsChecked")?.(next)
		callback<MouseEvent<HTMLElement>>(props, "Click")?.(event)
		callback<MouseEvent<HTMLElement>>(props, "click")?.(event)
		callback<{ IsChecked: boolean }>(
			props,
			"onIsCheckedChanged",
			"IsCheckedChanged"
		)?.({
			IsChecked: next
		})
	}
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	return (
		<WinSplitButton
			{...props}
			Flyout={splitFlyout}
			Options={splitOptions}
			onSelect={undefined}
			Select={handleSelect}
			Click={handleMainClick}
			className={cx(
				"win-toggle-split-button",
				checked ? "is-checked" : undefined,
				className,
				legacyClassName
			)}
		/>
	)
}
