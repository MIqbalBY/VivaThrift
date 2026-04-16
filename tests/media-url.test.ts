import { describe, expect, it } from 'vitest'

import { mediaUrl } from '../app/composables/useMediaUrl'

describe('mediaUrl', () => {
  it('rewrites plain object keys through the local media proxy', () => {
    expect(mediaUrl('products/book-cover.jpg')).toBe('/media/products/book-cover.jpg')
  })

  it('rewrites known R2/CDN URLs through the local media proxy', () => {
    expect(mediaUrl('https://cdn.vivathrift.store/products/book-cover.jpg')).toBe('/media/products/book-cover.jpg')
    expect(mediaUrl('https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/products/book-cover.jpg')).toBe('/media/products/book-cover.jpg')
    expect(mediaUrl('https://pub-any-random-id.r2.dev/avatars/user-1/avatar.webp?t=123')).toBe('/media/avatars/user-1/avatar.webp?t=123')
  })

  it('leaves unrelated remote URLs unchanged', () => {
    expect(mediaUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg')
  })

  it('rewrites avatar object keys with cache-busting query strings', () => {
    expect(mediaUrl('avatars/user-1/avatar.webp?t=999')).toBe('/media/avatars/user-1/avatar.webp?t=999')
  })
})
