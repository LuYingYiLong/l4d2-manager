// SPDX-License-Identifier: GPL-3.0-only
import { WinTextBlock } from "./winui-primitives"
import { commonStyle, cx } from "./winui-shared"
import type { WinProps } from "./winui-shared"

export function WinSettingsCard(props: WinProps): React.JSX.Element {
	return (
		<section className={cx("win-settings-card", props.class)}>
			<WinTextBlock Text={props.Header} FontWeight={600} />
			{props.Description && (
				<WinTextBlock Text={props.Description} TextWrapping="WrapWholeWords" />
			)}
			{props.children}
		</section>
	)
}
export function WinPersonPicture(
	props: WinProps & { ProfilePicture?: string; DisplayName?: string }
): React.JSX.Element {
	const name = String(props.DisplayName ?? props["AutomationProperties.Name"] ?? "")
	return (
		<div
			className={cx("win-person-picture", props.class)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.ProfilePicture ? (
				<img src={props.ProfilePicture} alt={name} />
			) : (
				name.slice(0, 1).toUpperCase()
			)}
		</div>
	)
}
export function WinCanvas(
	props: WinProps & { Width?: number; Height?: number }
): React.JSX.Element {
	return (
		<canvas
			className={cx("win-canvas", props.class)}
			width={props.Width}
			height={props.Height}
		/>
	)
}
