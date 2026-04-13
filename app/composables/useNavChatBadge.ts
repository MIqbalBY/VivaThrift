interface NavChatBadgeOptions {
  onNewMessage?: (chatId: string, senderId: string, content: string) => void
}

interface NavChatMessage {
  id: string
  sender_id: string
  is_read: boolean
  content?: string | null
  created_at?: string | null
}

interface NavChatRow {
  id: string
  messages?: NavChatMessage[] | null
}

export function useNavChatBadge(options: NavChatBadgeOptions = {}) {
  const supabase = useSupabaseClient() as any
  const route = useRoute()

  const navUnreadCount = useState('navUnreadCount', () => 0)
  const navChatStatus = useState<'idle' | 'connected' | 'reconnecting'>('navChatStatus', () => 'idle')
  const navRefreshTrigger = useState('navRefreshTrigger', () => 0)
  const navUid = ref<string | null>(null)
  let navChatChannel: any = null
  let navRetryTimer: ReturnType<typeof setTimeout> | null = null
  let navPollTimer: ReturnType<typeof setInterval> | null = null
  let hasUnreadBaseline = false
  let knownUnreadMessageIds = new Set<string>()

  function syncPopupFallback(chats: NavChatRow[], uid: string) {
    const nextUnreadIds = new Set<string>()
    const nextPopupCandidates: Array<{ chatId: string, messageId: string, senderId: string, content: string }> = []

    for (const chat of chats) {
      const incomingUnread = (chat.messages ?? [])
        .filter((message) => message.sender_id !== uid && message.is_read === false)

      for (const message of incomingUnread) {
        nextUnreadIds.add(message.id)
      }

      if (route.path === `/chat/${chat.id}` || incomingUnread.length === 0) continue

      const latestUnread = [...incomingUnread]
        .sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime())[0]

      if (!latestUnread?.id || knownUnreadMessageIds.has(latestUnread.id)) continue

      nextPopupCandidates.push({
        chatId: chat.id,
        messageId: latestUnread.id,
        senderId: latestUnread.sender_id,
        content: latestUnread.content ?? '',
      })
    }

    if (hasUnreadBaseline) {
      for (const candidate of nextPopupCandidates) {
        options.onNewMessage?.(candidate.chatId, candidate.senderId, candidate.content)
      }
    }

    knownUnreadMessageIds = nextUnreadIds
    hasUnreadBaseline = true
  }

  watch(navRefreshTrigger, () => {
    if (navUid.value) fetchNavUnread(navUid.value)
  })

  async function fetchNavUnread(uid: string) {
    const { data, error } = await supabase
      .from('chats')
      .select('id, messages(id, sender_id, is_read, content, created_at)')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
    if (error) { console.error('[NavUnread] Supabase error:', error); return }
    const chats = (data ?? []) as NavChatRow[]
    syncPopupFallback(chats, uid)
    let total = 0
    for (const chat of chats) {
      if (route.path === `/chat/${chat.id}`) continue
      const msgs = chat.messages ?? []
      const dbUnread = msgs.filter((m: any) => m.sender_id !== uid && m.is_read === false).length
      if (dbUnread > 0) {
        total += dbUnread
      } else {
        const sorted = [...msgs].sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        const latestMessage = sorted[0]
        if (latestMessage && latestMessage.sender_id === uid) continue
        const lastViewed = parseInt(localStorage.getItem(`chat_viewed_${uid}_${chat.id}`) ?? '0')
        if (lastViewed > 0) continue
      }
    }
    navUnreadCount.value = total
  }

  function pickRecord(payload: any, mode: 'new' | 'old') {
    if (!payload) return null
    if (mode === 'new') {
      return payload.new ?? payload.record ?? payload.new_record ?? payload.data?.new ?? payload.data?.record ?? null
    }
    return payload.old ?? payload.old_record ?? payload.data?.old ?? payload.data?.old_record ?? null
  }

  function setupNavChannel(uid: string) {
    if (navRetryTimer) { clearTimeout(navRetryTimer); navRetryTimer = null }
    if (navChatChannel) {
      supabase.removeChannel(navChatChannel)
      navChatChannel = null
    }
    navChatStatus.value = 'reconnecting'
    navChatChannel = supabase
      .channel(`user:${uid}:inbox`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, ({ payload }: any) => {
          const msg = pickRecord(payload, 'new')
          if (!msg) return
          if (msg.sender_id !== uid && route.path !== `/chat/${msg.chat_id}`) {
            if (msg.id) knownUnreadMessageIds.add(String(msg.id))
            options.onNewMessage?.(msg.chat_id, msg.sender_id, msg.content)
          }
          fetchNavUnread(uid)
      })
      .on('broadcast', { event: 'UPDATE' }, () => fetchNavUnread(uid))
      .on('broadcast', { event: 'DELETE' }, () => fetchNavUnread(uid))
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          navChatStatus.value = 'connected'
          fetchNavUnread(uid)
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          navChatStatus.value = 'reconnecting'
          navRetryTimer = setTimeout(() => setupNavChannel(uid), 3000)
        } else {
          navChatStatus.value = 'idle'
        }
      })
  }

  function startNavPoll(uid: string) {
    if (navPollTimer) clearInterval(navPollTimer)
    navPollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNavUnread(uid)
    }, 15000)
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && navUid.value) {
      setupNavChannel(navUid.value)
      fetchNavUnread(navUid.value)
    }
  }

  function handleOnline() {
    if (navUid.value) {
      setupNavChannel(navUid.value)
      fetchNavUnread(navUid.value)
    }
  }

  function cleanup() {
    if (navRetryTimer) { clearTimeout(navRetryTimer); navRetryTimer = null }
    if (navPollTimer) { clearInterval(navPollTimer); navPollTimer = null }
    if (navChatChannel) { supabase.removeChannel(navChatChannel); navChatChannel = null }
    navChatStatus.value = 'idle'
    hasUnreadBaseline = false
    knownUnreadMessageIds = new Set<string>()
  }

  return {
    navChatStatus,
    navUnreadCount,
    navRefreshTrigger,
    navUid,
    fetchNavUnread,
    setupNavChannel,
    startNavPoll,
    handleVisibilityChange,
    handleOnline,
    cleanup,
  }
}
