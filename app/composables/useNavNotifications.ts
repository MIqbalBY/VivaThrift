export function useNavNotifications() {
  const supabase = useSupabaseClient() as any

  const notifications = useState<any[]>('navNotifications', () => [])
  const notifUnreadCount = useState('navNotifUnreadCount', () => 0)
  const showNotifPanel = useState('navShowNotifPanel', () => false)
  const notifPanelRef = ref<HTMLElement | null>(null)
  const notifBellRef = ref<HTMLElement | null>(null)
  let notifChannel: any = null

  async function fetchNotifications(uid: string) {
    const { data } = await supabase
      .from('notifications')
      .select(`
        id, type, title, body, is_read, created_at,
        product_id, reference_id,
        products ( slug, product_media ( media_url, media_type, thumbnail_url, is_primary ) ),
        actor:users!notifications_actor_id_fkey ( name, avatar_url )
      `)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(30)
    notifications.value = data ?? []
    notifUnreadCount.value = (data ?? []).filter((n: any) => !n.is_read).length
  }

  function setupNotifChannel(uid: string) {
    if (notifChannel) { supabase.removeChannel(notifChannel); notifChannel = null }
    notifChannel = supabase
      .channel(`notif-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => fetchNotifications(uid)
      )
      .subscribe()
  }

  async function markAllRead(uid?: string) {
    let resolvedUid = uid
    if (!resolvedUid) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      resolvedUid = authUser?.id ?? undefined
    }
    if (!resolvedUid || notifUnreadCount.value === 0) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', resolvedUid).eq('is_read', false)
    notifications.value = notifications.value.map((n: any) => ({ ...n, is_read: true }))
    notifUnreadCount.value = 0
  }

  async function markOneRead(n: any) {
    if (n.is_read) return
    n.is_read = true
    notifUnreadCount.value = Math.max(0, notifUnreadCount.value - 1)
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
  }

  function notifTimeAgo(iso: string) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Baru saja'
    if (mins < 60) return `${mins} menit lalu`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} jam lalu`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days} hari lalu`
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }

  const NOTIF_ICONS: Record<string, string> = {
    new_product:     '🛍️',
    restock:         '📦',
    out_of_stock:    '😔',
    order_paid:      '💰',
    order_shipped:   '🚚',
    shipping_exception: '⚠️',
    shipping_incident_admin: '🛠️',
    order_completed: '✅',
    new_offer:       '🤝',
    offer_accepted:  '🎉',
    offer_rejected:  '😢',
    new_review:      '⭐',
  }

  const ORDER_NOTIF_TYPES = new Set([
    'order_paid', 'order_shipped', 'shipping_exception', 'order_completed',
  ])

  const ADMIN_NOTIF_TYPES = new Set([
    'shipping_incident_admin',
  ])

  const CHAT_NOTIF_TYPES = new Set([
    'new_offer', 'offer_accepted', 'offer_rejected',
  ])

  function getNotifIcon(type: string) {
    return NOTIF_ICONS[type] ?? 'ℹ️'
  }

  function getNotifRoute(notif: any): string {
    if (ADMIN_NOTIF_TYPES.has(notif.type)) return '/admin'

    // Order notifs → /orders page
    if (ORDER_NOTIF_TYPES.has(notif.type)) return '/orders'

    // Offer/chat notifs → /chat/{reference_id}
    if (CHAT_NOTIF_TYPES.has(notif.type) && notif.reference_id) {
      return `/chat/${notif.reference_id}`
    }

    // Product notifs → product page
    if (notif.products?.slug) return `/products/${notif.products.slug}`
    if (notif.product_id) return `/products/${notif.product_id}`

    return '#'
  }

  function getNotifProductImage(notif: any) {
    const media = notif.products?.product_media
    if (!media?.length) return null
    const primary = media.find((m: any) => m.is_primary) ?? media[0]
    if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
    return primary.media_url
  }

  function cleanup() {
    if (notifChannel) { supabase.removeChannel(notifChannel); notifChannel = null }
  }

  return {
    notifications,
    notifUnreadCount,
    showNotifPanel,
    notifPanelRef,
    notifBellRef,
    fetchNotifications,
    setupNotifChannel,
    markAllRead,
    markOneRead,
    notifTimeAgo,
    getNotifIcon,
    getNotifRoute,
    getNotifProductImage,
    cleanup,
  }
}
