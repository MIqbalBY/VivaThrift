import { useSupabaseClient, useSupabaseUser } from '#imports'

export function useWishlist() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  // Global wishlist set — product IDs the current user has wishlisted
  const wishlistedIds = useState<Set<string>>('wishlist-ids', () => new Set())
  const loading = ref(false)

  const userId = computed(() => user.value?.id ?? user.value?.sub ?? null)

  // Fallback for ISR-cached pages where useSupabaseUser() may be null on hydration
  async function resolveUid(): Promise<string | null> {
    if (userId.value) return userId.value
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  }

  async function fetchWishlist() {
    const uid = await resolveUid()
    if (!uid) {
      wishlistedIds.value = new Set()
      return
    }
    const { data } = await supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', uid)
    if (data) {
      wishlistedIds.value = new Set(data.map((w) => w.product_id))
    }
  }

  function isWishlisted(productId: string) {
    return wishlistedIds.value.has(productId)
  }

  async function toggleWishlist(productId: string) {
    const uid = await resolveUid()
    if (!uid) return false

    loading.value = true
    try {
      if (wishlistedIds.value.has(productId)) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', uid)
          .eq('product_id', productId)
        if (error) {
          console.error('[Wishlist] delete error:', error.message)
          return true
        }
        wishlistedIds.value.delete(productId)
        // trigger reactivity
        wishlistedIds.value = new Set(wishlistedIds.value)
        return false
      } else {
        const { error } = await supabase
          .from('wishlists')
          .insert({ user_id: uid, product_id: productId })
        if (error) {
          console.error('[Wishlist] insert error:', error.message)
          return false
        }
        wishlistedIds.value.add(productId)
        wishlistedIds.value = new Set(wishlistedIds.value)
        return true
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchWishlistProducts() {
    if (!userId.value) return []
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        created_at,
        products (
          id, title, price, slug, status, stock, is_negotiable, condition,
          seller_id,
          product_media (media_url, is_primary),
          users:seller_id (id, name, username, avatar_url, faculty),
          categories (name, slug)
        )
      `)
      .eq('user_id', userId.value)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Wishlist] fetchProducts error:', error.message, error.details, error.hint)
      return []
    }
    return data ?? []
  }

  return {
    wishlistedIds,
    loading,
    fetchWishlist,
    isWishlisted,
    toggleWishlist,
    fetchWishlistProducts,
  }
}
