export function useNavCategories() {
  const supabase = useSupabaseClient() as any

  const showCategory = useState('navShowCategory', () => false)
  const categoryButtonRef = ref<HTMLElement | null>(null)

  const { data: dbCategories } = useAsyncData('navbar-categories', async () => {
    const { data } = await supabase.from('categories').select('name').order('name')
    const names = data?.map((c: any) => c.name) ?? []
    const sorted = names.filter((n: string) => n !== 'Lainnya')
    if (names.includes('Lainnya')) sorted.push('Lainnya')
    return sorted
  }, { lazy: true })

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
