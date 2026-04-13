export function usePresence() {
  const supabase = useSupabaseClient()
  const onlineUsers = useState<Record<string, boolean>>('presenceOnlineUsers', () => ({}))
  const presenceReady = useState<boolean>('presenceReady', () => false)

  let channel: any = null
  let heartbeatInterval: any = null
  let trackedUserId: string | null = null
  let beforeUnloadHandler: (() => void) | null = null
  let visibilityHandler: (() => void) | null = null
  let authListener: any = null

  function setupGlobalPresence(userId: string) {
    if (!import.meta.client || !userId || channel) return
    trackedUserId = userId

    channel = supabase.channel('presence:global', {
      config: { private: true, presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const map: Record<string, boolean> = {}
        for (const key of Object.keys(state)) {
          if (state[key]?.length) map[key] = true
        }
        onlineUsers.value = map
        presenceReady.value = true
      })
      .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
        onlineUsers.value = { ...onlineUsers.value, [key]: true }
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        const copy = { ...onlineUsers.value }
        delete copy[key]
        onlineUsers.value = copy
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })

    // Update last_seen_at in DB periodically
    heartbeatInterval = setInterval(() => {
      ;(supabase.from('users') as any).update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
    }, 60000)

    // Update last_seen on page visibility change
    if (typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          ;(supabase.from('users') as any).update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
        }
      }
      document.addEventListener('visibilitychange', visibilityHandler)

      // Untrack immediately on tab close so other users see offline instantly
      beforeUnloadHandler = () => {
        ;(supabase.from('users') as any).update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
        if (channel) {
          channel.untrack()
        }
      }
      window.addEventListener('beforeunload', beforeUnloadHandler)
    }

    // Cleanup presence on logout so other users see offline instantly
    const { data } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        ;(supabase.from('users') as any).update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
        cleanup()
      }
    })
    authListener = data?.subscription
  }

  function isOnline(userId: string): boolean {
    return !!onlineUsers.value[userId]
  }

  function cleanup() {
    if (channel) {
      channel.untrack()
      supabase.removeChannel(channel)
      channel = null
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
      beforeUnloadHandler = null
    }
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
    if (authListener) {
      authListener.unsubscribe()
      authListener = null
    }
    // Remove self from online map
    if (trackedUserId) {
      const copy = { ...onlineUsers.value }
      delete copy[trackedUserId]
      onlineUsers.value = copy
      trackedUserId = null
    }
  }

  return { onlineUsers, presenceReady, setupGlobalPresence, isOnline, cleanup }
}
