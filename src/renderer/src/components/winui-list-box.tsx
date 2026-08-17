// SPDX-License-Identifier: GPL-3.0-only
import { WinItemsView } from "./winui-items-view"
import { cx } from "./winui-shared"
import type { WinChangeProps, WinItem, WinItemProps, WinValue } from "./winui-shared"

export function WinListBox(
	props: WinItemProps &
		WinChangeProps<WinValue> & {
			SelectedIndex?: number
			SelectedItem?: WinItem
			SelectedItems?: WinItem[]
			SelectionMode?: "None" | "Single" | "Multiple" | "Extended"
		}
): React.JSX.Element {
	return (
		<WinItemsView
			{...props}
			SelectionMode={props.SelectionMode ?? "Single"}
			VerticalScrollMode="Auto"
			VerticalScrollBarVisibility="Auto"
			HorizontalScrollMode="Disabled"
			HorizontalScrollBarVisibility="Disabled"
			className={cx("win-list-box", props.className)}
		/>
	)
}
