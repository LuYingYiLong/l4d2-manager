// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useState } from "react"
import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react"

export type WinStyle = CSSProperties & Record<"--" | string, string | number | undefined>
export type WinItem = Record<string, unknown> | string | number
export type WinValue = string | number | boolean | null | undefined

export interface WinProps extends Omit<HTMLAttributes<HTMLElement>, "style"> {
	children?: ReactNode
	className?: string
	Content?: ReactNode
	Text?: ReactNode
	Header?: ReactNode
	Description?: ReactNode
	Title?: ReactNode
	Message?: ReactNode
	PrimaryButtonText?: string
	SecondaryButtonText?: string
	CloseButtonText?: string
	Subtitle?: ReactNode
	TextAlignment?: string
	TextWrapping?: string
	TextTrimming?: string
	CharacterSpacing?: string | number
	LineHeight?: string | number
	IsTextSelectionEnabled?: boolean
	IsPrimaryButtonEnabled?: boolean
	IsSecondaryButtonEnabled?: boolean
	IsLightDismissEnabled?: boolean
	Theme?: string
	PaneTitle?: ReactNode
	Pane?: ReactNode
	Target?: ReactNode
	ActionButtonContent?: ReactNode
	CloseButtonContent?: ReactNode
	Trigger?: ReactNode
	trigger?: ReactNode
	AreTransportControlsEnabled?: boolean
	IsReadOnly?: boolean
	IsIndeterminate?: boolean
	IsActive?: boolean
	InputScope?: string
	Rows?: number
	Style?: string
	IsEnabled?: boolean
	IsOpen?: boolean
	Open?: boolean
	visible?: boolean
	Width?: string | number
	Height?: string | number
	MinWidth?: string | number
	MaxWidth?: string | number
	MinHeight?: string | number
	MaxHeight?: string | number
	Margin?: string | number
	Padding?: string | number
	Background?: string
	Foreground?: string
	BorderBrush?: string
	BorderThickness?: string | number
	CornerRadius?: string | number
	HorizontalAlignment?: string
	VerticalAlignment?: string
	HorizontalContentAlignment?: string
	VerticalContentAlignment?: string
	FocusVisualMargin?: string | number
	UseSystemFocusVisuals?: boolean
	FontFamily?: string
	FontSize?: string | number
	FontWeight?: string | number
	IsDragRegion?: boolean
	class?: string
	style?: WinStyle
	Click?: (event: MouseEvent<HTMLElement>) => void
	Close?: () => void
	[key: string]: unknown
}

export interface WinChangeProps<T = WinValue> {
	value?: T
	defaultValue?: T
	modelValue?: T
	onValueChange?: (value: T) => void
	onChangeValue?: (value: T) => void
	["onUpdate:modelValue"]?: (value: T) => void
	["onUpdate:Value"]?: (value: T) => void
}

export interface WinItemProps extends WinProps {
	ItemsSource?: WinItem[]
	Items?: WinItem[]
	ItemTemplate?: (item: WinItem, index: number) => ReactNode
	renderItem?: (item: WinItem, index: number) => ReactNode
}

export const alignments: Record<string, string> = {
	Left: "flex-start",
	Center: "center",
	Right: "flex-end",
	Stretch: "stretch",
	Top: "flex-start",
	Bottom: "flex-end"
}

export const internalProps = new Set([
	"Content",
	"Text",
	"TextAlignment",
	"TextWrapping",
	"TextTrimming",
	"CharacterSpacing",
	"LineHeight",
	"IsTextSelectionEnabled",
	"Header",
	"Description",
	"Title",
	"Message",
	"Style",
	"IsEnabled",
	"IsOpen",
	"Open",
	"visible",
	"Width",
	"Height",
	"MinWidth",
	"MaxWidth",
	"MinHeight",
	"MaxHeight",
	"Margin",
	"Padding",
	"Background",
	"Foreground",
	"BorderBrush",
	"BorderThickness",
	"CornerRadius",
	"HorizontalAlignment",
	"VerticalAlignment",
	"HorizontalContentAlignment",
	"VerticalContentAlignment",
	"FontFamily",
	"FontSize",
	"FontWeight",
	"ItemsSource",
	"Items",
	"ItemTemplate",
	"renderItem",
	"Value",
	"value",
	"defaultValue",
	"modelValue",
	"SelectedIndex",
	"SelectedPageIndex",
	"SelectedItem",
	"SelectedValue",
	"SelectedValuePath",
	"DisplayMemberPath",
	"MenuItems",
	"MenuItemsSource",
	"FooterMenuItems",
	"FooterMenuItemsSource",
	"PaneDisplayMode",
	"IsPaneOpen",
	"IsPaneVisible",
	"IsPaneToggleButtonVisible",
	"IsSettingsVisible",
	"IsBackButtonVisible",
	"IsBackEnabled",
	"OpenPaneLength",
	"CompactPaneLength",
	"CompactModeThresholdWidth",
	"ExpandedModeThresholdWidth",
	"PaneTitle",
	"AlwaysShowHeader",
	"SelectionFollowsFocus",
	"SettingsLabel",
	"SettingsIcon",
	"PaneHeader",
	"PaneFooter",
	"PaneCustomContent",
	"AutoSuggestBox",
	"ContentOverlay",
	"Pane",
	"DisplayMode",
	"PanePlacement",
	"OpenPaneLength",
	"CompactPaneLength",
	"PaneBackground",
	"IsTabStop",
	"ZoomMode",
	"MinZoomFactor",
	"MaxZoomFactor",
	"ZoomFactor",
	"HorizontalScrollMode",
	"VerticalScrollMode",
	"HorizontalScrollBarVisibility",
	"VerticalScrollBarVisibility",
	"IsVerticalScrollChainingEnabled",
	"IsHorizontalScrollChainingEnabled",
	"isPaneOpen",
	"displayMode",
	"placement",
	"openPaneLength",
	"compactPaneLength",
	"paneBackground",
	"RootItems",
	"SelectionMode",
	"SelectedItems",
	"TabNavigation",
	"IsItemInvokedEnabled",
	"Layout",
	"IsGrouped",
	"IsItemClickEnabled",
	"CanReorderItems",
	"AreStickyGroupHeadersEnabled",
	"ItemContainerStyle",
	"CanDragItems",
	"AllowDrop",
	"items",
	"selectionMode",
	"canDragItems",
	"allowDrop",
	"depth",
	"rootItems",
	"IsDropDownOpen",
	"IsEditable",
	"MaxDropDownHeight",
	"PlaceholderText",
	"DebugProbe",
	"QueryIcon",
	"TextMemberPath",
	"UpdateTextOnSelect",
	"IsSuggestionListOpen",
	"MaxSuggestionListHeight",
	"AutoMaximizeSuggestionArea",
	"DesiredCandidateWindowAlignment",
	"LightDismissOverlayMode",
	"TextBoxStyle",
	"KeepInteriorCornersSquare",
	"OpenOnFocus",
	"TextSubmitted",
	"DropDownOpened",
	"DropDownClosed",
	"onTextSubmitted",
	"onDropDownOpened",
	"onDropDownClosed",
	"onSuggestionListOpenChange",
	"onOpened",
	"onClosed",
	"onPrimaryButtonClick",
	"onSecondaryButtonClick",
	"onCloseButtonClick",
	"PrimaryButtonClick",
	"SecondaryButtonClick",
	"CloseButtonClick",
	"primary",
	"secondary",
	"close",
	"onOpening",
	"Opening",
	"onClosing",
	"Closing",
	"onSelect",
	"Select",
	"Placement",
	"Gap",
	"ShowMode",
	"AnchorRect",
	"IsLightDismissEnabled",
	"FlyoutItems",
	"CloseAnimation",
	"OverlayInputPassThroughElement",
	"IsSticky",
	"DefaultLabelPosition",
	"PrimaryCommands",
	"SecondaryCommands",
	"IsDynamicOverflowEnabled",
	"OverflowButtonVisibility",
	"onDynamicOverflowItemsChanging",
	"DynamicOverflowItemsChanging",
	"onTextChanged",
	"TextChanged",
	"onSuggestionChosen",
	"SuggestionChosen",
	"onQuerySubmitted",
	"QuerySubmitted",
	"NumberOfPages",
	"MaxVisiblePips",
	"PreviousButtonVisibility",
	"NextButtonVisibility",
	"PreviousButtonStyle",
	"NextButtonStyle",
	"SelectedPipStyle",
	"NormalPipStyle",
	"WrapMode",
	"onSelectedIndexChanged",
	"SelectedIndexChanged",
	"IsChecked",
	"IsThreeState",
	"ThreeState",
	"isThreeState",
	"indeterminate",
	"onChecked",
	"onUnchecked",
	"onIndeterminate",
	"Checked",
	"Unchecked",
	"Indeterminate",
	"onIsCheckedChanged",
	"IsCheckedChanged",
	"IsOn",
	"OnContent",
	"OffContent",
	"onContent",
	"offContent",
	"GroupName",
	"name",
	"MaxColumns",
	"Orientation",
	"IndicatorMode",
	"ViewportSize",
	"InitialSetValue",
	"IsClearEnabled",
	"MaxRating",
	"PlaceholderValue",
	"Caption",
	"IsReadOnly",
	"IsActive",
	"IsIndeterminate",
	"Minimum",
	"Maximum",
	"SmallChange",
	"LargeChange",
	"StepFrequency",
	"TickFrequency",
	"TickPlacement",
	"SnapsTo",
	"IsThumbToolTipEnabled",
	"ThumbToolTipValueConverter",
	"showTicks",
	"tickFrequency",
	"vertical",
	"min",
	"max",
	"step",
	"ShowError",
	"ShowPaused",
	"VisualMode",
	"orientation",
	"indicatorMode",
	"viewportSize",
	"minimum",
	"maximum",
	"smallChange",
	"largeChange",
	"visualMode",
	"Visibility",
	"IsHitTestVisible",
	"DeterminateSource",
	"IndeterminateSource",
	"Severity",
	"IsIconVisible",
	"IsClosable",
	"IconSource",
	"ActionButton",
	"CloseButtonStyle",
	"CloseButtonCommand",
	"CloseButtonCommandParameter",
	"IsExpanded",
	"ExpandDirection",
	"HeaderIcon",
	"HeaderControls",
	"HorizontalContentAlignment",
	"VerticalContentAlignment",
	"disabled",
	"onSelectionChanged",
	"SelectionChanged",
	"onItemInvoked",
	"ItemInvoked",
	"onItemClick",
	"ItemClick",
	"onDragItemsStarting",
	"DragItemsStarting",
	"onDragItemsCompleted",
	"DragItemsCompleted",
	"DragOver",
	"Drop",
	"onViewChanged",
	"ViewChanged",
	"PivotItemLoading",
	"PivotItemLoaded",
	"PivotItemUnloading",
	"PivotItemUnloaded",
	"onPivotItemLoading",
	"onPivotItemLoaded",
	"onPivotItemUnloading",
	"onPivotItemUnloaded",
	"Checked",
	"Click",
	"Close",
	"children",
	"class",
	"style",
	"AutomationPropertiesName",
	"AutomationProperties.Name",
	"LeftItems",
	"RightItems",
	"TopItems",
	"BottomItems",
	"Trigger",
	"trigger",
	"onValueChange",
	"onChangeValue",
	"onScroll",
	"Scroll",
	"onValueChanged",
	"ValueChanged",
	"Labels",
	"ScrollController",
	"DetailLabelRequested",
	"scrollOffsetChanged",
	"ScrollOffsetChanged",
	"onUpdate:modelValue",
	"onUpdate:Value"
])

export function cssLength(value: unknown): string | undefined {
	if (value === "" || value === null || value === undefined) return undefined
	if (typeof value === "number") return String(value) + "px"
	const text = String(value).trim()
	return /^-?\d+(?:\.\d+)?$/.test(text) ? text + "px" : text
}

export function mediaCssLength(value: unknown): string | undefined {
	if (value === undefined || value === null || value === "") return undefined
	if (typeof value === "number") return `${value}px`
	const text = String(value).trim()
	return /^-?\d+(\.\d+)?$/.test(text) ? `${text}px` : text
}

export function xamlThickness(value: unknown): string | undefined {
	if (value === "" || value === null || value === undefined) return undefined
	const parts = String(value)
		.split(",")
		.map((part) => cssLength(part.trim()) ?? "")
	if (parts.length === 1) return parts[0]
	if (parts.length === 2) return parts[1] + " " + parts[0]
	if (parts.length === 4) return parts[1] + " " + parts[2] + " " + parts[3] + " " + parts[0]
	return String(value)
}

export function cx(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(" ")
}

export function domProps(props: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(props)) {
		if (!internalProps.has(key) && !key.startsWith("onUpdate:")) result[key] = value
	}
	return result
}

export function commonStyle(props: WinProps): WinStyle {
	const style: WinStyle = {}
	if (props.Width !== undefined && props.Width !== "") style.width = cssLength(props.Width)
	if (props.Height !== undefined && props.Height !== "") style.height = cssLength(props.Height)
	if (props.MinWidth !== undefined && props.MinWidth !== "")
		style.minWidth = cssLength(props.MinWidth)
	if (props.MaxWidth !== undefined && props.MaxWidth !== "")
		style.maxWidth = cssLength(props.MaxWidth)
	if (props.MinHeight !== undefined && props.MinHeight !== "")
		style.minHeight = cssLength(props.MinHeight)
	if (props.MaxHeight !== undefined && props.MaxHeight !== "")
		style.maxHeight = cssLength(props.MaxHeight)
	if (props.Margin !== undefined && props.Margin !== "")
		style.margin = xamlThickness(props.Margin)
	if (props.Padding !== undefined && props.Padding !== "")
		style.padding = xamlThickness(props.Padding)
	if (props.Background) style.background = props.Background
	if (props.Foreground) style.color = props.Foreground
	if (props.FontFamily) style.fontFamily = props.FontFamily
	if (props.FontSize !== undefined && props.FontSize !== "")
		style.fontSize = cssLength(props.FontSize)
	if (props.FontWeight !== undefined && props.FontWeight !== "")
		style.fontWeight = props.FontWeight
	if (props.HorizontalAlignment) style.justifySelf = props.HorizontalAlignment.toLowerCase()
	if (props.VerticalAlignment) style.alignSelf = props.VerticalAlignment.toLowerCase()
	if (props.CornerRadius !== undefined && props.CornerRadius !== "")
		style["--ControlCornerRadius"] = cssLength(props.CornerRadius)
	return style
}

export function contentOf(props: WinProps, children?: ReactNode): ReactNode {
	return children ?? props.Content ?? props.Text ?? ""
}

export function callback<T>(
	props: Record<string, unknown>,
	...names: string[]
): ((value: T) => void) | undefined {
	for (const name of names) {
		if (typeof props[name] === "function") return props[name] as (value: T) => void
	}
	return undefined
}

export function useControllable<T>(
	value: T | undefined,
	defaultValue: T,
	onValueChange?: (value: T) => void
): [T, (value: T | ((current: T) => T)) => void] {
	const [internal, setInternal] = useState(defaultValue)
	const current = value === undefined ? internal : value
	const set = (next: T | ((current: T) => T)) => {
		const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next
		if (value === undefined) setInternal(resolved)
		onValueChange?.(resolved)
	}
	return [current, set]
}

export function itemsOf(props: WinItemProps): WinItem[] {
	return props.ItemsSource ?? props.Items ?? []
}

export function itemLabel(item: WinItem): ReactNode {
	if (typeof item !== "object" || item === null) return item
	const record = item as Record<string, unknown>
	return (record.Text ??
		record.Title ??
		record.Label ??
		record.name ??
		record.value ??
		"") as ReactNode
}

export function itemRecord(item: WinItem): Record<string, unknown> {
	return typeof item === "object" && item !== null ? item : {}
}
