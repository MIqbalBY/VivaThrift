export function useChatRealtime(
  chatId: string | string[],
  chat: Ref<any>,
  myId: Ref<string | null>,
  messages: Ref<any[]>,
  supabase: any,
  patchReplyRefs: (msgId: string, patch: Record<string, any>) => void,
  scrollToBottom: () => void,
  markMessagesAsRead: (ts?: string | null) => void,
  clearUnreadDivider: () => void,
  localProductStock: Ref<number | null>,
  localProductStatus: Ref<string | null>,
) {
  const channel = ref<any>(null)
  let roomRetryTimer: ReturnType<typeof setTimeout> | null = null
  let productSyncTimer: ReturnType<typeof setInterval> | null = null
  let productSyncInFlight = false

  const PRODUCT_SYNC_INTERVAL_MS = 45000

  async function syncProductState(force = false) {
    const productId = chat.value?.product?.id
    if (!productId) return
    if (!force && document.visibilityState !== 'visible') return
    if (productSyncInFlight) return

    productSyncInFlight = true
    try {
      const { data } = await supabase
        .from('products')
        .select('stock, status')
        .eq('id', productId)
        .maybeSingle()

      if (!data) return
      if (data.stock !== undefined) localProductStock.value = data.stock
      if (data.status !== undefined) localProductStatus.value = data.status
    } finally {
      productSyncInFlight = false
    }
  }

  function startProductSync() {
    if (productSyncTimer) clearInterval(productSyncTimer)
    productSyncTimer = setInterval(() => {
      syncProductState()
    }, PRODUCT_SYNC_INTERVAL_MS)
  }

  function stopProductSync() {
    if (productSyncTimer) {
      clearInterval(productSyncTimer)
      productSyncTimer = null
    }
  }

  function pickRecord(payload: any, mode: 'new' | 'old') {
    if (!payload) return null
    if (mode === 'new') {
      return payload.new ?? payload.record ?? payload.new_record ?? payload.data?.new ?? payload.data?.record ?? null
    }
    return payload.old ?? payload.old_record ?? payload.data?.old ?? payload.data?.old_record ?? null
  }

  function setupChatChannel() {
    if (roomRetryTimer) { clearTimeout(roomRetryTimer); roomRetryTimer = null }
    if (channel.value) { supabase.removeChannel(channel.value); channel.value = null }
    const chatTopic = `chat:${chatId}:messages`
    channel.value = supabase
      .channel(chatTopic, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, async ({ payload }: any) => {
          const inserted = pickRecord(payload, 'new')
          if (!inserted) return
          if (messages.value.some(m => m.id === inserted.id)) return
          let offer = null
          let reply = null
          if (inserted.offer_id) {
            const { data: offerData } = await supabase
              .from('offers')
              .select('id, offered_price, quantity, status')
              .eq('id', inserted.offer_id)
              .single()
            offer = offerData
          }
          if (inserted.reply_to_id) {
            const local = messages.value.find(m => m.id === inserted.reply_to_id)
            if (local) {
              reply = { id: local.id, content: local.content, sender_id: local.sender_id, is_deleted: local.is_deleted, offer_id: local.offer_id, sender: local.sender ? { name: local.sender.name } : null }
            } else {
              const { data: replyData } = await supabase
                .from('messages')
                .select('id, content, sender_id, is_deleted, offer_id, sender:users!sender_id(name)')
                .eq('id', inserted.reply_to_id)
                .single()
              reply = replyData
            }
          }
          if (messages.value.some(m => m.id === inserted.id)) return
          const basic = { ...inserted, offer, reply, sender: null }
          messages.value.push(basic)
          clearUnreadDivider()
          if (inserted.sender_id !== myId.value) {
            markMessagesAsRead(inserted.created_at)
          }
          scrollToBottom()
      })
      .on('broadcast', { event: 'UPDATE' }, ({ payload }: any) => {
        const updated = pickRecord(payload, 'new')
        if (!updated) return
        const idx = messages.value.findIndex(m => m.id === updated.id)
        if (idx >= 0) {
          messages.value[idx] = { ...messages.value[idx], ...updated }
        }
        const { id, content, is_deleted } = updated
        patchReplyRefs(id, { content, is_deleted })
      })
      .on('broadcast', { event: 'DELETE' }, ({ payload }: any) => {
        const deleted = pickRecord(payload, 'old')
        if (!deleted?.id) return
        const idx = messages.value.findIndex(m => m.id === deleted.id)
        if (idx >= 0) {
          messages.value[idx] = { ...messages.value[idx], is_deleted: true, content: '$$DELETED$$' }
        }
        patchReplyRefs(deleted.id, { is_deleted: true, content: '$$DELETED$$' })
      })
      .on('broadcast', { event: 'offer-updated' }, ({ payload }: any) => {
        const msg = messages.value.find(m => m.offer_id === payload.offerId || m.offer?.id === payload.offerId)
        if (msg?.offer) msg.offer.status = payload.status
      })
      .on('broadcast', { event: 'new-offer' }, ({ payload }: any) => {
        if (!payload?.message || payload.message.sender_id === myId.value) return
        if (messages.value.some(m => m.id === payload.message.id)) return
        messages.value.push({ ...payload.message, offer: payload.offer, reply: null, sender: null })
        clearUnreadDivider()
        markMessagesAsRead(payload.message.created_at)
        scrollToBottom()
      })
      .on('broadcast', { event: 'messages-read' }, ({ payload }: any) => {
        if (!payload?.msgIds || payload.readBy === myId.value) return
        for (const m of messages.value) {
          if (payload.msgIds.includes(m.id)) m.is_read = true
        }
      })
      .subscribe((status: string) => {
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          roomRetryTimer = setTimeout(setupChatChannel, 3000)
        }
      })
  }

  function onRoomVisibilityChange() {
    if (document.visibilityState === 'visible') {
      setupChatChannel()
      markMessagesAsRead()
      syncProductState(true)
    }
  }
  function onRoomOnline() {
    setupChatChannel()
    syncProductState(true)
  }

  function startRealtime() {
    setupChatChannel()
    startProductSync()
    syncProductState(true)
    document.addEventListener('visibilitychange', onRoomVisibilityChange)
    window.addEventListener('online', onRoomOnline)
  }

  function stopRealtime() {
    if (roomRetryTimer) { clearTimeout(roomRetryTimer); roomRetryTimer = null }
    stopProductSync()
    if (channel.value) { supabase.removeChannel(channel.value); channel.value = null }
    document.removeEventListener('visibilitychange', onRoomVisibilityChange)
    window.removeEventListener('online', onRoomOnline)
  }

  return {
    channel,
    setupChatChannel,
    startRealtime,
    stopRealtime,
  }
}
