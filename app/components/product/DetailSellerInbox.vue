<script setup>
const props = defineProps({
  productId:     { type: String,  required: true },
  currentUserId: { type: String,  required: true },
  isDark:        { type: Boolean, default: false },
})

const supabase = useSupabaseClient()

const sellerChats = ref([])
const pending = ref(true)
const unreadTotal = computed(() =>
  sellerChats.value.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
)

async function fetchChats() {
  if (!props.productId) return
  const { data } = await supabase
    .from('chats')
    .select(`
      id, created_at,
      buyer:users!buyer_id ( id, name, avatar_url, gender ),
      messages ( content, created_at, sender_id )
    `)
    .eq('product_id', props.productId)
    .order('created_at', { ascending: false })
  const mapped = (data ?? []).map(c => {
    const msgs = c.messages ?? []
    const sorted = [...msgs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const lastViewed = parseInt(localStorage.getItem(`chat_viewed_${props.currentUserId}_${c.id}`) ?? '0')
    return {
      ...c,
      lastMessage: sorted[0] ?? null,
      unreadCount: msgs.filter(m =>
        new Date(m.created_at).getTime() > lastViewed && m.sender_id !== props.currentUserId
      ).length
    }
  })
  sellerChats.value = mapped
    .filter(c => c.lastMessage !== null)
    .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at))
    .slice(0, 5)
  pending.value = false
}

function formatChatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hhmm
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return `Kemarin ${hhmm}`
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${hhmm}`
}

let channel = null

function setupRealtime() {
  if (channel) return
  channel = supabase
    .channel(`produk-seller-chats-${props.productId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const msg = payload.new
      const chatIdx = sellerChats.value.findIndex(c => c.id === msg.chat_id)
      if (chatIdx === -1) return
      const chat = sellerChats.value[chatIdx]
      const alreadyExists = (chat.messages ?? []).some(m => m.id === msg.id)
      if (!alreadyExists) {
        chat.messages = [...(chat.messages ?? []), msg]
        chat.lastMessage = msg
        if (msg.sender_id !== props.currentUserId) {
          chat.unreadCount = (chat.unreadCount ?? 0) + 1
        }
        sellerChats.value = [chat, ...sellerChats.value.filter((_, i) => i !== chatIdx)]
      }
    })
    .subscribe()
}

onMounted(async () => {
  await fetchChats()
  setupRealtime()
})

onUnmounted(() => {
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
})
</script>

<template>
  <div class="vt-glass rounded-2xl p-4 flex flex-col gap-3"
    :style="isDark
      ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
      : 'background: rgba(255,255,255,0.70); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 20px rgba(30,58,138,0.10);'"
  >
    <p class="text-sm font-semibold flex items-center gap-1.5" :class="isDark ? 'text-gray-200' : 'text-gray-700'">
      📬 Pesan Masuk
      <span v-if="unreadTotal > 0"
        class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
        :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb)'">
        {{ unreadTotal > 99 ? '99+' : unreadTotal }}
      </span>
    </p>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-4">
      <svg class="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
    </div>

    <!-- Empty -->
    <div v-else-if="sellerChats.length === 0" class="flex flex-col items-center gap-2 py-6 text-gray-400">
      <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.836L3 20l1.09-3.27C3.39 15.522 3 13.809 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
      <p class="text-sm font-medium">Belum ada pesan masuk</p>
      <p class="text-xs text-center">Pembeli yang tertarik akan menghubungimu di sini</p>
    </div>

    <!-- Chat list -->
    <div v-else class="flex flex-col gap-2">
      <NuxtLink
        v-for="c in sellerChats"
        :key="c.id"
        :to="`/chat/${c.id}`"
        class="flex items-center gap-3 p-3 rounded-xl transition cursor-pointer overflow-hidden"
        :style="isDark
          ? 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);'
          : 'background: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.5);'"
      >
        <div class="w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden" :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af)'">
          <img v-if="c.buyer?.avatar_url" :src="c.buyer.avatar_url" width="36" height="36" loading="lazy" class="w-full h-full object-cover" />
          <span v-else class="text-white text-xs font-bold">{{ (c.buyer?.name ?? '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase() }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-gray-800'">{{ c.buyer?.name ?? 'Pembeli' }} <span v-if="c.buyer?.gender === 'Laki-laki'" title="Laki-laki" class="text-blue-500">♂️</span><span v-else-if="c.buyer?.gender === 'Perempuan'" title="Perempuan" class="text-pink-500">♀️</span></p>
          <p class="text-xs truncate" :class="isDark ? 'text-gray-400' : 'text-gray-500'">{{ c.lastMessage.content }}</p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0 ml-2">
          <span class="text-xs whitespace-nowrap" :class="isDark ? 'text-gray-500' : 'text-gray-400'">{{ formatChatTime(c.lastMessage.created_at) }}</span>
          <span v-if="c.unreadCount > 0"
            class="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb)'">
            {{ c.unreadCount }}
          </span>
          <svg v-else class="w-4 h-4" :class="isDark ? 'text-gray-500' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
