// SPDX-License-Identifier: GPL-3.0-only
/* eslint-disable */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { WinScrollViewer } from "./winui-scrolling"
import { callback, cx } from "./winui-shared"
import type { WinProps, WinStyle } from "./winui-shared"

export type WinCaptureSnapshot = {
	id: string
	source: string
}

export interface WinCaptureElementHandle {
	StartCaptureElement: () => Promise<boolean>
	StopCaptureElement: () => void
	CapturePhoto: () => WinCaptureSnapshot | null
	SetMirrorPreview: (value: boolean) => void
	snapshots: WinCaptureSnapshot[]
	mirrorPreview: boolean
}

export const WinCaptureElement = forwardRef<WinCaptureElementHandle, WinProps>(
	function WinCaptureElement(props, ref) {
		const videoRef = useRef<HTMLVideoElement>(null)
		const mediaStreamRef = useRef<MediaStream | null>(null)
		const [frameSourceName, setFrameSourceName] = useState("")
		const [snapshots, setSnapshots] = useState<WinCaptureSnapshot[]>([])
		const [mirrorPreview, setMirrorPreviewState] = useState(false)
		const emitReady = (ready: boolean) => callback<boolean>(props, "onReady", "Ready")?.(ready)
		const stopCapture = () => {
			mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
			mediaStreamRef.current = null
			if (videoRef.current) {
				videoRef.current.srcObject = null
				videoRef.current.onloadedmetadata = null
				videoRef.current.onerror = null
			}
			emitReady(false)
		}
		const startCapture = async (): Promise<boolean> => {
			stopCapture()
			emitReady(false)
			if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
				setFrameSourceName("No camera devices found.")
				return false
			}
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: true,
					audio: false
				})
				mediaStreamRef.current = stream
				const video = videoRef.current
				if (!video) {
					stream.getTracks().forEach((track) => track.stop())
					mediaStreamRef.current = null
					return false
				}
				video.srcObject = stream
				await new Promise<void>((resolve, reject) => {
					video.onloadedmetadata = () => resolve()
					video.onerror = () => reject(new Error("Unable to load camera stream"))
				})
				await video.play()
				const track = stream.getVideoTracks()[0]
				setFrameSourceName(`Viewing: ${track?.label || "Integrated camera"}`)
				emitReady(true)
				return true
			} catch (error) {
				setFrameSourceName(
					error instanceof DOMException && error.name === "NotAllowedError"
						? "Camera access denied."
						: "Unable to start the camera."
				)
				stopCapture()
				return false
			}
		}
		const capturePhoto = (): WinCaptureSnapshot | null => {
			const video = videoRef.current
			const stream = mediaStreamRef.current
			if (!video || !stream || !video.videoWidth || !video.videoHeight) return null
			const canvas = document.createElement("canvas")
			canvas.width = video.videoWidth
			canvas.height = video.videoHeight
			const context = canvas.getContext("2d")
			if (!context) return null
			context.drawImage(video, 0, 0, canvas.width, canvas.height)
			const photo = {
				id: `${Date.now()}-${snapshots.length}`,
				source: canvas.toDataURL("image/jpeg", 0.92)
			}
			setSnapshots((current) => [photo, ...current])
			callback<WinCaptureSnapshot>(props, "onPhotoCaptured", "PhotoCaptured")?.(photo)
			return photo
		}
		const setMirrorPreview = (value: boolean) => setMirrorPreviewState(Boolean(value))
		useImperativeHandle(
			ref,
			() => ({
				StartCaptureElement: startCapture,
				StopCaptureElement: stopCapture,
				CapturePhoto: capturePhoto,
				SetMirrorPreview: setMirrorPreview,
				snapshots,
				mirrorPreview
			}),
			[snapshots, mirrorPreview]
		)
		useEffect(() => stopCapture, [])
		return (
			<div
				className={cx(
					"win-capture-element",
					(props.className ?? props.class) as string | undefined
				)}
				style={props.style as WinStyle | undefined}
			>
				<div
					className={cx(
						"win-capture-frame-source",
						!frameSourceName ? "empty" : undefined
					)}
				>
					{frameSourceName}
				</div>
				<div
					className={cx(
						"win-capture-captured-label",
						snapshots.length > 0 ? "visible" : undefined
					)}
				>
					Captured:
				</div>
				<div className={cx("win-capture-preview", mirrorPreview ? "mirrored" : undefined)}>
					<video ref={videoRef} autoPlay muted playsInline />
				</div>
				<div className="win-capture-container">
					<WinScrollViewer
						className="win-capture-snapshots-scroll"
						VerticalScrollMode="Auto"
						VerticalScrollBarVisibility="Auto"
						HorizontalScrollMode="Disabled"
						HorizontalScrollBarVisibility="Disabled"
					>
						<div className="win-capture-snapshots">
							{snapshots.map((snapshot) => (
								<img key={snapshot.id} src={snapshot.source} alt="Captured photo" />
							))}
						</div>
					</WinScrollViewer>
				</div>
			</div>
		)
	}
)
