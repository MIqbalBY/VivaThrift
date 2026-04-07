export function useAvatarUpload() {
  const supabase = useSupabaseClient() as any
  const user = useSupabaseUser()

  async function resolveUid(): Promise<string | null> {
    if (user.value?.id) return user.value.id
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  }

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

    try {
      const { canvas } = cropperRef.value.getResult()
      const blob: Blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.92))
      const file = new File([blob], 'avatar.webp', { type: 'image/webp' })

      const { uploadToR2 } = useR2Upload()
      // skipCompression: canvas output is already optimized
      const { publicUrl } = await uploadToR2(file, 'avatars', { skipCompression: true })
      const newUrl = publicUrl + '?t=' + Date.now()

      const uid = user.value?.id ?? userId ?? await resolveUid()
      await supabase.from('users').update({ avatar_url: newUrl }).eq('id', uid)
      avatarUrl.value = newUrl
      const sharedProfile = useState('userProfile')
      sharedProfile.value = { ...(sharedProfile.value ?? {}), avatar_url: newUrl }
      msgCallback?.('Foto profil diperbarui! ✅', 'ok')
    } catch (err: any) {
      msgCallback?.('Upload gagal: ' + (err?.message ?? 'Coba lagi'), 'err')
    } finally {
      avatarUploading.value = false
    }
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
    const uid = user.value?.id ?? userId ?? await resolveUid()
    if (!uid) return
    avatarUploading.value = true
    try {
      // Best-effort delete from R2 — key: avatars/<uid>/avatar.webp
      try {
        const { deleteFromR2 } = useR2Upload()
        await deleteFromR2(`avatars/${uid}/avatar.webp`)
      } catch { /* ignore — object may not exist */ }
      await supabase.from('users').update({ avatar_url: null }).eq('id', uid)
      avatarUrl.value = ''
      const sharedProfile = useState('userProfile')
      sharedProfile.value = { ...(sharedProfile.value ?? {}), avatar_url: null }
      msgCallback?.('Foto profil dihapus.', 'ok')
    } catch (err: any) {
      msgCallback?.('Gagal hapus: ' + (err?.message ?? 'Coba lagi'), 'err')
    } finally {
      avatarUploading.value = false
    }
  }

  return {
    avatarUploading, avatarInput,
    showCropModal, cropImageSrc, cropperRef, cropZoom, cropRotate,
    showDeleteAvatarConfirm,
    handleAvatarChange, confirmCrop, cancelCrop,
    deleteAvatar, confirmDeleteAvatar,
  }
}
