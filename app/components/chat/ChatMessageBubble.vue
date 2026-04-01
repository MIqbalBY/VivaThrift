<script setup>
const props = defineProps({
  msg: { type: Object, required: true },
  myId: { type: String, default: null },
  isDark: { type: Boolean, default: false },
  isSeller: { type: Boolean, default: false },
  isBuyer: { type: Boolean, default: false },
  otherParty: { type: Object, default: null },
  otherOnline: { type: Boolean, default: false },
  otherLastSeen: { type: String, default: null },
  searchQuery: { type: String, default: '' },
  editingMsgId: { type: String, default: null },
  editText: { type: String, default: '' },
  deleteMenuMsgId: { type: String, default: null },
  processingOffer: { type: String, default: null },
  readReceipts: { type: Boolean, default: true },
})

const emit = defineEmits([
  'start-reply', 'start-edit',
  'toggle-delete-menu', 'delete-for-me', 'delete-for-all',
  'save-edit', 'cancel-edit', 'update:editText',
  'respond-offer', 'checkout-offer', 'scroll-to-msg',
])

function canModifyMsg(msg) {
  if (!msg?.created_at) return false
  return (Date.now() - new Date(msg.created_at).getTime()) < 15 * 60 * 1000
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + time
}

function escapeHtmlChat(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlightText(text, query) {
  if (!query || !text) return escapeHtmlChat(text ?? '')
  const q = query.trim()
  if (!q) return escapeHtmlChat(text)
  const escaped = escapeHtmlChat(text)
  const escapedQuery = escapeHtmlChat(q)
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(regex, '<mark class="chat-search-hl">$1</mark>')
}
</script>

<template>
  <div
    :data-msg-id="msg.id"
    :class="msg.sender_id === myId ? 'items-end' : 'items-start'"
    class="flex flex-col group"
  >
    <!-- Bubble + Action wrapper -->
    <div
      class="flex items-end gap-1"
      :class="msg.sender_id === myId ? 'flex-row' : 'flex-row-reverse'"
    >
      <!-- Action buttons (appear on hover) -->
      <div
        v-if="!msg.offer_id"
        class="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          v-if="!msg.is_deleted && msg.content !== '$$DELETED$$'"
          @click="emit('start-reply', msg)"
          title="Balas"
          class="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition text-gray-400"
        >↩</button>
        <button
          v-if="msg.sender_id === myId && !msg.is_deleted && msg.content !== '$$DELETED$$' && canModifyMsg(msg)"
          @click="emit('start-edit', msg)"
          title="Edit"
          class="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition text-gray-400"
        >✏</button>
        <div class="relative" data-delete-menu>
          <button
            @click="emit('toggle-delete-menu', msg.id)"
            title="Hapus"
            class="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-red-100 dark:hover:bg-red-900/20 transition text-gray-400 hover:text-red-500"
          >🗑</button>
          <!-- Delete context menu -->
          <div
            v-if="deleteMenuMsgId === msg.id"
            class="absolute z-20 min-w-[160px] rounded-xl shadow-lg py-1 border"
            :class="msg.sender_id === myId ? 'right-0' : 'left-0'"
            :style="isDark
              ? 'background:#1e293b; border-color:rgba(255,255,255,0.1);'
              : 'background:#fff; border-color:rgba(0,0,0,0.08);'"
            style="bottom: 100%; margin-bottom: 4px;"
          >
            <button
              @click="emit('delete-for-me', msg.id)"
              class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition"
              :class="isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-50 text-gray-700'"
            >
              <span>🙈</span> Hapus untuk saya
            </button>
            <button
              v-if="msg.sender_id === myId && !msg.is_deleted && msg.content !== '$$DELETED$$' && canModifyMsg(msg)"
              @click="emit('delete-for-all', msg.id)"
              class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition text-red-500"
              :class="isDark ? 'hover:bg-red-900/20' : 'hover:bg-red-50'"
            >
              <span>🗑</span> Hapus untuk semua
            </button>
          </div>
        </div>
      </div>

      <!-- Offer Bubble -->
      <template v-if="msg.offer_id && msg.offer">
        <div
          class="w-72 rounded-2xl p-4 flex flex-col gap-2"
          :style="msg.sender_id === myId
            ? (isDark
                ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color:#fff;'
                : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff;')
            : isDark
              ? 'background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0;'
              : 'background: rgba(255,255,255,0.9); border:1px solid rgba(30,58,138,0.15);'"
        >
          <p class="text-xs font-bold uppercase opacity-70 tracking-wider">Penawaran</p>
          <div class="flex justify-between items-baseline">
            <span class="text-xs opacity-60">Harga</span>
            <span class="text-lg font-bold">Rp {{ (msg.offer.offered_price ?? 0).toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between items-baseline">
            <span class="text-xs opacity-60">Jumlah</span>
            <span class="text-sm font-semibold">&times; {{ msg.offer.quantity }} unit</span>
          </div>
          <div class="h-px my-1" :style="msg.sender_id === myId ? 'background:rgba(255,255,255,0.25)' : isDark ? 'background:rgba(255,255,255,0.1)' : 'background:rgba(0,0,0,0.08)'"></div>
          <div class="flex justify-between items-baseline">
            <span class="text-xs font-semibold opacity-70">Subtotal</span>
            <span class="text-base font-bold">Rp {{ ((msg.offer.offered_price ?? 0) * (msg.offer.quantity ?? 1)).toLocaleString('id-ID') }}</span>
          </div>

          <!-- Status badge -->
          <span
            class="self-start px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="{
              'bg-yellow-100 text-yellow-800': msg.offer.status === 'pending',
              'bg-green-100 text-green-800':   msg.offer.status === 'accepted',
              'bg-red-100 text-red-700':        msg.offer.status === 'rejected',
              'bg-gray-100 text-gray-600':      msg.offer.status === 'expired',
            }"
          >
            {{ msg.offer.status === 'pending'  ? '⏳ Menunggu' :
               msg.offer.status === 'accepted' ? '✅ Diterima' :
               msg.offer.status === 'rejected' ? '❌ Ditolak'  : '🚫 Kedaluwarsa' }}
          </span>

          <!-- Seller: accept / reject buttons -->
          <div v-if="isSeller && msg.offer.status === 'pending'" class="flex gap-2 mt-1">
            <button
              @click="emit('respond-offer', msg.offer.id, 'accepted')"
              :disabled="processingOffer === msg.offer.id"
              class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-600 text-white transition disabled:opacity-50"
            >
              Terima
            </button>
            <button
              @click="emit('respond-offer', msg.offer.id, 'rejected')"
              :disabled="processingOffer === msg.offer.id"
              class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50"
            >
              Tolak
            </button>
          </div>

          <!-- Buyer: checkout when accepted -->
          <button
            v-if="isBuyer && msg.offer.status === 'accepted'"
            @click="emit('checkout-offer', msg.offer.id)"
            class="w-full py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-800 hover:bg-blue-50 transition mt-1"
          >
            ⚡ Checkout Tawaran
          </button>

          <!-- Buyer: already checked out -->
          <div
            v-else-if="isBuyer && msg.offer.status === 'expired'"
            class="w-full py-1.5 rounded-lg text-xs font-semibold text-center bg-white/20 text-white mt-1"
          >
            ✅ Sudah Di-Checkout
          </div>
        </div>
      </template>

      <!-- Normal Message Bubble -->
      <template v-else>
        <div
          class="max-w-sm px-4 py-2.5 rounded-2xl text-sm"
          :style="msg.sender_id === myId
            ? (isDark
                ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color:#fff; border-radius: 18px 4px 18px 18px;'
                : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; border-radius: 18px 4px 18px 18px;')
            : isDark
              ? 'background: rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0; border-radius: 4px 18px 18px 18px;'
              : 'background: rgba(255,255,255,0.9); border:1px solid rgba(30,58,138,0.1); border-radius: 4px 18px 18px 18px;'"
        >
          <!-- Reply quote -->
          <div
            v-if="msg.reply_to_id"
            @click="msg.reply && !msg.reply.is_deleted && msg.reply.content !== '$$DELETED$$' ? emit('scroll-to-msg', msg.reply_to_id) : null"
            class="mb-2 -mx-1 px-2 py-1.5 rounded-lg text-[11px] bg-black/10 border-l-2 border-current transition-opacity"
            :class="msg.reply && !msg.reply.is_deleted && msg.reply.content !== '$$DELETED$$' ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-60'"
          >
            <template v-if="!msg.reply || msg.reply.is_deleted || msg.reply.content === '$$DELETED$$'">
              <p class="italic opacity-75">Pesan telah dihapus</p>
            </template>
            <template v-else>
              <p class="truncate font-medium">{{ msg.reply.offer_id ? '📦 Penawaran' : (msg.reply.content ?? '').slice(0, 80) }}</p>
              <p class="truncate opacity-60 mt-0.5">{{ msg.reply.sender?.name ?? (msg.reply.sender_id === myId ? 'Kamu' : (otherParty?.name ?? '...')) }}</p>
            </template>
          </div>
          <!-- Deleted -->
          <span v-if="msg.is_deleted || msg.content === '$$DELETED$$'" class="italic text-xs opacity-50">Pesan ini telah dihapus</span>
          <!-- Editing inline -->
          <template v-else-if="editingMsgId === msg.id">
            <textarea
              :value="editText"
              @input="emit('update:editText', $event.target.value)"
              @keydown.enter.prevent="emit('save-edit')"
              @keydown.esc="emit('cancel-edit')"
              rows="2"
              class="w-full rounded-lg px-2.5 py-1.5 outline-none resize-none text-sm bg-white/20 border border-white/30 placeholder-white/50 text-white"
            />
            <div class="flex gap-1 mt-1 justify-end">
              <button @click="emit('cancel-edit')" class="text-[11px] px-2 py-0.5 rounded opacity-60 hover:opacity-100 transition">Batal</button>
              <button @click="emit('save-edit')" class="text-[11px] px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 border border-white/20 transition font-medium">Simpan</button>
            </div>
          </template>
          <!-- Normal content -->
          <template v-else>
            <span v-if="searchQuery.trim()" v-html="highlightText(msg.content, searchQuery)"></span>
            <span v-else>{{ msg.content }}</span>
            <span v-if="msg.edited_at" class="text-[9px] opacity-50 ml-1">&middot; diedit</span>
          </template>
        </div>
      </template>
    </div><!-- end bubble + action wrapper -->

    <p class="text-[10px] text-gray-400 mt-0.5 px-1 flex items-center gap-1" :class="msg.sender_id === myId ? 'justify-end' : ''">
      <span>{{ formatTime(msg.created_at) }}</span>
      <!-- Check marks (only on own messages) -->
      <template v-if="msg.sender_id === myId && readReceipts">
        <!-- Double blue check: read -->
        <svg v-if="msg.is_read" class="w-4 h-4 text-sky-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 12.5l5 5L17 7" />
          <path d="M7 12.5l5 5L22.5 7" />
        </svg>
        <!-- Double gray check: delivered -->
        <svg v-else-if="otherOnline || (otherLastSeen && new Date(msg.created_at) <= new Date(otherLastSeen))" class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 12.5l5 5L17 7" />
          <path d="M7 12.5l5 5L22.5 7" />
        </svg>
        <!-- Single gray check: sent -->
        <svg v-else class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12.5l5 5L20 7" />
        </svg>
      </template>
      <!-- Read receipts disabled: always show single gray check -->
      <template v-else-if="msg.sender_id === myId">
        <svg class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12.5l5 5L20 7" />
        </svg>
      </template>
    </p>
  </div>
</template>
