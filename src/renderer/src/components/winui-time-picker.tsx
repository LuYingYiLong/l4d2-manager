// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { useEffect, useRef, useState } from "react"
import { useFlyoutAnimation } from "./useFlyoutAnimation"
import { WinButton, WinTextBlock } from "./winui-primitives"
import { WinPickerColumn } from "./winui-picker-column"
import type { WinPickerColumnHandle } from "./winui-picker-column"
import { callback, commonStyle, cx } from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle } from "./winui-shared"

export type WinClockTime = {
	hour: number
	minute: number
}

function parseClockTime(value: unknown): WinClockTime | undefined {
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>
		const hour = Number(record.hour ?? record.Hour)
		const minute = Number(record.minute ?? record.Minute)
		if (Number.isFinite(hour) && Number.isFinite(minute))
			return {
				hour: Math.max(0, Math.min(23, Math.trunc(hour))),
				minute: Math.max(0, Math.min(59, Math.trunc(minute)))
			}
	}
	if (typeof value === "string") {
		const match = value.trim().match(/^(\d{1,2}):(\d{1,2})/)
		if (match) {
			const hour = Number(match[1])
			const minute = Number(match[2])
			if (hour <= 23 && minute <= 59) return { hour, minute }
		}
	}
	return undefined
}

function clockTimeText(time: WinClockTime | undefined, is12Hour = false, fallback = "--"): string {
	if (!time) return fallback
	const hour = is12Hour ? time.hour % 12 || 12 : time.hour
	return String(hour).padStart(2, "0")
}

function clockMinuteText(time: WinClockTime | undefined, fallback = "--"): string {
	return time ? String(time.minute).padStart(2, "0") : fallback
}

function clockTimeString(time: WinClockTime): string {
	return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`
}

export function WinTimePicker(
	props: WinProps &
		WinChangeProps<string | WinClockTime> & {
			ClockIdentifier?: string
			Language?: string
			MinuteIncrement?: number
			SelectedTime?: WinClockTime
			Time?: string | WinClockTime
		}
): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null)
	const flyoutRef = useRef<HTMLDivElement>(null)
	const hourColRef = useRef<WinPickerColumnHandle>(null)
	const minuteColRef = useRef<WinPickerColumnHandle>(null)
	const periodColRef = useRef<WinPickerColumnHandle>(null)
	const [localOpen, setLocalOpen] = useState(false)
	const [position, setPosition] = useState<WinStyle>({ top: 0, left: 0 })
	const externalTime = props.SelectedTime ?? props.Time ?? props.value
	const controlledTime =
		props.SelectedTime !== undefined || props.Time !== undefined || props.value !== undefined
	const [localTime, setLocalTime] = useState<WinClockTime | undefined>(() =>
		parseClockTime(externalTime)
	)
	const selectedTime = controlledTime ? parseClockTime(externalTime) : localTime
	const [draftTime, setDraftTime] = useState<WinClockTime | undefined>(undefined)
	const open = props.IsOpen ?? localOpen
	const animation = useFlyoutAnimation(open, {
		enterClass: "picker-flyout-animate",
		exitClass: "picker-flyout-closing"
	})
	const isEnabled = props.IsEnabled !== false
	const is12Hour = String(props.ClockIdentifier ?? "12HourClock") === "12HourClock"
	const minuteIncrement = Math.max(
		1,
		Math.min(59, Math.trunc(Number(props.MinuteIncrement ?? 1)) || 1)
	)
	const minuteValues = Array.from({ length: Math.ceil(60 / minuteIncrement) }, (_, index) =>
		Math.min(59, index * minuteIncrement)
	)
	const hourValues = is12Hour
		? Array.from({ length: 12 }, (_, index) => index + 1)
		: Array.from({ length: 24 }, (_, index) => index)
	const periodLabel = (hour: number) => {
		try {
			const parts = new Intl.DateTimeFormat(props.Language || undefined, {
				hour: "numeric",
				hour12: true
			}).formatToParts(new Date(2024, 0, 1, hour))
			return (
				parts.find((part) => part.type === "dayPeriod")?.value ?? (hour < 12 ? "AM" : "PM")
			)
		} catch {
			return hour < 12 ? "AM" : "PM"
		}
	}
	const periodValues = [periodLabel(9), periodLabel(15)]
	const draftBase = () => {
		const current = selectedTime ?? {
			hour: new Date().getHours(),
			minute: new Date().getMinutes()
		}
		return { hour: current.hour, minute: current.minute }
	}
	const timeForOutput = (next: WinClockTime): string | WinClockTime =>
		typeof props.Time === "string" || typeof props.value === "string"
			? clockTimeString(next)
			: next
	const setOpen = (next: boolean) => {
		if (props.IsOpen === undefined) setLocalOpen(next)
		if (next) animation.beginOpen()
		else animation.beginClose()
		callback<boolean>(props, "onUpdate:IsOpen", "IsOpenChanged")?.(next)
		callback<unknown>(
			props,
			next ? "onOpened" : "onClosed",
			next ? "Opened" : "Closed"
		)?.(undefined)
	}
	const updatePosition = () => {
		const anchor = containerRef.current
		if (!anchor) return
		const rect = anchor.getBoundingClientRect()
		const popup = flyoutRef.current
		const popupRect = popup?.getBoundingClientRect()
		const width = popupRect?.width ?? 242
		const height = popupRect?.height ?? 323
		const margin = 8
		const gap = 4
		const belowTop = rect.bottom + gap
		const aboveTop = rect.top - height - gap
		const top =
			belowTop + height <= window.innerHeight - margin
				? belowTop
				: aboveTop >= margin
					? aboveTop
					: Math.min(
							Math.max(margin, belowTop),
							Math.max(margin, window.innerHeight - height - margin)
						)
		const left = Math.min(
			Math.max(margin, rect.left),
			Math.max(margin, window.innerWidth - width - margin)
		)
		setPosition({ top, left, transformOrigin: "center center" })
	}
	const toggleOpen = () => {
		if (!isEnabled) return
		if (!open) setDraftTime(draftBase())
		setOpen(!open)
	}
	const updateDraft = (next: Partial<WinClockTime>) =>
		setDraftTime((current) => ({ ...(current ?? draftBase()), ...next }))
	const commitTime = () => {
		const fallback = draftTime ?? draftBase()
		const flushedHourIndex = hourColRef.current?.flush()
		const flushedMinuteIndex = minuteColRef.current?.flush()
		const flushedPeriodIndex = periodColRef.current?.flush()
		const nextHourValue = hourValues[flushedHourIndex ?? hourIndex] ?? 0
		const nextMinute = minuteValues[flushedMinuteIndex ?? minuteIndex] ?? fallback.minute
		const hour12 = nextHourValue % 12
		const nextHour = is12Hour
			? hour12 + ((flushedPeriodIndex ?? periodIndex) === 1 ? 12 : 0)
			: nextHourValue
		const nextTime = { hour: nextHour, minute: nextMinute }
		const oldTime = selectedTime
		if (!controlledTime) setLocalTime(nextTime)
		const output = timeForOutput(nextTime)
		callback<string | WinClockTime>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Time",
			"onUpdate:SelectedTime"
		)?.(output)
		callback<unknown>(
			props,
			"onTimeChanged",
			"TimeChanged",
			"SelectedTimeChanged"
		)?.({
			oldTime,
			newTime: nextTime
		})
		setOpen(false)
	}
	const closeWithoutCommit = () => setOpen(false)
	const currentDraft = draftTime ?? draftBase()
	const hourIndex = is12Hour ? (currentDraft.hour % 12 || 12) - 1 : currentDraft.hour
	const minuteIndex = Math.max(
		0,
		minuteValues.reduce(
			(best, minute, index) =>
				Math.abs(minute - currentDraft.minute) <
				Math.abs(minuteValues[best] - currentDraft.minute)
					? index
					: best,
			0
		)
	)
	const periodIndex = currentDraft.hour >= 12 ? 1 : 0
	useEffect(() => {
		if (!open) return undefined
		setDraftTime(draftBase())
		const frame = window.requestAnimationFrame(updatePosition)
		const onResize = () => updatePosition()
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") closeWithoutCommit()
		}
		window.addEventListener("resize", onResize)
		window.addEventListener("scroll", onResize, true)
		document.addEventListener("keydown", onKeyDown, true)
		return () => {
			window.cancelAnimationFrame(frame)
			window.removeEventListener("resize", onResize)
			window.removeEventListener("scroll", onResize, true)
			document.removeEventListener("keydown", onKeyDown, true)
		}
	}, [open])
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	return (
		<div
			ref={containerRef}
			className={cx("win-time-picker", className, legacyClassName)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Header && <WinTextBlock className="picker-header" Text={props.Header} />}
			<WinButton
				className={cx("picker-btn", !selectedTime ? "has-no-time" : undefined)}
				Padding="0"
				MinHeight={32}
				IsEnabled={isEnabled}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={toggleOpen}
			>
				<div className="picker-column-text">
					{selectedTime ? clockTimeText(selectedTime, is12Hour) : "--"}
				</div>
				<div className="picker-column-text">
					{selectedTime ? clockMinuteText(selectedTime) : "--"}
				</div>
				{is12Hour && (
					<div className="picker-column-text">
						{selectedTime ? periodValues[selectedTime.hour >= 12 ? 1 : 0] : "--"}
					</div>
				)}
			</WinButton>
			{props.Description && (
				<WinTextBlock className="picker-description" Text={props.Description} />
			)}
			{animation.isRendered &&
				createPortal(
					<>
						<div
							className="picker-overlay"
							aria-hidden="true"
							onPointerDown={closeWithoutCommit}
						/>
						<div
							ref={flyoutRef}
							className={cx(
								"picker-flyout",
								"time-picker-flyout",
								animation.animationClass
							)}
							role="dialog"
							style={position}
							onPointerDown={(event) => event.stopPropagation()}
							onAnimationEnd={(event) => {
								if (event.target === event.currentTarget) animation.onAnimationEnd()
							}}
						>
							<div className="picker-columns">
								<WinPickerColumn
									ref={hourColRef}
									className="picker-col-flex"
									Items={hourValues.map((hour) =>
										is12Hour ? String(hour) : String(hour).padStart(2, "0")
									)}
									value={hourIndex}
									Wrap
									AriaLabel="Hour"
									onValueChange={(value) => {
										const selected = hourValues[Number(value)] ?? 0
										if (!is12Hour) updateDraft({ hour: selected })
										else {
											const hour12 = selected % 12
											updateDraft({
												hour: hour12 + (currentDraft.hour >= 12 ? 12 : 0)
											})
										}
									}}
								/>
								<div className="picker-col-divider" />
								<WinPickerColumn
									ref={minuteColRef}
									className="picker-col-flex"
									Items={minuteValues.map((minute) =>
										String(minute).padStart(2, "0")
									)}
									value={minuteIndex}
									Wrap
									AriaLabel="Minute"
									onValueChange={(value) =>
										updateDraft({ minute: minuteValues[Number(value)] ?? 0 })
									}
								/>
								{is12Hour && (
									<>
										<div className="picker-col-divider" />
										<WinPickerColumn
											ref={periodColRef}
											className="picker-col-flex"
											Items={periodValues}
											value={periodIndex}
											Wrap={false}
											CanScrollUp={periodIndex > 0}
											CanScrollDown={periodIndex < periodValues.length - 1}
											AriaLabel="AM/PM"
											onValueChange={(value) => {
												const hour = currentDraft.hour % 12
												updateDraft({
													hour: hour + (Number(value) === 1 ? 12 : 0)
												})
											}}
										/>
									</>
								)}
							</div>
							<div className="picker-actions">
								<WinButton
									Style="SubtleButtonStyle"
									className="picker-action-btn"
									aria-label="Accept"
									Padding="0"
									Margin="4"
									MinWidth="0"
									MinHeight="0"
									FontSize="16"
									onClick={commitTime}
								>
									<span className="icon" aria-hidden="true">
										{"\uE8FB"}
									</span>
								</WinButton>
								<WinButton
									Style="SubtleButtonStyle"
									className="picker-action-btn"
									aria-label="Cancel"
									Padding="0"
									Margin="4"
									MinWidth="0"
									MinHeight="0"
									FontSize="16"
									onClick={closeWithoutCommit}
								>
									<span className="icon" aria-hidden="true">
										{"\uE711"}
									</span>
								</WinButton>
							</div>
						</div>
					</>,
					document.body
				)}
		</div>
	)
}
