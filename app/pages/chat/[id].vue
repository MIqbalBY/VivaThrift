<script setup>
definePageMeta({ middleware: 'auth', layout: 'chat' })

const route   = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()
const { isOnline } = usePresence()
const { settings: userSettings } = useUserSettings()

const chatId = route.params.id

// ── Load Chat Metadata ────────────────────────────────────────────
const { data: chat } = await useAsyncData(`chat-${chatId}`, async () => {
  const { data } = await supabase
    .from('chats')
    .select(`
      id,
      product:products (
        id, title, slug, price, is_negotiable, stock, status,
        product_media ( media_url, media_type, thumbnail_url, is_primary )
      ),
      buyer:users!buyer_id   ( id, name, avatar_url ),
      seller:users!seller_id ( id, name, avatar_url )
    `)
    .eq('id', chatId)
    .single()
  return data
})

useHead({ title: computed(() => {
  const productTitle = chat.value?.product?.title
  if (productTitle) return `Chat ${productTitle} — VivaThrift`
  return 'Chat — VivaThrift'
}) })

// Resolve user ID reliably (useSupabaseUser() can be null before auth state settles)
const { data: { session } } = await supabase.auth.getSession()
const currentUserId = ref(session?.user?.id ?? currentUser.value?.id ?? null)
const myId = computed(() => currentUserId.value ?? currentUser.value?.id ?? null)

// Redirect if chat not found, user not logged in, or product deleted
if (!chat.value || !myId.value || chat.value.product?.status === 'deleted') {
  await navigateTo('/chat')
}

// Anyone who didn't post the product is treated as buyer
const isSeller = computed(() => myId.value === chat.value?.seller?.id)
const isBuyer  = computed(() => !!myId.value && !isSeller.value)

const otherParty = computed(() =>
  isBuyer.value ? chat.value?.seller : chat.value?.buyer
)

// ── Presence / Online Status ────────────────────────────────────
const otherLastSeen = ref(null)

// High-water mark helper: only ever moves forward in time, never backward.
// This prevents delivered (double-gray) checks from reverting to single-gray.
function setLastSeenIfNewer(ts) {
  if (!ts) return
  if (!otherLastSeen.value || new Date(ts) > new Date(otherLastSeen.value)) {
    otherLastSeen.value = ts
  }
}

const otherOnline = computed(() => {
  const otherId = otherParty.value?.id
  return otherId ? isOnline(otherId) : false
})

function formatLastSeen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'terakhir dilihat baru saja'
  if (diffMin < 60) return `terakhir dilihat ${diffMin} menit yang lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `terakhir dilihat ${diffHour} jam yang lalu`
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return `terakhir dilihat kemarin ${hhmm}`
  return `terakhir dilihat ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${hhmm}`
}

const otherStatusText = computed(() => {
  if (otherOnline.value) return 'Online'
  return formatLastSeen(otherLastSeen.value)
})

async function fetchOtherLastSeen() {
  const otherId = otherParty.value?.id
  if (!otherId) return
  const { data } = await supabase.from('users').select('last_seen_at').eq('id', otherId).single()
  if (data?.last_seen_at) setLastSeenIfNewer(data.last_seen_at)
}

// When other party comes online or goes offline, update the delivered timestamp.
// - online: all existing messages are now "delivered"
// - offline: stamp the time so double-gray persists
watch(otherOnline, (online, wasOnline) => {
  if (online || wasOnline) {
    setLastSeenIfNewer(new Date().toISOString())
  }
})

const productCover = computed(() => {
  const media = chat.value?.product?.product_media
  if (!media?.length) return null
  const primary = media.find(m => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
})

const productSlug = computed(() =>
  chat.value?.product?.slug ?? chat.value?.product?.id
)

// ── Messages ─────────────────────────────────────────────────────
const messages = ref([])

// Reply / Edit state
const replyingTo     = ref(null) // { id, content, sender_id, sender_name }
const editingMsgId   = ref(null)
const editText       = ref('')
const localHiddenIds = ref([])
const deleteMenuMsgId = ref(null) // which message's delete menu is open

// ── Search ──────────────────────────────────────────────────────
const searchOpen = ref(false)
const searchQuery = ref('')
const searchCurrentIdx = ref(0)

const searchMatches = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return messages.value
    .map((msg, idx) => ({ msgId: msg.id, idx }))
    .filter(({ idx }) => {
      const msg = messages.value[idx]
      if (msg.is_deleted || msg.content === '$$DELETED$$') return false
      return msg.content?.toLowerCase().includes(q)
    })
})

const searchTotal = computed(() => searchMatches.value.length)

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) {
    searchQuery.value = ''
    searchCurrentIdx.value = 0
  } else {
    nextTick(() => document.getElementById('chat-search-input')?.focus())
  }
}

function goSearchResult(dir) {
  if (!searchTotal.value) return
  if (dir === 'next') searchCurrentIdx.value = (searchCurrentIdx.value + 1) % searchTotal.value
  else searchCurrentIdx.value = (searchCurrentIdx.value - 1 + searchTotal.value) % searchTotal.value
  const match = searchMatches.value[searchCurrentIdx.value]
  if (match) scrollToMsg(match.msgId)
}

watch(searchQuery, () => {
  searchCurrentIdx.value = 0
  if (searchMatches.value.length) {
    nextTick(() => scrollToMsg(searchMatches.value[0].msgId))
  }
})

function highlightText(text, query) {
  if (!query || !text) return escapeHtmlChat(text ?? '')
  const q = query.trim()
  if (!q) return escapeHtmlChat(text)
  const escaped = escapeHtmlChat(text)
  const escapedQuery = escapeHtmlChat(q)
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(regex, '<mark class="chat-search-hl">$1</mark>')
}

function escapeHtmlChat(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Load messages — try with offer join; fall back if offer_id column not yet migrated
{
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted,
      sender:users!sender_id ( id, name, avatar_url ),
      offer:offers ( id, offered_price, quantity, status )
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  if (error) {
    // Fall back to basic query (offer_id column / FK not yet in DB)
    const { data: fallback } = await supabase
      .from('messages')
      .select(`id, content, is_read, created_at, sender_id, is_deleted, edited_at, sender:users!sender_id ( id, name, avatar_url )`)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
    messages.value = fallback ?? []
  } else {
    messages.value = data ?? []
  }

  // Resolve reply references locally (self-join on messages is unreliable)
  const replyIds = messages.value
    .filter(m => m.reply_to_id)
    .map(m => m.reply_to_id)
  if (replyIds.length) {
    // Collect IDs not found in the local list (replied-to message outside current chat)
    const localMap = new Map(messages.value.map(m => [m.id, m]))
    const missingIds = replyIds.filter(id => !localMap.has(id))
    let remoteMap = new Map()
    if (missingIds.length) {
      const { data: remote } = await supabase
        .from('messages')
        .select('id, content, sender_id, is_deleted, offer_id, sender:users!sender_id(name)')
        .in('id', missingIds)
      if (remote) remoteMap = new Map(remote.map(m => [m.id, m]))
    }
    for (const msg of messages.value) {
      if (!msg.reply_to_id) { msg.reply = null; continue }
      const local = localMap.get(msg.reply_to_id)
      if (local) {
        msg.reply = {
          id: local.id,
          content: local.content,
          sender_id: local.sender_id,
          is_deleted: local.is_deleted,
          offer_id: local.offer_id,
          sender: local.sender ? { name: local.sender.name } : null
        }
      } else {
        msg.reply = remoteMap.get(msg.reply_to_id) ?? null
      }
    }
  }
}

// ── Scroll ────────────────────────────────────────────────────────
const messagesContainer = ref(null)
const unreadDividerRef = ref(null)

function scrollToBottom(behavior = 'smooth') {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// ── Unread divider (snapshot at page open, before marking read) ───
const unreadDividerIndex = ref(-1)
const unreadCountOnOpen = ref(0)

// ── Mark messages read (localStorage — no RLS dependency) ──────────
const navRefreshTrigger = useState('navRefreshTrigger', () => 0)

function markMessagesAsRead(latestServerTs = null) {
  if (!import.meta.client || !myId.value) return

  // Update localStorage (for cross-tab / offline fallback)
  let readUntil = latestServerTs ? new Date(latestServerTs).getTime() : null
  if (!readUntil) {
    const lastMsg = messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
    readUntil = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : Date.now()
  }
  localStorage.setItem(`chat_viewed_${myId.value}_${chatId}`, readUntil.toString())

  // Collect unread messages from others
  const unreadIds = messages.value
    .filter(m => m.sender_id !== myId.value && m.is_read === false)
    .map(m => m.id)
  if (unreadIds.length > 0) {
    // Optimistic: set local is_read immediately so duplicate calls skip these
    for (const m of messages.value) {
      if (unreadIds.includes(m.id)) m.is_read = true
    }
    // Persist to DB, then broadcast + refresh nav AFTER commit
    supabase
      .from('messages')
      .update({ is_read: true })
      .in('id', unreadIds)
      .then(() => {
        // Broadcast so the sender sees blue checkmarks instantly (only if read_receipts enabled)
        if (userSettings.value.read_receipts) {
          channel?.send({ type: 'broadcast', event: 'messages-read', payload: { msgIds: unreadIds, readBy: myId.value } })
        }
        // Signal Navbar to re-fetch AFTER DB has committed
        navRefreshTrigger.value++
      })
  }
}

// ── Realtime ──────────────────────────────────────────────────────
let channel = null

onMounted(() => {
  // Snapshot unread state BEFORE writing localStorage
  if (import.meta.client && myId.value) {
    const lastViewed = parseInt(localStorage.getItem(`chat_viewed_${myId.value}_${chatId}`) ?? '0')
    if (lastViewed > 0) {
      const idx = messages.value.findIndex(
        m => new Date(m.created_at).getTime() > lastViewed && m.sender_id !== myId.value
      )
      unreadDividerIndex.value = idx
      if (idx >= 0) {
        unreadCountOnOpen.value = messages.value.slice(idx).filter(
          m => new Date(m.created_at).getTime() > lastViewed && m.sender_id !== myId.value
        ).length
      }
    }
  }

  // Scroll to unread divider if present, otherwise to bottom
  // Use rAF to ensure browser has finished layout (flexbox heights are final)
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = messagesContainer.value
        if (!container) return
        if (unreadDividerIndex.value >= 0) {
          // Prefer the template ref; fall back to querySelector in case the ref
          // array isn't populated yet (can happen during SSR hydration in Nuxt).
          let dividerEl = Array.isArray(unreadDividerRef.value)
            ? unreadDividerRef.value[0]
            : unreadDividerRef.value
          if (!dividerEl) {
            dividerEl = container.querySelector('[data-unread-divider]')
          }
          if (dividerEl) {
            const dividerTop = dividerEl.getBoundingClientRect().top
            const containerTop = container.getBoundingClientRect().top
            container.scrollTop += dividerTop - containerTop - 8
          } else {
            container.scrollTop = container.scrollHeight
          }
        } else {
          container.scrollTop = container.scrollHeight
        }
      })
    })
  })

  markMessagesAsRead()
  setupChatChannel()
  fetchOtherLastSeen()

  // Close delete menu when clicking outside
  document.addEventListener('click', (e) => {
    if (deleteMenuMsgId.value && !e.target.closest('[data-delete-menu]')) {
      deleteMenuMsgId.value = null
    }
  })

  // Load locally hidden message IDs
  if (import.meta.client && myId.value) {
    try {
      const stored = localStorage.getItem(`chat_hidden_${chatId}_${myId.value}`)
      if (stored) localHiddenIds.value = JSON.parse(stored)
    } catch {}
  }
})

onBeforeUnmount(() => {
  // Ensure latest messages are marked read before leaving
  markMessagesAsRead()
  // Clean up realtime channels
  if (channel) { supabase.removeChannel(channel); channel = null }
  if (roomRetryTimer) { clearTimeout(roomRetryTimer); roomRetryTimer = null }
})

let roomRetryTimer = null

function setupChatChannel() {
  if (roomRetryTimer) { clearTimeout(roomRetryTimer); roomRetryTimer = null }
  if (channel) { supabase.removeChannel(channel); channel = null }
  channel = supabase
    .channel(`chat-room-${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      async (payload) => {
        if (messages.value.some(m => m.id === payload.new.id)) return
        let offer = null
        let reply = null
        if (payload.new.offer_id) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('id, offered_price, quantity, status')
            .eq('id', payload.new.offer_id)
            .single()
          offer = offerData
        }
        if (payload.new.reply_to_id) {
          // First try local lookup (faster, avoids extra DB call)
          const local = messages.value.find(m => m.id === payload.new.reply_to_id)
          if (local) {
            reply = { id: local.id, content: local.content, sender_id: local.sender_id, is_deleted: local.is_deleted, offer_id: local.offer_id, sender: local.sender ? { name: local.sender.name } : null }
          } else {
            const { data: replyData } = await supabase
              .from('messages')
              .select('id, content, sender_id, is_deleted, offer_id, sender:users!sender_id(name)')
              .eq('id', payload.new.reply_to_id)
              .single()
            reply = replyData
          }
        }
        // Re-check after async work — broadcast handler may have added it
        if (messages.value.some(m => m.id === payload.new.id)) return
        const basic = { ...payload.new, offer, reply, sender: null }
        messages.value.push(basic)
        // Clear unread divider on any new message
        unreadDividerIndex.value = -1
        unreadCountOnOpen.value = 0
        // Mark read AFTER push so the new message is included in unreadIds
        if (payload.new.sender_id !== myId.value) {
          markMessagesAsRead(payload.new.created_at)
        }
        scrollToBottom()
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'offers', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const updated = payload.new
        const msg = messages.value.find(m => m.offer_id === updated.id)
        if (msg?.offer) msg.offer.status = updated.status
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${chat.value?.product?.id}` },
      (payload) => {
        const p = payload.new
        if (p.stock  !== undefined) localProductStock.value  = p.stock
        if (p.status !== undefined) localProductStatus.value = p.status
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const idx = messages.value.findIndex(m => m.id === payload.new.id)
        if (idx >= 0) {
          messages.value[idx] = { ...messages.value[idx], ...payload.new }
        }
        // Keep reply sub-objects in sync (e.g. when DB confirms a delete or edit)
        const { id, content, is_deleted } = payload.new
        patchReplyRefs(id, { content, is_deleted })
      }
    )
    .on('broadcast', { event: 'message-deleted' }, ({ payload }) => {
      if (payload?.sender_id === myId.value) return
      const idx = messages.value.findIndex(m => m.id === payload.msgId)
      if (idx >= 0) {
        messages.value[idx] = { ...messages.value[idx], is_deleted: true, content: '$$DELETED$$' }
      }
      patchReplyRefs(payload.msgId, { is_deleted: true, content: '$$DELETED$$' })
    })
    .on('broadcast', { event: 'message-edited' }, ({ payload }) => {
      if (payload?.sender_id === myId.value) return
      const idx = messages.value.findIndex(m => m.id === payload.msgId)
      if (idx >= 0) {
        messages.value[idx] = { ...messages.value[idx], content: payload.content, edited_at: payload.edited_at }
      }
      patchReplyRefs(payload.msgId, { content: payload.content })
    })
    .on('broadcast', { event: 'offer-updated' }, ({ payload }) => {
      // Update offer status in the message bubble for the other party
      const msg = messages.value.find(m => m.offer_id === payload.offerId || m.offer?.id === payload.offerId)
      if (msg?.offer) msg.offer.status = payload.status
    })
    .on('broadcast', { event: 'new-message' }, ({ payload }) => {
      // Other party receives regular message instantly via broadcast
      if (!payload?.message || payload.message.sender_id === myId.value) return
      if (messages.value.some(m => m.id === payload.message.id)) return
      messages.value.push({ ...payload.message, offer: null, sender: null, reply: payload.reply ?? null })
      unreadDividerIndex.value = -1
      unreadCountOnOpen.value = 0
      markMessagesAsRead(payload.message.created_at)
      scrollToBottom()
    })
    .on('broadcast', { event: 'new-offer' }, ({ payload }) => {
      // Other party receives offer message instantly via broadcast with full offer data
      if (!payload?.message || payload.message.sender_id === myId.value) return
      if (messages.value.some(m => m.id === payload.message.id)) return
      messages.value.push({ ...payload.message, offer: payload.offer, reply: null, sender: null })
      unreadDividerIndex.value = -1
      unreadCountOnOpen.value = 0
      markMessagesAsRead(payload.message.created_at)
      scrollToBottom()
    })
    .on('broadcast', { event: 'messages-read' }, ({ payload }) => {
      // Other party read our messages — update is_read to show blue checkmarks
      if (!payload?.msgIds || payload.readBy === myId.value) return
      for (const m of messages.value) {
        if (payload.msgIds.includes(m.id)) m.is_read = true
      }
    })
    .subscribe((status) => {
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        roomRetryTimer = setTimeout(setupChatChannel, 3000)
      }
    })
}

function onRoomVisibilityChange() {
  if (document.visibilityState === 'visible') {
    setupChatChannel()
    markMessagesAsRead()
  }
}
function onRoomOnline() { setupChatChannel() }

onMounted(() => {
  document.addEventListener('visibilitychange', onRoomVisibilityChange)
  window.addEventListener('online', onRoomOnline)
})

onUnmounted(() => {
  if (roomRetryTimer) clearTimeout(roomRetryTimer)
  if (channel) supabase.removeChannel(channel)
  document.removeEventListener('visibilitychange', onRoomVisibilityChange)
  window.removeEventListener('online', onRoomOnline)
})

// ── Send Message ──────────────────────────────────────────────────
const messageText = ref('')
const sending = ref(false)

async function sendMessage() {
  const text = messageText.value.trim()
  if (!text || sending.value) return
  sending.value = true
  messageText.value = ''
  // Clear unread divider when user sends a message
  unreadDividerIndex.value = -1
  unreadCountOnOpen.value = 0
  const replyId  = replyingTo.value?.id ?? null
  const replyMsg = replyId ? (messages.value.find(m => m.id === replyId) ?? null) : null
  replyingTo.value = null
  try {
    const insertPayload = { chat_id: chatId, sender_id: myId.value, content: text }
    if (replyId) insertPayload.reply_to_id = replyId
    const { data: newMsg, error } = await supabase.from('messages').insert(insertPayload)
      .select('id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted').single()
    if (error) throw error
    // Optimistic: add to local array immediately; realtime will deduplicate
    if (newMsg && !messages.value.some(m => m.id === newMsg.id)) {
      messages.value.push({ ...newMsg, offer: null, sender: null, reply: replyMsg })
      scrollToBottom()
    }
    // Broadcast so the other party receives the message instantly (more reliable than postgres_changes)
    channel?.send({ type: 'broadcast', event: 'new-message', payload: { message: newMsg, reply: replyMsg } })
  } catch (e) {
    messageText.value = text
    console.error(e)
  } finally {
    sending.value = false
  }
}

function onInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// ── Offer Modal ───────────────────────────────────────────────────
const showOfferModal  = ref(false)
const offerPrice      = ref('')
const offerQty        = ref(1)
const offerError      = ref('')
const submittingOffer = ref(false)

// Reactive product stock/status — updated by realtime so the offer button
// disappears immediately on the same screen after a successful checkout.
const localProductStock  = ref(chat.value?.product?.stock  ?? null)
const localProductStatus = ref(chat.value?.product?.status ?? null)

const maxQty = computed(() => {
  const s = localProductStock.value
  return (s !== null && s !== undefined) ? s : 99
})

// True only when the product still has available stock
const productAvailable = computed(() =>
  localProductStatus.value !== 'sold' &&
  (localProductStock.value === null || localProductStock.value > 0)
)

function openOfferModal() {
  offerPrice.value = chat.value?.product?.price?.toString() ?? ''
  offerQty.value   = 1
  offerError.value = ''
  showOfferModal.value = true
}

async function submitOffer() {
  offerError.value = ''
  const price = Number(offerPrice.value)
  const qty   = Number(offerQty.value)

  const originalPrice = chat.value?.product?.price ?? null
  if (!price || price <= 0)                        return (offerError.value = 'Harga harus lebih dari 0.')
  if (originalPrice !== null && price >= originalPrice) return (offerError.value = `Penawaran harus lebih rendah dari harga asli (Rp ${originalPrice.toLocaleString('id-ID')}).`)
  if (!qty   || qty   <  1)                        return (offerError.value = 'Jumlah minimal 1.')
  if (maxQty.value !== null && qty > maxQty.value) return (offerError.value = `Stok hanya ${maxQty.value}.`)

  submittingOffer.value = true
  try {
    const { data: offer, error: offErr } = await supabase
      .from('offers')
      .insert({
        chat_id:       chatId,
        product_id:    chat.value.product.id,
        buyer_id:      myId.value,
        offered_price: price,
        quantity:      qty,
        status:        'pending',
      })
      .select('id')
      .single()
    if (offErr) throw offErr

    const { data: newMsg, error: msgErr } = await supabase.from('messages').insert({
      chat_id:   chatId,
      sender_id: myId.value,
      offer_id:  offer.id,
      content:   `Mengajukan penawaran: Rp ${price.toLocaleString('id-ID')} × ${qty} unit`,
    }).select('id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted').single()
    if (msgErr) throw msgErr

    const offerData = { id: offer.id, offered_price: price, quantity: qty, status: 'pending' }

    // Push optimistically so the message appears immediately (don't wait for realtime)
    if (newMsg && !messages.value.some(m => m.id === newMsg.id)) {
      messages.value.push({
        ...newMsg,
        offer: offerData,
        reply: null,
        sender: null,
      })
      scrollToBottom()
    }

    // Broadcast to seller so their chat updates in real-time with full offer data
    channel?.send({ type: 'broadcast', event: 'new-offer', payload: { message: newMsg, offer: offerData } })

    showOfferModal.value = false
  } catch (e) {
    offerError.value = e.message ?? 'Gagal mengajukan penawaran.'
  } finally {
    submittingOffer.value = false
  }
}

// ── Accept / Reject Offer (seller only) ───────────────────────────
const processingOffer = ref(null)

async function respondOffer(offerId, status) {
  processingOffer.value = offerId
  try {
    const { error } = await supabase
      .from('offers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', offerId)
    if (error) throw error

    // Optimistic update: reflect new status immediately in seller's own view
    const offerMsg = messages.value.find(m => m.offer_id === offerId || m.offer?.id === offerId)
    if (offerMsg?.offer) offerMsg.offer.status = status

    // Broadcast so the other party (buyer) sees update without reload
    channel?.send({ type: 'broadcast', event: 'offer-updated', payload: { offerId, status } })
    const label = status === 'accepted' ? 'menerima' : 'menolak'
    const { data: respondMsg } = await supabase.from('messages').insert({
      chat_id:   chatId,
      sender_id: myId.value,
      content:   `Penjual ${label} penawaran ini.`,
      reply_to_id: offerMsg?.id ?? null,
    }).select('id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted').single()

    // Push the confirmation message immediately
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

// ── Checkout from Offer (buyer only) ─────────────────────────────
function checkoutOffer(offerId) {
  navigateTo(`/checkout?offer_id=${offerId}`)
}

// ── Reply / Edit / Delete ─────────────────────────────────────────
function canModifyMsg(msg) {
  if (!msg?.created_at) return false
  return (Date.now() - new Date(msg.created_at).getTime()) < 15 * 60 * 1000
}

function startReply(msg) {
  replyingTo.value = {
    id:          msg.id,
    content:     msg.content ?? '',
    sender_id:   msg.sender_id,
    sender_name: msg.sender_id === myId.value
      ? 'Kamu'
      : (msg.sender?.name ?? otherParty.value?.name ?? '...')
  }
  nextTick(() => document.querySelector('textarea')?.focus())
}

function cancelReply() { replyingTo.value = null }

function startEdit(msg) {
  editingMsgId.value = msg.id
  editText.value     = msg.content ?? ''
}

function cancelEdit() {
  editingMsgId.value = null
  editText.value     = ''
}

async function saveEdit() {
  const text = editText.value.trim()
  if (!text || !editingMsgId.value) return
  const id = editingMsgId.value
  cancelEdit()
  const editedAt = new Date().toISOString()
  // Optimistic — force reactivity via index replacement
  const idx = messages.value.findIndex(m => m.id === id)
  if (idx >= 0) {
    messages.value[idx] = { ...messages.value[idx], content: text, edited_at: editedAt }
  }
  await supabase.from('messages')
    .update({ content: text, edited_at: editedAt })
    .eq('id', id)
    .eq('sender_id', myId.value)
  // Broadcast edit to other party
  channel?.send({ type: 'broadcast', event: 'message-edited', payload: { msgId: id, content: text, edited_at: editedAt, sender_id: myId.value } })
}

// Sync .reply sub-objects so reply quotes stay in sync when a message is mutated.
function patchReplyRefs(msgId, patch) {
  for (let i = 0; i < messages.value.length; i++) {
    if (messages.value[i].reply?.id === msgId) {
      messages.value[i] = {
        ...messages.value[i],
        reply: { ...messages.value[i].reply, ...patch },
      }
    }
  }
}

function toggleDeleteMenu(msgId) {
  deleteMenuMsgId.value = deleteMenuMsgId.value === msgId ? null : msgId
}

async function deleteForAll(msgId) {
  deleteMenuMsgId.value = null
  const idx = messages.value.findIndex(m => m.id === msgId)
  if (idx >= 0) {
    messages.value[idx] = { ...messages.value[idx], is_deleted: true, content: '$$DELETED$$' }
  }
  patchReplyRefs(msgId, { is_deleted: true, content: '$$DELETED$$' })
  // Try with is_deleted column first, fall back to content-only if column doesn't exist
  const { error } = await supabase.from('messages')
    .update({ is_deleted: true, content: '$$DELETED$$' })
    .eq('id', msgId)
    .eq('sender_id', myId.value)
  if (error) {
    // Fallback: column might not exist yet — just update content
    await supabase.from('messages')
      .update({ content: '$$DELETED$$' })
      .eq('id', msgId)
      .eq('sender_id', myId.value)
  }
  // Broadcast delete to other party
  channel?.send({ type: 'broadcast', event: 'message-deleted', payload: { msgId, sender_id: myId.value } })
}

function deleteForMe(msgId) {
  deleteMenuMsgId.value = null
  hideForMe(msgId)
}

// ── Profile Card ────────────────────────────────────────────────
const profileCardUserId = ref(null)

// ── Helpers ───────────────────────────────────────────────────────
function scrollToMsg(id) {
  if (!id || !messagesContainer.value) return
  nextTick(() => {
    const el = messagesContainer.value.querySelector(`[data-msg-id="${id}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const orig = el.style.transition
    el.style.transition = 'background-color 0.3s'
    el.style.borderRadius = '12px'
    el.style.backgroundColor = isDark.value ? 'rgba(14,165,233,0.18)' : 'rgba(30,58,138,0.1)'
    setTimeout(() => { el.style.backgroundColor = ''; el.style.transition = orig }, 1400)
  })
}

function hideForMe(msgId) {
  if (localHiddenIds.value.includes(msgId)) return
  localHiddenIds.value = [...localHiddenIds.value, msgId]
  if (import.meta.client && myId.value) {
    localStorage.setItem(`chat_hidden_${chatId}_${myId.value}`, JSON.stringify(localHiddenIds.value))
  }
}
function formatTime(iso) {
  if (!iso) return ''
  const d   = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + time
}

function avatarInitial(name) {
  return (name ?? '?')[0].toUpperCase()
}
</script>

<template>
  <div class="flex flex-col h-full">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <div
      class="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
      :style="isDark
        ? 'background: rgba(15,25,50,0.90); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.08);'
        : 'background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-color: rgba(30,58,138,0.1);'"
    >
      <button @click="$router.back()" class="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-300">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- Product thumbnail -->
      <NuxtLink :to="productSlug ? `/products/${productSlug}` : '#'" class="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/10 shrink-0">
        <img v-if="productCover" :src="productCover" :alt="chat?.product?.title" class="w-full h-full object-cover"/>
        <div v-else class="w-full h-full flex items-center justify-center text-lg">📷</div>
      </NuxtLink>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <!-- Product title (top row) -->
        <NuxtLink
          :to="productSlug ? `/products/${productSlug}` : '#'"
          class="font-semibold text-sm text-gray-800 dark:text-white truncate hover:text-blue-600 dark:hover:text-sky-400 transition block"
        >{{ chat?.product?.title }}</NuxtLink>
        <!-- Avatar + Name + Status (bottom row) -->
        <div class="flex items-center gap-2 mt-0.5">
          <button
            v-if="otherParty"
            @click="profileCardUserId = otherParty.id"
            class="shrink-0 w-7 h-7 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10 hover:ring-2 ring-sky-400 transition"
          >
            <img v-if="otherParty.avatar_url" :src="otherParty.avatar_url" :alt="otherParty.name" class="w-full h-full object-cover" />
            <span v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-300">{{ avatarInitial(otherParty.name) }}</span>
          </button>
          <div class="min-w-0">
            <button
              v-if="otherParty"
              @click="profileCardUserId = otherParty.id"
              class="text-xs text-gray-400 hover:text-sky-400 dark:hover:text-sky-400 transition truncate max-w-full text-left block leading-tight"
            >{{ otherParty.name }}</button>
            <p v-if="otherStatusText" class="text-[10px] leading-tight" :class="otherOnline ? 'text-green-500 font-medium' : 'text-gray-400 dark:text-gray-500'">{{ otherStatusText }}</p>
            <p v-else-if="!otherParty" class="text-xs text-gray-400">...</p>
          </div>
        </div>
      </div>

      <!-- Price badge -->
      <div class="shrink-0 text-right">
        <p v-if="!productAvailable" class="text-xs font-bold text-red-500">Stok habis</p>
        <template v-else>
          <p class="text-xs font-bold text-blue-900 dark:text-sky-400">
            Rp {{ (chat?.product?.price ?? 0).toLocaleString('id-ID') }}
          </p>
          <p v-if="localProductStock !== null && localProductStock !== undefined" class="text-xs text-gray-400 dark:text-gray-500">Stok: {{ localProductStock }}</p>
          <p v-if="chat?.product?.is_negotiable" class="text-xs text-green-500">🤝 Bisa Nego</p>
        </template>
      </div>

      <!-- Search toggle -->
      <button @click="toggleSearch" class="p-1.5 rounded-lg transition shrink-0" :class="searchOpen ? 'bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
      </button>
    </div>

    <!-- ── Search Bar ──────────────────────────────────────────── -->
    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 -translate-y-2" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-2">
      <div
        v-if="searchOpen"
        class="shrink-0 flex items-center gap-2 px-4 py-2 border-b"
        :style="isDark
          ? 'background: #0f1932; border-color: rgba(255,255,255,0.08);'
          : 'background: rgba(255,255,255,0.9); border-color: rgba(30,58,138,0.1);'"
      >
        <div class="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" :style="isDark ? 'background:#0f1932; border:1px solid rgba(255,255,255,0.15);' : 'background:rgba(30,58,138,0.05); border:1px solid rgba(30,58,138,0.12);'">
          <svg class="w-4 h-4 shrink-0" :class="isDark ? 'text-gray-400' : 'text-gray-400'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          <input
            id="chat-search-input"
            v-model="searchQuery"
            type="text"
            placeholder="Cari pesan..."
            class="flex-1 bg-transparent outline-none text-sm placeholder-gray-400"
            :class="isDark ? 'text-white' : 'text-gray-800'"
            @keydown.enter.prevent="goSearchResult('next')"
            @keydown.escape="toggleSearch"
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <span v-if="searchQuery.trim()" class="text-xs font-medium shrink-0" :class="isDark ? 'text-gray-400' : 'text-gray-500'">{{ searchTotal ? `${searchCurrentIdx + 1}/${searchTotal}` : '0/0' }}</span>
        <button @click="goSearchResult('prev')" :disabled="!searchTotal" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-30" title="Sebelumnya">
          <svg class="w-4 h-4" :class="isDark ? 'text-gray-300' : 'text-gray-600'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
        </button>
        <button @click="goSearchResult('next')" :disabled="!searchTotal" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-30" title="Berikutnya">
          <svg class="w-4 h-4" :class="isDark ? 'text-gray-300' : 'text-gray-600'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
      </div>
    </Transition>

    <!-- ── Messages ───────────────────────────────────────────────── -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
    >
      <template v-for="(msg, index) in messages" :key="msg.id">

        <!-- Unread messages divider -->
        <div
          v-if="index === unreadDividerIndex && unreadCountOnOpen > 0"
          ref="unreadDividerRef"
          data-unread-divider
          class="flex items-center gap-3 my-1 select-none"
        >
          <div class="flex-1 h-px" :style="isDark ? 'background:rgba(255,255,255,0.15)' : 'background:rgba(30,58,138,0.15)'"></div>
          <span
            class="text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap"
            :style="isDark
              ? 'background:rgba(14,165,233,0.18); color:#7dd3fc; border:1px solid rgba(14,165,233,0.3);'
              : 'background:rgba(30,58,138,0.08); color:#1e3a8a; border:1px solid rgba(30,58,138,0.2);'"
          >
            {{ unreadCountOnOpen }} pesan belum dibaca
          </span>
          <div class="flex-1 h-px" :style="isDark ? 'background:rgba(255,255,255,0.15)' : 'background:rgba(30,58,138,0.15)'"></div>
        </div>

        <div
          v-if="!localHiddenIds.includes(msg.id)"
          :data-msg-id="msg.id"
          :class="msg.sender_id === myId ? 'items-end' : 'items-start'"
          class="flex flex-col group"
        >
        <!-- Bubble + Action wrapper -->
        <div
          class="flex items-end gap-1"
          :class="msg.sender_id === myId ? 'flex-row' : 'flex-row-reverse'"
        >
          <!-- Action buttons (appear on hover) -->
          <div
            v-if="!msg.offer_id"
            class="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              v-if="!msg.is_deleted && msg.content !== '$$DELETED$$'"
              @click="startReply(msg)"
              title="Balas"
              class="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition text-gray-400"
            >↩</button>
            <button
              v-if="msg.sender_id === myId && !msg.is_deleted && msg.content !== '$$DELETED$$' && canModifyMsg(msg)"
              @click="startEdit(msg)"
              title="Edit"
              class="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition text-gray-400"
            >✏</button>
            <div class="relative" data-delete-menu>
              <button
                @click="toggleDeleteMenu(msg.id)"
                title="Hapus"
                class="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-red-100 dark:hover:bg-red-900/20 transition text-gray-400 hover:text-red-500"
              >🗑</button>
              <!-- Delete context menu -->
              <div
                v-if="deleteMenuMsgId === msg.id"
                class="absolute z-20 min-w-[160px] rounded-xl shadow-lg py-1 border"
                :class="msg.sender_id === myId ? 'right-0' : 'left-0'"
                :style="isDark
                  ? 'background:#1e293b; border-color:rgba(255,255,255,0.1);'
                  : 'background:#fff; border-color:rgba(0,0,0,0.08);'"
                style="bottom: 100%; margin-bottom: 4px;"
              >
                <button
                  @click="deleteForMe(msg.id)"
                  class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition"
                  :class="isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-50 text-gray-700'"
                >
                  <span>🙈</span> Hapus untuk saya
                </button>
                <button
                  v-if="msg.sender_id === myId && !msg.is_deleted && msg.content !== '$$DELETED$$' && canModifyMsg(msg)"
                  @click="deleteForAll(msg.id)"
                  class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition text-red-500"
                  :class="isDark ? 'hover:bg-red-900/20' : 'hover:bg-red-50'"
                >
                  <span>🗑</span> Hapus untuk semua
                </button>
              </div>
            </div>
          </div>
        <!-- Offer Bubble -->
        <template v-if="msg.offer_id && msg.offer">
          <div
            class="w-72 rounded-2xl p-4 flex flex-col gap-2"
            :style="msg.sender_id === myId
              ? (isDark
                  ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color:#fff;'
                  : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff;')
              : isDark
                ? 'background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0;'
                : 'background: rgba(255,255,255,0.9); border:1px solid rgba(30,58,138,0.15);'"
          >
            <p class="text-xs font-bold uppercase opacity-70 tracking-wider">Penawaran</p>
            <div class="flex justify-between items-baseline">
              <span class="text-xs opacity-60">Harga</span>
              <span class="text-lg font-bold">Rp {{ (msg.offer.offered_price ?? 0).toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-xs opacity-60">Jumlah</span>
              <span class="text-sm font-semibold">&times; {{ msg.offer.quantity }} unit</span>
            </div>
            <div class="h-px my-1" :style="msg.sender_id === myId ? 'background:rgba(255,255,255,0.25)' : isDark ? 'background:rgba(255,255,255,0.1)' : 'background:rgba(0,0,0,0.08)'"></div>
            <div class="flex justify-between items-baseline">
              <span class="text-xs font-semibold opacity-70">Subtotal</span>
              <span class="text-base font-bold">Rp {{ ((msg.offer.offered_price ?? 0) * (msg.offer.quantity ?? 1)).toLocaleString('id-ID') }}</span>
            </div>

            <!-- Status badge -->
            <span
              class="self-start px-2 py-0.5 rounded-full text-xs font-semibold"
              :class="{
                'bg-yellow-100 text-yellow-800': msg.offer.status === 'pending',
                'bg-green-100 text-green-800':   msg.offer.status === 'accepted',
                'bg-red-100 text-red-700':        msg.offer.status === 'rejected',
                'bg-gray-100 text-gray-600':      msg.offer.status === 'expired',
              }"
            >
              {{ msg.offer.status === 'pending'  ? '⏳ Menunggu' :
                 msg.offer.status === 'accepted' ? '✅ Diterima' :
                 msg.offer.status === 'rejected' ? '❌ Ditolak'  : '🚫 Kedaluwarsa' }}
            </span>

            <!-- Seller: accept / reject buttons -->
            <div v-if="isSeller && msg.offer.status === 'pending'" class="flex gap-2 mt-1">
              <button
                @click="respondOffer(msg.offer.id, 'accepted')"
                :disabled="processingOffer === msg.offer.id"
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-600 text-white transition disabled:opacity-50"
              >
                Terima
              </button>
              <button
                @click="respondOffer(msg.offer.id, 'rejected')"
                :disabled="processingOffer === msg.offer.id"
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50"
              >
                Tolak
              </button>
            </div>

            <!-- Buyer: checkout when accepted -->
            <button
              v-if="isBuyer && msg.offer.status === 'accepted'"
              @click="checkoutOffer(msg.offer.id)"
              class="w-full py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-800 hover:bg-blue-50 transition mt-1"
            >
              ⚡ Checkout Tawaran
            </button>

            <!-- Buyer: already checked out -->
            <div
              v-else-if="isBuyer && msg.offer.status === 'expired'"
              class="w-full py-1.5 rounded-lg text-xs font-semibold text-center bg-white/20 text-white mt-1"
            >
              ✅ Sudah Di-Checkout
            </div>
          </div>
        </template>

        <!-- Normal Message Bubble -->
        <template v-else>
          <div
            class="max-w-sm px-4 py-2.5 rounded-2xl text-sm"
            :style="msg.sender_id === myId
              ? (isDark
                  ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color:#fff; border-radius: 18px 4px 18px 18px;'
                  : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; border-radius: 18px 4px 18px 18px;')
              : isDark
                ? 'background: rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0; border-radius: 4px 18px 18px 18px;'
                : 'background: rgba(255,255,255,0.9); border:1px solid rgba(30,58,138,0.1); border-radius: 4px 18px 18px 18px;'"
          >
            <!-- Reply quote -->
            <div
              v-if="msg.reply_to_id"
              @click="msg.reply ? scrollToMsg(msg.reply_to_id) : null"
              class="mb-2 -mx-1 px-2 py-1.5 rounded-lg text-[11px] bg-black/10 border-l-2 border-current transition-opacity"
              :class="msg.reply && !msg.reply.is_deleted && msg.reply.content !== '$$DELETED$$' ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-60'"
            >
              <template v-if="!msg.reply || msg.reply.is_deleted || msg.reply.content === '$$DELETED$$'">
                <p class="italic opacity-75">Pesan telah dihapus</p>
              </template>
              <template v-else>
                <p class="truncate font-medium">{{ msg.reply.offer_id ? '📦 Penawaran' : (msg.reply.content ?? '').slice(0, 80) }}</p>
                <p class="truncate opacity-60 mt-0.5">{{ msg.reply.sender?.name ?? (msg.reply.sender_id === myId ? 'Kamu' : (otherParty?.name ?? '...')) }}</p>
              </template>
            </div>
            <!-- Deleted -->
            <span v-if="msg.is_deleted || msg.content === '$$DELETED$$'" class="italic text-xs opacity-50">Pesan ini telah dihapus</span>
            <!-- Editing inline -->
            <template v-else-if="editingMsgId === msg.id">
              <textarea
                v-model="editText"
                @keydown.enter.prevent="saveEdit"
                @keydown.esc="cancelEdit"
                rows="2"
                class="w-full rounded-lg px-2.5 py-1.5 outline-none resize-none text-sm bg-white/20 border border-white/30 placeholder-white/50 text-white"
              />
              <div class="flex gap-1 mt-1 justify-end">
                <button @click="cancelEdit" class="text-[11px] px-2 py-0.5 rounded opacity-60 hover:opacity-100 transition">Batal</button>
                <button @click="saveEdit" class="text-[11px] px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 border border-white/20 transition font-medium">Simpan</button>
              </div>
            </template>
            <!-- Normal content -->
            <template v-else>
              <span v-if="searchQuery.trim()" v-html="highlightText(msg.content, searchQuery)"></span>
              <span v-else>{{ msg.content }}</span>
              <span v-if="msg.edited_at" class="text-[9px] opacity-50 ml-1">&middot; diedit</span>
            </template>
          </div>
        </template>
        </div><!-- end bubble + action wrapper -->

        <p class="text-[10px] text-gray-400 mt-0.5 px-1 flex items-center gap-1" :class="msg.sender_id === myId ? 'justify-end' : ''">
          <span>{{ formatTime(msg.created_at) }}</span>
          <!-- Check marks (only on own messages) -->
          <template v-if="msg.sender_id === myId && userSettings.read_receipts">
            <!-- Double blue check: read -->
            <svg v-if="msg.is_read" class="w-4 h-4 text-sky-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1.5 12.5l5 5L17 7" />
              <path d="M7 12.5l5 5L22.5 7" />
            </svg>
            <!-- Double gray check: delivered (other party online OR was online after msg sent) -->
            <svg v-else-if="otherOnline || (otherLastSeen && new Date(msg.created_at) <= new Date(otherLastSeen))" class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1.5 12.5l5 5L17 7" />
              <path d="M7 12.5l5 5L22.5 7" />
            </svg>
            <!-- Single gray check: sent (other party offline and never seen since) -->
            <svg v-else class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12.5l5 5L20 7" />
            </svg>
          </template>
          <!-- Read receipts disabled: always show single gray check -->
          <template v-else-if="msg.sender_id === myId">
            <svg class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12.5l5 5L20 7" />
            </svg>
          </template>
        </p>
      </div>

      </template>

      <!-- Empty state -->
      <div v-if="!messages.length" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-12">
        <p class="text-4xl mb-3">💬</p>
        <p class="text-sm">Mulai percakapan sekarang!</p>
      </div>
    </div>

    <!-- ── Input Area ──────────────────────────────────────────────── -->
    <div
      class="shrink-0 border-t"
      :style="isDark
        ? 'background: rgba(15,25,50,0.90); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.08);'
        : 'background: rgba(255,255,255,0.9); backdrop-filter: blur(12px); border-color: rgba(30,58,138,0.1);'"
    >
      <!-- Reply preview strip -->
      <div v-if="replyingTo" class="flex items-center gap-2 px-4 pt-2 pb-0">
        <div class="flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5 border-l-2 border-blue-400 bg-blue-50 dark:bg-sky-900/20">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-blue-700 dark:text-sky-400 truncate">&#8618; {{ replyingTo.sender_name }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ (replyingTo.content ?? '').slice(0, 60) }}</p>
          </div>
          <button @click="cancelReply" class="shrink-0 text-gray-400 hover:text-red-400 transition text-base leading-none">&times;</button>
        </div>
      </div>

      <div class="flex items-end gap-2 px-4 py-3">
      <!-- Offer button (buyer + negotiable + still has stock only) -->
      <button
        v-if="isBuyer && chat?.product?.is_negotiable && productAvailable"
        @click="openOfferModal"
        class="shrink-0 p-2.5 rounded-xl border border-blue-200 dark:border-sky-400 text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-400/10 transition text-sm"
        title="Ajukan penawaran"
      >
        🤝
      </button>

      <textarea
        v-model="messageText"
        @keydown="onInputKeydown"
        rows="1"
        placeholder="Ketik pesan..."
        class="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none border transition text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 border-gray-200 dark:border-white/10 focus:border-blue-400 dark:focus:border-blue-500"
        :style="isDark ? 'max-height: 120px; background: rgba(255,255,255,0.07);' : 'max-height: 120px; background: rgba(255,255,255,0.8);'"
      />

      <button
        @click="sendMessage"
        :disabled="!messageText.trim() || sending"
        class="shrink-0 p-2.5 rounded-xl text-white transition disabled:opacity-40"
        :style="isDark
          ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
          : 'background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
      >
        <svg v-if="!sending" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
        <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </button>      </div>    </div>

    <!-- ── Profile Card ──────────────────────────────────────────────── -->
    <ProfileCard
      v-if="profileCardUserId"
      :user-id="profileCardUserId"
      @close="profileCardUserId = null"
    />

    <!-- ── Offer Modal ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="showOfferModal"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style="background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);"
        @click.self="showOfferModal = false"
      >
        <div
          class="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
          :style="isDark
            ? 'background: rgba(15,25,50,0.97); box-shadow: 0 8px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08);'
            : 'background: rgba(255,255,255,0.97); box-shadow: 0 8px 40px rgba(30,58,138,0.18);'"
        >
          <h3 class="font-heading text-lg font-bold" :style="isDark ? 'color:#93c5fd;' : 'color:#1e3a8a;'">Ajukan Penawaran</h3>

          <div>
            <label class="block text-xs font-semibold mb-1" :class="isDark ? 'text-gray-300' : 'text-gray-600'">Harga Tawar (Rp)</label>
            <input
              v-model="offerPrice"
              type="number"
              min="1"
              placeholder="Masukkan harga"
              class="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition"
              :class="isDark
                ? 'bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:border-blue-400'
                : 'border border-gray-200 text-gray-900 focus:border-blue-400'"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold mb-1" :class="isDark ? 'text-gray-300' : 'text-gray-600'">
              Jumlah <span :class="isDark ? 'text-gray-500' : 'text-gray-400'">(maks. {{ maxQty }})</span>
            </label>
            <div class="flex items-center gap-3">
              <button
                @click="offerQty > 1 && offerQty--"
                class="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition"
                :class="isDark
                  ? 'border border-white/10 text-gray-200 hover:bg-white/10'
                  : 'border border-gray-200 hover:bg-gray-50'"
              >−</button>
              <span class="flex-1 text-center font-semibold" :class="isDark ? 'text-gray-100' : 'text-gray-800'">{{ offerQty }}</span>
              <button
                @click="offerQty < maxQty && offerQty++"
                class="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition"
                :class="isDark
                  ? 'border border-white/10 text-gray-200 hover:bg-white/10'
                  : 'border border-gray-200 hover:bg-gray-50'"
              >+</button>
            </div>
          </div>

          <p v-if="offerError" class="text-xs text-red-400">{{ offerError }}</p>

          <div class="flex gap-3">
            <button
              @click="showOfferModal = false"
              class="flex-1 py-2.5 rounded-xl text-sm transition"
              :class="isDark
                ? 'border border-white/10 text-gray-300 hover:bg-white/10'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'"
            >
              Batal
            </button>
            <button
              @click="submitOffer"
              :disabled="submittingOffer"
              class="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition"
              :style="isDark
                ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
                : 'background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
            >
              {{ submittingOffer ? 'Mengirim...' : 'Kirim Penawaran' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style>
.chat-search-hl {
  background: rgba(250, 204, 21, 0.45);
  border-radius: 2px;
  padding: 0 1px;
}
</style>
