// Shared product metadata, labels, and helpers
// Auto-imported across all pages & components by Nuxt

export const CONDITION_META: Record<string, { emoji: string; order: number }> = {
  'Baru':        { emoji: '🆕', order: 0 },
  'Seperti Baru':{ emoji: '✨', order: 1 },
  'Baik':        { emoji: '👍', order: 2 },
  'Cukup Baik':  { emoji: '👌', order: 3 },
  'Bekas':       { emoji: '♻️', order: 4 },
}

export const CATEGORY_META: Record<string, string> = {
  'Aksesori & Gadget':       '📱',
  'Buku & Alat Tulis':       '📚',
  'Dapur & Peralatan Makan': '🍳',
  'Elektronik':              '💻',
  'Fashion':                 '👗',
  'Hobi & Koleksi':          '🎨',
  'Kendaraan':               '🚗',
  'Kosmetik & Skincare':     '💄',
  'Olahraga':                '⚽',
  'Perabot Kos':             '🛋️',
  'Tiket & Voucher':         '🎫',
  'Lainnya':                 '📦',
}

export function conditionLabel(k: string): string {
  const meta = CONDITION_META[k]
  return meta ? `${meta.emoji} ${k}` : k
}

export function categoryLabel(cat: string): string {
  const emoji = CATEGORY_META[cat]
  return emoji ? `${emoji} ${cat}` : cat
}

export function getPrimaryImage(product: any): string | null {
  const media = product.product_media
  if (!media || media.length === 0) return null
  const primary = media.find((m: any) => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
}

export function facultyAcronym(f: string | null | undefined): string {
  if (!f) return ''
  const m = /\(([^)]+)\)$/.exec(f)
  return m ? (m[1] as string) : f
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()]
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const jam = String(d.getHours()).padStart(2, '0')
  const mnt = String(d.getMinutes()).padStart(2, '0')
  return `${hari}, ${tgl} pukul ${jam}:${mnt}`
}

export function productDate(p: any): { label: string; date: string } {
  const c = p.created_at, u = p.updated_at
  if (u && c && new Date(u).getTime() - new Date(c).getTime() > 60000) return { label: 'Diedit pada', date: formatDate(u) }
  return { label: 'Ditambahkan pada', date: formatDate(c) }
}

export const CONDITIONS = [
  { value: 'Baru',         label: '🆕 Baru' },
  { value: 'Seperti Baru', label: '✨ Seperti Baru' },
  { value: 'Baik',         label: '👍 Baik' },
  { value: 'Cukup Baik',   label: '👌 Cukup Baik' },
  { value: 'Bekas',        label: '♻️ Bekas' },
]

export function generateSlug(title: string, id: string): string {
  const base = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `${base}-${id.slice(0, 8)}`
}

export function stripUrls(str: string): string {
  return str.replace(/https?:\/\/[^\s]+/gi, '').replace(/\s{2,}/g, ' ').trim()
}
