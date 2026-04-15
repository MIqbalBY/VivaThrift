import { describe, expect, it, vi } from 'vitest'

import { createSignupAccount } from '../server/utils/signup-handler'

describe('createSignupAccount', () => {
  it('creates a confirmed account via admin auth when the payload is valid', async () => {
    const deps = {
      findUserByUsername: vi.fn(async () => null),
      createAuthUser: vi.fn(async () => ({
        user: { id: 'user-1', email: '50252101@student.its.ac.id' },
        error: null,
      })),
    }

    const result = await createSignupAccount({
      name: 'Iqbal Maulana',
      username: 'iqbal.maulana',
      nrp: '50252101',
      faculty: 'FTEIC',
      department: 'Informatika',
      gender: 'Laki-laki',
      email: '50252101@student.its.ac.id',
      password: 'Rahasia123',
      confirmPassword: 'Rahasia123',
    }, deps)

    expect(result).toEqual({ ok: true, userId: 'user-1' })
    expect(deps.createAuthUser).toHaveBeenCalledWith(expect.objectContaining({
      email: '50252101@student.its.ac.id',
      email_confirm: true,
    }))
  })

  it('rejects duplicate usernames before creating the auth user', async () => {
    const deps = {
      findUserByUsername: vi.fn(async () => ({ id: 'existing-user' })),
      createAuthUser: vi.fn(),
    }

    await expect(createSignupAccount({
      name: 'Iqbal Maulana',
      username: 'iqbal.maulana',
      nrp: '50252101',
      faculty: 'FTEIC',
      department: 'Informatika',
      gender: 'Laki-laki',
      email: '50252101@student.its.ac.id',
      password: 'Rahasia123',
      confirmPassword: 'Rahasia123',
    }, deps)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Username sudah digunakan. Silakan pilih username lain.',
    })

    expect(deps.createAuthUser).not.toHaveBeenCalled()
  })

  it('rejects non-ITS emails', async () => {
    const deps = {
      findUserByUsername: vi.fn(async () => null),
      createAuthUser: vi.fn(),
    }

    await expect(createSignupAccount({
      name: 'Iqbal Maulana',
      username: 'iqbal.maulana',
      nrp: '50252101',
      faculty: 'FTEIC',
      department: 'Informatika',
      gender: 'Laki-laki',
      email: 'iqbal@gmail.com',
      password: 'Rahasia123',
      confirmPassword: 'Rahasia123',
    }, deps)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Hanya email ITS (@student.its.ac.id) yang diizinkan.',
    })
  })
})
