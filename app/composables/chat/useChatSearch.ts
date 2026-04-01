export function useChatSearch(messages: Ref<any[]>, scrollToMsg: (id: string) => void) {
  const searchOpen = ref(false)
  const searchQuery = ref('')
  const searchCurrentIdx = ref(0)

  const searchMatches = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return []
    return messages.value
      .map((msg, idx) => ({ msgId: msg.id, idx }))
      .filter(({ idx }) => {
        const msg = messages.value[idx]
        if (msg.is_deleted || msg.content === '$$DELETED$$') return false
        return msg.content?.toLowerCase().includes(q)
      })
  })

  const searchTotal = computed(() => searchMatches.value.length)

  function toggleSearch() {
    searchOpen.value = !searchOpen.value
    if (!searchOpen.value) {
      searchQuery.value = ''
      searchCurrentIdx.value = 0
    } else {
      nextTick(() => document.getElementById('chat-search-input')?.focus())
    }
  }

  function goSearchResult(dir: 'next' | 'prev') {
    if (!searchTotal.value) return
    if (dir === 'next') searchCurrentIdx.value = (searchCurrentIdx.value + 1) % searchTotal.value
    else searchCurrentIdx.value = (searchCurrentIdx.value - 1 + searchTotal.value) % searchTotal.value
    const match = searchMatches.value[searchCurrentIdx.value]
    if (match) scrollToMsg(match.msgId)
  }

  watch(searchQuery, () => {
    searchCurrentIdx.value = 0
    if (searchMatches.value.length) {
      nextTick(() => scrollToMsg(searchMatches.value[0]?.msgId))
    }
  })

  function escapeHtmlChat(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function highlightText(text: string, query: string) {
    if (!query || !text) return escapeHtmlChat(text ?? '')
    const q = query.trim()
    if (!q) return escapeHtmlChat(text)
    const escaped = escapeHtmlChat(text)
    const escapedQuery = escapeHtmlChat(q)
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return escaped.replace(regex, '<mark class="chat-search-hl">$1</mark>')
  }

  return {
    searchOpen,
    searchQuery,
    searchCurrentIdx,
    searchMatches,
    searchTotal,
    toggleSearch,
    goSearchResult,
    highlightText,
  }
}
