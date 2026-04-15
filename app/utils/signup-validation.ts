type SignupProfileStepInput = {
  name: string
  username: string
  nrp: string
  faculty: string
  department: string
  gender: string
  usernameError?: string
  usernameChecking?: boolean
}

type SignupCredentialInput = {
  email: string
  password: string
  confirmPassword: string
}

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/
const ITS_EMAIL_REGEX = /^[^\s@]+@student\.its\.ac\.id$/i

export function validateSignupProfileStep(input: SignupProfileStepInput) {
  if (!input.name.trim() || !input.username.trim() || !input.nrp.trim() || !input.faculty || !input.department || !input.gender) {
    return 'Semua field wajib diisi.'
  }

  if (!USERNAME_REGEX.test(input.username.trim())) {
    return 'Username tidak valid.'
  }

  if (input.usernameChecking) {
    return 'Tunggu pengecekan username selesai.'
  }

  if (input.usernameError) {
    return input.usernameError
  }

  return ''
}

export function validateSignupCredentials(input: SignupCredentialInput) {
  const normalizedEmail = input.email.trim().toLowerCase()

  if (!normalizedEmail || !input.password || !input.confirmPassword) {
    return 'Semua field wajib diisi.'
  }

  if (input.password !== input.confirmPassword) {
    return 'Password dan konfirmasi password tidak cocok.'
  }

  if (input.password.length < 6) {
    return 'Password minimal 6 karakter.'
  }

  if (!ITS_EMAIL_REGEX.test(normalizedEmail)) {
    return 'Hanya email ITS (@student.its.ac.id) yang diizinkan.'
  }

  return ''
}

export function mapSignupErrorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? '').toLowerCase()

  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'Email sudah terdaftar. Silakan login.'
  }

  if (msg.includes('idx_users_username_lower') || msg.includes('users_username_key') || msg.includes('duplicate key') || msg.includes('username')) {
    return 'Username sudah digunakan. Silakan pilih username lain.'
  }

  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Coba lagi nanti.'
  }

  if (msg.includes('weak password') || msg.includes('password')) {
    return 'Password terlalu lemah. Gunakan minimal 6 karakter.'
  }

  if (msg.includes('invalid email')) {
    return 'Format email tidak valid.'
  }

  return 'Pendaftaran gagal. Coba lagi nanti.'
}
