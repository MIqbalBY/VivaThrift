interface NavChatBadgeOptions {
  onNewMessage?: (chatId: string, senderId: string, content: string) => void
}

export function useNavChatBadge(options: NavChatBadgeOptions = {}) {
  const supabase = useSupabaseClient() as any
  const route = useRoute()

  const navUnreadCount = useState('navUnreadCount', () => 0)
  const navRefreshTrigger = useState('navRefreshTrigger', () => 0)
  const navUid = ref<string | null>(null)
  let navChatChannel: any = null
  let navRetryTimer: ReturnType<typeof setTimeout> | null = null
  let navPollTimer: ReturnType<typeof setInterval> | null = null

  watch(navRefreshTrigger, () => {
    if (navUid.value) fetchNavUnread(navUid.value)
  })

  async function fetchNavUnread(uid: string) {
    const { data, error } = await supabase
      .from('chats')
      .select('id, messages(id, sender_id, is_read)')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
    if (error) { console.error('[NavUnread] Supabase error:', error); return }
    let total = 0
    for (const chat of data ?? []) {
      if (route.path === `/chat/${chat.id}`) continue
      const msgs = chat.messages ?? []
      const dbUnread = msgs.filter((m: any) => m.sender_id !== uid && m.is_read === false).length
      if (dbUnread > 0) {
        total += dbUnread
      } else {
        const sorted = [...msgs].sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        if (sorted.length > 0 && sorted[0].sender_id === uid) continue
        const lastViewed = parseInt(localStorage.getItem(`chat_viewed_${uid}_${chat.id}`) ?? '0')
        if (lastViewed > 0) continue
      }
    }
    navUnreadCount.value = total
  }

  function setupNavChannel(uid: string) {
    if (navRetryTimer) { clearTimeout(navRetryTimer); navRetryTimer = null }
    if (navChatChannel) {
      supabase.removeChannel(navChatChannel)
      navChatChannel = null
    }
    navChatChannel = supabase
      .channel(`nav-chat-unread-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const msg = payload.new
          if (msg.sender_id !== uid && route.path !== `/chat/${msg.chat_id}`) {
            options.onNewMessage?.(msg.chat_id, msg.sender_id, msg.content)
          }
          fetchNavUnread(uid)
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload.new?.is_read === true) fetchNavUnread(uid)
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          fetchNavUnread(uid)
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          navRetryTimer = setTimeout(() => setupNavChannel(uid), 3000)
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
  }

  return {
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
