import { useSupabaseClient, useSupabaseUser } from '#imports'

export type CartItem = {
  id: string
  cart_id: string
  product_id: string
  quantity: number
  added_at: string | null
  product: {
    id: string
    title: string
    price: number
    slug: string | null
    status: string | null
    stock: number | null
    is_negotiable: boolean | null
    is_cod: boolean | null
    seller_id: string | null
    product_media: { media_url: string; is_primary: boolean | null }[]
    users: { id: string; name: string; username: string | null; avatar_url: string | null } | null
  }
}

export function useCart() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const userId = computed(() => (user.value as any)?.id ?? null)

  const cartItems = useState<CartItem[]>('cart-items', () => [])
  const cartOpen = useState<boolean>('cart-open', () => false)
  const cartLoading = ref(false)

  const cartCount = computed(() => cartItems.value.reduce((sum, i) => sum + i.quantity, 0))
  const cartTotal = computed(() => cartItems.value.reduce((sum, i) => sum + (i.product?.price ?? 0) * i.quantity, 0))

  // Ensure the user has a cart row, return cart id
  async function ensureCart(): Promise<string | null> {
    if (!userId.value) return null
    const { data: existing } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId.value)
      .maybeSingle()
    if (existing) return existing.id

    const { data: created } = await supabase
      .from('carts')
      .insert({ user_id: userId.value })
      .select('id')
      .single()
    return created?.id ?? null
  }

  async function fetchCart() {
    if (!userId.value) {
      cartItems.value = []
      return
    }
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId.value)
      .maybeSingle()
    if (!cart) {
      cartItems.value = []
      return
    }
    const { data } = await supabase
      .from('cart_items')
      .select(`
        id, cart_id, product_id, quantity, added_at,
        product:products (
          id, title, price, slug, status, stock, is_negotiable, is_cod, seller_id,
          product_media (media_url, is_primary),
          users:seller_id (id, name, username, avatar_url)
        )
      `)
      .eq('cart_id', cart.id)
      .order('added_at', { ascending: false })
    cartItems.value = (data as unknown as CartItem[]) ?? []
  }

  async function addToCart(productId: string, quantity = 1): Promise<{ success: boolean; message: string }> {
    if (!userId.value) return { success: false, message: 'login' }

    cartLoading.value = true
    try {
      const cartId = await ensureCart()
      if (!cartId) return { success: false, message: 'Gagal membuat keranjang.' }

      // Check product stock
      const { data: product } = await supabase
        .from('products')
        .select('id, stock, status, title')
        .eq('id', productId)
        .single()

      if (!product || product.status === 'sold' || product.status === 'deleted') {
        return { success: false, message: 'Produk tidak tersedia.' }
      }
      if (product.stock !== null && product.stock <= 0) {
        return { success: false, message: 'Stok produk habis.' }
      }

      // Upsert: if already in cart, increment quantity
      const existing = cartItems.value.find(i => i.product_id === productId)
      if (existing) {
        const newQty = existing.quantity + quantity
        if (product.stock !== null && newQty > product.stock) {
          return { success: false, message: `Stok hanya tersisa ${product.stock} unit.` }
        }
        await supabase
          .from('cart_items')
          .update({ quantity: newQty })
          .eq('id', existing.id)
        existing.quantity = newQty
        cartItems.value = [...cartItems.value]
      } else {
        const { data: newItem } = await supabase
          .from('cart_items')
          .insert({ cart_id: cartId, product_id: productId, quantity })
          .select(`
            id, cart_id, product_id, quantity, added_at,
            product:products (
              id, title, price, slug, status, stock, is_negotiable, is_cod, seller_id,
              product_media (media_url, is_primary),
              users:seller_id (id, name, username, avatar_url)
            )
          `)
          .single()
        if (newItem) cartItems.value = [newItem as unknown as CartItem, ...cartItems.value]
      }

      return { success: true, message: `"${product.title}" ditambahkan ke keranjang.` }
    } finally {
      cartLoading.value = false
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) return removeFromCart(itemId)
    await supabase.from('cart_items').update({ quantity }).eq('id', itemId)
    const item = cartItems.value.find(i => i.id === itemId)
    if (item) {
      item.quantity = quantity
      cartItems.value = [...cartItems.value]
    }
  }

  async function removeFromCart(itemId: string) {
    await supabase.from('cart_items').delete().eq('id', itemId)
    cartItems.value = cartItems.value.filter(i => i.id !== itemId)
  }

  async function clearCart() {
    if (!userId.value) return
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId.value)
      .maybeSingle()
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id)
    }
    cartItems.value = []
  }

  // Validate stock before checkout — removes unavailable items and returns warning
  async function validateCartStock(): Promise<{ valid: boolean; removed: string[] }> {
    const removed: string[] = []
    const productIds = cartItems.value.map(i => i.product_id)
    if (productIds.length === 0) return { valid: true, removed }

    const { data: products } = await supabase
      .from('products')
      .select('id, title, stock, status')
      .in('id', productIds)

    for (const item of [...cartItems.value]) {
      const p = products?.find(pr => pr.id === item.product_id)
      if (!p || p.status === 'sold' || p.status === 'deleted' || (p.stock !== null && p.stock <= 0)) {
        removed.push(item.product?.title ?? item.product_id)
        await removeFromCart(item.id)
      } else if (p.stock !== null && item.quantity > p.stock) {
        await updateQuantity(item.id, p.stock)
      }
    }

    return { valid: removed.length === 0, removed }
  }

  return {
    cartItems,
    cartOpen,
    cartLoading,
    cartCount,
    cartTotal,
    fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    validateCartStock,
  }
}
