export function useNavCategories() {
  const supabase = useSupabaseClient() as any

  const showCategory = useState('navShowCategory', () => false)
  const categoryButtonRef = ref<HTMLElement | null>(null)
  const cachedCategories = useState<string[]>('navCategoriesCache', () => [])
  const hasFetchedCategories = useState<boolean>('navCategoriesLoaded', () => false)

  const { data: dbCategories } = useAsyncData('navbar-categories', async () => {
    if (hasFetchedCategories.value && cachedCategories.value.length) {
      return cachedCategories.value
    }

    const { data } = await supabase.from('categories').select('name').order('name')
    const names = data?.map((c: any) => c.name).filter(Boolean) ?? []
    const sorted = names.filter((n: string) => n !== 'Lainnya')
    if (names.includes('Lainnya')) sorted.push('Lainnya')

    cachedCategories.value = sorted
    hasFetchedCategories.value = true

    return sorted
  }, {
    lazy: true,
    default: () => cachedCategories.value,
    dedupe: 'defer',
  })

  function handleCategory(cat: string) {
    showCategory.value = false
    if (cat === 'Semua Kategori') navigateTo('/')
    else navigateTo(`/?category=${encodeURIComponent(cat)}`)
  }

  return {
    dbCategories,
    showCategory,
    categoryButtonRef,
    categoryLabel,
    handleCategory,
  }
}
