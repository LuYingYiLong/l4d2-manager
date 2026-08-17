// SPDX-License-Identifier: GPL-3.0-only
import type { ReactNode } from "react"

export type SwipeMode = "Reveal" | "Execute"
export type SwipeBehaviorOnInvoked = "Auto" | "Close" | "RemainOpen"
export type SwipeSide = "Left" | "Right" | "Top" | "Bottom"

export interface SwipeIconSource {
	Symbol?: string
	Glyph?: string
	UriSource?: string
}

export interface SwipeCommand {
	Label?: string
	Description?: string
	IconSource?: string | SwipeIconSource
	CanExecute?: (parameter?: unknown) => boolean
	Execute: (parameter?: unknown) => void
}

export interface SwipeItem {
	Text?: ReactNode
	Label?: ReactNode
	Icon?: ReactNode
	IconSource?: string | SwipeIconSource
	Background?: string
	Foreground?: string
	BehaviorOnInvoked?: SwipeBehaviorOnInvoked
	Command?: SwipeCommand
	CommandParameter?: unknown
	Invoked?: (sender: SwipeItem, args: { SwipeControl: { Close: () => void } }) => void
	onClick?: () => void
}

export interface SwipeItems {
	Mode?: SwipeMode
	Items: SwipeItem[]
}
