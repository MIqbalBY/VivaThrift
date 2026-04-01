import type { Ref } from 'vue'
import type { MediaItem } from './useProductMedia'

export function useVideoThumb(mediaList: Ref<MediaItem[]>) {
  const showThumbModal = ref(false)
  const thumbMediaIndex = ref(-1)
  const thumbVideoSrc = ref('')
  const thumbInitialPreview = ref('')
  const thumbInitialFile = ref<File | null>(null)

  function openThumbPicker(index: number) {
    const media = mediaList.value[index]
    if (!media) return
    thumbMediaIndex.value = index
    thumbVideoSrc.value = media.preview
    thumbInitialPreview.value = media.thumbnail || ''
    thumbInitialFile.value = media.thumbnailFile || null
    showThumbModal.value = true
  }

  function handleThumbConfirm({ file, preview }: { file: File; preview: string }) {
    const target = thumbMediaIndex.value >= 0 ? mediaList.value[thumbMediaIndex.value] : undefined
    if (target && file) {
      target.thumbnailFile = file
      target.thumbnail = preview
    }
    showThumbModal.value = false
  }

  return {
    showThumbModal,
    thumbVideoSrc,
    thumbInitialPreview,
    thumbInitialFile,
    openThumbPicker,
    handleThumbConfirm,
  }
}
