// SPDX-License-Identifier: GPL-3.0-only
export function winTitleBarDragRegion(element: HTMLElement): () => void {
  element.style.setProperty('-webkit-app-region', 'drag')
  return () => element.style.removeProperty('-webkit-app-region')
}

export default winTitleBarDragRegion
