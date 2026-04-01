export function useChatPresence(otherParty: Ref<any>, supabase: any) {
  const { isOnline } = usePresence()

  const otherLastSeen = ref<string | null>(null)

  // High-water mark: only ever moves forward in time, never backward.
  function setLastSeenIfNewer(ts: string | null) {
    if (!ts) return
    if (!otherLastSeen.value || new Date(ts) > new Date(otherLastSeen.value)) {
      otherLastSeen.value = ts
    }
  }

  const otherOnline = computed(() => {
    const otherId = otherParty.value?.id
    return otherId ? isOnline(otherId) : false
  })

  function formatLastSeen(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'terakhir dilihat baru saja'
    if (diffMin < 60) return `terakhir dilihat ${diffMin} menit yang lalu`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `terakhir dilihat ${diffHour} jam yang lalu`
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return `terakhir dilihat kemarin ${hhmm}`
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
  watch(otherOnline, (online: boolean, wasOnline: boolean) => {
    if (online || wasOnline) {
      setLastSeenIfNewer(new Date().toISOString())
    }
  })

  return {
    otherLastSeen,
    otherOnline,
    otherStatusText,
    setLastSeenIfNewer,
    fetchOtherLastSeen,
  }
}
