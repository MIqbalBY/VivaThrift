export function useNavSearch() {
  const supabase = useSupabaseClient() as any

  const searchQuery = useState('navSearchQuery', () => '')
  const showSearchDropdown = ref(false)
  const searchFormRef = ref<HTMLElement | null>(null)
  const suggestions = ref<any[]>([])
  const isSearching = ref(false)

  const RECENT_KEY = 'vt_recent_searches'
  const MAX_RECENT = 5
  const recentSearches = ref<string[]>([])

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const filteredRecent = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return recentSearches.value
    return recentSearches.value.filter(s => s.toLowerCase().includes(q))
  })

  const showDropdown = computed(() =>
    showSearchDropdown.value && (suggestions.value.length > 0 || filteredRecent.value.length > 0 || isSearching.value)
  )

  watch(searchQuery, (val) => {
    clearTimeout(debounceTimer)
    const q = val.trim()
    if (!q) {
      suggestions.value = []
      isSearching.value = false
      return
    }
    isSearching.value = true
    debounceTimer = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, slug, title, price, product_media ( media_url, media_type, thumbnail_url, is_primary )')
        .eq('status', 'active')
        .textSearch('search_vector', q, { type: 'websearch', config: 'indonesian' })
        .limit(6)
      suggestions.value = data ?? []
      isSearching.value = false
    }, 250)
  })

  function saveRecent(q: string) {
    const list = recentSearches.value.filter(s => s !== q)
    list.unshift(q)
    recentSearches.value = list.slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
  }

  function removeRecent(q: string, e: Event) {
    e.stopPropagation()
    recentSearches.value = recentSearches.value.filter(s => s !== q)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
  }

  function clearRecent() {
    recentSearches.value = []
    localStorage.removeItem(RECENT_KEY)
  }

  function selectRecent(q: string) {
    searchQuery.value = q
    saveRecent(q)
    showSearchDropdown.value = false
    suggestions.value = []
    navigateTo(`/?q=${encodeURIComponent(q)}`)
  }

  function selectSuggestion(product: any) {
    saveRecent(product.title)
    showSearchDropdown.value = false
    suggestions.value = []
    navigateTo(`/products/${product.slug ?? product.id}`)
  }

  function getSuggestionImage(product: any) {
    const media = product.product_media
    if (!media || media.length === 0) return null
    const primary = media.find((m: any) => m.is_primary) ?? media[0]
    if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
    return primary.media_url
  }

  function handleSearch() {
    const q = searchQuery.value.trim()
    if (!q) return
    saveRecent(q)
    showSearchDropdown.value = false
    suggestions.value = []
    navigateTo(`/?q=${encodeURIComponent(q)}`)
  }

  function initRecentSearches() {
    recentSearches.value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  }

  return {
    searchQuery,
    showSearchDropdown,
    searchFormRef,
    suggestions,
    isSearching,
    recentSearches,
    filteredRecent,
    showDropdown,
    handleSearch,
    saveRecent,
    removeRecent,
    clearRecent,
    selectRecent,
    selectSuggestion,
    getSuggestionImage,
    initRecentSearches,
  }
}
