// SPDX-License-Identifier: GPL-3.0-only
import type { MouseEvent } from "react"
import { contentOf, cx } from "./winui-shared"
import type { WinProps } from "./winui-shared"

export function WinHyperlinkButton(props: WinProps & { NavigateUri?: string }): React.JSX.Element {
	const href = props.NavigateUri ?? props["href"]
	return (
		<a
			href={typeof href === "string" ? href : undefined}
			className={cx("win-hyperlink-button", props.class)}
			onClick={(event) => props.onClick?.(event as unknown as MouseEvent<HTMLElement>)}
		>
			{contentOf(props, props.children)}
		</a>
	)
}
