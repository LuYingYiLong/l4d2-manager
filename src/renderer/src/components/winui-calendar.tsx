// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { createPortal } from "react-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFlyoutAnimation } from "./useFlyoutAnimation"
import { WinButton, WinTextBlock } from "./winui-primitives"
import { WinScrollViewer } from "./winui-scrolling"
import type { WinScrollViewerHandle } from "./winui-scrolling"
import { WinPickerColumn } from "./winui-picker-column"
import type { WinPickerColumnHandle } from "./winui-picker-column"
import { callback, commonStyle, cx } from "./winui-shared"
import type { WinChangeProps, WinProps, WinStyle } from "./winui-shared"

type WinCalendarSelectionMode = "None" | "Single" | "Multiple" | string

type WinCalendarViewProps = WinProps &
	WinChangeProps<Date | undefined> & {
		CalendarIdentifier?: string
		DayOfWeekFormat?: string
		DisplayMode?: "Month" | "Year" | "Decade" | string
		FirstDayOfWeek?: string
		IsGroupLabelVisible?: boolean
		IsOutOfScopeEnabled?: boolean
		IsTodayHighlighted?: boolean
		Language?: string
		MaxDate?: Date
		MinDate?: Date
		NumberOfWeeksInView?: number
		SelectedDate?: Date
		SelectedDates?: Date[]
		SelectionMode?: WinCalendarSelectionMode
		Date?: Date
	}

type WinCalendarDayCell = {
	key: string
	date: string
	month: number
	year: number
	outOfScope: boolean
	isToday: boolean
	showLabel: boolean
	labelText: string
	fullDate: Date
}

type WinCalendarMonthCell = {
	key: string
	month: number
	year: number
	text: string
	outOfScope: boolean
	isTodayMonth: boolean
	showLabel: boolean
	labelText: string
}

type WinCalendarYearCell = {
	key: string
	year: number
	outOfScope: boolean
}

type WinCalendarViewTarget =
	| { mode: 0; year: number; month: number }
	| { mode: 1; year: number }
	| { mode: 2; decade: number }

function calendarDateKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function validCalendarDate(value: unknown): Date | undefined {
	return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined
}

export function WinCalendarView(props: WinCalendarViewProps): React.JSX.Element {
	const today = useMemo(() => new Date(), [])
	const isEnabled = props.IsEnabled !== false
	const isOutOfScopeEnabled = props.IsOutOfScopeEnabled !== false
	const isTodayHighlighted = props.IsTodayHighlighted !== false
	const isGroupLabelVisible = props.IsGroupLabelVisible !== false
	const selectionMode = props.SelectionMode ?? "Single"
	const minDate = validCalendarDate(props.MinDate) ?? new Date(1920, 0, 1)
	const maxDate = validCalendarDate(props.MaxDate) ?? new Date(2120, 11, 31)
	const minYear = minDate.getFullYear()
	const maxYear = maxDate.getFullYear()
	const language = props.Language ?? "en-US"
	const calendarIdentifier = props.CalendarIdentifier ?? "GregorianCalendar"
	const firstDayIndex =
		(
			{
				Sunday: 0,
				Monday: 1,
				Tuesday: 2,
				Wednesday: 3,
				Thursday: 4,
				Friday: 5,
				Saturday: 6
			} as Record<string, number>
		)[props.FirstDayOfWeek ?? "Sunday"] ?? 0
	const calendarLocale = useMemo(() => {
		const calendarNames: Record<string, string> = {
			GregorianCalendar: "gregory",
			HebrewCalendar: "hebrew",
			HijriCalendar: "islamic",
			JapaneseCalendar: "japanese",
			JulianCalendar: "gregory",
			KoreanCalendar: "gregory",
			PersianCalendar: "persian",
			TaiwanCalendar: "roc",
			ThaiCalendar: "buddhist",
			UmAlQuraCalendar: "islamic-umalqura"
		}
		const locale = `${language}-u-ca-${calendarNames[calendarIdentifier] ?? "gregory"}`
		try {
			new Intl.DateTimeFormat(locale).format()
			return locale
		} catch {
			return language
		}
	}, [calendarIdentifier, language])
	const shortMonths = useMemo(
		() =>
			Array.from({ length: 12 }, (_, month) =>
				new Intl.DateTimeFormat(calendarLocale, { month: "short" }).format(
					new Date(2024, month, 1)
				)
			),
		[calendarLocale]
	)
	const dayNames = useMemo(() => {
		const formatter = new Intl.DateTimeFormat(calendarLocale, { weekday: "short" })
		const names = Array.from({ length: 7 }, (_, day) =>
			formatter.format(new Date(2024, 0, 7 + day)).slice(0, 2)
		)
		return [...names.slice(firstDayIndex), ...names.slice(0, firstDayIndex)]
	}, [calendarLocale, firstDayIndex])
	const formatDayNumber = (date: Date) =>
		new Intl.NumberFormat(calendarLocale, { useGrouping: false }).format(date.getDate())
	const dateFromSerial = (serial: number) => {
		const date = new Date(serial * 24 * 60 * 60 * 1000)
		return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	}
	const dateSerial = (year: number, month: number, day: number) =>
		Math.floor(Date.UTC(year, month, day) / (24 * 60 * 60 * 1000))
	const weekdayOfSerial = (serial: number) =>
		(new Date(serial * 24 * 60 * 60 * 1000).getUTCDay() - firstDayIndex + 7) % 7
	const monthMeta = useMemo(() => {
		const firstDay = dateSerial(minYear, 0, 1)
		const lastDay = dateSerial(maxYear, 11, 31)
		const startSerial = firstDay - weekdayOfSerial(firstDay)
		const endSerial = lastDay + (6 - weekdayOfSerial(lastDay))
		const data: Array<{ y: number; m: number; startRow: number }> = []
		for (let year = minYear; year <= maxYear; year += 1) {
			for (let month = 0; month < 12; month += 1) {
				data.push({
					y: year,
					m: month,
					startRow: Math.floor((dateSerial(year, month, 1) - startSerial) / 7)
				})
			}
		}
		return {
			data,
			startSerial,
			totalRows: Math.floor((endSerial - startSerial) / 7) + 1
		}
	}, [firstDayIndex, maxYear, minYear])
	const initialYear = Math.max(minYear, Math.min(maxYear, today.getFullYear()))
	const initialMonth =
		initialYear === today.getFullYear()
			? today.getMonth()
			: initialYear === minYear
				? minDate.getMonth()
				: maxDate.getMonth()
	const initialDecade = Math.floor(initialYear / 10) * 10
	const initialDayTop =
		(monthMeta.data[(initialYear - minYear) * 12 + initialMonth]?.startRow ?? 0) * 40
	const initialMonthTop = (initialYear - minYear) * 180
	const initialYearTop = Math.max(0, Math.floor((initialDecade - minYear) / 4)) * 60
	const displayModeIndexes: Record<string, number> = { Month: 0, Year: 1, Decade: 2 }
	const [viewMode, setViewMode] = useState(displayModeIndexes[props.DisplayMode ?? "Month"] ?? 0)
	const [transitionDirection, setTransitionDirection] = useState("in")
	const [viewTransitionId, setViewTransitionId] = useState(0)
	const [headerMonth, setHeaderMonth] = useState(initialMonth)
	const [headerYear, setHeaderYear] = useState(initialYear)
	const [headerDecade, setHeaderDecade] = useState(initialDecade)
	const controlledSelectedDates = Array.isArray(props.SelectedDates)
		? props.SelectedDates.map(validCalendarDate).filter((date): date is Date => Boolean(date))
		: undefined
	const controlledDate = validCalendarDate(props.SelectedDate ?? props.value)
	const defaultDate = validCalendarDate(props.Date)
	const initialSelectedDates: Date[] =
		controlledSelectedDates ??
		(controlledDate ? [controlledDate] : defaultDate ? [defaultDate] : [])
	const [internalSelectedDates, setInternalSelectedDates] = useState<Date[]>(initialSelectedDates)
	const selectedDates =
		controlledSelectedDates ?? (controlledDate ? [controlledDate] : internalSelectedDates)
	const calendarRootRef = useRef<HTMLDivElement>(null)
	const dayScrollRef = useRef<WinScrollViewerHandle>(null)
	const monthScrollRef = useRef<WinScrollViewerHandle>(null)
	const yearScrollRef = useRef<WinScrollViewerHandle>(null)
	const pendingViewTargetRef = useRef<WinCalendarViewTarget | null>(null)
	const initialCalendarScrollReadyRef = useRef(false)
	const [dayScrollTop, setDayScrollTop] = useState(initialDayTop)
	const [monthScrollTop, setMonthScrollTop] = useState(initialMonthTop)
	const [yearScrollTop, setYearScrollTop] = useState(initialYearTop)
	const [dayRenderTop, setDayRenderTop] = useState(initialDayTop)
	const [monthRenderTop, setMonthRenderTop] = useState(initialMonthTop)
	const [yearRenderTop, setYearRenderTop] = useState(initialYearTop)
	const dayView = useMemo(() => {
		const rowHeight = 40
		const viewportHeight = 240
		const startRow = Math.max(0, Math.floor(dayScrollTop / rowHeight) - 4)
		const endRow = Math.min(
			monthMeta.totalRows,
			Math.floor((dayScrollTop + viewportHeight) / rowHeight) + 5
		)
		const visibleTop = dayScrollTop
		const visibleBottom = dayScrollTop + viewportHeight
		const firstVisibleRow = Math.max(0, Math.floor(visibleTop / rowHeight))
		const lastVisibleRow = Math.min(
			monthMeta.totalRows - 1,
			Math.floor((visibleBottom - 1) / rowHeight)
		)
		const visibleMonths = new Map<string, { year: number; month: number; pixels: number }>()
		for (let row = firstVisibleRow; row <= lastVisibleRow; row += 1) {
			const rowTop = row * rowHeight
			const rowBottom = rowTop + rowHeight
			const rowPixels = Math.min(rowBottom, visibleBottom) - Math.max(rowTop, visibleTop)
			if (rowPixels <= 0) continue
			for (let column = 0; column < 7; column += 1) {
				const date = dateFromSerial(monthMeta.startSerial + row * 7 + column)
				const key = `${date.getFullYear()}-${date.getMonth()}`
				const previous = visibleMonths.get(key)
				if (previous) previous.pixels += rowPixels
				else
					visibleMonths.set(key, {
						year: date.getFullYear(),
						month: date.getMonth(),
						pixels: rowPixels
					})
			}
		}
		let bestMonth: { year: number; month: number } | undefined
		visibleMonths.forEach((month) => {
			if (
				!bestMonth ||
				month.pixels >
					(visibleMonths.get(`${bestMonth.year}-${bestMonth.month}`)?.pixels ?? 0)
			) {
				bestMonth = month
			}
		})
		const scopeYear = bestMonth?.year ?? headerYear
		const scopeMonth = bestMonth?.month ?? headerMonth
		const cells: WinCalendarDayCell[] = []
		for (let row = startRow; row < endRow; row += 1) {
			for (let column = 0; column < 7; column += 1) {
				const date = dateFromSerial(monthMeta.startSerial + row * 7 + column)
				cells.push({
					key: `${row}-${column}`,
					date: formatDayNumber(date),
					month: date.getMonth(),
					year: date.getFullYear(),
					outOfScope: date.getFullYear() !== scopeYear || date.getMonth() !== scopeMonth,
					isToday: calendarDateKey(date) === calendarDateKey(today),
					showLabel: date.getDate() === 1,
					labelText: shortMonths[date.getMonth()],
					fullDate: date
				})
			}
		}
		return {
			cells,
			top: startRow * rowHeight,
			headerYear: bestMonth?.year ?? headerYear,
			headerMonth: bestMonth?.month ?? headerMonth,
			totalHeight: monthMeta.totalRows * rowHeight
		}
	}, [dayScrollTop, headerMonth, headerYear, monthMeta, shortMonths, today])
	const totalMonthPages = Math.max(1, maxYear - minYear + 1)
	const monthView = useMemo(() => {
		const rowHeight = 60
		const rowsPerYear = 3
		const viewportHeight = 240
		const totalRows = totalMonthPages * rowsPerYear
		const startRow = Math.max(0, Math.floor(monthScrollTop / rowHeight) - 1)
		const endRow = Math.min(
			totalRows,
			Math.ceil((monthScrollTop + viewportHeight) / rowHeight) + 1
		)
		const firstVisibleRow = Math.floor(monthScrollTop / rowHeight)
		const lastVisibleRow = Math.floor((monthScrollTop + viewportHeight - 1) / rowHeight)
		let bestYear = minYear
		let bestPixels = 0
		for (let row = firstVisibleRow; row <= lastVisibleRow; row += 1) {
			const year = minYear + Math.floor(row / rowsPerYear)
			const yearEndRow = (year - minYear + 1) * rowsPerYear - 1
			const segmentLastRow = Math.min(yearEndRow, lastVisibleRow)
			const pixels =
				Math.min((segmentLastRow + 1) * rowHeight, monthScrollTop + viewportHeight) -
				Math.max(row * rowHeight, monthScrollTop)
			if (pixels > bestPixels) {
				bestPixels = pixels
				bestYear = year
			}
			row = segmentLastRow
		}
		const items: WinCalendarMonthCell[] = []
		for (let row = startRow; row < endRow; row += 1) {
			const year = minYear + Math.floor(row / rowsPerYear)
			const localRow = row - Math.floor(row / rowsPerYear) * rowsPerYear
			for (let column = 0; column < 4; column += 1) {
				const month = localRow * 4 + column
				items.push({
					key: `m${row}-${column}`,
					month,
					year,
					text: shortMonths[month],
					outOfScope: year !== bestYear,
					isTodayMonth: year === today.getFullYear() && month === today.getMonth(),
					showLabel: month === 0 && column === 0,
					labelText: `${year}`
				})
			}
		}
		return {
			items,
			top: startRow * rowHeight,
			headerYear: bestYear,
			totalHeight: totalRows * rowHeight
		}
	}, [maxYear, minYear, monthScrollTop, shortMonths, today, totalMonthPages])
	const yearsPerRow = 4
	const totalYearRows = Math.max(1, Math.ceil((maxYear - minYear + 1) / yearsPerRow))
	const yearView = useMemo(() => {
		const rowHeight = 60
		const viewportHeight = 240
		const startRow = Math.max(0, Math.floor(yearScrollTop / rowHeight) - 1)
		const endRow = Math.min(
			totalYearRows,
			Math.ceil((yearScrollTop + viewportHeight) / rowHeight) + 1
		)
		const firstVisibleRow = Math.max(0, Math.floor(yearScrollTop / rowHeight))
		const lastVisibleRow = Math.min(
			totalYearRows - 1,
			Math.floor((yearScrollTop + viewportHeight - 1) / rowHeight)
		)
		const visibleDecades = new Map<number, number>()
		for (let row = firstVisibleRow; row <= lastVisibleRow; row += 1) {
			const rowTop = row * rowHeight
			const rowBottom = rowTop + rowHeight
			const rowPixels =
				Math.min(rowBottom, yearScrollTop + viewportHeight) -
				Math.max(rowTop, yearScrollTop)
			for (let column = 0; column < yearsPerRow; column += 1) {
				const year = minYear + row * yearsPerRow + column
				if (year > maxYear) continue
				const decade = Math.floor(year / 10) * 10
				visibleDecades.set(decade, (visibleDecades.get(decade) ?? 0) + rowPixels)
			}
		}
		let bestDecade = headerDecade
		let bestPixels = 0
		visibleDecades.forEach((pixels, decade) => {
			if (pixels > bestPixels) {
				bestPixels = pixels
				bestDecade = decade
			}
		})
		const items: WinCalendarYearCell[] = []
		for (let row = startRow; row < endRow; row += 1) {
			for (let column = 0; column < yearsPerRow; column += 1) {
				const year = minYear + row * yearsPerRow + column
				if (year <= maxYear) {
					items.push({
						key: `y${row}-${column}`,
						year,
						outOfScope: year < bestDecade || year >= bestDecade + 10
					})
				}
			}
		}
		return {
			items,
			top: startRow * rowHeight,
			headerDecade: bestDecade,
			totalHeight: totalYearRows * rowHeight
		}
	}, [headerDecade, maxYear, minYear, totalYearRows, yearScrollTop])
	const selectedDateKeys = useMemo(
		() => new Set(selectedDates.map(calendarDateKey)),
		[selectedDates]
	)
	const labelText = useMemo(() => {
		const date = new Date(headerYear, headerMonth, 1)
		if (viewMode === 0)
			return new Intl.DateTimeFormat(calendarLocale, {
				month: "long",
				year: "numeric"
			}).format(date)
		if (viewMode === 1)
			return new Intl.DateTimeFormat(calendarLocale, { year: "numeric" }).format(date)
		return `${headerDecade} - ${headerDecade + 9}`
	}, [calendarLocale, headerDecade, headerMonth, headerYear, viewMode])
	const setSelection = (next: Date[], addedDates: Date[], removedDates: Date[]) => {
		if (
			controlledSelectedDates === undefined &&
			props.SelectedDate === undefined &&
			props.value === undefined
		)
			setInternalSelectedDates(next)
		callback<Date[]>(props, "onUpdate:SelectedDates")?.(next)
		callback<Date | undefined>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:SelectedDate",
			"onUpdate:Value"
		)?.(next[0])
		callback<unknown>(
			props,
			"onSelectedDatesChanged",
			"SelectedDatesChanged"
		)?.({
			addedDates,
			removedDates
		})
	}
	const runAfterLayout = (action: () => void) => {
		const frame = globalThis.requestAnimationFrame
		if (frame) frame(() => frame(action))
		else globalThis.setTimeout(action, 0)
	}
	const setViewerTop = (
		viewer: React.MutableRefObject<WinScrollViewerHandle | null>,
		top: number
	) => {
		viewer.current?.ChangeView(null, top, null)
	}
	const scrollDayTo = (year: number, month: number) => {
		const index = Math.max(
			0,
			Math.min(monthMeta.data.length - 1, (year - minYear) * 12 + month)
		)
		const meta = monthMeta.data[index]
		if (!meta) return
		const top = meta.startRow * 40
		setDayScrollTop(top)
		runAfterLayout(() => {
			setViewerTop(dayScrollRef, meta.startRow * 40)
		})
	}
	const scrollMonthTo = (year: number) => {
		const boundedYear = Math.max(minYear, Math.min(maxYear, year))
		const top = (boundedYear - minYear) * 180
		setMonthScrollTop(top)
		runAfterLayout(() => {
			setViewerTop(monthScrollRef, top)
		})
	}
	const scrollYearTo = (decade: number) => {
		const row = Math.max(
			0,
			Math.min(totalYearRows - 1, Math.floor((decade - minYear) / yearsPerRow))
		)
		const top = row * 60
		setYearScrollTop(top)
		runAfterLayout(() => {
			setViewerTop(yearScrollRef, top)
		})
	}
	const handleDayScroll = () => {
		if (!initialCalendarScrollReadyRef.current) return
		setDayScrollTop(dayScrollRef.current?.VerticalOffset ?? 0)
	}
	const handleMonthScroll = () => {
		if (!initialCalendarScrollReadyRef.current) return
		setMonthScrollTop(monthScrollRef.current?.VerticalOffset ?? 0)
	}
	const handleYearScroll = () => {
		if (!initialCalendarScrollReadyRef.current) return
		setYearScrollTop(yearScrollRef.current?.VerticalOffset ?? 0)
	}
	const isDaySelected = (cell: WinCalendarDayCell) =>
		selectedDateKeys.has(calendarDateKey(cell.fullDate))
	const isMonthSelected = (item: WinCalendarMonthCell) =>
		selectedDates.some(
			(date) => date.getFullYear() === item.year && date.getMonth() === item.month
		)
	const selectDay = (cell: WinCalendarDayCell) => {
		if (!isEnabled || (cell.outOfScope && !isOutOfScopeEnabled) || selectionMode === "None")
			return
		callback<unknown>(
			props,
			"onCalendarViewDayItemChanging",
			"CalendarViewDayItemChanging"
		)?.({
			Date: cell.fullDate,
			OriginalSource: cell
		})
		const oldDates = [...selectedDates]
		if (selectionMode === "Single") {
			const wasSelected = isDaySelected(cell)
			const next = wasSelected ? [] : [cell.fullDate]
			setSelection(
				next,
				wasSelected ? [] : next,
				wasSelected
					? oldDates
					: oldDates.filter(
							(date) => calendarDateKey(date) !== calendarDateKey(cell.fullDate)
						)
			)
		} else if (selectionMode === "Multiple") {
			const next = [...selectedDates]
			const index = next.findIndex(
				(date) => calendarDateKey(date) === calendarDateKey(cell.fullDate)
			)
			const addedDates: Date[] = []
			const removedDates: Date[] = []
			if (index >= 0) removedDates.push(...next.splice(index, 1))
			else {
				next.push(cell.fullDate)
				addedDates.push(cell.fullDate)
			}
			setSelection(next, addedDates, removedDates)
		}
	}
	const focusCalendarCell = (selector: string) => {
		runAfterLayout(() => {
			globalThis.setTimeout(() => {
				calendarRootRef.current?.querySelector<HTMLElement>(selector)?.focus()
			}, 0)
		})
	}
	const moveCalendarDayFocus = (cell: WinCalendarDayCell, delta: number) => {
		const target = new Date(cell.fullDate)
		target.setDate(target.getDate() + delta)
		if (target < minDate || target > maxDate) return
		setHeaderYear(target.getFullYear())
		setHeaderMonth(target.getMonth())
		scrollDayTo(target.getFullYear(), target.getMonth())
		focusCalendarCell(`[data-calendar-date="${calendarDateKey(target)}"]`)
	}
	const handleCalendarDayKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		cell: WinCalendarDayCell
	) => {
		const deltas: Record<string, number> = {
			ArrowDown: 7,
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -7
		}
		const delta = deltas[event.key]
		if (delta === undefined) return
		event.preventDefault()
		moveCalendarDayFocus(cell, delta)
	}
	const moveCalendarMonthFocus = (item: WinCalendarMonthCell, delta: number) => {
		const total = (item.year - minYear) * 12 + item.month + delta
		const bounded = Math.max(0, Math.min(monthMeta.data.length - 1, total))
		const year = minYear + Math.floor(bounded / 12)
		const month = bounded % 12
		setHeaderYear(year)
		setHeaderMonth(month)
		scrollMonthTo(year)
		focusCalendarCell(`[data-calendar-month="${year}-${month}"]`)
	}
	const handleCalendarMonthKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		item: WinCalendarMonthCell
	) => {
		const deltas: Record<string, number> = {
			ArrowDown: 4,
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -4
		}
		const delta = deltas[event.key]
		if (delta === undefined) return
		event.preventDefault()
		moveCalendarMonthFocus(item, delta)
	}
	const moveCalendarYearFocus = (item: WinCalendarYearCell, delta: number) => {
		const year = Math.max(minYear, Math.min(maxYear, item.year + delta))
		setHeaderYear(year)
		setHeaderDecade(Math.floor(year / 10) * 10)
		scrollYearTo(Math.floor(year / 10) * 10)
		focusCalendarCell(`[data-calendar-year="${year}"]`)
	}
	const handleCalendarYearKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		item: WinCalendarYearCell
	) => {
		const deltas: Record<string, number> = {
			ArrowDown: 4,
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -4
		}
		const delta = deltas[event.key]
		if (delta === undefined) return
		event.preventDefault()
		moveCalendarYearFocus(item, delta)
	}
	const beginViewTransition = (direction: string) => {
		setTransitionDirection(direction)
		setViewTransitionId((value) => value + 1)
	}
	const navigate = (direction: number) => {
		if (viewMode === 0) {
			let month = headerMonth + direction
			let year = headerYear
			if (month > 11) {
				month = 0
				year += 1
			} else if (month < 0) {
				month = 11
				year -= 1
			}
			const targetIndex = Math.max(
				0,
				Math.min(monthMeta.data.length - 1, (year - minYear) * 12 + month)
			)
			year = minYear + Math.floor(targetIndex / 12)
			month = targetIndex % 12
			setHeaderYear(year)
			setHeaderMonth(month)
			scrollDayTo(year, month)
		} else if (viewMode === 1) {
			const year = Math.max(minYear, Math.min(maxYear, headerYear + direction))
			setHeaderYear(year)
			scrollMonthTo(year)
		} else {
			const decade = Math.max(
				Math.floor(minYear / 10) * 10,
				Math.min(Math.floor(maxYear / 10) * 10, headerDecade + direction * 10)
			)
			setHeaderDecade(decade)
			scrollYearTo(decade)
		}
	}
	const selectMonth = (item: WinCalendarMonthCell) => {
		pendingViewTargetRef.current = { mode: 0, year: item.year, month: item.month }
		beginViewTransition("in")
		setHeaderMonth(item.month)
		setHeaderYear(item.year)
		setViewMode(0)
	}
	const selectYear = (item: WinCalendarYearCell) => {
		pendingViewTargetRef.current = { mode: 1, year: item.year }
		beginViewTransition("in")
		setHeaderYear(item.year)
		setViewMode(1)
	}
	const selectLabel = () => {
		if (!isEnabled) return
		if (viewMode === 0) {
			pendingViewTargetRef.current = { mode: 1, year: headerYear }
			beginViewTransition("out")
			setViewMode(1)
		} else if (viewMode === 1) {
			const decade = Math.floor(headerYear / 10) * 10
			pendingViewTargetRef.current = { mode: 2, decade }
			beginViewTransition("out")
			setHeaderDecade(decade)
			setViewMode(2)
		}
	}
	useEffect(() => {
		setViewMode(displayModeIndexes[props.DisplayMode ?? "Month"] ?? 0)
	}, [props.DisplayMode])
	useEffect(() => {
		const target = pendingViewTargetRef.current
		if (!target || target.mode !== viewMode) return
		pendingViewTargetRef.current = null
		if (target.mode === 0) scrollDayTo(target.year, target.month)
		else if (target.mode === 1) scrollMonthTo(target.year)
		else scrollYearTo(target.decade)
	}, [viewMode])
	useEffect(() => {
		let secondFrame = 0
		const firstFrame = requestAnimationFrame(() => {
			secondFrame = requestAnimationFrame(() => {
				if (viewMode === 0) {
					const index = Math.max(
						0,
						Math.min(
							monthMeta.data.length - 1,
							(initialYear - minYear) * 12 + initialMonth
						)
					)
					const meta = monthMeta.data[index]
					const top = (meta?.startRow ?? 0) * 40
					setViewerTop(dayScrollRef, top)
					setDayScrollTop(top)
				} else if (viewMode === 1) {
					const top = (initialYear - minYear) * 180
					setViewerTop(monthScrollRef, top)
					setMonthScrollTop(top)
				} else {
					const row = Math.max(
						0,
						Math.min(
							totalYearRows - 1,
							Math.floor((initialDecade - minYear) / yearsPerRow)
						)
					)
					const top = row * 60
					setViewerTop(yearScrollRef, top)
					setYearScrollTop(top)
				}
				initialCalendarScrollReadyRef.current = true
			})
		})
		return () => {
			cancelAnimationFrame(firstFrame)
			if (secondFrame) cancelAnimationFrame(secondFrame)
		}
	}, [])
	useEffect(() => {
		setDayRenderTop(dayView.top)
		if (dayView.headerYear !== headerYear || dayView.headerMonth !== headerMonth) {
			setHeaderYear(dayView.headerYear)
			setHeaderMonth(dayView.headerMonth)
		}
	}, [dayView, headerMonth, headerYear])
	useEffect(() => {
		setMonthRenderTop(monthView.top)
		if (monthView.headerYear !== headerYear) setHeaderYear(monthView.headerYear)
	}, [headerYear, monthView])
	useEffect(() => {
		setYearRenderTop(yearView.top)
		if (yearView.headerDecade !== headerDecade) setHeaderDecade(yearView.headerDecade)
	}, [headerDecade, yearView])
	return (
		<div
			ref={calendarRootRef}
			id={typeof props.id === "string" ? props.id : undefined}
			className={cx(
				"win-calendar-view",
				isEnabled ? undefined : "disabled",
				props.class,
				props.className
			)}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			<div className="calendar-header">
				<button
					type="button"
					className="win-btn DefaultButtonStyle subtle calendar-title-btn"
					disabled={!isEnabled || viewMode === 2}
					onClick={selectLabel}
				>
					<span>{labelText}</span>
				</button>
				<div className="calendar-nav">
					<button
						type="button"
						className="icon-btn"
						disabled={!isEnabled}
						aria-label="Previous"
						onClick={() => navigate(-1)}
					>
						{"\uEDDB"}
					</button>
					<button
						type="button"
						className="icon-btn"
						disabled={!isEnabled}
						aria-label="Next"
						onClick={() => navigate(1)}
					>
						{"\uEDDC"}
					</button>
				</div>
			</div>
			<div className="calendar-divider" />
			<div className="calendar-view-body">
				{viewMode === 0 && (
					<div
						className={cx("calendar-panel", `calendar-panel-${transitionDirection}`)}
						key={`day-${viewTransitionId}`}
					>
						<div className="calendar-day-headers">
							{dayNames.map((day) => (
								<div key={day} className="calendar-day-header">
									{day}
								</div>
							))}
						</div>
						<WinScrollViewer
							ref={dayScrollRef}
							className="calendar-scroll"
							VerticalScrollMode="Auto"
							VerticalScrollBarVisibility="Hidden"
							HorizontalScrollMode="Disabled"
							HorizontalScrollBarVisibility="Disabled"
							onViewChanged={handleDayScroll}
						>
							<div style={{ height: dayView.totalHeight, position: "relative" }}>
								<div
									style={{
										position: "absolute",
										top: dayRenderTop,
										left: 0,
										right: 0
									}}
								>
									<div className="calendar-grid">
										{dayView.cells.map((cell) => (
											<button
												key={cell.key}
												type="button"
												className={cx(
													"calendar-day",
													cell.outOfScope ? "out-of-scope" : undefined,
													cell.outOfScope && !isOutOfScopeEnabled
														? "hidden"
														: undefined,
													cell.isToday && isTodayHighlighted
														? "today"
														: undefined,
													isDaySelected(cell) ? "selected" : undefined
												)}
												data-calendar-date={calendarDateKey(cell.fullDate)}
												disabled={
													!isEnabled ||
													(cell.outOfScope && !isOutOfScopeEnabled)
												}
												aria-label={`${cell.year}-${cell.month + 1}-${cell.fullDate.getDate()}`}
												aria-selected={isDaySelected(cell)}
												aria-current={cell.isToday ? "date" : undefined}
												onKeyDown={(event) =>
													handleCalendarDayKeyDown(event, cell)
												}
												onClick={() => selectDay(cell)}
											>
												{cell.showLabel && isGroupLabelVisible && (
													<span
														className={cx(
															"group-label",
															isDaySelected(cell) && !cell.isToday
																? "label-accent"
																: undefined
														)}
													>
														{cell.labelText}
													</span>
												)}
												<span className="day-text">{cell.date}</span>
											</button>
										))}
									</div>
								</div>
							</div>
						</WinScrollViewer>
					</div>
				)}
				{viewMode === 1 && (
					<div
						className={cx("calendar-panel", `calendar-panel-${transitionDirection}`)}
						key={`month-${viewTransitionId}`}
					>
						<WinScrollViewer
							ref={monthScrollRef}
							className="calendar-scroll large-scroll"
							VerticalScrollMode="Auto"
							VerticalScrollBarVisibility="Hidden"
							HorizontalScrollMode="Disabled"
							HorizontalScrollBarVisibility="Disabled"
							onViewChanged={handleMonthScroll}
						>
							<div style={{ height: monthView.totalHeight, position: "relative" }}>
								<div
									style={{
										position: "absolute",
										top: monthRenderTop,
										left: 0,
										right: 0
									}}
								>
									<div className="calendar-large-grid">
										{monthView.items.map((item) => (
											<button
												key={item.key}
												type="button"
												className={cx(
													"calendar-large-btn",
													item.outOfScope ? "out-of-scope" : undefined,
													item.isTodayMonth ? "current" : undefined,
													isMonthSelected(item) ? "selected" : undefined
												)}
												data-calendar-month={`${item.year}-${item.month}`}
												aria-selected={isMonthSelected(item)}
												onKeyDown={(event) =>
													handleCalendarMonthKeyDown(event, item)
												}
												disabled={!isEnabled}
												onClick={() => selectMonth(item)}
											>
												{item.showLabel && isGroupLabelVisible && (
													<span
														className={cx(
															"group-label",
															isMonthSelected(item) &&
																!item.isTodayMonth
																? "label-accent"
																: undefined
														)}
													>
														{item.labelText}
													</span>
												)}
												<span>{item.text}</span>
											</button>
										))}
									</div>
								</div>
							</div>
						</WinScrollViewer>
					</div>
				)}
				{viewMode === 2 && (
					<div
						className={cx("calendar-panel", `calendar-panel-${transitionDirection}`)}
						key={`year-${viewTransitionId}`}
					>
						<WinScrollViewer
							ref={yearScrollRef}
							className="calendar-scroll large-scroll"
							VerticalScrollMode="Auto"
							VerticalScrollBarVisibility="Hidden"
							HorizontalScrollMode="Disabled"
							HorizontalScrollBarVisibility="Disabled"
							onViewChanged={handleYearScroll}
						>
							<div style={{ height: yearView.totalHeight, position: "relative" }}>
								<div
									style={{
										position: "absolute",
										top: yearRenderTop,
										left: 0,
										right: 0
									}}
								>
									<div className="calendar-large-grid">
										{yearView.items.map((item) => (
											<button
												key={item.key}
												type="button"
												className={cx(
													"calendar-large-btn",
													item.outOfScope ? "out-of-scope" : undefined,
													item.year === today.getFullYear()
														? "current"
														: undefined
												)}
												data-calendar-year={item.year}
												aria-selected={item.year === headerYear}
												onKeyDown={(event) =>
													handleCalendarYearKeyDown(event, item)
												}
												disabled={!isEnabled}
												onClick={() => selectYear(item)}
											>
												<span>{item.year}</span>
											</button>
										))}
									</div>
								</div>
							</div>
						</WinScrollViewer>
					</div>
				)}
			</div>
		</div>
	)
}
type WinCalendarDatePickerProps = WinCalendarViewProps & {
	DateFormat?: string
	PlaceholderText?: string
	IsCalendarOpen?: boolean
}

function pickerDateValue(value: unknown): Date | undefined {
	return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined
}

function pickerDateText(date: Date | undefined, format: string, placeholder: string): string {
	if (!date) return placeholder
	try {
		return format.toLowerCase().includes("long")
			? date.toLocaleDateString(undefined, { dateStyle: "long" })
			: date.toLocaleDateString()
	} catch {
		return date.toLocaleDateString()
	}
}

export function WinCalendarDatePicker(props: WinCalendarDatePickerProps): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null)
	const flyoutRef = useRef<HTMLDivElement>(null)
	const [localOpen, setLocalOpen] = useState(false)
	const [position, setPosition] = useState<WinStyle>({ top: 0, left: 0 })
	const externalOpen = props.IsCalendarOpen as boolean | undefined
	const open = externalOpen ?? localOpen
	const controlledDate =
		props.Date !== undefined || props.SelectedDate !== undefined || props.value !== undefined
	const effectiveDate = pickerDateValue(props.Date ?? props.SelectedDate ?? props.value)
	const [localDate, setLocalDate] = useState<Date | undefined>(effectiveDate)
	const selectedDate = controlledDate ? effectiveDate : localDate
	const isEnabled = props.IsEnabled !== false
	const animation = useFlyoutAnimation(open, {
		enterClass: "picker-flyout-animate",
		exitClass: "picker-flyout-closing"
	})
	const placeholder = String(props.PlaceholderText ?? "Select a date")
	const displayText = pickerDateText(
		selectedDate,
		String(props.DateFormat ?? "shortdate"),
		placeholder
	)
	const setOpen = (next: boolean) => {
		if (externalOpen === undefined) setLocalOpen(next)
		if (next) animation.beginOpen()
		else animation.beginClose()
		callback<boolean>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:IsCalendarOpen"
		)?.(next)
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
		const gap = 4
		const margin = 8
		const width = popupRect?.width ?? 304
		const height = popupRect?.height ?? 404
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
		setPosition({
			top,
			left,
			transformOrigin: top < rect.top ? "bottom center" : "top center"
		})
	}
	useEffect(() => {
		if (!open) return undefined
		const frame = window.requestAnimationFrame(updatePosition)
		const onResize = () => updatePosition()
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
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
	const toggleOpen = () => {
		if (!isEnabled) return
		setOpen(!open)
	}
	const selectDate = (dates: Date[]) => {
		const nextDate = pickerDateValue(dates[0])
		const oldDate = selectedDate
		if (!controlledDate) setLocalDate(nextDate)
		callback<Date | undefined>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Date",
			"onUpdate:SelectedDate"
		)?.(nextDate)
		callback<unknown>(
			props,
			"onDateChanged",
			"DateChanged",
			"SelectedDateChanged"
		)?.({
			oldDate,
			newDate: nextDate
		})
		setOpen(false)
	}
	const className = typeof props.className === "string" ? props.className : undefined
	const legacyClassName = typeof props.class === "string" ? props.class : undefined
	return (
		<div
			ref={containerRef}
			className={cx("win-calendar-date-picker", className, legacyClassName)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Header && <WinTextBlock className="picker-header" Text={props.Header} />}
			<WinButton
				className="calendar-date-picker-button"
				Padding="0"
				MinHeight={32}
				IsEnabled={isEnabled}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={toggleOpen}
			>
				<span className={cx("picker-text", selectedDate ? undefined : "placeholder")}>
					{displayText}
				</span>
				<span className="picker-icon" aria-hidden="true">
					{"\uE787"}
				</span>
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
							onPointerDown={() => setOpen(false)}
						/>
						<div
							ref={flyoutRef}
							className={cx(
								"picker-flyout",
								"calendar-picker-flyout",
								animation.animationClass
							)}
							role="dialog"
							style={position}
							onPointerDown={(event) => event.stopPropagation()}
							onAnimationEnd={(event) => {
								if (event.target === event.currentTarget) animation.onAnimationEnd()
							}}
						>
							<WinCalendarView
								{...props}
								className="calendar-picker-view"
								SelectedDates={selectedDate ? [selectedDate] : []}
								SelectionMode="Single"
								{...{ "onUpdate:SelectedDates": selectDate }}
							/>
						</div>
					</>,
					document.body
				)}
		</div>
	)
}

type WinDatePickerProps = WinProps &
	WinChangeProps<Date | undefined> & {
		Date?: Date
		SelectedDate?: Date
		MonthVisible?: boolean
		DayVisible?: boolean
		YearVisible?: boolean
		CalendarIdentifier?: string
		Language?: string
		MonthFormat?: string
		DayFormat?: string
		YearFormat?: string
		MinYear?: Date
		MaxYear?: Date
		Orientation?: string
	}

function datePickerCalendarValue(
	date: Date | undefined,
	minYear: Date | undefined,
	maxYear: Date | undefined
): Date {
	const now = new Date()
	const year = date?.getFullYear() ?? now.getFullYear()
	const min = minYear?.getFullYear() ?? year - 50
	const max = maxYear?.getFullYear() ?? year + 50
	return new Date(
		Math.max(min, Math.min(max, year)),
		date?.getMonth() ?? now.getMonth(),
		date?.getDate() ?? now.getDate()
	)
}

function datePickerFormatter(
	language: string | undefined,
	options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
	try {
		return new Intl.DateTimeFormat(language, options)
	} catch {
		return new Intl.DateTimeFormat(undefined, options)
	}
}

function datePickerMonthText(date: Date, language: string | undefined, format: string): string {
	const normalized = format.toLowerCase()
	if (normalized.includes("integer")) {
		const month = String(date.getMonth() + 1)
		return normalized.includes("(2)") ? month.padStart(2, "0") : month
	}
	return datePickerFormatter(language, {
		month: normalized.includes("abbreviated") ? "short" : "long"
	}).format(date)
}

function datePickerDayText(date: Date, language: string | undefined, format: string): string {
	const normalized = format.toLowerCase()
	if (normalized.includes("dayofweek"))
		return datePickerFormatter(language, {
			weekday: normalized.includes("abbreviated") ? "short" : "long"
		}).format(date)
	const day = String(date.getDate())
	return normalized.includes("(2)") ? day.padStart(2, "0") : day
}

function datePickerYearText(date: Date, format: string): string {
	return format.toLowerCase().includes("abbreviated")
		? String(date.getFullYear()).slice(-2)
		: String(date.getFullYear())
}

function datePickerPlaceholder(
	language: string | undefined,
	part: "month" | "day" | "year"
): string {
	const normalized = language?.toLowerCase() ?? ""
	if (normalized.startsWith("zh") || normalized.startsWith("ja"))
		return {
			month: "月",
			day: "日",
			year: "年"
		}[part]
	if (normalized.startsWith("ko"))
		return {
			month: "월",
			day: "일",
			year: "년"
		}[part]
	return {
		month: "Month",
		day: "Day",
		year: "Year"
	}[part]
}

export function WinDatePicker(props: WinDatePickerProps): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null)
	const flyoutRef = useRef<HTMLDivElement>(null)
	const monthColRef = useRef<WinPickerColumnHandle>(null)
	const dayColRef = useRef<WinPickerColumnHandle>(null)
	const yearColRef = useRef<WinPickerColumnHandle>(null)
	const [localOpen, setLocalOpen] = useState(false)
	const [position, setPosition] = useState<WinStyle>({ top: 0, left: 0 })
	const [localDate, setLocalDate] = useState<Date | undefined>(
		pickerDateValue(props.Date ?? props.SelectedDate ?? props.value)
	)
	const [draftDate, setDraftDate] = useState<Date | undefined>(undefined)
	const externalOpen = props.IsOpen as boolean | undefined
	const open = externalOpen ?? localOpen
	const animation = useFlyoutAnimation(open, {
		enterClass: "picker-flyout-animate",
		exitClass: "picker-flyout-closing"
	})
	const isEnabled = props.IsEnabled !== false
	const currentDate = datePickerCalendarValue(
		pickerDateValue(props.Date ?? props.SelectedDate ?? props.value) ?? localDate,
		props.MinYear,
		props.MaxYear
	)
	const pickerDate = draftDate ?? currentDate
	const controlledDate =
		props.Date !== undefined || props.SelectedDate !== undefined || props.value !== undefined
	const commitDate = (date: Date) => {
		const oldDate = currentDate
		if (!controlledDate) setLocalDate(date)
		callback<Date | undefined>(
			props,
			"onValueChange",
			"onChangeValue",
			"onUpdate:Date",
			"onUpdate:SelectedDate"
		)?.(date)
		callback<unknown>(
			props,
			"onDateChanged",
			"DateChanged",
			"SelectedDateChanged"
		)?.({
			oldDate,
			newDate: date
		})
	}
	const updateDraftDate = (year: number, month: number, day: number) => {
		const lastDay = new Date(year, month + 1, 0).getDate()
		setDraftDate(new Date(year, month, Math.min(day, lastDay)))
	}
	const setOpen = (next: boolean) => {
		if (props.IsOpen === undefined) setLocalOpen(next)
		if (next) animation.beginOpen()
		else animation.beginClose()
		if (next) setDraftDate(currentDate)
		callback<boolean>(props, "onUpdate:IsOpen")?.(next)
	}
	const updatePosition = () => {
		const anchor = containerRef.current
		if (!anchor) return
		const rect = anchor.getBoundingClientRect()
		const popup = flyoutRef.current
		const popupRect = popup?.getBoundingClientRect()
		const width = popupRect?.width ?? 296
		const height = popupRect?.height ?? 322
		const top = Math.min(
			Math.max(8, rect.top + rect.height / 2 - height / 2),
			Math.max(8, window.innerHeight - height - 8)
		)
		const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
		setPosition({ top, left, width: rect.width, transformOrigin: "center center" })
	}
	useEffect(() => {
		if (!open) return undefined
		const frame = window.requestAnimationFrame(updatePosition)
		const onResize = () => updatePosition()
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
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
	const monthVisible = props.MonthVisible !== false
	const dayVisible = props.DayVisible !== false
	const yearVisible = props.YearVisible !== false
	const language = props.Language?.trim() || undefined
	const monthFormat = props.MonthFormat ?? "month.full"
	const dayFormat = props.DayFormat ?? "day.integer"
	const yearFormat = props.YearFormat ?? "year.full"
	const hasDate = Boolean(
		pickerDateValue(props.Date ?? props.SelectedDate ?? props.value) ?? localDate
	)
	const displayParts = [
		monthVisible
			? hasDate
				? {
						text: datePickerMonthText(currentDate, language, monthFormat),
						className: "picker-month-text"
					}
				: {
						text: datePickerPlaceholder(language, "month"),
						className: "picker-month-text"
					}
			: undefined,
		dayVisible
			? hasDate
				? {
						text: datePickerDayText(currentDate, language, dayFormat),
						className: "picker-day-text"
					}
				: {
						text: datePickerPlaceholder(language, "day"),
						className: "picker-day-text"
					}
			: undefined,
		yearVisible
			? hasDate
				? {
						text: datePickerYearText(currentDate, yearFormat),
						className: "picker-year-text"
					}
				: {
						text: datePickerPlaceholder(language, "year"),
						className: "picker-year-text"
					}
			: undefined
	].filter((part): part is { text: string; className: string } => Boolean(part))
	return (
		<div
			ref={containerRef}
			className={cx("win-date-picker", className, legacyClassName)}
			id={typeof props.id === "string" ? props.id : undefined}
			style={{ ...props.style, ...commonStyle(props) }}
		>
			{props.Header && <WinTextBlock className="picker-header" Text={props.Header} />}
			<WinButton
				className={cx("picker-btn", hasDate ? undefined : "has-no-date")}
				Padding="0"
				MinHeight={32}
				IsEnabled={isEnabled}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => isEnabled && setOpen(!open)}
			>
				{displayParts.map((part, index) => (
					<span
						key={`${part.text}-${index}`}
						className={cx("picker-column-text", part.className)}
					>
						{part.text}
					</span>
				))}
			</WinButton>
			{animation.isRendered &&
				createPortal(
					<>
						<div
							className="picker-overlay"
							aria-hidden="true"
							onPointerDown={() => setOpen(false)}
						/>
						<div
							ref={flyoutRef}
							className={cx(
								"picker-flyout",
								"date-picker-flyout",
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
								{monthVisible && (
									<WinPickerColumn
										ref={monthColRef}
										className="picker-month"
										Items={Array.from({ length: 12 }, (_, month) =>
											datePickerMonthText(
												new Date(2024, month, 1),
												language,
												monthFormat
											)
										)}
										Wrap
										AriaLabel="Month"
										value={pickerDate.getMonth()}
										onValueChange={(value) => {
											const month = Number(value)
											updateDraftDate(
												pickerDate.getFullYear(),
												month,
												pickerDate.getDate()
											)
										}}
									/>
								)}
								{monthVisible && dayVisible && (
									<div className="picker-col-divider" aria-hidden="true" />
								)}
								{dayVisible && (
									<WinPickerColumn
										ref={dayColRef}
										className="picker-day"
										Items={Array.from(
											{
												length: new Date(
													pickerDate.getFullYear(),
													pickerDate.getMonth() + 1,
													0
												).getDate()
											},
											(_, day) =>
												datePickerDayText(
													new Date(
														pickerDate.getFullYear(),
														pickerDate.getMonth(),
														day + 1
													),
													language,
													dayFormat
												)
										)}
										Wrap
										AriaLabel="Day"
										value={pickerDate.getDate() - 1}
										onValueChange={(value) => {
											const day = Number(value) + 1
											updateDraftDate(
												pickerDate.getFullYear(),
												pickerDate.getMonth(),
												day
											)
										}}
									/>
								)}
								{yearVisible && (monthVisible || dayVisible) && (
									<div className="picker-col-divider" aria-hidden="true" />
								)}
								{yearVisible && (
									<WinPickerColumn
										ref={yearColRef}
										className="picker-year"
										Items={Array.from(
											{
												length:
													(props.MaxYear?.getFullYear() ??
														new Date().getFullYear() + 50) -
													(props.MinYear?.getFullYear() ??
														new Date().getFullYear() - 50) +
													1
											},
											(_, index) =>
												datePickerYearText(
													new Date(
														(props.MinYear?.getFullYear() ??
															new Date().getFullYear() - 50) + index,
														0,
														1
													),
													yearFormat
												)
										)}
										Wrap
										AriaLabel="Year"
										value={
											pickerDate.getFullYear() -
											(props.MinYear?.getFullYear() ??
												new Date().getFullYear() - 50)
										}
										onValueChange={(value) => {
											const year =
												Number(value) +
												(props.MinYear?.getFullYear() ??
													new Date().getFullYear() - 50)
											updateDraftDate(
												year,
												pickerDate.getMonth(),
												pickerDate.getDate()
											)
										}}
									/>
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
									onClick={() => {
										const fallbackDate = draftDate ?? currentDate
										const monthIndex = monthColRef.current?.flush()
										const dayIndex = dayColRef.current?.flush()
										const yearIndex = yearColRef.current?.flush()
										const minYear =
											props.MinYear?.getFullYear() ??
											new Date().getFullYear() - 50
										const year =
											yearIndex === undefined
												? fallbackDate.getFullYear()
												: minYear + yearIndex
										const month =
											monthIndex === undefined
												? fallbackDate.getMonth()
												: monthIndex
										const day =
											dayIndex === undefined
												? fallbackDate.getDate()
												: dayIndex + 1
										commitDate(
											new Date(
												year,
												month,
												Math.min(
													day,
													new Date(year, month + 1, 0).getDate()
												)
											)
										)
										setOpen(false)
									}}
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
									onClick={() => setOpen(false)}
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
