// SPDX-License-Identifier: GPL-3.0-only
import { useState } from "react"

export type FlyoutAnimationOptions = {
	enterClass?: string
	exitClass?: string
}

export function useFlyoutAnimation(
	open: boolean,
	options: FlyoutAnimationOptions = {}
): {
	isAnimating: boolean
	isClosing: boolean
	isRendered: boolean
	animationClass: string
	beginOpen: () => void
	beginClose: () => void
	onAnimationEnd: () => void
} {
	const [isClosing, setIsClosing] = useState(false)
	const isRendered = open || isClosing
	const beginOpen = (): void => {
		setIsClosing(false)
	}
	const beginClose = (): void => {
		if (open || isClosing) setIsClosing(true)
	}
	const onAnimationEnd = (): void => {
		if (isClosing) setIsClosing(false)
	}
	return {
		isAnimating: isRendered,
		isClosing,
		isRendered,
		animationClass: isClosing
			? (options.exitClass ?? "")
			: (options.enterClass ?? "flyout-animate"),
		beginOpen,
		beginClose,
		onAnimationEnd
	}
}

export default useFlyoutAnimation
