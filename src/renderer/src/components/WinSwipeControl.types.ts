// SPDX-License-Identifier: GPL-3.0-only
import type { ReactNode } from 'react'

export type SwipeSide = 'left' | 'right' | 'top' | 'bottom'
export interface SwipeItem {
  Text?: ReactNode
  Icon?: ReactNode
  Background?: string
  onClick?: () => void
}
export type SwipeItems = Partial<Record<SwipeSide, SwipeItem[]>>
