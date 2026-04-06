/**
 * useRecentlyViewed — track & display recently viewed products via localStorage.
 * Stores up to MAX_ITEMS product IDs. Fetches full product data on demand.
 */

const STORAGE_KEY = 'vt_recently_viewed'
const MAX_ITEMS   = 8

export function useRecentlyViewed() {
  const supabase = useSupabaseClient()

  const recentIds  = useState<string[]>('recently-viewed-ids', () => [])
  const recentProducts = ref<any[]>([])
  const loading = ref(false)

  function loadFromStorage() {
    if (import.meta.server) return
    try {
      recentIds.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      recentIds.value = []
    }
  }

  function saveToStorage() {
    if (import.meta.server) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds.value))
  }

  /** Call this when a product detail page is viewed. */
  function trackView(productId: string) {
    if (!productId) return
    const filtered = recentIds.value.filter(id => id !== productId)
    filtered.unshift(productId)
    recentIds.value = filtered.slice(0, MAX_ITEMS)
    saveToStorage()
  }

  /** Fetch full product data for the recently viewed IDs. */
  async function fetchRecentProducts() {
    loadFromStorage()
    if (!recentIds.value.length) { recentProducts.value = []; return }

    loading.value = true
    const { data } = await supabase
      .from('products')
      .select(`id, slug, title, price, condition, is_negotiable, is_cod, seller_id, status, stock, created_at, updated_at,
        product_media ( media_url, media_type, thumbnail_url, is_primary ),
        users!products_seller_id_fkey ( id, name, nrp, faculty, department, avatar_url, gender ),
        categories ( name )`)
      .in('id', recentIds.value)
      .eq('status', 'active')

    // Preserve the order from recentIds (most recent first)
    const map = new Map((data ?? []).map(p => [p.id, p]))
    recentProducts.value = recentIds.value
      .map(id => map.get(id))
      .filter(Boolean)

    loading.value = false
  }

  return {
    recentIds,
    recentProducts,
    loading,
    trackView,
    fetchRecentProducts,
    loadFromStorage,
  }
}
