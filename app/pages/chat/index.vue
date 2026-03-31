<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { isDark } = useDarkMode()

// Resolve user ID reliably (useSupabaseUser() can be null on initial SSR)
const { data: { session } } = await supabase.auth.getSession()
const userId = session?.user?.id ?? user.value?.id ?? null

const { data: chats, pending, refresh } = await useAsyncData('chats-list', async () => {
  if (!userId) return []
  const { data } = await supabase
    .from('chats')
    .select(`
      id, created_at,
      product:products ( id, title, slug, status, product_media ( media_url, media_type, thumbnail_url, is_primary ) ),
      buyer:users!buyer_id ( id, name, avatar_url ),
      seller:users!seller_id ( id, name, avatar_url ),
      messages ( id, content, created_at, sender_id, is_read )
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  // Filter out orphaned rows (null buyer/seller) and chats for deleted products
  const valid = (data ?? []).filter(chat => chat.buyer?.id && chat.seller?.id && chat.product && chat.product.status !== 'deleted')

  // Enrich each chat with lastMessage only (unreadCount computed client-side via localStorage)
  const processed = valid.map(chat => {
    const msgs = [...(chat.messages ?? [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return {
      ...chat,
      lastMessage: msgs[0] ?? null,
    }
  })

  // Sort by most recent activity before dedup
  processed.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.created_at) : new Date(a.created_at)
    const tb = b.lastMessage ? new Date(b.lastMessage.created_at) : new Date(b.created_at)
    return tb - ta
  })

  // Deduplicate: keep first (most recent) per (product_id, buyer_id) pair
  const seen = new Set()
  const deduped = []
  for (const chat of processed) {
    const key = `${chat.product?.id}-${chat.buyer?.id}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(chat)
    }
  }
  return deduped
})

function getOtherParty(chat) {
  return userId === chat.buyer?.id ? chat.seller : chat.buyer
}

function getProductCover(chat) {
  const media = chat.product?.product_media
  if (!media?.length) return null
  const primary = media.find(m => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
}

function isBuyer(chat) {
  return userId === chat.buyer?.id
}

// Compute unread counts from DB is_read field (with localStorage fallback)
const clientUnread = computed(() => {
  if (!chats.value) return {}
  const map = {}
  for (const chat of chats.value) {
    const msgs = chat.messages ?? []
    // Count messages from others that are still unread (is_read = false)
    map[chat.id] = msgs.filter(m => m.sender_id !== userId && m.is_read === false).length
  }
  return map
})

let listChannel = null
let listRetryTimer = null

function setupListChannel() {
  if (listRetryTimer) { clearTimeout(listRetryTimer); listRetryTimer = null }
  if (listChannel) { supabase.removeChannel(listChannel); listChannel = null }
  listChannel = supabase
    .channel('chat-list-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const msg = payload.new
        if (!chats.value) return
        const chatIdx = chats.value.findIndex(c => c.id === msg.chat_id)
        if (chatIdx === -1) return

        // Update the message list and lastMessage in-place (no full re-fetch)
        const chat = chats.value[chatIdx]
        const alreadyExists = (chat.messages ?? []).some(m => m.id === msg.id)
        if (!alreadyExists) {
          chat.messages = [...(chat.messages ?? []), msg]
          chat.lastMessage = msg
          // Re-sort so this chat bubbles to the top
          chats.value = [
            chat,
            ...chats.value.filter((_, i) => i !== chatIdx),
          ]
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload) => {
        // Update is_read on local message copy (e.g. when other device marks as read)
        if (!chats.value) return
        for (const chat of chats.value) {
          const msg = (chat.messages ?? []).find(m => m.id === payload.new.id)
          if (msg) { msg.is_read = payload.new.is_read; break }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        listRetryTimer = setTimeout(setupListChannel, 3000)
      }
    })
}

function onListVisibilityChange() {
  if (document.visibilityState === 'visible') { refresh(); setupListChannel() }
}
function onListOnline() { refresh(); setupListChannel() }

onMounted(async () => {
  await refresh()
  setupListChannel()
  document.addEventListener('visibilitychange', onListVisibilityChange)
  window.addEventListener('online', onListOnline)
})

onUnmounted(() => {
  if (listRetryTimer) clearTimeout(listRetryTimer)
  if (listChannel) supabase.removeChannel(listChannel)
  document.removeEventListener('visibilitychange', onListVisibilityChange)
  window.removeEventListener('online', onListOnline)
})

function formatTime(iso) {
  if (!iso) return ''
  const d   = new Date(iso)
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  if (d.toDateString() === now.toDateString()) return hhmm
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function avatarInitials(name) {
  return (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-4 py-8">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/" class="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition text-gray-500 dark:text-gray-300 shrink-0">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
      </NuxtLink>
      <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#ffffff' : 'color:#1e3a8a'">💬 Chat</h1>
    </div>

    <div v-if="pending" class="flex justify-center py-20">
      <svg class="w-7 h-7 text-blue-800 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    </div>

    <div v-else-if="!chats?.length" class="text-center text-gray-400 py-20">
      <p class="text-5xl mb-4">💬</p>
      <p class="text-base font-medium">Belum ada percakapan.</p>
      <NuxtLink to="/" class="text-blue-700 text-sm underline mt-2 inline-block">Temukan barang yang ingin dibeli</NuxtLink>
    </div>

    <div v-else class="flex flex-col gap-2">
      <NuxtLink
        v-for="chat in chats"
        :key="chat.id"
        :to="`/chat/${chat.id}`"
        class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-shadow cursor-pointer"
        :class="(clientUnread[chat.id] ?? 0) > 0
          ? (isDark ? 'hover:bg-white/5' : 'hover:bg-blue-50/60')
          : (isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50')"
        :style="isDark
          ? 'background: rgba(15,25,50,0.70); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 12px rgba(0,0,0,0.3);'
          : 'background: rgba(255,255,255,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 2px 12px rgba(30,58,138,0.07);'"
      >
        <!-- Other party avatar -->
        <div class="w-11 h-11 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-white"
          :style="isDark
            ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
            : 'background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
        >
          <img v-if="getOtherParty(chat)?.avatar_url" :src="getOtherParty(chat).avatar_url" class="w-full h-full object-cover" />
          <span v-else>{{ avatarInitials(getOtherParty(chat)?.name) }}</span>
        </div>

        <!-- Middle: name + last message -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold truncate flex-1"
              :class="[isDark ? 'text-white' : 'text-gray-800', (clientUnread[chat.id] ?? 0) > 0 ? 'font-bold' : '']">
              {{ getOtherParty(chat)?.name ?? '-' }}
            </p>
            <span class="text-xs shrink-0" :class="isDark ? 'text-gray-500' : 'text-gray-400'">
              {{ formatTime(chat.lastMessage?.created_at ?? chat.created_at) }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-2 mt-0.5">
            <p class="text-xs truncate flex-1"
              :class="[
                (clientUnread[chat.id] ?? 0) > 0
                  ? (isDark ? 'text-gray-200 font-medium' : 'text-gray-700 font-medium')
                  : (isDark ? 'text-gray-500' : 'text-gray-400'),
                !chat.lastMessage ? 'italic' : ''
              ]">
              <template v-if="chat.lastMessage">
                <span v-if="chat.lastMessage.sender_id === userId" :class="isDark ? 'text-gray-500' : 'text-gray-400'">Kamu: </span>{{ chat.lastMessage.content }}
              </template>
              <template v-else>Belum ada pesan</template>
            </p>
            <!-- Unread badge -->
            <span v-if="(clientUnread[chat.id] ?? 0) > 0"
              class="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white flex items-center justify-center"
              :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb)'">
              {{ clientUnread[chat.id] > 99 ? '99+' : clientUnread[chat.id] }}
            </span>
            <!-- Role badge (only if no unread) -->
            <span v-else
              class="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
              :class="isBuyer(chat)
                ? (isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-50 text-blue-600')
                : (isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-50 text-green-600')"
            >
              {{ isBuyer(chat) ? 'Pembeli' : 'Penjual' }}
            </span>
          </div>
          <!-- Product title hint -->
          <p class="text-[10px] truncate mt-0.5" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
            {{ chat.product?.title }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
