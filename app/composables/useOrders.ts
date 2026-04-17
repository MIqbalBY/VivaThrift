/**
 * useOrders — composable untuk halaman /orders
 * Fetch, filter, dan mutate order data untuk buyer dan seller.
 */

import { mediaUrl } from './useMediaUrl'

export type OrderRole   = 'buyer' | 'seller'
export type OrderTabKey = 'pending_payment' | 'confirmed' | 'awaiting_meetup' | 'shipped' | 'completed' | 'cancelled'

export const ORDER_TABS: { key: OrderTabKey; label: string; icon: string }[] = [
  { key: 'pending_payment',  label: 'Belum Bayar', icon: '⏳' },
  { key: 'confirmed',        label: 'Dikemas',     icon: '📦' },
  { key: 'awaiting_meetup',  label: 'Meetup',      icon: '🤝' },
  { key: 'shipped',          label: 'Dikirim',     icon: '🚚' },
  { key: 'completed',        label: 'Selesai',     icon: '✅' },
  { key: 'cancelled',        label: 'Dibatalkan',  icon: '❌' },
]

export function useOrders() {
  const supabase = useSupabaseClient()
  const user     = useSupabaseUser()

  const orders      = ref<any[]>([])
  const loading     = ref(false)
  const fetchErr    = ref<string | null>(null)
  const reviewedIds = ref<Set<string>>(new Set())

  const role      = ref<OrderRole>('buyer')
  const activeTab = ref<OrderTabKey>('pending_payment')

  // ── Fetch ────────────────────────────────────────────────────────────────────
  async function fetchOrders() {
    // Fallback: useSupabaseUser() can be null on full-page reload from an external
    // redirect (INITIAL_SESSION timing issue with @nuxtjs/supabase v2).
    let uid = user.value?.id
    if (!uid) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      uid = authUser?.id ?? null
    }
    if (!uid) return
    loading.value  = true
    fetchErr.value = null

    const field = role.value === 'buyer' ? 'buyer_id' : 'seller_id'

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, total_amount, platform_fee, payment_gateway_fee,
        tracking_number, courier_name, shipped_at, completed_at,
        shipping_method, shipping_cost, shipping_collection_type, shipping_insurance_fee, shipping_is_insured, shipping_is_fragile,
        meetup_location, meetup_otp, meetup_confirmed_at, courier_code,
        biteship_order_id, biteship_waybill_id, courier_service,
        created_at, updated_at, payment_url, offer_id, disbursement_id,
        order_items (
          id, quantity, price_at_time,
          product:products (
            id, title, slug,
            product_media ( media_url, media_type, is_primary, thumbnail_url )
          )
        ),
        buyer:users!buyer_id   ( id, name, username, avatar_url, phone ),
        seller:users!seller_id ( id, name, username, avatar_url, phone, bank_account_number ),
        offer:offers!offer_id  ( id, chat_id )
      `)
      .eq(field, uid)
      .order('created_at', { ascending: false })

    if (error) {
      fetchErr.value = error.message
    } else {
      orders.value = data ?? []
    }

    // Fetch which order_items the user has already reviewed (buyer role only)
    if (role.value === 'buyer') {
      const { data: reviewed } = await supabase
        .from('reviews')
        .select('order_item_id')
        .eq('reviewer_id', uid)
      reviewedIds.value = new Set((reviewed ?? []).map((r: any) => r.order_item_id))
    } else {
      reviewedIds.value = new Set()
    }

    loading.value = false
  }

  function isReviewed(orderItemId: string) {
    return reviewedIds.value.has(orderItemId)
  }

  function markReviewed(orderItemId: string) {
    reviewedIds.value = new Set([...reviewedIds.value, orderItemId])
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const tabCounts = computed<Record<OrderTabKey, number>>(() => {
    const all = orders.value
    return {
      pending_payment:  all.filter(o => o.status === 'pending_payment').length,
      confirmed:        all.filter(o => o.status === 'confirmed').length,
      awaiting_meetup:  all.filter(o => o.status === 'awaiting_meetup').length,
      shipped:          all.filter(o => o.status === 'shipped').length,
      completed:        all.filter(o => o.status === 'completed').length,
      cancelled:        all.filter(o => ['cancelled', 'payment_failed'].includes(o.status)).length,
    }
  })

  const filteredOrders = computed(() => {
    const tab = activeTab.value
    if (tab === 'cancelled') {
      return orders.value.filter(o => ['cancelled', 'payment_failed'].includes(o.status))
    }
    if (tab === 'awaiting_meetup') {
      return orders.value.filter(o => o.status === 'awaiting_meetup')
    }
    return orders.value.filter(o => o.status === tab)
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function primaryMedia(order: any) {
    const items = order.order_items ?? []
    if (!items.length) return undefined
    const media = items[0]?.product?.product_media ?? []
    if (!media.length) return undefined
    const primary = media.find((m: any) => m.is_primary) ?? media[0]
    if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return mediaUrl(primary.thumbnail_url)
    return mediaUrl(primary.media_url ?? null)
  }

  function productTitle(order: any) {
    return order.order_items?.[0]?.product?.title ?? '—'
  }

  function productSlug(order: any) {
    return order.order_items?.[0]?.product?.slug ?? order.order_items?.[0]?.product?.id ?? null
  }

  function chatId(order: any) {
    return order.offer?.chat_id ?? null
  }

  function formatRp(amount: number) {
    return new Intl.NumberFormat('id-ID', {
      style:    'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  function sellerReceives(
    totalAmount: number,
    shippingCost: number = 0,
    platformFee: number = 0,
    paymentGatewayFee: number = 0,
  ) {
    // Net seller = total - shipping - platform fee - payment gateway fee.
    // If checkout amount already includes gateway fee from buyer, this equals subtotal.
    return totalAmount - shippingCost - platformFee - paymentGatewayFee
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const actionLoading = ref<Record<string, boolean>>({})
  const actionErr     = ref<Record<string, string>>({})
  const actionSuccess = ref<Record<string, boolean>>({})

  async function shipOrder(orderId: string, trackingNumber: string, courierName: string) {
    actionLoading.value[orderId] = true
    actionErr.value[orderId]     = ''
    actionSuccess.value[orderId] = false
    try {
      await $fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: { action: 'ship', tracking_number: trackingNumber, courier_name: courierName },
      })
      actionSuccess.value[orderId] = true
      await fetchOrders()
    } catch (e: any) {
      actionErr.value[orderId] = e?.data?.statusMessage ?? e?.message ?? 'Gagal mengupdate pesanan.'
    } finally {
      actionLoading.value[orderId] = false
    }
  }

  async function shipViaBiteship(orderId: string) {
    actionLoading.value[orderId] = true
    actionErr.value[orderId]     = ''
    actionSuccess.value[orderId] = false
    try {
      await $fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: { action: 'ship', use_biteship: true },
      })
      actionSuccess.value[orderId] = true
      await fetchOrders()
    } catch (e: any) {
      actionErr.value[orderId] = e?.data?.statusMessage ?? e?.message ?? 'Gagal membuat pesanan Biteship.'
    } finally {
      actionLoading.value[orderId] = false
    }
  }

  async function completeOrder(orderId: string) {
    actionLoading.value[orderId] = true
    actionErr.value[orderId]     = ''
    actionSuccess.value[orderId] = false
    try {
      await $fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: { action: 'complete' },
      })
      actionSuccess.value[orderId] = true
      await fetchOrders()
    } catch (e: any) {
      actionErr.value[orderId] = e?.data?.statusMessage ?? e?.message ?? 'Gagal mengkonfirmasi pesanan.'
    } finally {
      actionLoading.value[orderId] = false
    }
  }

  async function startMeetup(orderId: string) {
    actionLoading.value[orderId] = true
    actionErr.value[orderId]     = ''
    actionSuccess.value[orderId] = false
    try {
      await $fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: { action: 'start_meetup' },
      })
      actionSuccess.value[orderId] = true
      await fetchOrders()
    } catch (e: any) {
      actionErr.value[orderId] = e?.data?.statusMessage ?? e?.message ?? 'Gagal memulai meetup.'
    } finally {
      actionLoading.value[orderId] = false
    }
  }

  async function confirmMeetup(orderId: string, otp: string) {
    actionLoading.value[orderId] = true
    actionErr.value[orderId]     = ''
    actionSuccess.value[orderId] = false
    try {
      await $fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: { action: 'confirm_meetup', otp },
      })
      actionSuccess.value[orderId] = true
      await fetchOrders()
    } catch (e: any) {
      actionErr.value[orderId] = e?.data?.statusMessage ?? e?.message ?? 'Gagal konfirmasi meetup.'
    } finally {
      actionLoading.value[orderId] = false
    }
  }

  // Refetch when role changes
  watch(role, () => {
    activeTab.value = 'pending_payment'
    fetchOrders()
  })

  return {
    orders, loading, fetchErr,
    role, activeTab,
    tabCounts, filteredOrders,
    primaryMedia, productTitle, productSlug, chatId, formatRp, sellerReceives,
    actionLoading, actionErr, actionSuccess,
    fetchOrders, shipOrder, shipViaBiteship, completeOrder, startMeetup, confirmMeetup,
    isReviewed, markReviewed, reviewedIds,
    ORDER_TABS,
  }
}