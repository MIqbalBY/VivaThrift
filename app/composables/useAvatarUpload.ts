export function useAvatarUpload() {
  const supabase = useSupabaseClient() as any
  const user = useSupabaseUser()

  const avatarUploading = ref(false)
  const avatarInput     = ref<HTMLInputElement | null>(null)

  // Crop modal state
  const showCropModal = ref(false)
  const cropImageSrc  = ref('')
  const cropperRef    = ref<any>(null)
  const cropZoom      = ref(1)
  const cropRotate    = ref(0)

  const showDeleteAvatarConfirm = ref(false)

  function handleAvatarChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    ;(e.target as HTMLInputElement).value = ''
    if (file.size > 10 * 1024 * 1024) {
      return { error: 'Ukuran foto maksimal 10 MB.' }
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      cropImageSrc.value = ev.target?.result as string
      cropZoom.value = 1
      cropRotate.value = 0
      showCropModal.value = true
    }
    reader.readAsDataURL(file)
    return { error: null }
  }

  async function confirmCrop(avatarUrl: Ref<string>, userId?: string | null, msgCallback?: (msg: string, type: string) => void) {
    if (!cropperRef.value) return
    avatarUploading.value = true
    showCropModal.value = false

    const { canvas } = cropperRef.value.getResult()
    const blob = await new Promise<Blob>(res => canvas.toBlob(res, 'image/jpeg', 0.92))

    const uid  = user.value?.id ?? userId
    const path = `${uid}/avatar.jpg`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) {
      msgCallback?.('Upload gagal: ' + upErr.message, 'err')
      avatarUploading.value = false
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const newUrl = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('users').update({ avatar_url: newUrl }).eq('id', uid)
    avatarUrl.value = newUrl
    const sharedProfile = useState('userProfile')
    sharedProfile.value = { ...(sharedProfile.value ?? {}), avatar_url: newUrl }
    msgCallback?.('Foto profil diperbarui! ✅', 'ok')
    avatarUploading.value = false
  }

  function cancelCrop() {
    showCropModal.value = false
    cropImageSrc.value  = ''
  }

  function deleteAvatar(avatarUrl: string) {
    if (!avatarUrl) return
    showDeleteAvatarConfirm.value = true
  }

  async function confirmDeleteAvatar(avatarUrl: Ref<string>, userId?: string | null, msgCallback?: (msg: string, type: string) => void) {
    showDeleteAvatarConfirm.value = false
    const uid = user.value?.id ?? userId
    if (!uid) return
    avatarUploading.value = true
    const path = `${uid}/avatar.jpg`
    await supabase.storage.from('avatars').remove([path])
    await supabase.from('users').update({ avatar_url: null }).eq('id', uid)
    avatarUrl.value = ''
    const sharedProfile = useState('userProfile')
    sharedProfile.value = { ...(sharedProfile.value ?? {}), avatar_url: null }
    msgCallback?.('Foto profil dihapus.', 'ok')
    avatarUploading.value = false
  }

  return {
    avatarUploading, avatarInput,
    showCropModal, cropImageSrc, cropperRef, cropZoom, cropRotate,
    showDeleteAvatarConfirm,
    handleAvatarChange, confirmCrop, cancelCrop,
    deleteAvatar, confirmDeleteAvatar,
  }
}
