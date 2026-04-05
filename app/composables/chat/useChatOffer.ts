export function useChatOffer(
  chatId: string | string[],
  chat: Ref<any>,
  myId: Ref<string | null>,
  messages: Ref<any[]>,
  scrollToBottom: () => void,
  channel: Ref<any>,
  supabase: any,
) {
  const showOfferModal = ref(false)
  const offerPrice = ref('')
  const offerQty = ref(1)
  const offerError = ref('')
  const submittingOffer = ref(false)
  const processingOffer = ref<string | null>(null)

  const localProductStock = ref(chat.value?.product?.stock ?? null)
  const localProductStatus = ref(chat.value?.product?.status ?? null)

  const maxQty = computed(() => {
    const s = localProductStock.value
    return (s !== null && s !== undefined) ? s : 99
  })

  const productAvailable = computed(() =>
    localProductStatus.value !== 'sold' &&
    (localProductStock.value === null || localProductStock.value > 0)
  )

  function openOfferModal() {
    offerPrice.value = chat.value?.product?.price?.toString() ?? ''
    offerQty.value = 1
    offerError.value = ''
    showOfferModal.value = true
  }

  async function submitOffer() {
    offerError.value = ''
    const price = Number(offerPrice.value)
    const qty = Number(offerQty.value)

    const originalPrice = chat.value?.product?.price ?? null
    if (!price || price <= 0) return (offerError.value = 'Harga harus lebih dari 0.')
    if (originalPrice !== null && price >= originalPrice) return (offerError.value = `Penawaran harus lebih rendah dari harga asli (Rp ${originalPrice.toLocaleString('id-ID')}).`)
    if (!qty || qty < 1) return (offerError.value = 'Jumlah minimal 1.')
    if (maxQty.value !== null && qty > maxQty.value) return (offerError.value = `Stok hanya ${maxQty.value}.`)

    submittingOffer.value = true
    try {
      const result = await $fetch<{ offerId: string; message: any }>('/api/offers', {
        method: 'POST',
        body: {
          chatId,
          productId: chat.value.product.id,
          price,
          quantity: qty,
        },
      })

      const offerData = { id: result.offerId, offered_price: price, quantity: qty, status: 'pending' }

      if (result.message && !messages.value.some((m: any) => m.id === result.message.id)) {
        messages.value.push({ ...result.message, offer: offerData, reply: null, sender: null })
        scrollToBottom()
      }

      channel.value?.send({ type: 'broadcast', event: 'new-offer', payload: { message: result.message, offer: offerData } })
      showOfferModal.value = false
    } catch (e: any) {
      offerError.value = e.data?.statusMessage ?? e.message ?? 'Gagal mengajukan penawaran.'
    } finally {
      submittingOffer.value = false
    }
  }

  async function respondOffer(offerId: string, status: 'accepted' | 'rejected') {
    processingOffer.value = offerId
    try {
      await $fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        body: { status },
      })

      const offerMsg = messages.value.find(m => m.offer_id === offerId || m.offer?.id === offerId)
      if (offerMsg?.offer) offerMsg.offer.status = status

      channel.value?.send({ type: 'broadcast', event: 'offer-updated', payload: { offerId, status } })
      const label = status === 'accepted' ? 'menerima' : 'menolak'
      const { data: respondMsg } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: myId.value,
        content: `Penjual ${label} penawaran ini.`,
        reply_to_id: offerMsg?.id ?? null,
      }).select('id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted').single()

      if (respondMsg && !messages.value.some(m => m.id === respondMsg.id)) {
        messages.value.push({
          ...respondMsg,
          offer: null,
          reply: offerMsg ? { id: offerMsg.id, content: offerMsg.content, sender_id: offerMsg.sender_id, is_deleted: false, offer_id: offerMsg.offer_id } : null,
          sender: null,
        })
        scrollToBottom()
      }
    } catch (e) {
      console.error('respondOffer error:', e)
    } finally {
      processingOffer.value = null
    }
  }

  function checkoutOffer(offerId: string) {
    navigateTo(`/checkout?offer_id=${offerId}`)
  }

  return {
    showOfferModal,
    offerPrice,
    offerQty,
    offerError,
    submittingOffer,
    processingOffer,
    localProductStock,
    localProductStatus,
    maxQty,
    productAvailable,
    openOfferModal,
    submitOffer,
    respondOffer,
    checkoutOffer,
  }
}
