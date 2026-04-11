// server/routes/media/[...].get.ts
// Transparent R2 proxy — serves private R2 objects using server-side credentials.
// Route: GET /media/avatars/xxx.webp → fetches R2 key "avatars/xxx.webp"
//
// This bypass is needed until the R2 bucket is configured with public access
// or the cdn.vivathrift.store custom domain is linked correctly in Cloudflare.

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const ALLOWED_PREFIXES = ['avatars/', 'product-media/', 'team-photo/']

// Mime type map for common media files
const MIME: Record<string, string> = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}

function getClient(config: ReturnType<typeof useRuntimeConfig>) {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId:     config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  })
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // Extract key from the URL path: /media/avatars/xxx → avatars/xxx
  const params = event.context.params as Record<string, string>
  // In Nitro [...] catch-all params come as the wildcard key
  const key = params['_'] ?? ''

  // Security: only allow known prefixes to prevent arbitrary file reads
  if (!ALLOWED_PREFIXES.some(p => key.startsWith(p))) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Strip query strings (cache busters like ?t=xxx) from key
  const cleanKey = key.split('?')[0]!

  const ext = (cleanKey.split('.').pop() ?? '').toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'

  try {
    const client = getClient(config)
    const res = await client.send(new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key:    cleanKey,
    }))

    if (!res.Body) throw createError({ statusCode: 404, message: 'Not found' })

    // Set caching headers — 30-day cache since media files are immutable
    setResponseHeaders(event, {
      'Content-Type':  contentType,
      'Cache-Control': 'public, max-age=2592000, immutable',
      ...(res.ContentLength ? { 'Content-Length': String(res.ContentLength) } : {}),
    })

    // Stream the body directly
    const chunks: Uint8Array[] = []
    const reader = res.Body as AsyncIterable<Uint8Array>
    for await (const chunk of reader) chunks.push(chunk)
    const total = chunks.reduce((s, c) => s + c.byteLength, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength }
    return out
  } catch (err: any) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchKey') {
      throw createError({ statusCode: 404, message: 'Media not found' })
    }
    throw createError({ statusCode: 500, message: 'Could not fetch media' })
  }
})
