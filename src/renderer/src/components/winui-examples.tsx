// SPDX-License-Identifier: GPL-3.0-only
import { cx } from "./winui-shared"
import type { WinProps } from "./winui-shared"

export function WinSwitchPresenter(props: WinProps): React.JSX.Element {
	return <>{props.children}</>
}
export function WinCase(props: WinProps & { When?: boolean }): React.JSX.Element {
	return props.When === false ? <></> : <>{props.children}</>
}
export function WinControlExample(props: WinProps): React.JSX.Element {
	return <section className={cx("win-control-example", props.class)}>{props.children}</section>
}
export function WinThemeWrapper(props: WinProps & { theme?: string }): React.JSX.Element {
	return (
		<div
			className={cx(
				"win-theme-scope",
				"theme-" + (props.theme ?? props.Theme ?? "default"),
				props.class
			)}
		>
			{props.children}
		</div>
	)
}
