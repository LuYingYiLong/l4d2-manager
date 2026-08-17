// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { WinTextBlock } from "./winui-primitives"
import { WinCommandBarFlyout } from "./winui-command-bars"
import type { WinCommandBarFlyoutCommand } from "./winui-command-bars"
import { callback, commonStyle, cx, mediaCssLength } from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle } from "./winui-shared"

type WinRichEditBoxProps = WinProps &
	WinChangeProps<string> & {
		Value?: string
		Html?: string
		AcceptsReturn?: boolean
		CharacterCasing?: string
		ClipboardCopyFormat?: string
		IsSpellCheckEnabled?: boolean
		IsTextPredictionEnabled?: boolean
		MaxLength?: number
		PlaceholderText?: string
		ShowFormattingCommands?: boolean
		PrimaryCommands?: WinCommandBarFlyoutCommand[]
		SecondaryCommands?: WinCommandBarFlyoutCommand[]
		TextAlignment?: string
		TextReadingOrder?: string
		TextWrapping?: string
		SelectionHighlightColor?: string
		SelectionHighlightColorWhenNotFocused?: string
	}

function richTextEscape(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;"
		}
		return entities[character]
	})
}

export function WinRichEditBox(props: WinRichEditBoxProps): React.JSX.Element {
	const editorRef = useRef<HTMLDivElement>(null)
	const [isFocused, setIsFocused] = useState(false)
	const [commandOpen, setCommandOpen] = useState(false)
	const [commandAnchor, setCommandAnchor] = useState<DOMRect | null>(null)
	const [formatVersion, setFormatVersion] = useState(0)
	const savedSelection = useRef<Range | null>(null)
	const externalText =
		props.Text !== undefined
			? String(props.Text)
			: props.Value !== undefined
				? String(props.Value)
				: typeof props.value === "string"
					? props.value
					: undefined
	const externalHtml = typeof props.Html === "string" ? props.Html : undefined
	const initialHtml = externalHtml ?? richTextEscape(externalText ?? "")
	const [localHtml, setLocalHtml] = useState(initialHtml)
	const isEnabled = props.IsEnabled !== false
	const isReadOnly = props.IsReadOnly === true
	const canEdit = isEnabled && !isReadOnly
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	const readText = () => (editorRef.current?.innerText ?? "").replace(/\n$/, "")
	const readHtml = () => editorRef.current?.innerHTML ?? localHtml
	const saveSelection = () => {
		const selection = window.getSelection()
		if (
			selection &&
			selection.rangeCount > 0 &&
			editorRef.current?.contains(selection.anchorNode)
		) {
			savedSelection.current = selection.getRangeAt(0).cloneRange()
		}
	}
	const restoreSelection = () => {
		const selection = window.getSelection()
		const range = savedSelection.current
		if (!selection || !range) return
		selection.removeAllRanges()
		selection.addRange(range)
	}
	const selectionText = () => window.getSelection()?.toString() ?? ""
	const emitTextChange = () => {
		const editor = editorRef.current
		if (!editor) return
		const text = readText()
		const html = readHtml()
		setLocalHtml(html)
		callback<string>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Text",
			"onUpdate:Value"
		)?.(text)
		callback<string>(props, "onUpdate:Html")?.(html)
		callback<unknown>(props, "onTextChanged", "TextChanged")?.({ Text: text, Html: html })
	}
	const commandActive = (command: string) =>
		typeof document !== "undefined" && document.queryCommandState(command)
	const runCommand = (command: string) => {
		if (!canEdit) return
		editorRef.current?.focus()
		restoreSelection()
		try {
			document.execCommand(command)
		} catch {
			return
		}
		emitTextChange()
		setFormatVersion((value) => value + 1)
		saveSelection()
	}
	const command = (
		name: string,
		label: string,
		icon: string,
		commandName: string,
		isToggle = false
	): WinCommandBarFlyoutCommand => ({
		Name: name,
		Label: label,
		Icon: icon,
		IsToggle: isToggle,
		IsChecked: isToggle && commandActive(commandName),
		IsEnabled: isToggle ? canEdit : undefined,
		Click: () => runCommand(commandName)
	})
	const primaryCommands = [
		...(props.ShowFormattingCommands !== false
			? [
					command("BoldButton", "Bold", "Bold", "bold", true),
					command("ItalicButton", "Italic", "Italic", "italic", true),
					command("UnderlineButton", "Underline", "Underline", "underline", true)
				]
			: []),
		...(props.PrimaryCommands ?? [])
	]
	const secondaryCommands = [
		...(selectionText() && canEdit ? [command("CutButton", "Cut", "Cut", "cut")] : []),
		...(selectionText() ? [command("CopyButton", "Copy", "Copy", "copy")] : []),
		...(canEdit ? [command("PasteButton", "Paste", "Paste", "paste")] : []),
		command("UndoButton", "Undo", "Undo", "undo"),
		command("RedoButton", "Redo", "Redo", "redo"),
		command("SelectAllButton", "Select all", "SelectAll", "selectAll"),
		...(props.ShowFormattingCommands !== false && canEdit
			? [
					command("BulletsButton", "Bullets", "\uE8FD", "insertUnorderedList"),
					command("NumberingButton", "Numbering", "\uE8EF", "insertOrderedList"),
					command("ClearFormattingButton", "Clear formatting", "\uE894", "removeFormat")
				]
			: []),
		...(props.SecondaryCommands ?? [])
	]
	const syncExternalValue = () => {
		if (isFocused || !editorRef.current) return
		const nextHtml = externalHtml ?? richTextEscape(externalText ?? "")
		if (editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml
		setLocalHtml(nextHtml)
	}
	useEffect(syncExternalValue, [externalHtml, externalText, isFocused])
	const handleInput = () => {
		const editor = editorRef.current
		if (!editor) return
		const maxLength = Number(props.MaxLength ?? 0)
		let text = readText()
		const casing = String(props.CharacterCasing ?? "Normal")
		if (casing === "Upper") text = text.toUpperCase()
		if (casing === "Lower") text = text.toLowerCase()
		if (maxLength > 0 && text.length > maxLength) {
			text = text.slice(0, maxLength)
			editor.textContent = text
		}
		if (casing === "Upper" || casing === "Lower") {
			editor.textContent = text
		}
		emitTextChange()
		callback<unknown>(props, "onTextChanging", "TextChanging")?.({ IsContentChanging: true })
	}
	const openCommandBar = (event: React.MouseEvent<HTMLDivElement>) => {
		saveSelection()
		const selection = window.getSelection()
		const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null
		setCommandAnchor(
			rect && (rect.width || rect.height) ? rect : event.currentTarget.getBoundingClientRect()
		)
		setCommandOpen(true)
		callback<unknown>(
			props,
			"onContextMenuOpening",
			"ContextMenuOpening"
		)?.({
			Handled: false,
			CursorLeft: event.clientX,
			CursorTop: event.clientY
		})
	}
	const style: WinStyle = {
		...(props.style as WinStyle | undefined),
		...commonStyle(props),
		...(props.SelectionHighlightColor
			? { "--reb-selection-background": String(props.SelectionHighlightColor) }
			: {}),
		...(props.SelectionHighlightColorWhenNotFocused
			? {
					"--reb-selection-background-blur": String(
						props.SelectionHighlightColorWhenNotFocused
					)
				}
			: {})
	}
	const editorStyle: WinStyle = {
		textAlign: String(
			props.TextAlignment ?? "Left"
		).toLowerCase() as CSSProperties["textAlign"],
		whiteSpace: props.TextWrapping === "NoWrap" ? "pre" : "pre-wrap",
		overflowWrap: props.TextWrapping === "WrapWholeWords" ? "normal" : "break-word",
		direction: props.TextReadingOrder === "UseFlowDirection" ? "inherit" : undefined
	}
	return (
		<>
			<div
				className={cx(
					"win-rich-edit-box",
					className,
					legacyClassName,
					isFocused ? "focused" : undefined
				)}
				style={style}
			>
				{props.Header && (
					<WinTextBlock className="win-rich-edit-header" Text={props.Header} />
				)}
				<div
					className="win-rich-edit-scroll"
					style={{
						minHeight: mediaCssLength(props.MinHeight) ?? "118px",
						height: mediaCssLength(props.Height)
					}}
				>
					<div
						ref={editorRef}
						className="win-rich-edit-editor"
						contentEditable={canEdit}
						role="textbox"
						aria-multiline="true"
						aria-readonly={isReadOnly}
						aria-disabled={!isEnabled}
						data-placeholder={String(props.PlaceholderText ?? "")}
						spellCheck={props.IsSpellCheckEnabled !== false}
						aria-autocomplete={
							props.IsTextPredictionEnabled === false ? "none" : "both"
						}
						style={editorStyle}
						onInput={handleInput}
						onFocus={() => {
							setIsFocused(true)
							callback<unknown>(props, "onGotFocus", "GotFocus")?.(undefined)
						}}
						onBlur={() => {
							setIsFocused(false)
							callback<unknown>(props, "onLostFocus", "LostFocus")?.(undefined)
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" && props.AcceptsReturn === false)
								event.preventDefault()
							if (
								(event.ctrlKey || event.metaKey) &&
								event.key.toLowerCase() === "b"
							) {
								event.preventDefault()
								runCommand("bold")
							}
							if (
								(event.ctrlKey || event.metaKey) &&
								event.key.toLowerCase() === "i"
							) {
								event.preventDefault()
								runCommand("italic")
							}
							if (
								(event.ctrlKey || event.metaKey) &&
								event.key.toLowerCase() === "u"
							) {
								event.preventDefault()
								runCommand("underline")
							}
							callback<unknown>(
								props,
								"onSelectionChanged",
								"SelectionChanged"
							)?.(undefined)
						}}
						onKeyUp={saveSelection}
						onMouseUp={saveSelection}
						onContextMenu={openCommandBar}
						onPaste={(event) => {
							if (props.ClipboardCopyFormat === "PlainText") {
								event.preventDefault()
								const text = event.clipboardData.getData("text/plain")
								document.execCommand("insertText", false, text)
							}
							callback<unknown>(props, "onPaste", "Paste")?.({ Handled: false })
						}}
						onCopy={() =>
							callback<unknown>(
								props,
								"onCopyingToClipboard",
								"CopyingToClipboard"
							)?.({ Handled: false })
						}
						onCut={() =>
							callback<unknown>(
								props,
								"onCuttingToClipboard",
								"CuttingToClipboard"
							)?.({ Handled: false })
						}
					/>
				</div>
				{props.Description && (
					<WinTextBlock className="win-rich-edit-description" Text={props.Description} />
				)}
			</div>
			<WinCommandBarFlyout
				Open={commandOpen}
				AnchorRect={commandAnchor}
				PrimaryCommands={primaryCommands}
				SecondaryCommands={secondaryCommands}
				Placement="Auto"
				ShowMode="Standard"
				onValueChange={(open) => setCommandOpen(open)}
			/>
			{formatVersion > -1 && null}
		</>
	)
}
