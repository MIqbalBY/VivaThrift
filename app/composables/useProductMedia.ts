import type { Ref } from 'vue'

export interface MediaItem {
  file?: File
  preview: string
  type: 'image' | 'video'
  isCover: boolean
  isExisting?: boolean
  dbUrl?: string
  dbThumbnailUrl?: string | null
  thumbnail?: string
  thumbnailFile?: File | null
  mediaType?: string
}

export const PHOTO_MAX = 5
export const VIDEO_MAX = 1
export const PHOTO_SIZE_MAX = 4 * 1024 * 1024   // 4 MB
export const VIDEO_SIZE_MAX = 20 * 1024 * 1024   // 20 MB

export function useProductMedia(opts: { onImageFiles?: (files: File[]) => void } = {}) {
  const mediaList = ref<MediaItem[]>([])
  const errorMsg = ref('')

  const photoCount = computed(() => mediaList.value.filter(m => m.type === 'image').length)
  const videoCount = computed(() => mediaList.value.filter(m => m.type === 'video').length)

  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])
    errorMsg.value = ''
    const imageQueue: File[] = []

    for (const file of files) {
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      const isVideo = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)

      if (!isImage && !isVideo) {
        errorMsg.value = `File "${file.name}" tidak didukung. Gunakan JPG/PNG/WebP atau MP4/MOV/WebM.`
        continue
      }
      if (isImage && file.size > PHOTO_SIZE_MAX) {
        errorMsg.value = `Foto "${file.name}" melebihi batas 4 MB.`
        continue
      }
      if (isVideo && file.size > VIDEO_SIZE_MAX) {
        errorMsg.value = `Video "${file.name}" melebihi batas 20 MB.`
        continue
      }
      if (isImage && (photoCount.value + imageQueue.length) >= PHOTO_MAX) {
        errorMsg.value = `Maksimal ${PHOTO_MAX} foto.`
        continue
      }
      if (isVideo && videoCount.value >= VIDEO_MAX) {
        errorMsg.value = `Maksimal ${VIDEO_MAX} video.`
        continue
      }

      if (isImage) {
        imageQueue.push(file)
      } else {
        mediaList.value.push({
          file,
          preview: URL.createObjectURL(file),
          type: 'video',
          isCover: false,
          isExisting: false,
          mediaType: file.type,
        })
      }
    }

    input.value = ''

    if (imageQueue.length > 0) {
      opts.onImageFiles?.(imageQueue)
    }
  }

  function removeMedia(index: number) {
    const removed = mediaList.value[index]
    if (!removed) return
    if (!removed.isExisting) URL.revokeObjectURL(removed.preview)
    const wasCover = removed.isCover
    mediaList.value.splice(index, 1)
    if (wasCover) {
      const firstPhoto = mediaList.value.find(m => m.type === 'image')
      if (firstPhoto) firstPhoto.isCover = true
    }
  }

  function setCover(index: number) {
    mediaList.value.forEach((m, i) => { m.isCover = i === index })
  }

  return {
    mediaList,
    errorMsg,
    photoCount,
    videoCount,
    handleFileInput,
    removeMedia,
    setCover,
  }
}
