export function useChatMessages(
  chatId: string | string[],
  myId: Ref<string | null>,
  otherParty: Ref<any>,
  supabase: any,
  isDark: Ref<boolean>,
  channel: Ref<any>,
) {
  const messages = ref<any[]>([])
  const replyingTo = ref<any>(null)
  const editingMsgId = ref<string | null>(null)
  const editText = ref('')
  const localHiddenIds = ref<string[]>([])
  const deleteMenuMsgId = ref<string | null>(null)
  const messageText = ref('')
  const sending = ref(false)
  const messagesContainer = ref<HTMLElement | null>(null)

  // ── Load messages ──────────────────────────────────────────────
  async function loadMessages() {
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
      const { data: fallback } = await supabase
        .from('messages')
        .select(`id, content, is_read, created_at, sender_id, is_deleted, edited_at, sender:users!sender_id ( id, name, avatar_url )`)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
      messages.value = fallback ?? []
    } else {
      messages.value = data ?? []
    }

    // Resolve reply references
    const replyIds = messages.value.filter(m => m.reply_to_id).map(m => m.reply_to_id)
    if (replyIds.length) {
      const localMap = new Map(messages.value.map(m => [m.id, m]))
      const missingIds = replyIds.filter(id => !localMap.has(id))
      let remoteMap = new Map()
      if (missingIds.length) {
        const { data: remote } = await supabase
          .from('messages')
          .select('id, content, sender_id, is_deleted, offer_id, sender:users!sender_id(name)')
          .in('id', missingIds)
        if (remote) remoteMap = new Map(remote.map((m: any) => [m.id, m]))
      }
      for (const msg of messages.value) {
        if (!msg.reply_to_id) { msg.reply = null; continue }
        const local = localMap.get(msg.reply_to_id)
        if (local) {
          msg.reply = {
            id: local.id, content: local.content, sender_id: local.sender_id,
            is_deleted: local.is_deleted, offer_id: local.offer_id,
            sender: local.sender ? { name: local.sender.name } : null,
          }
        } else {
          msg.reply = remoteMap.get(msg.reply_to_id) ?? null
        }
      }
    }
  }

  // ── Scroll helpers ─────────────────────────────────────────────
  function scrollToBottom() {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }

  function scrollToMsg(id: string) {
    if (!id || !messagesContainer.value) return
    nextTick(() => {
      const el = messagesContainer.value!.querySelector(`[data-msg-id="${id}"]`)
      if (!el) return
      ;(el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
      const htmlEl = el as HTMLElement
      const orig = htmlEl.style.transition
      htmlEl.style.transition = 'background-color 0.3s'
      htmlEl.style.borderRadius = '12px'
      htmlEl.style.backgroundColor = isDark.value ? 'rgba(14,165,233,0.18)' : 'rgba(30,58,138,0.1)'
      setTimeout(() => { htmlEl.style.backgroundColor = ''; htmlEl.style.transition = orig }, 1400)
    })
  }

  // ── Reply / Edit / Delete ──────────────────────────────────────
  function canModifyMsg(msg: any) {
    if (!msg?.created_at) return false
    return (Date.now() - new Date(msg.created_at).getTime()) < 15 * 60 * 1000
  }

  function startReply(msg: any) {
    replyingTo.value = {
      id: msg.id,
      content: msg.content ?? '',
      sender_id: msg.sender_id,
      sender_name: msg.sender_id === myId.value
        ? 'Kamu'
        : (msg.sender?.name ?? otherParty.value?.name ?? '...'),
    }
    nextTick(() => document.querySelector('textarea')?.focus())
  }

  function cancelReply() { replyingTo.value = null }

  function startEdit(msg: any) {
    editingMsgId.value = msg.id
    editText.value = msg.content ?? ''
  }

  function cancelEdit() {
    editingMsgId.value = null
    editText.value = ''
  }

  async function saveEdit() {
    const text = editText.value.trim()
    if (!text || !editingMsgId.value) return
    const id = editingMsgId.value
    cancelEdit()
    const editedAt = new Date().toISOString()
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], content: text, edited_at: editedAt }
    }
    await supabase.from('messages')
      .update({ content: text, edited_at: editedAt })
      .eq('id', id)
      .eq('sender_id', myId.value)
    channel.value?.send({ type: 'broadcast', event: 'message-edited', payload: { msgId: id, content: text, edited_at: editedAt, sender_id: myId.value } })
  }

  function patchReplyRefs(msgId: string, patch: Record<string, any>) {
    for (let i = 0; i < messages.value.length; i++) {
      if (messages.value[i].reply?.id === msgId) {
        messages.value[i] = {
          ...messages.value[i],
          reply: { ...messages.value[i].reply, ...patch },
        }
      }
    }
  }

  function toggleDeleteMenu(msgId: string) {
    deleteMenuMsgId.value = deleteMenuMsgId.value === msgId ? null : msgId
  }

  async function deleteForAll(msgId: string) {
    deleteMenuMsgId.value = null
    const idx = messages.value.findIndex(m => m.id === msgId)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], is_deleted: true, content: '$$DELETED$$' }
    }
    patchReplyRefs(msgId, { is_deleted: true, content: '$$DELETED$$' })
    const { error } = await supabase.from('messages')
      .update({ is_deleted: true, content: '$$DELETED$$' })
      .eq('id', msgId)
      .eq('sender_id', myId.value)
    if (error) {
      await supabase.from('messages')
        .update({ content: '$$DELETED$$' })
        .eq('id', msgId)
        .eq('sender_id', myId.value)
    }
    channel.value?.send({ type: 'broadcast', event: 'message-deleted', payload: { msgId, sender_id: myId.value } })
  }

  function deleteForMe(msgId: string) {
    deleteMenuMsgId.value = null
    hideForMe(msgId)
  }

  function hideForMe(msgId: string) {
    if (localHiddenIds.value.includes(msgId)) return
    localHiddenIds.value = [...localHiddenIds.value, msgId]
    if (import.meta.client && myId.value) {
      localStorage.setItem(`chat_hidden_${chatId}_${myId.value}`, JSON.stringify(localHiddenIds.value))
    }
  }

  function loadHiddenIds() {
    if (import.meta.client && myId.value) {
      try {
        const stored = localStorage.getItem(`chat_hidden_${chatId}_${myId.value}`)
        if (stored) localHiddenIds.value = JSON.parse(stored)
      } catch {}
    }
  }

  // ── Send Message ───────────────────────────────────────────────
  async function sendMessage(clearUnread: () => void) {
    const text = messageText.value.trim()
    if (!text || sending.value) return
    sending.value = true
    messageText.value = ''
    clearUnread()
    const replyId = replyingTo.value?.id ?? null
    const replyMsg = replyId ? (messages.value.find(m => m.id === replyId) ?? null) : null
    replyingTo.value = null
    try {
      const insertPayload: any = { chat_id: chatId, sender_id: myId.value, content: text }
      if (replyId) insertPayload.reply_to_id = replyId
      const { data: newMsg, error } = await supabase.from('messages').insert(insertPayload)
        .select('id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted').single()
      if (error) throw error
      if (newMsg && !messages.value.some(m => m.id === newMsg.id)) {
        messages.value.push({ ...newMsg, offer: null, sender: null, reply: replyMsg })
        scrollToBottom()
      }
      channel.value?.send({ type: 'broadcast', event: 'new-message', payload: { message: newMsg, reply: replyMsg } })
    } catch (e) {
      messageText.value = text
      console.error(e)
    } finally {
      sending.value = false
    }
  }

  function onInputKeydown(e: KeyboardEvent, clearUnread: () => void) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(clearUnread)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────
  function formatTime(iso: string) {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    if (sameDay) return time
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  function avatarInitial(name?: string) {
    return (name ?? '?')[0]?.toUpperCase() ?? '?'
  }

  return {
    messages,
    replyingTo,
    editingMsgId,
    editText,
    localHiddenIds,
    deleteMenuMsgId,
    messageText,
    sending,
    messagesContainer,
    loadMessages,
    scrollToBottom,
    scrollToMsg,
    canModifyMsg,
    startReply,
    cancelReply,
    startEdit,
    cancelEdit,
    saveEdit,
    patchReplyRefs,
    toggleDeleteMenu,
    deleteForAll,
    deleteForMe,
    hideForMe,
    loadHiddenIds,
    sendMessage,
    onInputKeydown,
    formatTime,
    avatarInitial,
  }
}
