export function useAddressEdit() {
  const supabase = useSupabaseClient() as any
  const user = useSupabaseUser()

  async function resolveUid(): Promise<string | null> {
    if (user.value?.id) return user.value.id
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  }

  const addrSaving    = ref(false)
  const addrMsg       = ref('')
  const addrMsgType   = ref('')
  const addrLoading   = ref(false)

  const addrActiveType = ref<'shipping' | 'seller'>('shipping')

  // Shipping address
  const shippingForm     = reactive({ label: '', full_address: '', city: '', postal_code: '', notes: '', lat: null as number | null, lng: null as number | null })
  const _shippingId      = ref<string | null>(null)
  const shippingEditMode = ref(false)

  // Seller address
  const sellerForm     = reactive({ label: '', full_address: '', city: '', postal_code: '', notes: '', lat: null as number | null, lng: null as number | null })
  const _sellerId      = ref<string | null>(null)
  const sellerEditMode = ref(false)

  // "Sync address" toggle
  const syncAddress = ref(false)

  // Delete address
  const showDeleteAddrConfirm = ref(false)
  const addrDeleting          = ref(false)
  const deleteAddrType        = ref<'shipping' | 'seller'>('shipping')

  // GPS
  const gpsLoading = ref(false)

  function getAddrForm(type: string) { return type === 'seller' ? sellerForm : shippingForm }
  function getAddrId(type: string) { return type === 'seller' ? _sellerId.value : _shippingId.value }
  function getAddrEditMode(type: string) { return type === 'seller' ? sellerEditMode : shippingEditMode }

  function loadAddrRow(row: any, type: string) {
    const form = getAddrForm(type)
    const idRef = type === 'seller' ? _sellerId : _shippingId
    const editRef = type === 'seller' ? sellerEditMode : shippingEditMode
    if (!row) { editRef.value = true; return }
    idRef.value        = row.id
    form.label         = row.label        ?? ''
    form.full_address  = row.full_address ?? ''
    form.city          = row.city         ?? ''
    form.postal_code   = row.postal_code  ?? ''
    form.notes         = row.notes        ?? ''
    form.lat           = row.lat          ?? null
    form.lng           = row.lng          ?? null
    editRef.value = false
  }

  async function fetchAddresses(uid?: string) {
    const id = uid ?? user.value?.id
    if (!id) return
    addrLoading.value = true
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', id)
    addrLoading.value = false
    const rows = data ?? []
    loadAddrRow(rows.find((r: any) => r.address_type === 'shipping'), 'shipping')
    loadAddrRow(rows.find((r: any) => r.address_type === 'seller'),  'seller')
    if (_sellerId.value && _shippingId.value) {
      const s = shippingForm, e = sellerForm
      syncAddress.value = s.label === e.label && s.full_address === e.full_address && s.city === e.city && s.lat === e.lat && s.lng === e.lng
    }
  }

  async function saveAddress(type?: string, userId?: string | null) {
    const t = type ?? addrActiveType.value
    const form = getAddrForm(t)
    if (!form.full_address.trim()) {
      addrMsg.value = 'Alamat lengkap wajib diisi.'
      addrMsgType.value = 'err'
      return
    }
    const uid = user.value?.id ?? userId ?? await resolveUid()
    if (!uid) {
      addrMsg.value = 'Sesi tidak ditemukan, coba muat ulang halaman.'
      addrMsgType.value = 'err'
      return
    }
    addrSaving.value = true
    addrMsg.value    = ''

    try {
      const payload = {
        user_id:      uid,
        address_type: t,
        label:        form.label.trim() || null,
        full_address: form.full_address.trim(),
        city:         form.city.trim() || null,
        postal_code:  (form as any).postal_code?.trim() || null,
        notes:        form.notes.trim() || null,
        lat:          form.lat || null,
        lng:          form.lng || null,
      }

      const existingId = getAddrId(t)
      let error
      if (existingId) {
        ;({ error } = await supabase.from('addresses').update(payload).eq('id', existingId))
      } else {
        ;({ error } = await supabase.from('addresses').insert(payload))
      }

      if (error) {
        addrMsg.value = 'Gagal menyimpan: ' + error.message
        addrMsgType.value = 'err'
      } else {
        addrMsg.value = (t === 'seller' ? 'Alamat pengirim' : 'Alamat pengiriman') + ' berhasil disimpan! ✅'
        addrMsgType.value = 'ok'
        await fetchAddresses(uid)
        if (t === 'shipping') {
          const sharedAddress = useState('userAddress')
          sharedAddress.value = { label: form.label, city: form.city, full_address: form.full_address }
        }
        setTimeout(() => { addrMsg.value = '' }, 3000)
      }
    } catch (e: any) {
      addrMsg.value = 'Terjadi kesalahan: ' + (e?.message ?? 'tidak diketahui')
      addrMsgType.value = 'err'
    } finally {
      addrSaving.value = false
    }
  }

  async function toggleSyncAddress() {
    syncAddress.value = !syncAddress.value
    if (syncAddress.value) {
      if (!shippingForm.full_address.trim()) {
        addrMsg.value = 'Isi alamat pengiriman terlebih dahulu.'
        addrMsgType.value = 'err'
        syncAddress.value = false
        return
      }
      Object.assign(sellerForm, {
        label:        shippingForm.label,
        full_address: shippingForm.full_address,
        city:         shippingForm.city,
        postal_code:  shippingForm.postal_code,
        notes:        shippingForm.notes,
        lat:          shippingForm.lat,
        lng:          shippingForm.lng,
      })
      sellerEditMode.value = false
      await saveAddress('seller')
    }
  }

  function deleteAddress(type: string) {
    const id = getAddrId(type)
    if (!id) return
    deleteAddrType.value = type as 'shipping' | 'seller'
    showDeleteAddrConfirm.value = true
  }

  async function confirmDeleteAddress() {
    showDeleteAddrConfirm.value = false
    const type = deleteAddrType.value
    const id = getAddrId(type)
    if (!id) return
    addrDeleting.value = true
    const { error } = await supabase.from('addresses').delete().eq('id', id)
    addrDeleting.value = false
    if (error) {
      addrMsg.value = 'Gagal menghapus: ' + error.message
      addrMsgType.value = 'err'
      return
    }
    const form = getAddrForm(type)
    const idRef = type === 'seller' ? _sellerId : _shippingId
    const editRef = type === 'seller' ? sellerEditMode : shippingEditMode
    idRef.value = null
    form.label = ''; form.full_address = ''; form.city = ''; (form as any).postal_code = ''; form.notes = ''; form.lat = null; form.lng = null
    editRef.value = true
    if (type === 'seller') syncAddress.value = false
    addrMsg.value = 'Alamat berhasil dihapus.'
    addrMsgType.value = 'ok'
    if (type === 'shipping') {
      const sharedAddress = useState('userAddress')
      sharedAddress.value = null
    }
    setTimeout(() => { addrMsg.value = '' }, 3000)
  }

  function useGPS(type?: string) {
    const t = type ?? addrActiveType.value
    if (!navigator.geolocation) {
      addrMsg.value = 'Browser tidak mendukung GPS.'
      addrMsgType.value = 'err'
      return
    }
    gpsLoading.value = true
    const form = getAddrForm(t)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.lat = parseFloat(pos.coords.latitude.toFixed(7))
        form.lng = parseFloat(pos.coords.longitude.toFixed(7))
        gpsLoading.value = false
      },
      () => {
        addrMsg.value = 'Tidak bisa mendapatkan lokasi. Pastikan izin GPS diaktifkan.'
        addrMsgType.value = 'err'
        gpsLoading.value = false
      }
    )
  }

  function openMapLink(type?: string) {
    const t = type ?? addrActiveType.value
    const form = getAddrForm(t)
    const lat = form.lat ?? -7.2813
    const lng = form.lng ?? 112.7971
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener')
  }

  return {
    addrSaving, addrMsg, addrMsgType, addrLoading,
    addrActiveType,
    shippingForm, _shippingId, shippingEditMode,
    sellerForm, _sellerId, sellerEditMode,
    syncAddress,
    showDeleteAddrConfirm, addrDeleting, deleteAddrType,
    gpsLoading,
    getAddrForm, getAddrId, getAddrEditMode,
    fetchAddresses, saveAddress, toggleSyncAddress,
    deleteAddress, confirmDeleteAddress,
    useGPS, openMapLink,
  }
}
