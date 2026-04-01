export function useChatReadStatus(
  chatId: string | string[],
  myId: Ref<string | null>,
  messages: Ref<any[]>,
  userSettings: Ref<any>,
  channel: Ref<any>,
) {
  const unreadDividerIndex = ref(-1)
  const unreadCountOnOpen = ref(0)
  const navRefreshTrigger = useState('navRefreshTrigger', () => 0)

  function markMessagesAsRead(latestServerTs: string | null = null) {
    if (!import.meta.client || !myId.value) return

    let readUntil = latestServerTs ? new Date(latestServerTs).getTime() : null
    if (!readUntil) {
      const lastMsg = messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
      readUntil = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : Date.now()
    }
    localStorage.setItem(`chat_viewed_${myId.value}_${chatId}`, readUntil.toString())

    const unreadIds = messages.value
      .filter(m => m.sender_id !== myId.value && m.is_read === false)
      .map(m => m.id)
    if (unreadIds.length > 0) {
      for (const m of messages.value) {
        if (unreadIds.includes(m.id)) m.is_read = true
      }
      const supabase = useSupabaseClient() as any
      supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', unreadIds)
        .then(() => {
          if (userSettings.value.read_receipts) {
            channel.value?.send({ type: 'broadcast', event: 'messages-read', payload: { msgIds: unreadIds, readBy: myId.value } })
          }
          navRefreshTrigger.value++
        })
    }
  }

  function snapshotUnreadState() {
    if (!import.meta.client || !myId.value) return
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

  function clearUnreadDivider() {
    unreadDividerIndex.value = -1
    unreadCountOnOpen.value = 0
  }

  return {
    unreadDividerIndex,
    unreadCountOnOpen,
    markMessagesAsRead,
    snapshotUnreadState,
    clearUnreadDivider,
  }
}
