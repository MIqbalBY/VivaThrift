import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { resolveServerUid } from '../../utils/resolve-server-uid'

const ALLOWED_FOLDERS  = ['avatars', 'product-media', 'team-photo'] as const
const ALLOWED_TYPES    = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
const MAX_IMAGE_BYTES  = 5 * 1024 * 1024   // 5 MB after client-side compression
const MAX_VIDEO_BYTES  = 10 * 1024 * 1024  // 10 MB

type AllowedFolder = (typeof ALLOWED_FOLDERS)[number]

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

  // Must be authenticated
  const uid = await resolveServerUid(event)
  if (!uid) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { folder, filename, contentType, fileSize, action } = body as {
    folder:      string
    filename:    string
    contentType: string
    fileSize:    number
    action?:     'upload' | 'delete'
    key?:        string
  }

  // ── DELETE action ──────────────────────────────────────────────────────────
  if (action === 'delete') {
    const key = (body as any).key as string | undefined
    if (!key || typeof key !== 'string') {
      throw createError({ statusCode: 400, message: 'key wajib diisi untuk delete' })
    }
    // Key must start with an allowed folder prefix to prevent arbitrary deletes
    if (!ALLOWED_FOLDERS.some(f => key.startsWith(f + '/'))) {
      throw createError({ statusCode: 403, message: 'key tidak valid' })
    }
    const client = getClient(config)
    await client.send(new DeleteObjectCommand({
      Bucket: config.r2BucketName,
      Key:    key,
    }))
    return { ok: true }
  }

  // ── UPLOAD action (default) ────────────────────────────────────────────────
  if (!ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
    throw createError({ statusCode: 400, message: 'folder tidak valid' })
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw createError({ statusCode: 400, message: 'tipe file tidak didukung' })
  }
  const isVideo = contentType.startsWith('video/')
  const maxSize = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (fileSize > maxSize) {
    throw createError({ statusCode: 413, message: isVideo ? 'Video maksimal 10 MB' : 'Gambar maksimal 5 MB' })
  }

  // Sanitise filename — strip path separators and null bytes
  const sanitised = filename.replace(/[/\\.\0]/g, '_').slice(0, 80) || 'file'
  const ext       = (filename.split('.').pop() ?? 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)
  const key       = `${folder}/${uid}/${Date.now()}-${sanitised.slice(0, 40)}.${ext}`

  const client = getClient(config)
  const command = new PutObjectCommand({
    Bucket:      config.r2BucketName,
    Key:         key,
    ContentType: contentType,
    ContentLength: fileSize,
  })

  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  const publicBase   = String(config.public.r2PublicUrl ?? '').replace(/\/+$/, '')
  const publicUrl    = publicBase ? `${publicBase}/${key}` : `/media/${key}`

  return { presignedUrl, publicUrl, key }
})
