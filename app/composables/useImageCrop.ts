import type { Ref } from 'vue'
import type { MediaItem } from './useProductMedia'

export function useImageCrop(mediaList: Ref<MediaItem[]>) {
  const showCropModal = ref(false)
  const cropImageSrc = ref('')
  const pendingCropQueue = ref<File[]>([])
  const currentCropFile = ref<File | null>(null)

  const pendingCount = computed(() => pendingCropQueue.value.length)

  function startCropping(files: File[]) {
    pendingCropQueue.value = [...files]
    openNextCrop()
  }

  function openNextCrop() {
    if (pendingCropQueue.value.length === 0) {
      showCropModal.value = false
      return
    }
    const file = pendingCropQueue.value.shift()!
    currentCropFile.value = file
    const reader = new FileReader()
    reader.onload = (ev) => {
      cropImageSrc.value = (ev.target as FileReader).result as string
      showCropModal.value = true
    }
    reader.readAsDataURL(file)
  }

  function handleCropConfirm(blob: Blob) {
    const name = currentCropFile.value?.name?.replace(/\.[^.]+$/, '.jpg') ?? 'cropped.jpg'
    const croppedFile = new File([blob], name, { type: 'image/jpeg' })
    const isCover = mediaList.value.filter(m => m.isCover).length === 0
    mediaList.value.push({
      file: croppedFile,
      preview: URL.createObjectURL(blob),
      type: 'image',
      isCover,
      isExisting: false,
      mediaType: 'image/jpeg',
    })
    openNextCrop()
  }

  function handleCropSkip() {
    openNextCrop()
  }

  function handleCropCancel() {
    pendingCropQueue.value = []
    showCropModal.value = false
    cropImageSrc.value = ''
    currentCropFile.value = null
  }

  return {
    showCropModal,
    cropImageSrc,
    pendingCount,
    startCropping,
    handleCropConfirm,
    handleCropSkip,
    handleCropCancel,
  }
}
