import imageCompression from 'browser-image-compression'

export type R2Folder = 'avatars' | 'product-media' | 'team-photo'

const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB:           1,
  maxWidthOrHeight:    1920,
  useWebWorker:        true,
  fileType:            'image/webp' as const,
}

const MAX_VIDEO_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Shared composable for uploading files to Cloudflare R2 via presigned URLs.
 *
 * Usage:
 *   const { uploadToR2, deleteFromR2 } = useR2Upload()
 *   const { publicUrl, key } = await uploadToR2(file, 'product-media')
 */
export function useR2Upload() {
  /**
   * Upload a file (image or video) to R2.
   * Images are compressed client-side before upload.
   * Returns the public CDN URL and the R2 object key.
   */
  async function uploadToR2(
    file: File,
    folder: R2Folder,
    opts?: { skipCompression?: boolean },
  ): Promise<{ publicUrl: string; key: string }> {
    const isVideo = file.type.startsWith('video/')

    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      throw new Error('Video maksimal 10 MB')
    }

    let uploadFile: File | Blob = file
    let contentType = file.type

    if (!isVideo && !opts?.skipCompression) {
      uploadFile   = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS)
      contentType  = 'image/webp'
    }

    // Ask server for presigned URL
    const { presignedUrl, publicUrl, key } = await $fetch<{
      presignedUrl: string
      publicUrl:    string
      key:          string
    }>('/api/upload/presign', {
      method: 'POST',
      body:   {
        folder,
        filename:    file.name,
        contentType,
        fileSize:    uploadFile.size,
      },
    })

    // Upload directly from browser → R2 (bypasses Vercel 4.5 MB limit)
    const res = await fetch(presignedUrl, {
      method:  'PUT',
      body:    uploadFile,
      headers: { 'Content-Type': contentType },
    })

    if (!res.ok) {
      throw new Error(`Upload ke R2 gagal: ${res.status} ${res.statusText}`)
    }

    return { publicUrl, key }
  }

  /**
   * Delete a file from R2 by its object key.
   */
  async function deleteFromR2(key: string): Promise<void> {
    await $fetch('/api/upload/presign', {
      method: 'POST',
      body:   { action: 'delete', folder: key.split('/')[0], filename: '', contentType: '', fileSize: 0, key },
    })
  }

  return { uploadToR2, deleteFromR2 }
}
