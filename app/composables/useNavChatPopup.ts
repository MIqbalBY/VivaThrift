export function useNavChatPopup() {
  const supabase = useSupabaseClient() as any
  const { settings: userSettings } = useUserSettings()
  const { mediaUrl } = useMediaUrl()

  const chatNotifications = ref<any[]>([])
  let notifIdCounter = 0
  const notifTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  function getNotifInitial(name: string) {
    return (name ?? '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  }

  function dismissChatNotification(id: number) {
    const idx = chatNotifications.value.findIndex(n => n.id === id)
    if (idx >= 0) {
      const { chatId } = chatNotifications.value[idx]
      if (notifTimers[chatId]) { clearTimeout(notifTimers[chatId]); delete notifTimers[chatId] }
      chatNotifications.value.splice(idx, 1)
    }
  }

  function showChatNotification(chatId: string, senderId: string, content: string) {
    if (!userSettings.value.chat_popup) return

    const existing = chatNotifications.value.find(n => n.chatId === chatId)
    if (existing) {
      existing.message = content
      existing.senderName = '...'
      existing.senderAvatar = null
      if (notifTimers[chatId]) clearTimeout(notifTimers[chatId])
      notifTimers[chatId] = setTimeout(() => { dismissChatNotification(existing.id); delete notifTimers[chatId] }, 5000)
      supabase.from('users').select('name, avatar_url').eq('id', senderId).single().then(({ data: s }: any) => {
        const n = chatNotifications.value.find((n: any) => n.chatId === chatId)
        if (n) { n.senderName = s?.name ?? 'Pengguna'; n.senderAvatar = mediaUrl(s?.avatar_url ?? null) ?? null }
      })
      return
    }

    const id = ++notifIdCounter
    chatNotifications.value.push({ id, chatId, senderName: '...', senderAvatar: null, message: content, type: 'text' })
    notifTimers[chatId] = setTimeout(() => { dismissChatNotification(id); delete notifTimers[chatId] }, 5000)
    supabase.from('users').select('name, avatar_url').eq('id', senderId).single().then(({ data: s }: any) => {
      const n = chatNotifications.value.find((n: any) => n.id === id)
      if (n) { n.senderName = s?.name ?? 'Pengguna'; n.senderAvatar = mediaUrl(s?.avatar_url ?? null) ?? null }
    })
  }

  return {
    chatNotifications,
    showChatNotification,
    dismissChatNotification,
    getNotifInitial,
  }
}
