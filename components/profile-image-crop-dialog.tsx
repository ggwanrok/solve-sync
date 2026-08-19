"use client"

import { LoaderCircle, Move, ZoomIn } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { optimizeProfileImage } from "@/lib/profile-image-client"

const VIEWPORT_SIZE = 256
const MAX_ZOOM = 3

type ImageInfo = {
  url: string
  width: number
  height: number
}

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value))
}

export function ProfileImageCropDialog({
  file,
  onCancel,
  onApply,
}: {
  file: File
  onCancel: () => void
  onApply: (optimizedFile: File) => Promise<boolean>
}) {
  const [image, setImage] = useState<ImageInfo | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [pending, setPending] = useState(false)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  useEffect(() => {
    let active = true
    const url = URL.createObjectURL(file)
    const nextImage = new Image()
    nextImage.decoding = "async"
    nextImage.src = url
    void nextImage.decode()
      .then(() => {
        if (active) setImage({ url, width: nextImage.naturalWidth, height: nextImage.naturalHeight })
      })
      .catch(() => {
        if (active) {
          toast.error("이미지를 불러오지 못했습니다.")
          onCancel()
        }
      })

    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [file, onCancel])

  const baseScale = image ? Math.max(VIEWPORT_SIZE / image.width, VIEWPORT_SIZE / image.height) : 1
  const displayWidth = image ? image.width * baseScale * zoom : VIEWPORT_SIZE
  const displayHeight = image ? image.height * baseScale * zoom : VIEWPORT_SIZE
  const maxOffsetX = Math.max(0, (displayWidth - VIEWPORT_SIZE) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - VIEWPORT_SIZE) / 2)

  function updateZoom(value: number) {
    const nextZoom = Math.max(1, Math.min(MAX_ZOOM, value))
    if (!image) return setZoom(nextZoom)
    const nextWidth = image.width * baseScale * nextZoom
    const nextHeight = image.height * baseScale * nextZoom
    setZoom(nextZoom)
    setOffset((current) => ({
      x: clamp(current.x, Math.max(0, (nextWidth - VIEWPORT_SIZE) / 2)),
      y: clamp(current.y, Math.max(0, (nextHeight - VIEWPORT_SIZE) / 2)),
    }))
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!image || pending) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({
      x: clamp(drag.offsetX + event.clientX - drag.x, maxOffsetX),
      y: clamp(drag.offsetY + event.clientY - drag.y, maxOffsetY),
    })
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  async function applyCrop() {
    if (!file || !image || pending) return
    setPending(true)
    try {
      const optimizedFile = await optimizeProfileImage(file, {
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        viewportSize: VIEWPORT_SIZE,
      })
      if (await onApply(optimizedFile)) onCancel()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지를 처리하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onCancel() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>프로필 사진 영역 선택</DialogTitle>
          <DialogDescription>원을 드래그하고 확대해 표시할 영역을 맞춰주세요.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-64 items-center justify-center">
          {image ? (
            <div
              role="img"
              aria-label="프로필 사진 자르기 미리보기"
              className="relative size-64 touch-none cursor-grab overflow-hidden rounded-full bg-muted ring-4 ring-background shadow-md outline outline-border active:cursor-grabbing"
              style={{
                backgroundImage: `url(${JSON.stringify(image.url)})`,
                backgroundPosition: `calc(50% ${offset.x < 0 ? "-" : "+"} ${Math.abs(offset.x)}px) calc(50% ${offset.y < 0 ? "-" : "+"} ${Math.abs(offset.y)}px)`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${displayWidth}px ${displayHeight}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 transition-opacity hover:opacity-100">
                <Move className="size-7 text-white drop-shadow" />
              </div>
            </div>
          ) : (
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
          )}
        </div>

        <label className="flex items-center gap-3 text-sm" htmlFor="profile-image-zoom">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">사진 확대</span>
          <input
            id="profile-image-zoom"
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={(event) => updateZoom(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-primary"
            disabled={!image || pending}
          />
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>취소</Button>
          <Button type="button" onClick={applyCrop} disabled={!image || pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "적용 중..." : "이 영역 사용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
