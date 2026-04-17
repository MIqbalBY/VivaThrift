import { describe, expect, it } from 'vitest'

import { extractBiteshipLabelUrl } from '../server/utils/biteship'

describe('extractBiteshipLabelUrl', () => {
  it('prefers a top-level label url when present', () => {
    expect(extractBiteshipLabelUrl({
      label_url: 'https://files.example.com/label.pdf',
      courier: {},
    })).toBe('https://files.example.com/label.pdf')
  })

  it('falls back to nested courier label fields', () => {
    expect(extractBiteshipLabelUrl({
      courier: {
        label: {
          url: 'https://files.example.com/courier-label.pdf',
        },
      },
    })).toBe('https://files.example.com/courier-label.pdf')
  })

  it('returns null when no label url exists', () => {
    expect(extractBiteshipLabelUrl({ courier: { tracking_id: 'trk_123' } })).toBeNull()
  })
})
