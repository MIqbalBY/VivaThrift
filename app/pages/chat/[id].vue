<script setup>
import { useChatPresence } from '~/composables/chat/useChatPresence'
import { useChatSearch } from '~/composables/chat/useChatSearch'
import { useChatReadStatus } from '~/composables/chat/useChatReadStatus'
import { useChatMessages } from '~/composables/chat/useChatMessages'
import { useChatOffer } from '~/composables/chat/useChatOffer'
import { useChatRealtime } from '~/composables/chat/useChatRealtime'

definePageMeta({ middleware: 'auth', layout: 'chat' })

const route = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()
const { settings: userSettings } = useUserSettings()

const chatId = route.params.id

// ── Chat Metadata ────────────────────────────────────────────────
const { data: chat } = await useAsyncData(`chat-${chatId}`, async () => {
  const { data } = await supabase
    .from('chats')
    .select(`
      id,
      product:products (
        id, title, slug, price, is_negotiable, stock, status,
        product_media ( media_url, media_type, thumbnail_url, is_primary )
      ),
      buyer:users!buyer_id   ( id, name, avatar_url ),
      seller:users!seller_id ( id, name, avatar_url )
    `)
    .eq('id', chatId)
    .single()
  return data
})

useSeoMeta({ title: () => {
  const productTitle = chat.value?.product?.title
  if (productTitle) return `Chat ${productTitle} — VivaThrift`
  return 'Chat — VivaThrift'
} })

const { data: { session } } = await supabase.auth.getSession()
const currentUserId = ref(session?.user?.id ?? currentUser.value?.id ?? null)
const myId = computed(() => currentUserId.value ?? currentUser.value?.id ?? null)

if (!chat.value || !myId.value) {
  await navigateTo('/chat')
}

const isSeller = computed(() => myId.value === chat.value?.seller?.id)
const isBuyer  = computed(() => !!myId.value && !isSeller.value)
const otherParty = computed(() => isBuyer.value ? chat.value?.seller : chat.value?.buyer)

const productCover = computed(() => {
  const media = chat.value?.product?.product_media
  if (!media?.length) return null
  const primary = media.find(m => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return mediaUrl(primary.thumbnail_url)
  return mediaUrl(primary.media_url)
})
const productSlug = computed(() => chat.value?.product?.slug ?? chat.value?.product?.id)

// ── Composables ──────────────────────────────────────────────────
// Shared channel ref — starts null, populated by useChatRealtime on mount.
// All composables that broadcast use this same ref.
const channelRef = ref(null)

const {
  otherLastSeen, otherOnline, otherStatusText, fetchOtherLastSeen,
} = useChatPresence(otherParty, supabase)

const {
  messages, replyingTo, editingMsgId, editText, localHiddenIds, deleteMenuMsgId,
  messageText, sending, messagesContainer,
  loadMessages, scrollToBottom, scrollToMsg, canModifyMsg,
  startReply, cancelReply, startEdit, cancelEdit, saveEdit,
  patchReplyRefs, toggleDeleteMenu, deleteForAll, deleteForMe, loadHiddenIds,
  sendMessage, onInputKeydown, avatarInitial,
} = useChatMessages(chatId, myId, otherParty, supabase, isDark, channelRef)

const {
  showOfferModal, offerPrice, offerQty, offerError, submittingOffer, processingOffer,
  localProductStock, localProductStatus, maxQty, productAvailable,
  openOfferModal, submitOffer, respondOffer, checkoutOffer,
} = useChatOffer(chatId, chat, myId, messages, scrollToBottom, channelRef, supabase)

const {
  unreadDividerIndex, unreadCountOnOpen,
  markMessagesAsRead, snapshotUnreadState, clearUnreadDivider,
} = useChatReadStatus(chatId, myId, messages, userSettings, channelRef)

const {
  channel, startRealtime, stopRealtime,
} = useChatRealtime(
  chatId, chat, myId, messages, supabase,
  patchReplyRefs, scrollToBottom, markMessagesAsRead, clearUnreadDivider,
  localProductStock, localProductStatus,
)

// Sync useChatRealtime's internal channel into the shared ref (sync flush for timing)
watch(channel, (v) => { channelRef.value = v }, { flush: 'sync' })

const {
  searchOpen, searchQuery, searchCurrentIdx, searchTotal,
  toggleSearch, goSearchResult, highlightText,
} = useChatSearch(messages, scrollToMsg)

// ── Lifecycle ────────────────────────────────────────────────────
await loadMessages()

const unreadDividerRef = ref(null)
const profileCardUserId = ref(null)

onMounted(() => {
  snapshotUnreadState()

  // Scroll to unread divider or bottom
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = messagesContainer.value
        if (!container) return
        if (unreadDividerIndex.value >= 0) {
          let dividerEl = Array.isArray(unreadDividerRef.value)
            ? unreadDividerRef.value[0]
            : unreadDividerRef.value
          if (!dividerEl) dividerEl = container.querySelector('[data-unread-divider]')
          if (dividerEl) {
            const dividerTop = dividerEl.getBoundingClientRect().top
            const containerTop = container.getBoundingClientRect().top
            container.scrollTop += dividerTop - containerTop - 8
          } else {
            container.scrollTop = container.scrollHeight
          }
        } else {
          container.scrollTop = container.scrollHeight
        }
      })
    })
  })

  markMessagesAsRead()
  startRealtime()
  fetchOtherLastSeen()
  loadHiddenIds()

  document.addEventListener('click', onClickOutsideDeleteMenu)
})

onBeforeUnmount(() => {
  markMessagesAsRead()
  stopRealtime()
  document.removeEventListener('click', onClickOutsideDeleteMenu)
})

function onClickOutsideDeleteMenu(e) {
  if (deleteMenuMsgId.value && !e.target.closest('[data-delete-menu]')) {
    deleteMenuMsgId.value = null
  }
}

function handleSend() { sendMessage(clearUnreadDivider) }
function handleInputKeydown(e) { onInputKeydown(e, clearUnreadDivider) }
</script>

<template>
  <div class="flex flex-col h-full">

    <ChatHeader
      :chat="chat"
      :other-party="otherParty"
      :other-online="otherOnline"
      :other-status-text="otherStatusText"
      :product-cover="productCover"
      :product-slug="productSlug"
      :product-available="productAvailable"
      :local-product-stock="localProductStock"
      :search-open="searchOpen"
      :is-dark="isDark"
      @toggle-search="toggleSearch"
      @show-profile="profileCardUserId = $event"
    />

    <ChatSearchBar
      :search-open="searchOpen"
      :search-query="searchQuery"
      :search-total="searchTotal"
      :search-current-idx="searchCurrentIdx"
      :is-dark="isDark"
      @update:search-query="searchQuery = $event"
      @go-result="goSearchResult"
      @toggle-search="toggleSearch"
    />

    <!-- ── Messages ───────────────────────────────────────────────── -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      <template v-for="(msg, index) in messages" :key="msg.id">
        <!-- Unread divider -->
        <div
          v-if="index === unreadDividerIndex && unreadCountOnOpen > 0"
          ref="unreadDividerRef"
          data-unread-divider
          class="flex items-center gap-3 my-1 select-none"
        >
          <div class="flex-1 h-px" :style="isDark ? 'background:rgba(255,255,255,0.15)' : 'background:rgba(30,58,138,0.15)'"></div>
          <span
            class="text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap"
            :style="isDark
              ? 'background:rgba(14,165,233,0.18); color:#7dd3fc; border:1px solid rgba(14,165,233,0.3);'
              : 'background:rgba(30,58,138,0.08); color:#1e3a8a; border:1px solid rgba(30,58,138,0.2);'"
          >
            {{ unreadCountOnOpen }} pesan belum dibaca
          </span>
          <div class="flex-1 h-px" :style="isDark ? 'background:rgba(255,255,255,0.15)' : 'background:rgba(30,58,138,0.15)'"></div>
        </div>

        <ChatMessageBubble
          v-if="!localHiddenIds.includes(msg.id)"
          :msg="msg"
          :my-id="myId"
          :is-dark="isDark"
          :is-seller="isSeller"
          :is-buyer="isBuyer"
          :other-party="otherParty"
          :other-online="otherOnline"
          :other-last-seen="otherLastSeen"
          :search-query="searchQuery"
          :editing-msg-id="editingMsgId"
          :edit-text="editText"
          :delete-menu-msg-id="deleteMenuMsgId"
          :processing-offer="processingOffer"
          :read-receipts="userSettings.read_receipts"
          @start-reply="startReply"
          @start-edit="startEdit"
          @toggle-delete-menu="toggleDeleteMenu"
          @delete-for-me="deleteForMe"
          @delete-for-all="deleteForAll"
          @save-edit="saveEdit"
          @cancel-edit="cancelEdit"
          @update:edit-text="editText = $event"
          @respond-offer="respondOffer"
          @checkout-offer="checkoutOffer"
          @scroll-to-msg="scrollToMsg"
        />
      </template>

      <div v-if="!messages.length" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-12">
        <p class="text-4xl mb-3">💬</p>
        <p class="text-sm">Mulai percakapan sekarang!</p>
      </div>
    </div>

    <ChatInputArea
      :replying-to="replyingTo"
      :message-text="messageText"
      :sending="sending"
      :is-dark="isDark"
      :is-buyer="isBuyer"
      :is-negotiable="!!chat?.product?.is_negotiable"
      :product-available="productAvailable"
      @update:message-text="messageText = $event"
      @send="handleSend"
      @input-keydown="handleInputKeydown"
      @cancel-reply="cancelReply"
      @open-offer="openOfferModal"
    />

    <ProfileCard
      v-if="profileCardUserId"
      :user-id="profileCardUserId"
      @close="profileCardUserId = null"
    />

    <ChatOfferModal
      :show="showOfferModal"
      :offer-price="offerPrice"
      :offer-qty="offerQty"
      :offer-error="offerError"
      :submitting-offer="submittingOffer"
      :max-qty="maxQty"
      :is-dark="isDark"
      @update:show="showOfferModal = $event"
      @update:offer-price="offerPrice = $event"
      @update:offer-qty="offerQty = $event"
      @submit="submitOffer"
    />

  </div>
</template>

<style>
.chat-search-hl {
  background: rgba(250, 204, 21, 0.45);
  border-radius: 2px;
  padding: 0 1px;
}
</style>
