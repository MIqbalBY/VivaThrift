export function useMyRating() {
  const supabase = useSupabaseClient()

  const myRating      = ref<number | null>(null)
  const myRatingCount = ref(0)

  async function fetchMyRating(uid: string) {
    if (!uid) return
    const { data } = await supabase
      .from('reviews')
      .select('rating_seller')
      .eq('reviewee_id', uid)
    const arr = (data ?? []).map((r: any) => r.rating_seller).filter((v: any) => v != null)
    myRatingCount.value = arr.length
    myRating.value = arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null
  }

  return { myRating, myRatingCount, fetchMyRating }
}
