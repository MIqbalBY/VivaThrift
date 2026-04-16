import { validateSignupCredentials, validateSignupProfileStep } from '../../app/utils/signup-validation'

type SignupPayload = {
  name: string
  username: string
  nrp: string
  faculty: string
  department: string
  gender: string
  email: string
  password: string
  confirmPassword: string
}

type SignupDeps = {
  findUserByUsername: (username: string) => Promise<{ id: string } | null>
  createAuthUser: (payload: {
    email: string
    password: string
    email_confirm: boolean
    user_metadata: Record<string, string>
  }) => Promise<{
    user: { id?: string | null } | null
    error: { message?: string | null } | null
  }>
}

function throwSignupError(statusCode: number, statusMessage: string): never {
  throw Object.assign(new Error(statusMessage), { statusCode, statusMessage })
}

function mapCreateUserError(message: string) {
  const msg = message.toLowerCase()

  if (msg.includes('already registered') || msg.includes('user already registered') || msg.includes('email address already')) {
    return { statusCode: 409, statusMessage: 'Email sudah terdaftar. Silakan login.' }
  }

  if (msg.includes('duplicate key') || msg.includes('username')) {
    return { statusCode: 409, statusMessage: 'Username sudah digunakan. Silakan pilih username lain.' }
  }

  if (msg.includes('weak password') || msg.includes('password')) {
    return { statusCode: 400, statusMessage: 'Password terlalu lemah. Gunakan minimal 6 karakter.' }
  }

  return { statusCode: 500, statusMessage: 'Pendaftaran gagal. Coba lagi nanti.' }
}

export async function createSignupAccount(payload: SignupPayload, deps: SignupDeps) {
  const normalizedUsername = String(payload.username ?? '').trim().toLowerCase()
  const normalizedEmail = String(payload.email ?? '').trim().toLowerCase()

  const profileError = validateSignupProfileStep({
    name: payload.name,
    username: normalizedUsername,
    nrp: payload.nrp,
    faculty: payload.faculty,
    department: payload.department,
    gender: payload.gender,
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
    email_confirm: false,
    user_metadata: {
      name: String(payload.name ?? '').trim(),
      username: normalizedUsername,
      nrp: String(payload.nrp ?? '').trim(),
      faculty: String(payload.faculty ?? '').trim(),
      department: String(payload.department ?? '').trim(),
      gender: String(payload.gender ?? '').trim(),
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

  return { ok: true as const, userId }
}
