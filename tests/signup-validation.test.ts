import { describe, expect, it } from 'vitest'

import {
  mapSignupErrorMessage,
  validateSignupCredentials,
  validateSignupProfileStep,
} from '../app/utils/signup-validation'

describe('signup validation', () => {
  it('blocks progress while username availability is still being checked', () => {
    expect(validateSignupProfileStep({
      name: 'Iqbal Maulana',
      username: 'iqbal.maulana',
      nrp: '5025211010',
      faculty: 'FTEIC',
      department: 'Informatika',
      gender: 'Laki-laki',
      usernameError: '',
      usernameChecking: true,
    })).toBe('Tunggu pengecekan username selesai.')
  })

  it('validates the ITS email and password confirmation', () => {
    expect(validateSignupCredentials({
      email: ' 50252101@student.its.ac.id ',
      password: 'rahasia123',
      confirmPassword: 'rahasia123',
    })).toBe('')

    expect(validateSignupCredentials({
      email: 'user@gmail.com',
      password: 'rahasia123',
      confirmPassword: 'rahasia123',
    })).toContain('@student.its.ac.id')
  })

  it('maps duplicate username database errors to a clear message', () => {
    expect(mapSignupErrorMessage(new Error('duplicate key value violates unique constraint "idx_users_username_lower"')))
      .toBe('Username sudah digunakan. Silakan pilih username lain.')
  })
})
