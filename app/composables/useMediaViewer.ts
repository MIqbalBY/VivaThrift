import type { Ref } from 'vue'

export function useMediaViewer(mediaList: Ref<any[]>) {
  const viewerOpen = ref(false)
  const viewerIndex = ref(0)

  function openViewer(index: number) {
    viewerIndex.value = index
    viewerOpen.value = true
  }

  function closeViewer() {
    viewerOpen.value = false
  }

  function prevViewer() {
    viewerIndex.value = (viewerIndex.value - 1 + mediaList.value.length) % mediaList.value.length
  }

  function nextViewer() {
    viewerIndex.value = (viewerIndex.value + 1) % mediaList.value.length
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!viewerOpen.value) return
    if (e.key === 'Escape') closeViewer()
    if (e.key === 'ArrowLeft') prevViewer()
    if (e.key === 'ArrowRight') nextViewer()
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

  return {
    viewerOpen,
    viewerIndex,
    openViewer,
    closeViewer,
    prevViewer,
    nextViewer,
  }
}
