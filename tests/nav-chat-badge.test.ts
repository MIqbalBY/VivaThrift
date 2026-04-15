import { describe, expect, it } from 'vitest'

import { getNavChatStatusForSetup } from '../app/composables/useNavChatBadge'

describe('getNavChatStatusForSetup', () => {
  it('returns connecting on the first initial connection', () => {
    expect(getNavChatStatusForSetup(false, 'initial')).toBe('connecting')
  })

  it('returns reconnecting after the chat was previously connected', () => {
    expect(getNavChatStatusForSetup(true, 'initial')).toBe('reconnecting')
  })

  it('returns reconnecting when the setup is a retry', () => {
    expect(getNavChatStatusForSetup(false, 'retry')).toBe('reconnecting')
  })
})
