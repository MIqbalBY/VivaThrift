/**
 * scripts/migrate-storage-to-r2.ts
 *
 * One-time script: copy files from Supabase Storage → Cloudflare R2.
 * Reads every media URL (cdn.vivathrift.store/*) that is NOT yet in R2,
 * downloads from Supabase Storage public bucket, then uploads to R2.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage-to-r2.ts
 *
 * Prereq: npm/pnpm install -D tsx @aws-sdk/client-s3 (already in deps)
 *          .env must have SUPABASE_URL, SUPABASE_SERVICE_KEY, R2_* vars
 */
import 'dotenv/config'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

// ── config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL!
const SUPABASE_SERVICE  = process.env.SUPABASE_SERVICE_KEY!
const R2_ENDPOINT       = process.env.R2_ENDPOINT!
const R2_ACCESS_KEY_ID  = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET         = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET         = process.env.R2_BUCKET_NAME ?? 'vivathrift-media'
const SUPABASE_STORAGE  = `${SUPABASE_URL}/storage/v1/object/public`
const CDN_PREFIX        = 'https://cdn.vivathrift.store/'
const R2_DEV_PREFIX     = 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET },
})

// ── helpers ──────────────────────────────────────────────────────────────────

/** Strip query strings (cache busters like ?t=...) */
function cleanUrl(url: string): string {
  try { return new URL(url).origin + new URL(url).pathname } catch { return url }
}

/** Convert cdn.vivathrift.store/{bucket}/{path} → R2 key = {bucket}/{path} */
function cdnUrlToKey(url: string): string | null {
  const clean = cleanUrl(url)
  if (clean.startsWith(CDN_PREFIX)) return clean.slice(CDN_PREFIX.length)
  if (clean.startsWith(R2_DEV_PREFIX)) return clean.slice(R2_DEV_PREFIX.length)
  return null
}

/** Convert R2 key → old Supabase Storage public URL */
function keyToSupabaseUrl(key: string): string {
  return `${SUPABASE_STORAGE}/${key}`
}

/** Check if key already exists in R2 */
async function existsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch { return false }
}

/** Download a file via HTTP and return ArrayBuffer */
async function downloadFile(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) { console.warn(`  ✗ HTTP ${res.status} ${url}`); return null }
    const ct = res.headers.get('content-type') ?? 'application/octet-stream'
    return { data: await res.arrayBuffer(), contentType: ct }
  } catch (e) {
    console.warn(`  ✗ Fetch failed: ${url} — ${e}`)
    return null
  }
}

/** Upload Buffer to R2 */
async function uploadToR2(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: new Uint8Array(data),
    ContentType: contentType,
  }))
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Collecting all media URLs from database...')

  // 1. Collect all unique URLs
  const urls = new Set<string>()

  // avatar_url from users
  const { data: users, error: ue } = await supabase
    .from('users').select('avatar_url').not('avatar_url', 'is', null)
  if (ue) throw ue
  for (const u of users ?? []) { if (u.avatar_url) urls.add(u.avatar_url) }

  // media_url + thumbnail_url from product_media
  const { data: media, error: me } = await supabase
    .from('product_media').select('media_url, thumbnail_url')
  if (me) throw me
  for (const m of media ?? []) {
    if (m.media_url)     urls.add(m.media_url)
    if (m.thumbnail_url) urls.add(m.thumbnail_url)
  }

  console.log(`📋 Found ${urls.size} unique media URLs\n`)

  let copied = 0, skipped = 0, failed = 0

  for (const url of urls) {
    const key = cdnUrlToKey(url)
    if (!key) {
      console.log(`  ⚠  Skipping unknown domain: ${url.slice(0, 60)}`)
      skipped++
      continue
    }

    // Check if already in R2
    const already = await existsInR2(key)
    if (already) {
      console.log(`  ✓ Already in R2: ${key}`)
      skipped++
      continue
    }

    // Try downloading from Supabase Storage using the reconstructed URL
    const supabaseUrl = keyToSupabaseUrl(key)
    console.log(`  ↓ Downloading: ${supabaseUrl.slice(0, 80)}`)
    const file = await downloadFile(supabaseUrl)
    if (!file) { failed++; continue }

    // Upload to R2
    try {
      await uploadToR2(key, file.data, file.contentType)
      console.log(`  ↑ Uploaded to R2: ${key}`)
      copied++
    } catch (e) {
      console.warn(`  ✗ R2 upload failed for ${key}: ${e}`)
      failed++
    }
  }

  console.log(`\n✅ Done: ${copied} copied, ${skipped} skipped, ${failed} failed.`)
  if (failed > 0) {
    console.log('⚠  Some files could not be migrated. They may no longer exist in Supabase Storage.')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
