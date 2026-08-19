"use client"

import { PROFILE_IMAGE_DIMENSION, PROFILE_IMAGE_MAX_BYTES } from "@/lib/profile"

const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42]

type DecodedImage = {
  source: HTMLImageElement
  width: number
  height: number
  dispose: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = "async"
  image.src = objectUrl
  try {
    await image.decode()
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function encodeCanvas(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export type ProfileImageCrop = {
  zoom: number
  offsetX: number
  offsetY: number
  viewportSize: number
}

export async function optimizeProfileImage(file: File, crop?: ProfileImageCrop) {
  const decoded = await decodeImage(file)
  try {
    if (!decoded.width || !decoded.height) throw new Error("이미지 크기를 확인할 수 없습니다.")

    const canvas = document.createElement("canvas")
    canvas.width = PROFILE_IMAGE_DIMENSION
    canvas.height = PROFILE_IMAGE_DIMENSION
    const context = canvas.getContext("2d")
    if (!context) throw new Error("이미지를 처리할 수 없습니다.")

    const viewportSize = crop?.viewportSize || 1
    const zoom = Math.max(1, crop?.zoom || 1)
    const baseScale = Math.max(viewportSize / decoded.width, viewportSize / decoded.height)
    const displayScale = baseScale * zoom
    const sourceSize = viewportSize / displayScale
    const sourceX = Math.max(0, Math.min(
      decoded.width - sourceSize,
      decoded.width / 2 - (crop?.offsetX || 0) / displayScale - sourceSize / 2,
    ))
    const sourceY = Math.max(0, Math.min(
      decoded.height - sourceSize,
      decoded.height / 2 - (crop?.offsetY || 0) / displayScale - sourceSize / 2,
    ))
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(
      decoded.source,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      PROFILE_IMAGE_DIMENSION,
      PROFILE_IMAGE_DIMENSION,
    )

    for (const type of ["image/webp", "image/jpeg"] as const) {
      for (const quality of QUALITY_STEPS) {
        const blob = await encodeCanvas(canvas, type, quality)
        if (!blob || blob.type !== type || blob.size > PROFILE_IMAGE_MAX_BYTES) continue
        const extension = type === "image/webp" ? "webp" : "jpg"
        return new File([blob], `avatar.${extension}`, { type, lastModified: Date.now() })
      }
    }

    throw new Error("이미지를 500KB 이하로 압축하지 못했습니다.")
  } finally {
    decoded.dispose()
  }
}
