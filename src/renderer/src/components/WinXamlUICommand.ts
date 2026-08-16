// SPDX-License-Identifier: GPL-3.0-only
export interface WinXamlUICommand {
	Label?: string
	Description?: string
	IconSource?: string
	Command?: () => void
	CanExecute?: boolean
}

export function createXamlUICommand(command: WinXamlUICommand): WinXamlUICommand {
	return { CanExecute: true, ...command }
}

export default createXamlUICommand
