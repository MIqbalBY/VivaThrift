import { validateSignupCredentials, validateSignupProfileStep } from '../../app/utils/signup-validation'

type SignupPayload = {
  name: string
  username: string
  nrp: string
  faculty: string
  department: string
  gender: string
  phone: string
  email: string
  password: string
  confirmPassword: string
}

type SignupAuthPayload = {
  email: string
  password: string
  emailRedirectTo?: string
  user_metadata: Record<string, string>
}

type SignupAuthResult = {
  user: { id?: string | null } | null
  error: { message?: string | null } | null
}

type SignupDeps = {
  findUserByUsername: (username: string) => Promise<{ id: string } | null>
  createAuthUser: (payload: SignupAuthPayload) => Promise<SignupAuthResult>
  syncUserProfile?: (payload: {
    id: string
    name: string
    username: string
    nrp: string
    faculty: string
    department: string
    gender: string
    phone: string
    email: string
  }) => Promise<void>
}

type SignupCustomEmailDeps = {
  generateSignupLink: (payload: SignupAuthPayload) => Promise<SignupAuthResult & {
    actionLink?: string | null
    action_link?: string | null
  }>
  sendVerificationEmail: (payload: {
    to: string
    name: string
    confirmationUrl: string
  }) => Promise<boolean>
}

type SignupOptions = {
  emailRedirectTo?: string
}

function throwSignupError(statusCode: number, statusMessage: string): never {
  throw Object.assign(new Error(statusMessage), { statusCode, statusMessage })
}

export async function createAuthUserWithCustomVerificationEmail(
  payload: SignupAuthPayload,
  deps: SignupCustomEmailDeps,
): Promise<SignupAuthResult> {
  const result = await deps.generateSignupLink(payload)

  if (result.error) {
    return {
      user: result.user ?? null,
      error: result.error,
    }
  }

  const confirmationUrl = String(result.actionLink ?? result.action_link ?? '').trim()
  const userId = result.user?.id

  if (!userId || !confirmationUrl) {
    return {
      user: result.user ?? null,
      error: { message: 'Error sending confirmation email' },
    }
  }

  const sent = await deps.sendVerificationEmail({
    to: payload.email,
    name: String(payload.user_metadata.name ?? 'Teman VivaThrift').trim() || 'Teman VivaThrift',
    confirmationUrl,
  })

  if (!sent) {
    return {
      user: result.user ?? null,
      error: { message: 'Error sending confirmation email' },
    }
  }

  return {
    user: result.user,
    error: null,
  }
}

function mapCreateUserError(message: string) {
  const msg = message.toLowerCase()

  if (msg.includes('already registered') || msg.includes('user already registered') || msg.includes('email address already')) {
    return { statusCode: 409, statusMessage: 'Email sudah terdaftar. Silakan login.' }
  }

  if (msg.includes('duplicate key') || msg.includes('username')) {
    return { statusCode: 409, statusMessage: 'Username sudah digunakan. Silakan pilih username lain.' }
  }

  if (msg.includes('confirmation email')) {
    return { statusCode: 503, statusMessage: 'Email verifikasi belum bisa dikirim. Coba lagi beberapa saat lagi.' }
  }

  if (msg.includes('weak password') || msg.includes('password')) {
    return { statusCode: 400, statusMessage: 'Password terlalu lemah. Gunakan minimal 6 karakter.' }
  }

  return { statusCode: 500, statusMessage: 'Pendaftaran gagal. Coba lagi nanti.' }
}

export async function createSignupAccount(payload: SignupPayload, deps: SignupDeps, options: SignupOptions = {}) {
  const normalizedUsername = String(payload.username ?? '').trim().toLowerCase()
  const normalizedEmail = String(payload.email ?? '').trim().toLowerCase()
  const normalizedPhone = String(payload.phone ?? '').trim()

  const profileError = validateSignupProfileStep({
    name: payload.name,
    username: normalizedUsername,
    nrp: payload.nrp,
    faculty: payload.faculty,
    department: payload.department,
    gender: payload.gender,
    phone: normalizedPhone,
    usernameChecking: false,
    usernameError: '',
  })

  if (profileError) {
    throwSignupError(400, profileError)
  }

  const credentialError = validateSignupCredentials({
    email: normalizedEmail,
    password: payload.password,
    confirmPassword: payload.confirmPassword,
  })

  if (credentialError) {
    throwSignupError(400, credentialError)
  }

  const existing = await deps.findUserByUsername(normalizedUsername)
  if (existing) {
    throwSignupError(409, 'Username sudah digunakan. Silakan pilih username lain.')
  }

  const result = await deps.createAuthUser({
    email: normalizedEmail,
    password: payload.password,
    emailRedirectTo: options.emailRedirectTo,
    user_metadata: {
      name: String(payload.name ?? '').trim(),
      username: normalizedUsername,
      nrp: String(payload.nrp ?? '').trim(),
      faculty: String(payload.faculty ?? '').trim(),
      department: String(payload.department ?? '').trim(),
      gender: String(payload.gender ?? '').trim(),
      phone: normalizedPhone,
    },
  })

  if (result.error) {
    const mapped = mapCreateUserError(result.error.message ?? '')
    throwSignupError(mapped.statusCode, mapped.statusMessage)
  }

  const userId = result.user?.id
  if (!userId) {
    throwSignupError(500, 'Pendaftaran gagal. Coba lagi nanti.')
  }

  await deps.syncUserProfile?.({
    id: userId,
    name: String(payload.name ?? '').trim(),
    username: normalizedUsername,
    nrp: String(payload.nrp ?? '').trim(),
    faculty: String(payload.faculty ?? '').trim(),
    department: String(payload.department ?? '').trim(),
    gender: String(payload.gender ?? '').trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
  })

  return { ok: true as const, userId }
}
