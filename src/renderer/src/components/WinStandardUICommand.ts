// SPDX-License-Identifier: GPL-3.0-only
export interface WinStandardUICommand {
	id?: string
	label?: string
	Icon?: string
	execute?: () => void
	IsEnabled?: boolean
}

export const StandardUICommands = {
	Copy: { id: "copy", label: "Copy" },
	Cut: { id: "cut", label: "Cut" },
	Paste: { id: "paste", label: "Paste" },
	SelectAll: { id: "select-all", label: "Select all" }
} as const

export default StandardUICommands
