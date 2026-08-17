// SPDX-License-Identifier: GPL-3.0-only
import { WinTextBlock } from "./winui-primitives"
import { cx } from "./winui-shared"
import type { WinProps } from "./winui-shared"

export function WinFlyoutAnimation(props: WinProps): React.JSX.Element {
	return <div className={cx("win-flyout-animation", props.class)}>{props.children}</div>
}
export function TypographyRow(props: WinProps): React.JSX.Element {
	return (
		<div className={cx("typography-row", props.class)}>
			{props.children ?? <WinTextBlock Text={props.Text} />}
		</div>
	)
}
export function ColorBrushSection(props: WinProps): React.JSX.Element {
	return <section className={cx("color-brush-section", props.class)}>{props.children}</section>
}
export function BackgroundColorSection(props: WinProps): React.JSX.Element {
	return <ColorBrushSection {...props} />
}
export function FillColorSection(props: WinProps): React.JSX.Element {
	return <ColorBrushSection {...props} />
}
export function HighContrastColorSection(props: WinProps): React.JSX.Element {
	return <ColorBrushSection {...props} />
}
export function SignalColorSection(props: WinProps): React.JSX.Element {
	return <ColorBrushSection {...props} />
}
export function StrokeColorSection(props: WinProps): React.JSX.Element {
	return <ColorBrushSection {...props} />
}
export function TextColorSection(props: WinProps): React.JSX.Element {
	return <ColorBrushSection {...props} />
}
