// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import type { CSSProperties, HTMLAttributes, MouseEvent } from "react"
import {
	alignments,
	callback,
	commonStyle,
	contentOf,
	cssLength,
	cx,
	domProps
} from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

export function WinButton(props: WinProps): React.JSX.Element {
	const {
		children,
		className,
		disabled,
		onClick,
		Click,
		Style = "",
		IsEnabled = true,
		...rest
	} = props
	const isDisabled = Boolean(disabled) || IsEnabled === false
	const style: WinStyle = {
		...props.style,
		...commonStyle(props),
		...(props.Background
			? { background: undefined, "--ButtonBackground": props.Background }
			: {}),
		...(props.Foreground ? { color: undefined, "--ButtonForeground": props.Foreground } : {}),
		...(props.BorderBrush
			? {
					"--ButtonBorderBrush": props.BorderBrush,
					"--ButtonBorderBrushTop": props.BorderBrush,
					"--ButtonBorderBrushBottom": props.BorderBrush
				}
			: {}),
		...(props.BorderThickness !== undefined && props.BorderThickness !== ""
			? { "--ButtonBorderThemeThickness": cssLength(props.BorderThickness) }
			: {}),
		...(props.FocusVisualMargin !== undefined && props.FocusVisualMargin !== ""
			? { outlineOffset: cssLength(props.FocusVisualMargin) }
			: {}),
		...(props.CornerRadius !== undefined && props.CornerRadius !== ""
			? { "--ButtonCornerRadius": cssLength(props.CornerRadius) }
			: {}),
		...(props.HorizontalContentAlignment
			? {
					justifyContent:
						props.HorizontalContentAlignment === "Stretch"
							? "flex-start"
							: (alignments[props.HorizontalContentAlignment] ??
								props.HorizontalContentAlignment.toLowerCase())
				}
			: {}),
		...(props.VerticalContentAlignment
			? {
					alignItems:
						alignments[props.VerticalContentAlignment] ??
						props.VerticalContentAlignment.toLowerCase()
				}
			: {})
	}
	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (isDisabled) return
		onClick?.(event)
		Click?.(event as unknown as MouseEvent<HTMLElement>)
	}
	return (
		<button
			{...(domProps(rest) as HTMLAttributes<HTMLButtonElement>)}
			type={(rest.type as "button" | "submit" | "reset" | undefined) ?? "button"}
			className={cx(
				"win-btn",
				!Style || Style.includes("DefaultButtonStyle") ? "DefaultButtonStyle" : undefined,
				Style.includes("AccentButtonStyle") ? "AccentButtonStyle" : undefined,
				Style.includes("SubtleButtonStyle") ? "SubtleButtonStyle" : undefined,
				props.HorizontalContentAlignment === "Stretch"
					? "content-horizontal-stretch"
					: undefined,
				props.VerticalContentAlignment === "Stretch"
					? "content-vertical-stretch"
					: undefined,
				className,
				props.class
			)}
			style={style}
			disabled={isDisabled}
			onClick={handleClick}
		>
			{contentOf(props, children)}
		</button>
	)
}

export function WinTextBlock(props: WinProps): React.JSX.Element {
	const {
		children,
		className,
		Style = "",
		IsTextSelectionEnabled = false,
		TextWrapping = "",
		TextTrimming = "",
		MaxLines,
		...rest
	} = props
	const style: WinStyle = {
		...props.style,
		...commonStyle(props),
		userSelect: IsTextSelectionEnabled ? "text" : "none",
		...(props.CharacterSpacing !== undefined
			? { letterSpacing: Number(props.CharacterSpacing) / 1000 + "em" }
			: {}),
		...(props.LineHeight !== undefined ? { lineHeight: cssLength(props.LineHeight) } : {}),
		...(props.TextAlignment
			? { textAlign: props.TextAlignment.toLowerCase() as CSSProperties["textAlign"] }
			: {}),
		...(props.Foreground ? { color: props.Foreground } : {}),
		...(TextWrapping === "NoWrap" || TextTrimming ? { whiteSpace: "nowrap" } : {}),
		...(TextWrapping === "Wrap" ? { overflowWrap: "anywhere" } : {}),
		...(TextWrapping === "WrapWholeWords" ? { overflowWrap: "normal" } : {}),
		...(TextTrimming && TextTrimming !== "None"
			? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
			: {}),
		...(MaxLines !== undefined && MaxLines !== ""
			? {
					display: "-webkit-box",
					overflow: "hidden",
					WebkitLineClamp: String(MaxLines),
					WebkitBoxOrient: "vertical"
				}
			: {})
	}
	return (
		<span
			{...(domProps(rest) as HTMLAttributes<HTMLSpanElement>)}
			className={cx(
				"win-text-block",
				Style.includes("CustomTextBlockStyle") ? "CustomTextBlockStyle" : undefined,
				className,
				props.class
			)}
			style={style}
		>
			{contentOf(props, children)}
		</span>
	)
}

export function WinImage(
	props: WinProps & {
		Source?: string | { UriSource?: string; AutoPlay?: boolean }
		Stretch?: string
		NineGrid?: string | number
	}
): React.JSX.Element {
	const { Source = "", Stretch = "Uniform", NineGrid, className, ...rest } = props
	const source = typeof Source === "string" ? Source : (Source.UriSource ?? "")
	const stretch = Stretch.toLowerCase()
	const imageStyle: WinStyle = {
		width: stretch === "none" ? "auto" : (cssLength(props.Width) ?? "auto"),
		height: stretch === "none" ? "auto" : (cssLength(props.Height) ?? "auto"),
		objectFit:
			stretch === "fill"
				? "fill"
				: stretch === "uniformtofill"
					? "cover"
					: stretch === "none"
						? "none"
						: "contain"
	}
	return (
		<div
			{...(domProps(props) as HTMLAttributes<HTMLDivElement>)}
			className={cx(
				"win-image-host",
				NineGrid ? "has-nine-grid" : undefined,
				className,
				props.class
			)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			<img
				{...(domProps(rest) as HTMLAttributes<HTMLImageElement>)}
				className="win-image"
				src={source}
				alt={String(props["AutomationProperties.Name"] ?? "")}
				style={imageStyle}
				onLoad={(event) =>
					callback<unknown>(props, "onImageOpened", "ImageOpened")?.(event)
				}
				onError={(event) =>
					callback<unknown>(props, "onImageFailed", "ImageFailed")?.(event)
				}
			/>
		</div>
	)
}

export function WinStackPanel(
	props: WinProps & { Orientation?: string; Spacing?: string | number }
): React.JSX.Element {
	const { children, Orientation = "Vertical", Spacing = 0, className, ...rest } = props
	const horizontal = Orientation === "Horizontal"
	const contentAlignment = alignments[props.HorizontalContentAlignment ?? "Stretch"] ?? "stretch"
	return (
		<div
			{...(domProps(rest) as HTMLAttributes<HTMLDivElement>)}
			className={cx("win-stack-panel", className, props.class)}
			style={{
				...props.style,
				...commonStyle(props),
				flexDirection: horizontal ? "row" : "column",
				gap: cssLength(Spacing),
				justifyContent: horizontal ? contentAlignment : "flex-start",
				alignItems: horizontal ? "center" : contentAlignment
			}}
		>
			{children}
		</div>
	)
}

function gridDefinition(value: unknown): string | undefined {
	if (!value) return undefined
	return String(value)
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			if (part === "*") return "1fr"
			if (/^\d+(?:\.\d+)?\*$/.test(part)) return part.slice(0, -1) + "fr"
			if (/^\d+(?:\.\d+)?$/.test(part)) return part + "px"
			return part
		})
		.join(" ")
}

export function WinGrid(
	props: WinProps & {
		ColumnDefinitions?: string
		RowDefinitions?: string
		ColumnSpacing?: string | number
		RowSpacing?: string | number
	}
): React.JSX.Element {
	const {
		children,
		ColumnDefinitions,
		RowDefinitions,
		ColumnSpacing = 0,
		RowSpacing = 0,
		className,
		...rest
	} = props
	return (
		<div
			{...(domProps(rest) as HTMLAttributes<HTMLDivElement>)}
			className={cx("win-grid", className, props.class)}
			style={{
				...props.style,
				...commonStyle(props),
				gridTemplateColumns: gridDefinition(ColumnDefinitions),
				gridTemplateRows: gridDefinition(RowDefinitions),
				columnGap: cssLength(ColumnSpacing),
				rowGap: cssLength(RowSpacing)
			}}
		>
			{children}
		</div>
	)
}

export function WinRelativePanel(props: WinProps): React.JSX.Element {
	return (
		<div
			className={cx("win-relative-panel", props.className, props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.children}
		</div>
	)
}
export function WinVariableSizedWrapGrid(
	props: WinProps & {
		MaximumRowsOrColumns?: number
		ItemWidth?: string | number
		ItemHeight?: string | number
	}
): React.JSX.Element {
	return (
		<div
			className={cx("win-variable-wrap-grid", props.class)}
			style={{
				...props.style,
				...commonStyle(props),
				gridTemplateColumns: props.MaximumRowsOrColumns
					? "repeat(" + props.MaximumRowsOrColumns + ", minmax(0, 1fr))"
					: undefined,
				gridAutoRows: cssLength(props.ItemHeight),
				gridAutoColumns: cssLength(props.ItemWidth)
			}}
		>
			{props.children}
		</div>
	)
}
export function WinViewbox(props: WinProps & { Stretch?: string }): React.JSX.Element {
	return (
		<div
			className={cx("win-viewbox", props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.children}
		</div>
	)
}
