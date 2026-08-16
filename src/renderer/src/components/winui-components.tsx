// SPDX-License-Identifier: GPL-3.0-only
// React adaptation of the WinUIonWeb component surface.
/* eslint-disable */

import { createPortal } from 'react-dom'
import {
	forwardRef,
	useEffect,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from 'react'
import type {
	CSSProperties,
	ChangeEvent,
	HTMLAttributes,
	InputHTMLAttributes,
	MouseEvent,
	ReactNode,
} from 'react'
import './winui.css'

export type WinStyle = CSSProperties & Record<'--' | string, string | number | undefined>
export type WinItem = Record<string, unknown> | string | number
export type WinValue = string | number | boolean | null | undefined

export interface WinProps extends Omit<HTMLAttributes<HTMLElement>, 'style'> {
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
	FontFamily?: string
	FontSize?: string | number
	FontWeight?: string | number
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
	['onUpdate:modelValue']?: (value: T) => void
	['onUpdate:Value']?: (value: T) => void
}

export interface WinItemProps extends WinProps {
	ItemsSource?: WinItem[]
	Items?: WinItem[]
	ItemTemplate?: (item: WinItem, index: number) => ReactNode
	renderItem?: (item: WinItem, index: number) => ReactNode
}

const alignments: Record<string, string> = {
	Left: 'flex-start',
	Center: 'center',
	Right: 'flex-end',
	Stretch: 'stretch',
	Top: 'flex-start',
	Bottom: 'flex-end',
}

const internalProps = new Set([
	'Content', 'Text', 'Header', 'Description', 'Title', 'Message', 'Style',
	'IsEnabled', 'IsOpen', 'Open', 'visible', 'Width', 'Height', 'MinWidth',
	'MaxWidth', 'MinHeight', 'MaxHeight', 'Margin', 'Padding', 'Background',
	'Foreground', 'BorderBrush', 'BorderThickness', 'CornerRadius',
	'HorizontalAlignment', 'VerticalAlignment', 'HorizontalContentAlignment',
	'VerticalContentAlignment', 'FontFamily', 'FontSize', 'FontWeight',
	'ItemsSource', 'Items', 'ItemTemplate', 'renderItem', 'Value', 'value',
	'defaultValue', 'modelValue', 'SelectedIndex', 'SelectedItem', 'IsChecked',
	'Checked', 'Click', 'Close', 'children', 'class', 'style', 'Trigger',
	'trigger', 'onValueChange', 'onChangeValue', 'onUpdate:modelValue',
	'onUpdate:Value',
])

export function cssLength(value: unknown): string | undefined {
	if (value === '' || value === null || value === undefined) return undefined
	if (typeof value === 'number') return String(value) + 'px'
	const text = String(value).trim()
	return /^-?\\d+(?:\\.\\d+)?$/.test(text) ? text + 'px' : text
}

export function xamlThickness(value: unknown): string | undefined {
	if (value === '' || value === null || value === undefined) return undefined
	const parts = String(value).split(',').map((part) => cssLength(part.trim()) ?? '')
	if (parts.length === 1) return parts[0]
	if (parts.length === 2) return parts[1] + ' ' + parts[0]
	if (parts.length === 4) return parts[1] + ' ' + parts[2] + ' ' + parts[3] + ' ' + parts[0]
	return String(value)
}

export function cx(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(' ')
}

function domProps(props: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(props)) {
		if (!internalProps.has(key) && !key.startsWith('onUpdate:')) result[key] = value
	}
	return result
}

function commonStyle(props: WinProps): WinStyle {
	const style: WinStyle = {}
	if (props.Width !== undefined && props.Width !== '') style.width = cssLength(props.Width)
	if (props.Height !== undefined && props.Height !== '') style.height = cssLength(props.Height)
	if (props.MinWidth !== undefined && props.MinWidth !== '') style.minWidth = cssLength(props.MinWidth)
	if (props.MaxWidth !== undefined && props.MaxWidth !== '') style.maxWidth = cssLength(props.MaxWidth)
	if (props.MinHeight !== undefined && props.MinHeight !== '') style.minHeight = cssLength(props.MinHeight)
	if (props.MaxHeight !== undefined && props.MaxHeight !== '') style.maxHeight = cssLength(props.MaxHeight)
	if (props.Margin !== undefined && props.Margin !== '') style.margin = xamlThickness(props.Margin)
	if (props.Padding !== undefined && props.Padding !== '') style.padding = xamlThickness(props.Padding)
	if (props.Background) style.background = props.Background
	if (props.Foreground) style.color = props.Foreground
	if (props.FontFamily) style.fontFamily = props.FontFamily
	if (props.FontSize !== undefined && props.FontSize !== '') style.fontSize = cssLength(props.FontSize)
	if (props.FontWeight !== undefined && props.FontWeight !== '') style.fontWeight = props.FontWeight
	if (props.HorizontalAlignment) style.justifySelf = props.HorizontalAlignment.toLowerCase()
	if (props.VerticalAlignment) style.alignSelf = props.VerticalAlignment.toLowerCase()
	if (props.CornerRadius !== undefined && props.CornerRadius !== '') style['--ControlCornerRadius'] = cssLength(props.CornerRadius)
	return style
}

function contentOf(props: WinProps, children?: ReactNode): ReactNode {
	return children ?? props.Content ?? props.Text ?? ''
}

function callback<T>(props: Record<string, unknown>, ...names: string[]): ((value: T) => void) | undefined {
	for (const name of names) {
		if (typeof props[name] === 'function') return props[name] as (value: T) => void
	}
	return undefined
}

function useControllable<T>(
	value: T | undefined,
	defaultValue: T,
	onValueChange?: (value: T) => void,
): [T, (value: T | ((current: T) => T)) => void] {
	const [internal, setInternal] = useState(defaultValue)
	const current = value === undefined ? internal : value
	const set = (next: T | ((current: T) => T)) => {
		const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next
		if (value === undefined) setInternal(resolved)
		onValueChange?.(resolved)
	}
	return [current, set]
}

function itemsOf(props: WinItemProps): WinItem[] {
	return props.ItemsSource ?? props.Items ?? []
}

function itemLabel(item: WinItem): ReactNode {
	if (typeof item !== 'object' || item === null) return item
	const record = item as Record<string, unknown>
	return (record.Text ?? record.Title ?? record.Label ?? record.name ?? record.value ?? '') as ReactNode
}

function renderItems(props: WinItemProps): ReactNode {
	const renderer = props.renderItem ?? props.ItemTemplate
	return itemsOf(props).map((item, index) => (
		<span key={index} className="win-generated-item">
			{renderer ? renderer(item, index) : itemLabel(item)}
		</span>
	))
}

export function WinButton(props: WinProps): React.JSX.Element {
	const { children, className, disabled, onClick, Click, Style = '', IsEnabled = true, ...rest } = props
	const isDisabled = Boolean(disabled) || IsEnabled === false
	const style: WinStyle = {
		...props.style,
		...commonStyle(props),
		...(props.BorderBrush ? { '--ButtonBorderBrush': props.BorderBrush } : {}),
		...(props.BorderThickness !== undefined && props.BorderThickness !== '' ? { '--ButtonBorderThemeThickness': cssLength(props.BorderThickness) } : {}),
		...(props.HorizontalContentAlignment ? { justifyContent: alignments[props.HorizontalContentAlignment] ?? props.HorizontalContentAlignment.toLowerCase() } : {}),
		...(props.VerticalContentAlignment ? { alignItems: alignments[props.VerticalContentAlignment] ?? props.VerticalContentAlignment.toLowerCase() } : {}),
	}
	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (isDisabled) return
		onClick?.(event)
		Click?.(event as unknown as MouseEvent<HTMLElement>)
	}
	return (
		<button
			{...(domProps(rest) as HTMLAttributes<HTMLButtonElement>)}
			type={(rest.type as 'button' | 'submit' | 'reset' | undefined) ?? 'button'}
			className={cx('win-btn', !Style || Style.includes('DefaultButtonStyle') ? 'DefaultButtonStyle' : undefined, Style.includes('AccentButtonStyle') ? 'AccentButtonStyle' : undefined, Style.includes('SubtleButtonStyle') ? 'SubtleButtonStyle' : undefined, className, props.class)}
			style={style}
			disabled={isDisabled}
			onClick={handleClick}
		>
			{contentOf(props, children)}
		</button>
	)
}

export function WinTextBlock(props: WinProps): React.JSX.Element {
	const { children, className, Style = '', IsTextSelectionEnabled = false, TextWrapping = '', TextTrimming = '', MaxLines, ...rest } = props
	const style: WinStyle = {
		...props.style,
		...commonStyle(props),
		userSelect: IsTextSelectionEnabled ? 'text' : 'none',
		...(props.CharacterSpacing !== undefined ? { letterSpacing: Number(props.CharacterSpacing) / 1000 + 'em' } : {}),
		...(props.LineHeight !== undefined ? { lineHeight: cssLength(props.LineHeight) } : {}),
		...(props.TextAlignment ? { textAlign: props.TextAlignment.toLowerCase() as CSSProperties['textAlign'] } : {}),
		...(props.Foreground ? { color: props.Foreground } : {}),
		...(TextWrapping === 'NoWrap' || TextTrimming ? { whiteSpace: 'nowrap' } : {}),
		...(TextWrapping === 'Wrap' ? { overflowWrap: 'anywhere' } : {}),
		...(TextWrapping === 'WrapWholeWords' ? { overflowWrap: 'normal' } : {}),
		...(TextTrimming && TextTrimming !== 'None' ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
		...(MaxLines !== undefined && MaxLines !== '' ? { display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: String(MaxLines), WebkitBoxOrient: 'vertical' } : {}),
	}
	return <span {...(domProps(rest) as HTMLAttributes<HTMLSpanElement>)} className={cx('win-text-block', Style.includes('CustomTextBlockStyle') ? 'CustomTextBlockStyle' : undefined, className, props.class)} style={style}>{contentOf(props, children)}</span>
}

export function WinImage(props: WinProps & { Source?: string | { UriSource?: string; AutoPlay?: boolean }; Stretch?: string; NineGrid?: string | number }): React.JSX.Element {
	const { Source = '', Stretch = 'Uniform', NineGrid, className, ...rest } = props
	const source = typeof Source === 'string' ? Source : Source.UriSource ?? ''
	const stretch = Stretch.toLowerCase()
	const imageStyle: WinStyle = {
		width: stretch === 'none' ? 'auto' : cssLength(props.Width) ?? 'auto',
		height: stretch === 'none' ? 'auto' : cssLength(props.Height) ?? 'auto',
		objectFit: stretch === 'fill' ? 'fill' : stretch === 'uniformtofill' ? 'cover' : stretch === 'none' ? 'none' : 'contain',
	}
	return <div className={cx('win-image-host', NineGrid ? 'has-nine-grid' : undefined, className, props.class)} style={{ ...props.style, ...commonStyle(props) }}><img {...(domProps(rest) as HTMLAttributes<HTMLImageElement>)} className="win-image" src={source} alt={String(props['AutomationProperties.Name'] ?? '')} style={imageStyle} onLoad={(event) => callback<unknown>(props, 'onImageOpened', 'ImageOpened')?.(event)} onError={(event) => callback<unknown>(props, 'onImageFailed', 'ImageFailed')?.(event)} /></div>
}

export function WinStackPanel(props: WinProps & { Orientation?: string; Spacing?: string | number }): React.JSX.Element {
	const { children, Orientation = 'Vertical', Spacing = 0, className, ...rest } = props
	const horizontal = Orientation === 'Horizontal'
	const contentAlignment = alignments[props.HorizontalContentAlignment ?? 'Stretch'] ?? 'stretch'
	return <div {...(domProps(rest) as HTMLAttributes<HTMLDivElement>)} className={cx('win-stack-panel', className, props.class)} style={{ ...props.style, ...commonStyle(props), flexDirection: horizontal ? 'row' : 'column', gap: cssLength(Spacing), justifyContent: horizontal ? contentAlignment : 'flex-start', alignItems: horizontal ? 'center' : contentAlignment }}>{children}</div>
}

function gridDefinition(value: unknown): string | undefined {
	if (!value) return undefined
	return String(value).split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
		if (part === '*') return '1fr'
		if (/^\\d+(?:\\.\\d+)?\\*$/.test(part)) return part.slice(0, -1) + 'fr'
		if (/^\\d+(?:\\.\\d+)?$/.test(part)) return part + 'px'
		return part
	}).join(' ')
}

export function WinGrid(props: WinProps & { ColumnDefinitions?: string; RowDefinitions?: string; ColumnSpacing?: string | number; RowSpacing?: string | number }): React.JSX.Element {
	const { children, ColumnDefinitions, RowDefinitions, ColumnSpacing = 0, RowSpacing = 0, className, ...rest } = props
	return <div {...(domProps(rest) as HTMLAttributes<HTMLDivElement>)} className={cx('win-grid', className, props.class)} style={{ ...props.style, ...commonStyle(props), gridTemplateColumns: gridDefinition(ColumnDefinitions), gridTemplateRows: gridDefinition(RowDefinitions), columnGap: cssLength(ColumnSpacing), rowGap: cssLength(RowSpacing) }}>{children}</div>
}

export function WinRelativePanel(props: WinProps): React.JSX.Element { return <div className={cx('win-relative-panel', props.className, props.class)} style={{ ...props.style, ...commonStyle(props) }}>{props.children}</div> }
export function WinVariableSizedWrapGrid(props: WinProps & { MaximumRowsOrColumns?: number; ItemWidth?: string | number; ItemHeight?: string | number }): React.JSX.Element { return <div className={cx('win-variable-wrap-grid', props.class)} style={{ ...props.style, ...commonStyle(props), gridTemplateColumns: props.MaximumRowsOrColumns ? 'repeat(' + props.MaximumRowsOrColumns + ', minmax(0, 1fr))' : undefined, gridAutoRows: cssLength(props.ItemHeight), gridAutoColumns: cssLength(props.ItemWidth) }}>{props.children}</div> }
export function WinViewbox(props: WinProps & { Stretch?: string }): React.JSX.Element { return <div className={cx('win-viewbox', props.class)} style={{ ...props.style, ...commonStyle(props) }}>{props.children}</div> }

export function WinCheckBox(props: WinProps & WinChangeProps<boolean> & { IsChecked?: boolean; ThreeState?: boolean }): React.JSX.Element {
	const external = props.modelValue ?? props.IsChecked ?? props.value
	const [checked, setChecked] = useControllable(external, Boolean(props.defaultValue ?? false), callback<boolean>(props, 'onValueChange', 'onChangeValue', 'onUpdate:modelValue', 'onUpdate:Value'))
	return <label className={cx('win-checkbox', checked ? 'checked' : undefined, props.class)}><input {...(domProps(props) as InputHTMLAttributes<HTMLInputElement>)} type="checkbox" checked={Boolean(checked)} disabled={props.IsEnabled === false} onChange={(event) => { setChecked(event.currentTarget.checked); callback<unknown>(props, 'onChange')?.(event) }} /><span className="win-checkbox-box" aria-hidden="true" /><span className="win-checkbox-content">{contentOf(props, props.children)}</span></label>
}

export function WinRadioButton(props: WinProps & WinChangeProps<WinValue> & { GroupName?: string; Value?: WinValue; IsChecked?: boolean }): React.JSX.Element {
	const selected = props.IsChecked ?? props.modelValue === (props.Value ?? props.value)
	return <label className={cx('win-radio-button', selected ? 'checked' : undefined, props.class)}><input {...(domProps(props) as InputHTMLAttributes<HTMLInputElement>)} type="radio" name={props.GroupName} checked={selected} disabled={props.IsEnabled === false} onChange={(event) => { callback<WinValue>(props, 'onValueChange', 'onChangeValue', 'onUpdate:modelValue', 'onUpdate:Value')?.(props.Value ?? props.value ?? true); callback<unknown>(props, 'onChange')?.(event) }} /><span className="win-radio-circle" aria-hidden="true" /><span>{contentOf(props, props.children)}</span></label>
}

export function WinRadioButtons(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number; Orientation?: string }): React.JSX.Element {
	const groupName = useId()
	const items = itemsOf(props)
	const [selected, setSelected] = useControllable(props.SelectedIndex ?? props.value, -1, callback<WinValue>(props, 'onValueChange', 'onUpdate:SelectedIndex'))
	return <div className={cx('win-radio-buttons', props.Orientation === 'Horizontal' ? 'horizontal' : undefined, props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}{items.map((item, index) => <WinRadioButton key={index} GroupName={groupName} IsChecked={selected === index} Content={itemLabel(item)} onValueChange={() => setSelected(index)} />)}</div>
}

export function WinToggleSwitch(props: WinProps & WinChangeProps<boolean> & { IsOn?: boolean; OnContent?: ReactNode; OffContent?: ReactNode }): React.JSX.Element {
	const external = props.IsOn ?? props.modelValue ?? props.value
	const [on, setOn] = useControllable(external, Boolean(props.defaultValue), callback<boolean>(props, 'onValueChange', 'onChangeValue', 'onUpdate:modelValue', 'onUpdate:Value'))
	return <label className={cx('win-toggle-switch', on ? 'on' : undefined, props.class)}><input {...(domProps(props) as InputHTMLAttributes<HTMLInputElement>)} type="checkbox" checked={Boolean(on)} disabled={props.IsEnabled === false} onChange={(event) => setOn(event.currentTarget.checked)} /><span className="win-toggle-track"><span className="win-toggle-thumb" /></span><span>{on ? props.OnContent ?? props.Content : props.OffContent ?? props.Content}</span></label>
}

export function WinToggleButton(props: WinProps & WinChangeProps<boolean> & { IsChecked?: boolean }): React.JSX.Element {
	const external = props.IsChecked ?? props.modelValue ?? props.value
	const [checked, setChecked] = useControllable(external, Boolean(props.defaultValue), callback<boolean>(props, 'onValueChange', 'onChangeValue', 'onUpdate:modelValue', 'onUpdate:Value'))
	return <WinButton {...props} className={cx('win-toggle-button', checked ? 'checked' : undefined, props.className)} aria-pressed={checked} onClick={(event) => { setChecked(!checked); props.onClick?.(event) }}>{props.children}</WinButton>
}

export function WinToggleSplitButton(props: WinProps & WinChangeProps<boolean>): React.JSX.Element { return <WinSplitButton {...props} className={cx('win-toggle-split-button', props.className)} /> }

export function WinSlider(props: WinProps & WinChangeProps<number> & { Minimum?: number; Maximum?: number; SmallChange?: number; Value?: number; Orientation?: string }): React.JSX.Element {
	const [value, setValue] = useControllable(props.Value ?? props.value, Number(props.defaultValue ?? props.Minimum ?? 0), callback<number>(props, 'onValueChange', 'onChangeValue', 'onUpdate:Value', 'onUpdate:modelValue'))
	return <label className={cx('win-slider', props.Orientation === 'Vertical' ? 'vertical' : undefined, props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}<input type="range" min={props.Minimum ?? 0} max={props.Maximum ?? 100} step={props.SmallChange ?? 1} value={Number(value)} disabled={props.IsEnabled === false} onChange={(event) => setValue(Number(event.currentTarget.value))} /><output>{value}</output></label>
}

export function WinNumberBox(props: WinProps & WinChangeProps<number> & { Value?: number; Minimum?: number; Maximum?: number; SmallChange?: number; PlaceholderText?: string }): React.JSX.Element {
	const [value, setValue] = useControllable(props.Value ?? props.value, Number(props.defaultValue ?? 0), callback<number>(props, 'onValueChange', 'onChangeValue', 'onUpdate:Value', 'onUpdate:modelValue'))
	return <label className={cx('win-number-box', props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}<input type="number" value={Number.isFinite(Number(value)) ? value : ''} min={props.Minimum} max={props.Maximum} step={props.SmallChange ?? 1} placeholder={props.PlaceholderText} disabled={props.IsEnabled === false} onChange={(event) => setValue(Number(event.currentTarget.value))} /></label>
}

export function WinTextBox(props: WinProps & WinChangeProps<string> & { Value?: string; PlaceholderText?: string; AcceptsReturn?: boolean; TextWrapping?: string; MaxLength?: number }): React.JSX.Element {
	const [value, setValue] = useControllable(props.Value ?? props.value, String(props.defaultValue ?? ''), callback<string>(props, 'onValueChange', 'onChangeValue', 'onUpdate:Value', 'onUpdate:modelValue'))
	const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setValue(event.currentTarget.value); callback<unknown>(props, 'onChange')?.(event) }
	const common = { value, placeholder: props.PlaceholderText, maxLength: props.MaxLength, disabled: props.IsEnabled === false, onChange: handleChange }
	const inputType = props.InputScope === 'Password' ? 'password' : props.InputScope === 'Number' ? 'number' : 'text'
	return <label className={cx('win-text-box-host', props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}{props.AcceptsReturn || props.TextWrapping === 'Wrap' ? <textarea {...common} rows={props.Rows} /> : <input {...common} type={inputType} />}</label>
}

export function WinPasswordBox(props: WinProps & WinChangeProps<string> & { Value?: string; PlaceholderText?: string }): React.JSX.Element { return <WinTextBox {...props} InputScope="Password" className={cx('win-password-box', props.className)} /> }
export function WinRichEditBox(props: WinProps & WinChangeProps<string> & { Value?: string }): React.JSX.Element { return <WinTextBox {...props} AcceptsReturn TextWrapping="Wrap" className={cx('win-rich-edit-box', props.className)} /> }
export function WinRichTextBlock(props: WinProps): React.JSX.Element { return <WinTextBlock {...props} className={cx('win-rich-text-block', props.className)} /> }

export function WinProgressBar(props: WinProps & { Value?: number; Minimum?: number; Maximum?: number; IsIndeterminate?: boolean }): React.JSX.Element {
	const min = props.Minimum ?? 0
	const max = props.Maximum ?? 100
	const percent = props.IsIndeterminate ? undefined : Math.max(0, Math.min(100, (((props.Value ?? 0) - min) / Math.max(1, max - min)) * 100))
	return <div className={cx('win-progress-bar', props.IsIndeterminate ? 'indeterminate' : undefined, props.class)} style={{ ...props.style, ...commonStyle(props) }} role="progressbar" aria-valuemin={min} aria-valuemax={max} aria-valuenow={percent === undefined ? undefined : props.Value}><span style={{ width: percent === undefined ? undefined : percent + '%' }} /></div>
}

export function WinProgressRing(props: WinProps & { IsActive?: boolean }): React.JSX.Element { return <span className={cx('win-progress-ring', props.IsActive === false ? 'inactive' : undefined, props.class)} role="progressbar" aria-label={String(props['aria-label'] ?? 'Loading')} /> }
export function WinRating(props: WinProps & WinChangeProps<number> & { Value?: number; MaxRating?: number; IsReadOnly?: boolean }): React.JSX.Element {
	const [value, setValue] = useControllable(props.Value ?? props.value, Number(props.defaultValue ?? 0), callback<number>(props, 'onValueChange', 'onChangeValue', 'onUpdate:Value', 'onUpdate:modelValue'))
	return <div className={cx('win-rating', props.class)}>{Array.from({ length: props.MaxRating ?? 5 }, (_, index) => <button key={index} type="button" disabled={props.IsReadOnly} className={index < Number(value) ? 'filled' : undefined} onClick={() => setValue(index + 1)}>★</button>)}</div>
}

export function WinInfoBadge(props: WinProps & { Value?: ReactNode; Icon?: ReactNode }): React.JSX.Element { return <span className={cx('win-info-badge', props.class)} style={{ ...props.style, ...commonStyle(props) }}>{props.Icon}{props.Value ?? contentOf(props, props.children)}</span> }
export function WinInfoBar(props: WinProps & { Severity?: string; IsOpen?: boolean; IsClosable?: boolean }): React.JSX.Element {
	const [open, setOpen] = useControllable(props.IsOpen, true, callback<boolean>(props, 'onValueChange', 'onUpdate:IsOpen'))
	if (!open) return <></>
	return <div className={cx('win-info-bar', 'severity-' + String(props.Severity ?? 'Informational').toLowerCase(), props.class)} role="status"><div className="win-info-bar-content">{props.Title && <WinTextBlock Text={props.Title} FontWeight={600} />}{props.Message ?? props.Content ?? props.children}</div>{props.IsClosable !== false && <WinButton Style="SubtleButtonStyle" aria-label="Close" onClick={() => setOpen(false)}>×</WinButton>}</div>
}

export interface WinFlyoutHandle { ShowAt: () => void; Hide: () => void; Toggle: () => void; IsOpen: boolean }

function getPosition(anchor: HTMLElement | null, popup: HTMLElement | null, placement: string): { top: number; left: number } {
	if (!anchor) return { top: 12, left: 12 }
	const rect = anchor.getBoundingClientRect()
	const popupRect = popup?.getBoundingClientRect()
	const top = placement.startsWith('Top') ? rect.top - (popupRect?.height ?? 0) - 6 : rect.bottom + 6
	const left = placement.endsWith('EdgeAlignedRight') ? rect.right - (popupRect?.width ?? 0) : rect.left
	return { top: Math.max(8, top), left: Math.max(8, left) }
}

export const WinFlyout = forwardRef<WinFlyoutHandle, WinProps & { Placement?: string; IsLightDismissEnabled?: boolean; Trigger?: ReactNode }>(function WinFlyout(props, ref) {
	const [localOpen, setLocalOpen] = useState(false)
	const open = props.IsOpen ?? props.Open ?? localOpen
	const anchor = useRef<HTMLSpanElement>(null)
	const popup = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState({ top: 0, left: 0 })
	const setOpen = (next: boolean) => {
		if (props.IsOpen === undefined && props.Open === undefined) setLocalOpen(next)
		callback<boolean>(props, 'onValueChange', 'onUpdate:IsOpen')?.(next)
		callback<unknown>(props, next ? 'onOpened' : 'onClosed', next ? 'Opened' : 'Closed')?.(undefined)
	}
	useImperativeHandle(ref, () => ({ ShowAt: () => setOpen(true), Hide: () => setOpen(false), Toggle: () => setOpen(!open), IsOpen: Boolean(open) }), [open])
	useEffect(() => {
		if (!open) return undefined
		const update = () => setPosition(getPosition(anchor.current, popup.current, String(props.Placement ?? 'Bottom')))
		const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
		update()
		document.addEventListener('keydown', onKey, true)
		window.addEventListener('resize', update)
		window.addEventListener('scroll', update, true)
		return () => { document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
	}, [open, props.Placement])
	const popupChildren = props.children as ReactNode
	const popupContent = open && typeof document !== 'undefined' ? createPortal(<><div className="win-flyout-dismiss-layer" onPointerDown={() => props.IsLightDismissEnabled !== false && setOpen(false)} /><div ref={popup} className={cx('win-flyout', props.Theme === 'light' ? 'theme-light' : props.Theme === 'dark' ? 'theme-dark' : undefined)} style={{ top: position.top, left: position.left }} onPointerDown={(event) => event.stopPropagation()}>{popupChildren}</div></>, document.body) : null
	const trigger = (props.Trigger ?? props.trigger) as ReactNode
	return <><span ref={anchor} className="win-flyout-anchor" onClick={() => trigger ? setOpen(!open) : undefined}>{trigger}</span>{popupContent}</>
})

export function WinPopup(props: WinProps): React.JSX.Element { return <WinFlyout {...props} className={cx('win-popup', props.className)} /> }

export interface WinContentDialogHandle { ShowAsync: () => Promise<string>; showAsync: () => Promise<string>; hide: () => void }

export const WinContentDialog = forwardRef<WinContentDialogHandle, WinProps & { PrimaryButtonText?: string; SecondaryButtonText?: string; CloseButtonText?: string; DefaultButton?: string; IsLightDismissEnabled?: boolean }>(function WinContentDialog(props, ref) {
	const [localOpen, setLocalOpen] = useState(false)
	const open = props.IsOpen ?? props.visible ?? localOpen
	const pending = useRef<((result: string) => void) | undefined>(undefined)
	const close = (result = 'None') => {
		if (props.IsOpen === undefined && props.visible === undefined) setLocalOpen(false)
		callback<boolean>(props, 'onUpdate:IsOpen', 'onUpdate:visible')?.(false)
		callback<string>(props, 'onClosed', 'Closed')?.(result)
		pending.current?.(result)
		pending.current = undefined
	}
	const show = () => { setLocalOpen(true); return new Promise<string>((resolve) => { pending.current = resolve }) }
	useImperativeHandle(ref, () => ({ ShowAsync: show, showAsync: show, hide: () => close() }), [])
	if (!open || typeof document === 'undefined') return <></>
	const button = (text: string | undefined, result: string, enabled: boolean, eventName: string) => text ? <WinButton disabled={!enabled} onClick={() => { callback<unknown>(props, eventName)?.(undefined); close(result) }}>{text}</WinButton> : null
	const dialogChildren = (props.children ?? props.Content) as ReactNode
	const title = props.Title as ReactNode
	const primaryText = props.PrimaryButtonText as string | undefined
	const secondaryText = props.SecondaryButtonText as string | undefined
	const closeText = props.CloseButtonText as string | undefined
	const primaryEnabled = props.IsPrimaryButtonEnabled as boolean | undefined
	const secondaryEnabled = props.IsSecondaryButtonEnabled as boolean | undefined
	return createPortal(<div className="win-content-dialog-overlay" onPointerDown={(event) => { if (event.currentTarget === event.target && props.IsLightDismissEnabled) close() }}><section className="win-content-dialog" role="dialog" aria-modal="true"><div className="win-content-dialog-content">{title && <WinTextBlock Text={title} FontSize={20} FontWeight={600} />}{dialogChildren}</div><div className="win-content-dialog-command-space">{button(primaryText, 'Primary', primaryEnabled !== false, 'onPrimaryButtonClick')}{button(secondaryText, 'Secondary', secondaryEnabled !== false, 'onSecondaryButtonClick')}{button(closeText, 'Close', true, 'onCloseButtonClick')}</div></section></div>, document.body)
})

export interface WinMenuItem { Text?: ReactNode; Icon?: ReactNode; Value?: WinValue; IsEnabled?: boolean; IsChecked?: boolean; Separator?: boolean;[key: string]: unknown }
export function WinMenuFlyout(props: WinProps & { Items?: WinMenuItem[]; FlyoutItems?: WinMenuItem[] }): React.JSX.Element {
	const items = props.Items ?? props.FlyoutItems ?? []
	const [open, setOpen] = useState(Boolean(props.IsOpen ?? props.Open))
	return <WinFlyout {...props} IsOpen={open} onValueChange={setOpen} Trigger={props.Trigger ?? props.trigger}><div className="win-menu-flyout">{items.map((item, index) => item.Separator ? <div key={index} className="win-menu-separator" /> : <button key={index} type="button" className="win-menu-item" disabled={item.IsEnabled === false} onClick={() => { callback<WinMenuItem>(props, 'onSelect', 'Select')?.(item); setOpen(false); callback<unknown>(props, 'onClose', 'Close')?.(undefined) }}>{item.Icon && <span>{item.Icon}</span>}<span>{item.Text ?? itemLabel(item)}</span>{item.IsChecked && <span>✓</span>}</button>)}</div>{props.children}</WinFlyout>
}

export function WinToolTip(props: WinProps & { Target?: ReactNode }): React.JSX.Element { const [open, setOpen] = useState(Boolean(props.IsOpen)); return <span className="win-tooltip-host" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>{props.Target ?? props.children}{open && <span className="win-tooltip" role="tooltip">{props.Content ?? props.Text}</span>}</span> }
export function WinToolTipService(props: WinProps): React.JSX.Element { return <>{props.children}</> }
export function WinTeachingTip(props: WinProps & { ActionButtonContent?: ReactNode; CloseButtonContent?: ReactNode }): React.JSX.Element { return <WinPopup {...props} className={cx('win-teaching-tip', props.className)}><WinTextBlock Text={props.Title} FontWeight={600} />{props.Subtitle && <WinTextBlock Text={props.Subtitle} TextWrapping="WrapWholeWords" />}{props.children}{props.ActionButtonContent && <WinButton onClick={() => callback<unknown>(props, 'onActionButtonClick')?.(undefined)}>{props.ActionButtonContent}</WinButton>}{props.CloseButtonContent && <WinButton onClick={() => callback<unknown>(props, 'onCloseButtonClick')?.(undefined)}>{props.CloseButtonContent}</WinButton>}</WinPopup> }
export function WinExpander(props: WinProps & { IsExpanded?: boolean; Header?: ReactNode }): React.JSX.Element { const [expanded, setExpanded] = useControllable(props.IsExpanded, false, callback<boolean>(props, 'onValueChange', 'onUpdate:IsExpanded')); return <section className={cx('win-expander', expanded ? 'expanded' : undefined, props.class)}><button type="button" className="win-expander-header" onClick={() => setExpanded(!expanded)}><span className="chevron-animate" />{props.Header ?? props.Content}</button>{expanded && <div className="win-expander-content">{props.children}</div>}</section> }
export function WinScrollViewer(props: WinProps & { HorizontalScrollMode?: string; VerticalScrollMode?: string }): React.JSX.Element { return <div className={cx('win-scroll-viewer', props.className, props.class)} style={{ ...props.style, ...commonStyle(props), overflowX: props.HorizontalScrollMode === 'Disabled' ? 'hidden' : 'auto', overflowY: props.VerticalScrollMode === 'Disabled' ? 'hidden' : 'auto' }}>{props.children}</div> }
export function WinScrollView(props: WinProps): React.JSX.Element { return <WinScrollViewer {...props} className={cx('win-scroll-view', props.className)} /> }
export function WinHorizontalScrollContainer(props: WinProps): React.JSX.Element { return <WinScrollViewer {...props} className={cx('win-horizontal-scroll', props.className)} HorizontalScrollMode="Enabled" VerticalScrollMode="Disabled" /> }
export function WinScrollBar(props: WinProps): React.JSX.Element { return <div className={cx('win-scroll-bar', props.class)}>{props.children}</div> }

export function WinItemsRepeater(props: WinItemProps): React.JSX.Element { return <div className={cx('win-items-repeater', props.class)}>{renderItems(props)}</div> }
export function WinItemsView(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number }): React.JSX.Element {
	const items = itemsOf(props)
	const [selected, setSelected] = useControllable(props.SelectedIndex ?? props.value, -1, callback<WinValue>(props, 'onValueChange', 'onUpdate:SelectedIndex'))
	return <div className={cx('win-items-view', props.class)}>{items.map((item, index) => <button key={index} type="button" className={cx('win-item', selected === index ? 'selected' : undefined)} onClick={() => { setSelected(index); callback<WinItem>(props, 'onItemClick', 'ItemClick')?.(item) }}>{props.renderItem ? props.renderItem(item, index) : itemLabel(item)}</button>)}</div>
}
export function WinListBox(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number }): React.JSX.Element { return <WinItemsView {...props} className={cx('win-list-box', props.className)} /> }
export function WinListView(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number }): React.JSX.Element { return <WinItemsView {...props} className={cx('win-list-view', props.className)} /> }
export function WinGridView(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number }): React.JSX.Element { return <WinItemsView {...props} className={cx('win-grid-view', props.className)} /> }
export function WinTreeView(props: WinItemProps & WinChangeProps<WinValue> & { RootItems?: WinItem[] }): React.JSX.Element {
	const renderTree = (items: WinItem[], level = 0): ReactNode => items.map((item, index) => { const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}; const children = Array.isArray(record.children) ? record.children as WinItem[] : []; return <div key={String(level) + '-' + String(index)} className="win-tree-node" style={{ paddingLeft: level * 16 }}><button type="button" onClick={() => callback<WinItem>(props, 'onItemClick', 'ItemClick')?.(item)}>{itemLabel(item)}</button>{children.length > 0 && renderTree(children, level + 1)}</div> })
	return <div className={cx('win-tree-view', props.class)}>{renderTree(props.RootItems ?? itemsOf(props))}</div>
}
export function WinComboBox(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number; SelectedItem?: WinItem; PlaceholderText?: string }): React.JSX.Element {
	const items = itemsOf(props)
	const initial = props.SelectedIndex ?? items.findIndex((item) => item === props.SelectedItem)
	const [selected, setSelected] = useControllable(props.SelectedIndex ?? props.value, initial >= 0 ? initial : -1, callback<WinValue>(props, 'onValueChange', 'onUpdate:SelectedIndex', 'onUpdate:modelValue'))
	const [open, setOpen] = useState(false)
	const selectedItem = typeof selected === 'number' ? items[selected] : items.find((item) => item === selected)
	return <div className={cx('win-combo-box', open ? 'open' : undefined, props.class)}><button type="button" className="win-combo-button" disabled={props.IsEnabled === false} onClick={() => setOpen(!open)}>{selectedItem ? itemLabel(selectedItem) : props.PlaceholderText ?? props.Header ?? ''}<span className="chevron-animate" /></button>{open && <div className="win-combo-flyout">{items.map((item, index) => <button key={index} type="button" className={cx('win-combo-item', selected === index ? 'selected' : undefined)} onClick={() => { setSelected(index); setOpen(false); callback<WinItem>(props, 'onSelectionChanged', 'SelectionChanged')?.(item) }}>{itemLabel(item)}</button>)}</div>}</div>
}
export function WinAutoSuggestBox(props: WinProps & WinChangeProps<string> & { Value?: string; PlaceholderText?: string }): React.JSX.Element { return <WinTextBox {...props} Value={props.Value ?? props.value} PlaceholderText={props.PlaceholderText} /> }
export function WinCalendarView(props: WinProps & WinChangeProps<Date> & { Date?: Date; SelectedDate?: Date; MinDate?: Date; MaxDate?: Date }): React.JSX.Element { const [date, setDate] = useControllable(props.SelectedDate ?? props.value, props.Date ?? new Date(), callback<Date>(props, 'onValueChange', 'onUpdate:SelectedDate')); return <input type="date" className={cx('win-calendar-view', props.class)} value={date instanceof Date ? date.toISOString().slice(0, 10) : ''} min={props.MinDate?.toISOString().slice(0, 10)} max={props.MaxDate?.toISOString().slice(0, 10)} onChange={(event) => setDate(new Date(event.currentTarget.value + 'T00:00:00'))} /> }
export function WinCalendarDatePicker(props: WinProps & WinChangeProps<Date> & { Date?: Date; SelectedDate?: Date }): React.JSX.Element { return <label className={cx('win-calendar-date-picker', props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}<WinCalendarView {...props} /></label> }
export function WinDatePicker(props: WinProps & WinChangeProps<Date> & { Date?: Date; SelectedDate?: Date }): React.JSX.Element { return <WinCalendarDatePicker {...props} className={cx('win-date-picker', props.className)} /> }
export function WinTimePicker(props: WinProps & WinChangeProps<string> & { Time?: string }): React.JSX.Element { const [time, setTime] = useControllable(props.Time ?? props.value, String(props.defaultValue ?? ''), callback<string>(props, 'onValueChange', 'onUpdate:Time')); return <label className={cx('win-time-picker', props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}<input type="time" value={String(time)} onChange={(event) => setTime(event.currentTarget.value)} /></label> }
export function WinColorPicker(props: WinProps & WinChangeProps<string> & { Color?: string }): React.JSX.Element { const [color, setColor] = useControllable(props.Color ?? props.value, String(props.defaultValue ?? '#0067c0'), callback<string>(props, 'onValueChange', 'onUpdate:Color')); return <label className={cx('win-color-picker', props.class)}>{props.Header && <WinTextBlock Text={props.Header} />}<input type="color" value={String(color)} onChange={(event) => setColor(event.currentTarget.value)} /></label> }
export function WinPickerColumn(props: WinItemProps & WinChangeProps<WinValue> & { SelectedIndex?: number }): React.JSX.Element { return <WinComboBox {...props} className={cx('win-picker-column', props.className)} /> }
export function WinPipsPager(props: WinProps & WinChangeProps<number> & { NumberOfPages?: number; SelectedPageIndex?: number }): React.JSX.Element { const [selected, setSelected] = useControllable(props.SelectedPageIndex ?? props.value, 0, callback<number>(props, 'onValueChange', 'onUpdate:SelectedPageIndex')); return <div className={cx('win-pips-pager', props.class)}>{Array.from({ length: props.NumberOfPages ?? 1 }, (_, index) => <button key={index} type="button" className={selected === index ? 'selected' : undefined} onClick={() => setSelected(index)}>●</button>)}</div> }
export function WinFlipView(props: WinItemProps & WinChangeProps<number> & { SelectedIndex?: number }): React.JSX.Element { const items = itemsOf(props); const [selected, setSelected] = useControllable(props.SelectedIndex ?? props.value, 0, callback<number>(props, 'onValueChange', 'onUpdate:SelectedIndex')); return <div className={cx('win-flip-view', props.class)}>{items[selected] && (props.renderItem ? props.renderItem(items[selected], selected) : itemLabel(items[selected]))}<button type="button" onClick={() => setSelected(Math.min(items.length - 1, Number(selected) + 1))}>›</button></div> }
export function WinPivot(props: WinItemProps & WinChangeProps<number> & { SelectedIndex?: number }): React.JSX.Element { const items = itemsOf(props); const [selected, setSelected] = useControllable(props.SelectedIndex ?? props.value, 0, callback<number>(props, 'onValueChange', 'onUpdate:SelectedIndex')); return <div className={cx('win-pivot', props.class)}><div className="win-pivot-tabs">{items.map((item, index) => <button key={index} type="button" className={selected === index ? 'selected' : undefined} onClick={() => setSelected(index)}>{itemLabel(item)}</button>)}</div><div className="win-pivot-content">{props.children ?? (items[selected] && itemLabel(items[selected]))}</div></div> }
export function WinPivotItem(props: WinProps): React.JSX.Element { return <div className="win-pivot-item">{props.children ?? contentOf(props)}</div> }
export function WinSelectorBar(props: WinItemProps & WinChangeProps<number> & { SelectedIndex?: number }): React.JSX.Element { return <WinPivot {...props} className={cx('win-selector-bar', props.className)} /> }
export function WinSelectorBarItem(props: WinProps): React.JSX.Element { return <button type="button" className={cx('win-selector-bar-item', props.class)}>{contentOf(props, props.children)}</button> }
export function WinSemanticZoom(props: WinProps): React.JSX.Element { return <div className={cx('win-semantic-zoom', props.class)}>{props.children}</div> }
export function WinNavigationView(props: WinItemProps & WinChangeProps<WinValue> & { MenuItems?: WinItem[]; PaneDisplayMode?: string }): React.JSX.Element { const items = props.MenuItems ?? itemsOf(props); const [selected, setSelected] = useControllable(props.value, 0, callback<WinValue>(props, 'onValueChange', 'onSelectionChanged')); return <div className={cx('win-navigation-view', props.class)}><aside className="win-navigation-pane"><div className="win-navigation-header">{props.Header ?? props.PaneTitle}</div>{items.map((item, index) => <button key={index} type="button" className={selected === index ? 'selected' : undefined} onClick={() => setSelected(index)}>{itemLabel(item)}</button>)}</aside><main className="win-navigation-content">{props.children}</main></div> }
export function WinSplitView(props: WinProps & { IsPaneOpen?: boolean }): React.JSX.Element { return <div className={cx('win-split-view', props.IsPaneOpen ? 'pane-open' : undefined, props.class)}><aside className="win-split-pane">{props.Pane}</aside><main>{props.children}</main></div> }
export function WinBreadcrumbBar(props: WinItemProps): React.JSX.Element { return <nav className={cx('win-breadcrumb-bar', props.class)}>{itemsOf(props).map((item, index) => <span key={index}>{index > 0 && <span aria-hidden="true"> / </span>}<button type="button" onClick={() => callback<WinItem>(props, 'onItemClicked', 'ItemClicked')?.(item)}>{itemLabel(item)}</button></span>)}</nav> }
export function WinPageHeader(props: WinProps): React.JSX.Element { return <header className={cx('win-page-header', props.class)}><WinTextBlock Text={props.Title ?? props.Header ?? props.Content} FontSize={28} FontWeight={600} />{props.children}</header> }
export function WinAppBarButton(props: WinProps): React.JSX.Element { return <WinButton {...props} className={cx('win-app-bar-button', props.className)} /> }
export function WinAppBarToggleButton(props: WinProps & WinChangeProps<boolean>): React.JSX.Element { return <WinToggleButton {...props} className={cx('win-app-bar-toggle-button', props.className)} /> }
export function WinAppBarSeparator(props: WinProps): React.JSX.Element { return <span className={cx('win-app-bar-separator', props.class)} aria-hidden="true" /> }
export function WinCommandBar(props: WinItemProps): React.JSX.Element { return <div className={cx('win-command-bar', props.class)}>{props.children ?? renderItems(props)}</div> }
export function WinCommandBarFlyout(props: WinProps): React.JSX.Element { return <WinFlyout {...props} className={cx('win-command-bar-flyout', props.className)} /> }
export function WinDropDownButton(props: WinProps & { Items?: WinMenuItem[] }): React.JSX.Element { return <WinSplitButton {...props} className={cx('win-dropdown-button', props.className)} /> }
export function WinSplitButton(props: WinProps & { Items?: WinMenuItem[] }): React.JSX.Element { return <div className={cx('win-split-button', props.class)}><WinButton {...props} className="win-split-main-button" />{props.Items && <WinMenuFlyout Items={props.Items} Trigger={<WinButton aria-label="Open menu">⌄</WinButton>} />}</div> }
export function WinMenuBar(props: WinItemProps): React.JSX.Element { return <nav className={cx('win-menu-bar', props.class)}>{props.children ?? renderItems(props)}</nav> }
export function WinSettingsCard(props: WinProps): React.JSX.Element { return <section className={cx('win-settings-card', props.class)}><WinTextBlock Text={props.Header} FontWeight={600} />{props.Description && <WinTextBlock Text={props.Description} TextWrapping="WrapWholeWords" />}{props.children}</section> }
export function WinPersonPicture(props: WinProps & { ProfilePicture?: string; DisplayName?: string }): React.JSX.Element { const name = String(props.DisplayName ?? props['AutomationProperties.Name'] ?? ''); return <div className={cx('win-person-picture', props.class)} style={{ ...props.style, ...commonStyle(props) }}>{props.ProfilePicture ? <img src={props.ProfilePicture} alt={name} /> : name.slice(0, 1).toUpperCase()}</div> }
export function WinCanvas(props: WinProps & { Width?: number; Height?: number }): React.JSX.Element { return <canvas className={cx('win-canvas', props.class)} width={props.Width} height={props.Height} /> }
export function WinCaptureElement(props: WinProps): React.JSX.Element { return <WinScrollViewer {...props} className={cx('win-capture-element', props.className)} /> }
export function WinMediaPlayerElement(props: WinProps & { Source?: string; AutoPlay?: boolean; IsLooping?: boolean; IsMuted?: boolean }): React.JSX.Element { return <video className={cx('win-media-player', props.class)} src={props.Source} autoPlay={props.AutoPlay} loop={props.IsLooping} muted={props.IsMuted} controls={props.AreTransportControlsEnabled !== false}>{props.children}</video> }
export function WinAnimatedVisualPlayer(props: WinProps): React.JSX.Element { return <div className={cx('win-animated-visual-player', props.class)}>{props.children ?? props.Content}</div> }
export function WinParallaxView(props: WinProps): React.JSX.Element { return <WinScrollViewer {...props} className={cx('win-parallax-view', props.className)} /> }
export function WinPullToRefresh(props: WinProps): React.JSX.Element { return <div className={cx('win-pull-to-refresh', props.class)} onPointerDown={() => callback<unknown>(props, 'onRefreshRequested', 'RefreshRequested')?.(undefined)}>{props.children}</div> }
export function WinRefreshContainer(props: WinProps): React.JSX.Element { return <WinPullToRefresh {...props} className={cx('win-refresh-container', props.className)} /> }
export function WinRefreshVisualizer(props: WinProps): React.JSX.Element { return <span className={cx('win-refresh-visualizer', props.class)}>{props.children ?? '↻'}</span> }
export function WinRepeatButton(props: WinProps): React.JSX.Element { return <WinButton {...props} className={cx('win-repeat-button', props.className)} /> }
export function WinSwipeControl(props: WinProps): React.JSX.Element { return <div className={cx('win-swipe-control', props.class)}>{props.children}</div> }
export function WinSwitchPresenter(props: WinProps): React.JSX.Element { return <>{props.children}</> }
export function WinCase(props: WinProps & { When?: boolean }): React.JSX.Element { return props.When === false ? <></> : <>{props.children}</> }
export function WinControlExample(props: WinProps): React.JSX.Element { return <section className={cx('win-control-example', props.class)}>{props.children}</section> }
export function WinThemeWrapper(props: WinProps & { theme?: string }): React.JSX.Element { return <div className={cx('win-theme-scope', 'theme-' + (props.theme ?? props.Theme ?? 'default'), props.class)}>{props.children}</div> }
export function WinTitleBar(props: WinProps): React.JSX.Element { return <header className={cx('win-title-bar', props.class)}>{props.children ?? <WinTextBlock Text={props.Title ?? props.Content} />}</header> }
export function WinFlyoutAnimation(props: WinProps): React.JSX.Element { return <div className={cx('win-flyout-animation', props.class)}>{props.children}</div> }
export function TypographyRow(props: WinProps): React.JSX.Element { return <div className={cx('typography-row', props.class)}>{props.children ?? <WinTextBlock Text={props.Text} />}</div> }
export function ColorBrushSection(props: WinProps): React.JSX.Element { return <section className={cx('color-brush-section', props.class)}>{props.children}</section> }
export function BackgroundColorSection(props: WinProps): React.JSX.Element { return <ColorBrushSection {...props} /> }
export function FillColorSection(props: WinProps): React.JSX.Element { return <ColorBrushSection {...props} /> }
export function HighContrastColorSection(props: WinProps): React.JSX.Element { return <ColorBrushSection {...props} /> }
export function SignalColorSection(props: WinProps): React.JSX.Element { return <ColorBrushSection {...props} /> }
export function StrokeColorSection(props: WinProps): React.JSX.Element { return <ColorBrushSection {...props} /> }
export function TextColorSection(props: WinProps): React.JSX.Element { return <ColorBrushSection {...props} /> }

export function WinAnnotatedScrollBar(props: WinProps): React.JSX.Element {
	return <WinScrollBar {...props} />
}

export function WinHyperlinkButton(props: WinProps & { NavigateUri?: string }): React.JSX.Element {
	const href = props.NavigateUri ?? props['href']
	return <a href={typeof href === 'string' ? href : undefined} className={cx('win-hyperlink-button', props.class)} onClick={(event) => props.onClick?.(event as unknown as MouseEvent<HTMLElement>)}>{contentOf(props, props.children)}</a>
}
