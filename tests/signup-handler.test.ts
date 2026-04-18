import { describe, expect, it, vi } from 'vitest'

import { createSignupAccount, createAuthUserWithCustomVerificationEmail } from '../server/utils/signup-handler'

describe('createSignupAccount', () => {
  it('creates an unconfirmed account so the user must verify email first', async () => {
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
      phone: '081234567890',
      email: '50252101@student.its.ac.id',
      password: 'Rahasia123',
      confirmPassword: 'Rahasia123',
    }, deps, {
      emailRedirectTo: 'https://www.vivathrift.store/auth/confirm?type=signup',
    })

    expect(result).toEqual({ ok: true, userId: 'user-1' })
    expect(deps.createAuthUser).toHaveBeenCalledWith(expect.objectContaining({
      email: '50252101@student.its.ac.id',
      emailRedirectTo: 'https://www.vivathrift.store/auth/confirm?type=signup',
      user_metadata: expect.objectContaining({
        phone: '081234567890',
      }),
    }))
  })

  it('sends signup verification email using custom email delivery', async () => {
    const deps = {
      generateSignupLink: vi.fn(async () => ({
        user: { id: 'user-verify-1' },
        actionLink: 'https://jwnisdkjgqnoergsoorf.supabase.co/auth/v1/verify?token=abc',
        error: null,
      })),
      sendVerificationEmail: vi.fn(async () => true),
    }

    const result = await createAuthUserWithCustomVerificationEmail({
      email: '50252101@student.its.ac.id',
      password: 'Rahasia123',
      emailRedirectTo: 'https://www.vivathrift.store/auth/confirm?type=signup',
      user_metadata: {
        name: 'Iqbal Maulana',
        username: 'iqbal.maulana',
        nrp: '50252101',
        faculty: 'FTEIC',
        department: 'Informatika',
        gender: 'Laki-laki',
        phone: '081234567890',
      },
    }, deps)

    expect(result).toEqual({
      user: { id: 'user-verify-1' },
      error: null,
    })
    expect(deps.generateSignupLink).toHaveBeenCalledWith(expect.objectContaining({
      email: '50252101@student.its.ac.id',
      emailRedirectTo: 'https://www.vivathrift.store/auth/confirm?type=signup',
    }))
    expect(deps.sendVerificationEmail).toHaveBeenCalledWith({
      to: '50252101@student.its.ac.id',
      name: 'Iqbal Maulana',
      confirmationUrl: 'https://jwnisdkjgqnoergsoorf.supabase.co/auth/v1/verify?token=abc',
    })
  })

  it('syncs signup profile data into the app user profile record', async () => {
    const deps = {
      findUserByUsername: vi.fn(async () => null),
      createAuthUser: vi.fn(async () => ({
        user: { id: 'user-2', email: '50252101@student.its.ac.id' },
        error: null,
      })),
      syncUserProfile: vi.fn(async () => undefined),
    }

    const result = await createSignupAccount({
      name: 'Iqbal Maulana',
      username: 'iqbal.maulana',
      nrp: '50252101',
      faculty: 'FTEIC',
      department: 'Informatika',
      gender: 'Laki-laki',
      phone: '081234567890',
      email: '50252101@student.its.ac.id',
      password: 'Rahasia123',
      confirmPassword: 'Rahasia123',
    }, deps)

    expect(result).toEqual({ ok: true, userId: 'user-2' })
    expect(deps.syncUserProfile).toHaveBeenCalledWith({
      id: 'user-2',
      name: 'Iqbal Maulana',
      username: 'iqbal.maulana',
      nrp: '50252101',
      faculty: 'FTEIC',
      department: 'Informatika',
      gender: 'Laki-laki',
      phone: '081234567890',
      email: '50252101@student.its.ac.id',
    })
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
      phone: '081234567890',
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
      phone: '081234567890',
      email: 'iqbal@gmail.com',
      password: 'Rahasia123',
      confirmPassword: 'Rahasia123',
    }, deps)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Hanya email ITS (@student.its.ac.id) yang diizinkan.',
    })
  })
})
