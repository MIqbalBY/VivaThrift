let channel: any = null
let heartbeatInterval: any = null
let trackedUserId: string | null = null
let beforeUnloadHandler: (() => void) | null = null
let visibilityHandler: (() => void) | null = null
let authListener: any = null
let lastSeenWriteAt = 0
let lastSeenWriteInFlight = false

const LAST_SEEN_HEARTBEAT_MS = 180000
const LAST_SEEN_MIN_WRITE_GAP_MS = 60000

export function usePresence() {
  const supabase = useSupabaseClient()
  const onlineUsers = useState<Record<string, boolean>>('presenceOnlineUsers', () => ({}))
  const presenceReady = useState<boolean>('presenceReady', () => false)

  async function updateLastSeen(userId: string, force = false) {
    const now = Date.now()
    if (!force && (lastSeenWriteInFlight || now - lastSeenWriteAt < LAST_SEEN_MIN_WRITE_GAP_MS)) return
    lastSeenWriteInFlight = true
    try {
      await (supabase.from('users') as any)
        .update({ last_seen_at: new Date(now).toISOString() })
        .eq('id', userId)
      lastSeenWriteAt = now
    } finally {
      lastSeenWriteInFlight = false
    }
  }

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

    // Throttle heartbeat writes; realtime presence already carries online status.
    heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateLastSeen(userId)
      }
    }, LAST_SEEN_HEARTBEAT_MS)

    // Update last_seen on page visibility change
    if (typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          updateLastSeen(userId, true)
        }
      }
      document.addEventListener('visibilitychange', visibilityHandler)

      // Untrack immediately on tab close so other users see offline instantly
      beforeUnloadHandler = () => {
        updateLastSeen(userId, true)
        if (channel) {
          channel.untrack()
        }
      }
      window.addEventListener('beforeunload', beforeUnloadHandler)
    }

    // Cleanup presence on logout so other users see offline instantly
    const { data } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        updateLastSeen(userId, true)
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
