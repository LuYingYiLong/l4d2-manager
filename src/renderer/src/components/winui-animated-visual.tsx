// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { ReactNode } from "react"
import { alignments, commonStyle, cssLength, cx } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

export interface WinAnimatedVisualPlayerHandle {
	Diagnostics: null
	Duration: number
	IsAnimatedVisualLoaded: boolean
	IsPlaying: boolean
	ProgressObject: null
	Pause: () => void
	PlayAsync: (fromProgress?: number, toProgress?: number, looped?: boolean) => Promise<void>
	Resume: () => void
	SetProgress: (value: number) => void
	Stop: () => void
	rootRef: HTMLDivElement | null
}

export const WinAnimatedVisualPlayer = forwardRef<WinAnimatedVisualPlayerHandle, WinProps>(
	function WinAnimatedVisualPlayer(props, ref) {
		const rootRef = useRef<HTMLDivElement>(null)
		const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
		const resolveRef = useRef<(() => void) | undefined>(undefined)
		const [isPlaying, setIsPlaying] = useState(
			props.IsPlaying !== undefined ? Boolean(props.IsPlaying) : false
		)
		const [isLoaded, setIsLoaded] = useState(false)
		const [progress, setProgressState] = useState(0)
		const source = props.Source
		const sourceUri =
			typeof source === "string"
				? source
				: source && typeof source === "object"
					? String(
							(source as Record<string, unknown>).UriSource ??
								(source as Record<string, unknown>).Source ??
								(source as Record<string, unknown>).src ??
								""
						)
					: ""
		const playbackRate = Number(props.PlaybackRate ?? 1)
		const duration = Math.max(1, Number(props.Duration ?? 5967))
		const children = props.children as ReactNode
		const fallbackContent = props.FallbackContent as ReactNode
		const fallback =
			/^(https?:|data:|\/)/.test(sourceUri) && sourceUri
				? sourceUri
				: typeof props.FallbackContent === "string" &&
					  /^(https?:|data:|\/)/.test(props.FallbackContent)
					? props.FallbackContent
					: ""
		const clampProgress = (value: number) => Math.max(0, Math.min(1, Number(value) || 0))
		const clearPlayTimer = (resolve = true) => {
			if (timerRef.current !== undefined) clearTimeout(timerRef.current)
			timerRef.current = undefined
			if (resolve) {
				resolveRef.current?.()
				resolveRef.current = undefined
			}
		}
		const pause = () => {
			clearPlayTimer()
			setIsPlaying(false)
		}
		const resume = () => {
			if (playbackRate !== 0) setIsPlaying(true)
		}
		const stop = () => {
			clearPlayTimer()
			setIsPlaying(false)
			setProgressState(0)
		}
		const playAsync = (fromProgress = 0, toProgress = 1, looped = false) => {
			clearPlayTimer()
			const from = clampProgress(fromProgress)
			const to = clampProgress(toProgress)
			setProgressState(from)
			if (playbackRate === 0) {
				setIsPlaying(false)
				return Promise.resolve()
			}
			setIsPlaying(true)
			if (looped) return new Promise<void>((resolve) => (resolveRef.current = resolve))
			return new Promise<void>((resolve) => {
				resolveRef.current = resolve
				timerRef.current = setTimeout(
					() => {
						setProgressState(to)
						setIsPlaying(false)
						timerRef.current = undefined
						resolveRef.current = undefined
						resolve()
					},
					duration / Math.max(Math.abs(playbackRate), 0.01)
				)
			})
		}
		const setProgress = (value: number) => setProgressState(clampProgress(value))
		const style: WinStyle = {
			...(props.style as WinStyle | undefined),
			...commonStyle(props),
			width: props.Width !== undefined ? cssLength(props.Width) : undefined,
			height: props.Height !== undefined ? cssLength(props.Height) : undefined,
			minWidth: props.MinWidth !== undefined ? cssLength(props.MinWidth) : undefined,
			minHeight: props.MinHeight !== undefined ? cssLength(props.MinHeight) : undefined,
			maxWidth: props.MaxWidth !== undefined ? cssLength(props.MaxWidth) : undefined,
			maxHeight: props.MaxHeight !== undefined ? cssLength(props.MaxHeight) : undefined,
			justifySelf: alignments[String(props.HorizontalAlignment ?? "")],
			alignSelf: alignments[String(props.VerticalAlignment ?? "")],
			objectFit:
				String(props.Stretch ?? "Uniform").toLowerCase() === "fill"
					? "fill"
					: String(props.Stretch ?? "Uniform").toLowerCase() === "uniformtofill"
						? "cover"
						: "contain",
			"--win-avp-rate": String(Math.max(0.01, Math.abs(playbackRate) || 1)),
			"--win-avp-direction": playbackRate < 0 ? "reverse" : "normal",
			"--win-avp-progress": String(progress)
		}
		useEffect(() => {
			setIsLoaded(false)
			const frame = requestAnimationFrame(() => setIsLoaded(true))
			return () => cancelAnimationFrame(frame)
		}, [sourceUri])
		useEffect(() => {
			if (props.IsPlaying !== undefined) setIsPlaying(Boolean(props.IsPlaying))
			else if (props.AutoPlay !== false) void playAsync(0, 1, true)
			else setIsPlaying(false)
			return () => clearPlayTimer()
		}, [props.IsPlaying, props.AutoPlay, sourceUri])
		useEffect(() => {
			if (playbackRate === 0) pause()
		}, [playbackRate])
		useImperativeHandle(
			ref,
			() => ({
				Diagnostics: null,
				Duration: duration,
				IsAnimatedVisualLoaded: isLoaded,
				IsPlaying: isPlaying,
				ProgressObject: null,
				Pause: pause,
				PlayAsync: playAsync,
				Resume: resume,
				SetProgress: setProgress,
				Stop: stop,
				rootRef: rootRef.current
			}),
			[duration, isLoaded, isPlaying, progress, playbackRate]
		)
		return (
			<div
				ref={rootRef}
				className={cx(
					"win-animated-visual-player",
					isPlaying && playbackRate !== 0 ? "is-playing" : undefined,
					isLoaded ? "is-loaded" : undefined,
					props.class as string | undefined
				)}
				style={style}
				role="img"
			>
				{children ??
					(props.Content as ReactNode) ??
					(fallback ? (
						<img className="win-animated-visual-fallback" src={fallback} alt="" />
					) : (
						<svg
							className="win-animated-visual"
							viewBox="0 0 375 667"
							aria-hidden="true"
						>
							<rect
								className="win-animated-visual-background"
								x="0"
								y="0"
								width="375"
								height="667"
							/>
							<g className="win-animated-visual-mark">
								<path
									className="win-animated-visual-stroke stroke-1"
									d="M112 333h151"
								/>
								<path
									className="win-animated-visual-stroke stroke-2"
									d="M145 287v92"
								/>
								<path
									className="win-animated-visual-stroke stroke-3"
									d="M188 268v131"
								/>
								<path
									className="win-animated-visual-stroke stroke-4"
									d="M231 287v92"
								/>
								<circle
									className="win-animated-visual-dot dot-1"
									cx="112"
									cy="333"
									r="10"
								/>
								<circle
									className="win-animated-visual-dot dot-2"
									cx="145"
									cy="287"
									r="10"
								/>
								<circle
									className="win-animated-visual-dot dot-3"
									cx="188"
									cy="268"
									r="10"
								/>
								<circle
									className="win-animated-visual-dot dot-4"
									cx="231"
									cy="287"
									r="10"
								/>
								<circle
									className="win-animated-visual-dot dot-5"
									cx="263"
									cy="333"
									r="10"
								/>
							</g>
						</svg>
					))}
				{!isLoaded && fallbackContent && typeof props.FallbackContent !== "string"
					? fallbackContent
					: null}
			</div>
		)
	}
)
