// Markdown-lite description formatter
// Supports **bold**, *italic*, and bullet lists (lines starting with "- ")

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function applyInlineFormat(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
}

export function formatDescription(text: string | null | undefined): string {
  if (!text) return ''
  const lines = text.split('\n')
  const parts: string[] = []
  let inList = false
  for (const line of lines) {
    if (line.trimStart().startsWith('- ')) {
      if (!inList) { parts.push('<ul class="list-disc list-inside space-y-0.5 my-1 text-gray-600">'); inList = true }
      parts.push(`<li>${applyInlineFormat(escapeHtml(line.trimStart().slice(2)))}</li>`)
    } else {
      if (inList) { parts.push('</ul>'); inList = false }
      if (line.trim() === '') {
        parts.push('<div class="h-2"></div>')
      } else {
        parts.push(`<span class="block">${applyInlineFormat(escapeHtml(line))}</span>`)
      }
    }
  }
  if (inList) parts.push('</ul>')
  return parts.join('')
}
