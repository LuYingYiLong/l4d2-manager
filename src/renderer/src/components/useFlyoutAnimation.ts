// SPDX-License-Identifier: GPL-3.0-only
export function useFlyoutAnimation(open: boolean): {
  isAnimating: boolean
  animationClass: string
} {
  return { isAnimating: open, animationClass: open ? 'flyout-animate' : '' }
}

export default useFlyoutAnimation
