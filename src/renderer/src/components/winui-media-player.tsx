// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { ReactNode } from "react"
import { WinFlyout } from "./winui-dialogs"
import { WinProgressBar } from "./winui-feedback"
import { WinSlider } from "./winui-inputs"
import { callback, commonStyle, cx, mediaCssLength } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

type WinMediaTransportControls = {
	IsSeekBarVisible?: boolean
	IsVolumeButtonVisible?: boolean
	IsZoomButtonVisible?: boolean
	IsCastButtonVisible?: boolean
	IsFullWindowButtonVisible?: boolean
	ShowAndHideAutomatically?: boolean
}

type WinMediaPlayerProps = WinProps & {
	Source?: string | Record<string, unknown>
	PosterSource?: string | Record<string, unknown>
	AreTransportControlsEnabled?: boolean
	TransportControls?: WinMediaTransportControls
	Stretch?: string
	AutoPlay?: boolean
	IsLooping?: boolean
	IsMuted?: boolean
	IsFullWindow?: boolean
}

function mediaSourceUri(value: unknown): string {
	if (typeof value === "string") return value
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>
		return String(record.UriSource ?? record.Source ?? record.src ?? "")
	}
	return ""
}

function mediaSourceMimeType(source: string): string | undefined {
	const path = source.split(/[?#]/, 1)[0].toLowerCase()
	if (path.endsWith(".mp4") || path.endsWith(".m4v")) return "video/mp4"
	if (path.endsWith(".webm")) return "video/webm"
	if (path.endsWith(".ogv") || path.endsWith(".ogg")) return "video/ogg"
	return undefined
}

function formatMediaTime(value: number): string {
	const safe = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)
	const seconds = String(safe % 60).padStart(2, "0")
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
		: `${minutes}:${seconds}`
}

export interface WinMediaPlayerElementHandle {
	MediaPlayer: HTMLVideoElement | null
}

export const WinMediaPlayerElement = forwardRef<WinMediaPlayerElementHandle, WinMediaPlayerProps>(
	function WinMediaPlayerElement(props, ref): React.JSX.Element {
		const rootRef = useRef<HTMLDivElement>(null)
		const videoRef = useRef<HTMLVideoElement>(null)
		const controlPanelRef = useRef<HTMLDivElement>(null)
		const hideTimer = useRef<number | undefined>(undefined)
		const pointerMoveEndTimer = useRef<number | undefined>(undefined)
		const mediaLoadTimer = useRef<number | undefined>(undefined)
		const rootPointerPressed = useRef(false)
		const controlPanelPointerOver = useRef(false)
		const controlPanelPointerPressed = useRef(false)
		const controlPanelHasFocus = useRef(false)
		const source = mediaSourceUri(props.Source)
		const poster = mediaSourceUri(props.PosterSource)
		const transport = (props.TransportControls ?? {}) as WinMediaTransportControls
		const [isPlaying, setIsPlaying] = useState(false)
		const [currentTime, setCurrentTime] = useState(0)
		const [duration, setDuration] = useState(0)
		const [volume, setVolume] = useState(50)
		const [muted, setMuted] = useState(props.IsMuted === true)
		const [isBuffering, setIsBuffering] = useState(Boolean(source))
		const [isMediaLoading, setIsMediaLoading] = useState(Boolean(source))
		const [mediaError, setMediaError] = useState(false)
		const [controlsVisible, setControlsVisible] = useState(true)
		const [volumeOpen, setVolumeOpen] = useState(false)
		const [fullWindow, setFullWindow] = useState(false)
		const [activeStretch, setActiveStretch] = useState(String(props.Stretch ?? "Uniform"))
		const transportEnabled = props.AreTransportControlsEnabled === true
		const autoHide = transport.ShowAndHideAutomatically !== false
		const isEnabled = props.IsEnabled !== false
		const isSeekBarVisible = transport.IsSeekBarVisible !== false
		const isVolumeButtonVisible = transport.IsVolumeButtonVisible !== false
		const isZoomButtonVisible = transport.IsZoomButtonVisible !== false
		const isCastButtonVisible = transport.IsCastButtonVisible !== false
		const isFullWindowButtonVisible = transport.IsFullWindowButtonVisible !== false
		const className = typeof props.className === "string" ? props.className : undefined
		const legacyClassName = typeof props.class === "string" ? props.class : undefined
		const stretchMap: Record<string, "none" | "fill" | "contain" | "cover"> = {
			None: "none",
			Fill: "fill",
			Uniform: "contain",
			UniformToFill: "cover"
		}
		const videoObjectFit = stretchMap[activeStretch] ?? "contain"
		const clearHideTimer = () => {
			if (hideTimer.current !== undefined) window.clearTimeout(hideTimer.current)
			hideTimer.current = undefined
		}
		const clearMediaLoadTimer = () => {
			if (mediaLoadTimer.current !== undefined) window.clearTimeout(mediaLoadTimer.current)
			mediaLoadTimer.current = undefined
		}
		const armMediaLoadTimer = () => {
			clearMediaLoadTimer()
			if (!source) return
			mediaLoadTimer.current = window.setTimeout(() => {
				if (isMediaLoading && !mediaError) {
					setMediaError(true)
					setIsBuffering(false)
					setIsMediaLoading(false)
					showControls()
					callback<unknown>(
						props,
						"onMediaFailed",
						"MediaFailed"
					)?.({
						type: "error",
						target: videoRef.current
					})
				}
			}, 12000)
		}
		const scheduleHide = () => {
			clearHideTimer()
			if (
				!autoHide ||
				!isPlaying ||
				isBuffering ||
				isMediaLoading ||
				mediaError ||
				volumeOpen ||
				controlPanelPointerOver.current ||
				controlPanelPointerPressed.current ||
				controlPanelHasFocus.current ||
				rootPointerPressed.current
			)
				return
			hideTimer.current = window.setTimeout(() => {
				setControlsVisible(false)
				hideTimer.current = undefined
			}, 3000)
		}
		const showControls = () => {
			setControlsVisible(true)
			clearHideTimer()
			if (pointerMoveEndTimer.current !== undefined)
				window.clearTimeout(pointerMoveEndTimer.current)
			pointerMoveEndTimer.current = window.setTimeout(() => {
				pointerMoveEndTimer.current = undefined
				scheduleHide()
			}, 0)
		}
		const syncVideoState = () => {
			const video = videoRef.current
			if (!video) return
			setCurrentTime(video.currentTime || 0)
			setDuration(Number.isFinite(video.duration) ? video.duration : 0)
			setMuted(video.muted)
			setVolume(Math.round((video.volume || 0) * 100))
		}
		const onMediaLoaded = () => {
			clearMediaLoadTimer()
			setMediaError(false)
			setIsBuffering(false)
			setIsMediaLoading(false)
			syncVideoState()
		}
		const onBufferingStarted = () => {
			setIsBuffering(true)
			if (videoRef.current && videoRef.current.readyState >= 2) setIsMediaLoading(false)
			showControls()
			clearHideTimer()
		}
		const onBufferingEnded = () => {
			clearMediaLoadTimer()
			setIsBuffering(false)
			setIsMediaLoading(false)
			scheduleHide()
		}
		const onMediaError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
			clearMediaLoadTimer()
			setMediaError(true)
			setIsBuffering(false)
			setIsMediaLoading(false)
			showControls()
			clearHideTimer()
			callback<unknown>(props, "onMediaFailed", "MediaFailed")?.(event)
		}
		const updateFullscreenState = () => {
			const next = document.fullscreenElement === rootRef.current
			setFullWindow(next)
			callback<boolean>(props, "onIsFullWindowChanged", "IsFullWindowChanged")?.(next)
		}
		const enterFullscreen = async () => {
			if (!rootRef.current?.requestFullscreen) return
			try {
				await rootRef.current.requestFullscreen()
			} catch {
				setFullWindow(false)
			}
		}
		const exitFullscreen = async () => {
			if (!document.fullscreenElement || !document.exitFullscreen) return
			try {
				await document.exitFullscreen()
			} catch {
				setFullWindow(false)
			}
		}
		const toggleFullscreen = () => {
			if (document.fullscreenElement === rootRef.current) void exitFullscreen()
			else void enterFullscreen()
		}
		const togglePlay = () => {
			const video = videoRef.current
			if (!video || !isEnabled) return
			if (video.paused) video.play().catch(() => undefined)
			else video.pause()
		}
		const updateVolume = (next: number) => {
			const video = videoRef.current
			const value = Math.max(0, Math.min(100, next))
			setVolume(value)
			setMuted(value === 0)
			if (video) {
				video.volume = value / 100
				video.muted = value === 0
			}
		}
		const toggleMute = () => {
			const video = videoRef.current
			if (!video) return
			const next = !video.muted
			video.muted = next
			if (!next && video.volume === 0) {
				video.volume = 1
				setVolume(100)
			}
			setMuted(next)
		}
		const seekTo = (next: number) => {
			const video = videoRef.current
			if (!video) return
			video.currentTime = next
			setCurrentTime(next)
		}
		const toggleStretch = () => {
			const values = ["Uniform", "Fill", "UniformToFill", "None"]
			setActiveStretch(values[(values.indexOf(activeStretch) + 1) % values.length])
		}
		const requestCast = async () => {
			const video = videoRef.current as
				| (HTMLVideoElement & {
						remote?: { prompt?: () => Promise<void> }
				  })
				| null
			if (video?.remote?.prompt) {
				try {
					await video.remote.prompt()
					return
				} catch {
					// Native remote playback is not available in every WebView.
				}
			}
			callback<unknown>(
				props,
				"onCastRequested",
				"CastRequested"
			)?.({
				Source: source
			})
		}
		useEffect(() => {
			const video = videoRef.current
			if (!video) return undefined
			setMediaError(false)
			setIsBuffering(Boolean(source))
			setIsMediaLoading(Boolean(source))
			setCurrentTime(0)
			setDuration(0)
			armMediaLoadTimer()
			video.load()
			if (props.AutoPlay) video.play().catch(() => undefined)
			return () => clearMediaLoadTimer()
		}, [source])
		useEffect(() => {
			const onFullscreenChange = () => updateFullscreenState()
			document.addEventListener("fullscreenchange", onFullscreenChange)
			return () => {
				document.removeEventListener("fullscreenchange", onFullscreenChange)
				clearHideTimer()
				clearMediaLoadTimer()
				if (pointerMoveEndTimer.current !== undefined)
					window.clearTimeout(pointerMoveEndTimer.current)
			}
		}, [])
		useEffect(() => {
			const video = videoRef.current
			if (!video || props.IsMuted === undefined) return
			video.muted = Boolean(props.IsMuted)
			setMuted(video.muted)
		}, [props.IsMuted])
		useEffect(() => {
			if (props.IsFullWindow && !fullWindow) void enterFullscreen()
			if (props.IsFullWindow === false && fullWindow) void exitFullscreen()
		}, [props.IsFullWindow, fullWindow])
		useEffect(() => {
			setActiveStretch(String(props.Stretch ?? "Uniform"))
		}, [props.Stretch])
		useImperativeHandle(ref, () => ({ MediaPlayer: videoRef.current }), [
			isPlaying,
			currentTime,
			duration,
			muted,
			volume,
			fullWindow
		])
		const rootStyle: WinStyle = {
			...(props.style as WinStyle | undefined),
			...commonStyle(props),
			width: mediaCssLength(props.Width),
			height: mediaCssLength(props.Height),
			minWidth: mediaCssLength(props.MinWidth),
			minHeight: mediaCssLength(props.MinHeight),
			maxWidth: fullWindow ? undefined : mediaCssLength(props.MaxWidth),
			maxHeight: mediaCssLength(props.MaxHeight),
			justifySelf: (
				{ Left: "start", Center: "center", Right: "end", Stretch: "stretch" } as Record<
					string,
					string
				>
			)[String(props.HorizontalAlignment ?? "")],
			alignSelf: (
				{ Top: "start", Center: "center", Bottom: "end", Stretch: "stretch" } as Record<
					string,
					string
				>
			)[String(props.VerticalAlignment ?? "")]
		}
		const mediaLoading = isBuffering || isMediaLoading
		return (
			<div
				ref={rootRef}
				className={cx(
					"win-media-player-element",
					fullWindow ? "is-full-window" : undefined,
					className,
					legacyClassName
				)}
				style={rootStyle}
				onPointerMove={showControls}
				onPointerLeave={scheduleHide}
				onPointerDown={() => {
					rootPointerPressed.current = true
					showControls()
				}}
				onPointerUp={() => {
					rootPointerPressed.current = false
					scheduleHide()
				}}
				onPointerCancel={() => {
					rootPointerPressed.current = false
					scheduleHide()
				}}
				onLostPointerCapture={() => {
					rootPointerPressed.current = false
					scheduleHide()
				}}
			>
				<div className="win-media-player-surface">
					<video
						ref={videoRef}
						className={cx(
							"win-media-player-video",
							mediaError ? "is-media-error" : undefined
						)}
						poster={poster || undefined}
						autoPlay={props.AutoPlay as boolean | undefined}
						loop={props.IsLooping as boolean | undefined}
						muted={muted}
						crossOrigin="anonymous"
						preload="metadata"
						playsInline
						style={{ objectFit: videoObjectFit }}
						onLoadedMetadata={() => {
							syncVideoState()
							callback<unknown>(
								props,
								"onMediaOpened",
								"MediaOpened"
							)?.(videoRef.current)
						}}
						onTimeUpdate={syncVideoState}
						onDurationChange={syncVideoState}
						onLoadedData={onMediaLoaded}
						onError={onMediaError}
						onWaiting={onBufferingStarted}
						onCanPlay={onBufferingEnded}
						onPlaying={() => {
							setIsPlaying(true)
							onBufferingEnded()
						}}
						onPlay={() => {
							setIsPlaying(true)
							showControls()
						}}
						onPause={() => {
							setIsPlaying(false)
							clearHideTimer()
							setControlsVisible(true)
						}}
						onEnded={() => {
							setIsPlaying(false)
							clearHideTimer()
							setControlsVisible(true)
						}}
					>
						{source && <source src={source} type={mediaSourceMimeType(source)} />}
						{props.children as ReactNode}
					</video>
					{mediaError && poster && (
						<img className="win-media-player-poster-fallback" src={poster} alt="" />
					)}
					{transportEnabled && (
						<div
							className={cx(
								"win-media-transport-controls",
								controlsVisible ? "visible" : undefined,
								mediaLoading || mediaError ? "is-media-loading" : undefined
							)}
							onPointerEnter={() => {
								controlPanelPointerOver.current = true
								showControls()
							}}
							onPointerLeave={() => {
								controlPanelPointerOver.current = false
								scheduleHide()
							}}
							onPointerDown={(event) => {
								event.stopPropagation()
								controlPanelPointerPressed.current = true
								rootPointerPressed.current = false
								showControls()
							}}
							onPointerUp={() => {
								controlPanelPointerPressed.current = false
								scheduleHide()
							}}
							onPointerCancel={() => {
								controlPanelPointerPressed.current = false
								scheduleHide()
							}}
							onLostPointerCapture={() => {
								controlPanelPointerPressed.current = false
								scheduleHide()
							}}
							onFocus={() => {
								controlPanelHasFocus.current = true
								clearHideTimer()
							}}
							onBlur={(event) => {
								if (
									event.relatedTarget instanceof Node &&
									event.currentTarget.contains(event.relatedTarget)
								)
									return
								controlPanelHasFocus.current = false
								scheduleHide()
							}}
						>
							<div ref={controlPanelRef} className="win-media-transport-panel">
								{mediaError && (
									<div className="win-media-error" role="alert">
										Media failed to load
									</div>
								)}
								{isSeekBarVisible && (
									<div className="win-media-timeline-border">
										<div className="win-media-timeline-grid">
											<div className="win-media-progress-host">
												<div className="win-media-progress-slider">
													<WinSlider
														Value={Math.min(currentTime, duration || 1)}
														Minimum={0}
														Maximum={duration || 1}
														SmallChange={1}
														StepFrequency={0.01}
														IsThumbToolTipEnabled={false}
														Width="100%"
														Height={32}
														aria-label="Seek"
														onValueChange={seekTo}
													/>
												</div>
												{(mediaLoading || mediaError) && (
													<div className="win-media-loading-progress">
														<WinProgressBar
															IsIndeterminate={mediaLoading}
															ShowError={mediaError}
															Width="100%"
															Height={4}
														/>
													</div>
												)}
											</div>
											<div className="win-media-time-text-grid">
												<span>{formatMediaTime(currentTime)}</span>
												<span>
													{formatMediaTime(
														Math.max(0, duration - currentTime)
													)}
												</span>
											</div>
										</div>
									</div>
								)}
								<div className="win-media-command-border">
									<div
										className="win-media-command-bar"
										role="toolbar"
										aria-label="Media transport controls"
									>
										<div className="win-media-command-left">
											{isVolumeButtonVisible && (
												<WinFlyout
													IsOpen={volumeOpen}
													Placement="Top"
													Theme={props.Theme}
													Trigger={
														<button
															type="button"
															className="win-media-appbar-button"
															aria-label={muted ? "Unmute" : "Volume"}
														>
															<span
																className="win-media-glyph"
																aria-hidden="true"
															>
																{muted || volume === 0
																	? "\uE74F"
																	: "\uE767"}
															</span>
														</button>
													}
													onValueChange={setVolumeOpen}
												>
													<div className="win-media-volume-panel">
														<button
															type="button"
															className="win-media-appbar-button"
															aria-label={muted ? "Unmute" : "Mute"}
															onClick={toggleMute}
														>
															<span
																className="win-media-glyph"
																aria-hidden="true"
															>
																{muted || volume === 0
																	? "\uE74F"
																	: "\uE767"}
															</span>
														</button>
														<WinSlider
															Value={volume}
															Minimum={0}
															Maximum={100}
															SmallChange={1}
															StepFrequency={1}
															IsThumbToolTipEnabled={false}
															Width={190}
															Height={32}
															aria-label="Volume"
															onValueChange={updateVolume}
														/>
														<span className="win-media-volume-value">
															{Math.round(volume)}
														</span>
													</div>
												</WinFlyout>
											)}
										</div>
										<div className="win-media-command-center">
											<button
												type="button"
												className="win-media-appbar-button"
												aria-label={isPlaying ? "Pause" : "Play"}
												onClick={togglePlay}
											>
												<span
													className="win-media-glyph"
													aria-hidden="true"
												>
													{isPlaying ? "\uF8AE" : "\uF5B0"}
												</span>
											</button>
										</div>
										<div className="win-media-command-right">
											{isZoomButtonVisible && (
												<button
													type="button"
													className="win-media-appbar-button"
													aria-label="Change aspect ratio"
													onClick={toggleStretch}
												>
													<span
														className="win-media-glyph"
														aria-hidden="true"
													>
														{"\uE799"}
													</span>
												</button>
											)}
											{isCastButtonVisible && (
												<button
													type="button"
													className="win-media-appbar-button"
													aria-label="Cast"
													onClick={() => void requestCast()}
												>
													<span
														className="win-media-glyph"
														aria-hidden="true"
													>
														{"\uEC15"}
													</span>
												</button>
											)}
											{isFullWindowButtonVisible && (
												<button
													type="button"
													className="win-media-appbar-button"
													aria-label={
														fullWindow
															? "Exit full screen"
															: "Full screen"
													}
													onClick={toggleFullscreen}
												>
													<span
														className="win-media-glyph"
														aria-hidden="true"
													>
														{fullWindow ? "\uE73F" : "\uE740"}
													</span>
												</button>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		)
	}
)
