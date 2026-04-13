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
}

interface NavUnreadMessage {
  id: string
  chat_id: string
  sender_id: string
  content?: string | null
  created_at?: string | null
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
  let navFetchTimer: ReturnType<typeof setTimeout> | null = null
  let hasUnreadBaseline = false
  let knownUnreadMessageIds = new Set<string>()

  function syncPopupFallback(unreadMessages: NavUnreadMessage[], uid: string) {
    const nextUnreadIds = new Set<string>()
    const nextPopupCandidates: Array<{ chatId: string, messageId: string, senderId: string, content: string }> = []
    const unreadByChat = new Map<string, NavUnreadMessage[]>()

    for (const message of unreadMessages) {
      nextUnreadIds.add(message.id)
      if (message.sender_id === uid) continue
      const bucket = unreadByChat.get(message.chat_id)
      if (bucket) bucket.push(message)
      else unreadByChat.set(message.chat_id, [message])
    }

    for (const [chatId, incomingUnread] of unreadByChat.entries()) {
      if (route.path === `/chat/${chatId}` || incomingUnread.length === 0) continue

      const latestUnread = [...incomingUnread]
        .sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime())[0]

      if (!latestUnread?.id || knownUnreadMessageIds.has(latestUnread.id)) continue

      nextPopupCandidates.push({
        chatId,
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

  async function runFetchNavUnread(uid: string) {
    const { data: chatRows, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
    if (chatError) { console.error('[NavUnread] Supabase error:', chatError); return }

    const chatIds = ((chatRows ?? []) as NavChatRow[]).map((chat) => chat.id)
    if (!chatIds.length) {
      syncPopupFallback([], uid)
      navUnreadCount.value = 0
      return
    }

    const { data: unreadRows, error: unreadError } = await supabase
      .from('messages')
      .select('id, chat_id, sender_id, content, created_at')
      .in('chat_id', chatIds)
      .neq('sender_id', uid)
      .eq('is_read', false)
    if (unreadError) { console.error('[NavUnread] Supabase error:', unreadError); return }

    const unreadMessages = (unreadRows ?? []) as NavUnreadMessage[]
    syncPopupFallback(unreadMessages, uid)

    let total = 0
    for (const message of unreadMessages) {
      if (route.path === `/chat/${message.chat_id}`) continue
      total += 1
    }
    navUnreadCount.value = total
  }

  function fetchNavUnread(uid: string, immediate = false) {
    if (navFetchTimer) {
      clearTimeout(navFetchTimer)
      navFetchTimer = null
    }
    if (immediate) {
      runFetchNavUnread(uid)
      return
    }
    navFetchTimer = setTimeout(() => {
      runFetchNavUnread(uid)
    }, 350)
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
          fetchNavUnread(uid, true)
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
    }, 60000)
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && navUid.value) {
      setupNavChannel(navUid.value)
      fetchNavUnread(navUid.value, true)
    }
  }

  function handleOnline() {
    if (navUid.value) {
      setupNavChannel(navUid.value)
      fetchNavUnread(navUid.value, true)
    }
  }

  function cleanup() {
    if (navRetryTimer) { clearTimeout(navRetryTimer); navRetryTimer = null }
    if (navPollTimer) { clearInterval(navPollTimer); navPollTimer = null }
    if (navFetchTimer) { clearTimeout(navFetchTimer); navFetchTimer = null }
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
