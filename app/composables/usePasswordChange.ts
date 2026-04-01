export function usePasswordChange() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const pwOld         = ref('')
  const pwNew         = ref('')
  const pwConfirm     = ref('')
  const pwSaving      = ref(false)
  const pwMsg         = ref('')
  const pwMsgType     = ref('')
  const showPwOld     = ref(false)
  const showPwNew     = ref(false)
  const showPwConfirm = ref(false)

  async function changePassword(emailFallback?: string) {
    pwMsg.value = ''
    if (!pwOld.value) { pwMsg.value = 'Password lama wajib diisi.'; pwMsgType.value = 'err'; return }
    if (!pwNew.value) { pwMsg.value = 'Password baru wajib diisi.'; pwMsgType.value = 'err'; return }
    if (pwNew.value.length < 6) { pwMsg.value = 'Password baru minimal 6 karakter.'; pwMsgType.value = 'err'; return }
    if (pwNew.value !== pwConfirm.value) { pwMsg.value = 'Konfirmasi password tidak cocok.'; pwMsgType.value = 'err'; return }
    if (pwOld.value === pwNew.value) { pwMsg.value = 'Password baru tidak boleh sama dengan password lama.'; pwMsgType.value = 'err'; return }

    pwSaving.value = true
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.value?.email ?? emailFallback ?? '',
        password: pwOld.value,
      })
      if (signInErr) {
        pwMsg.value = 'Password lama salah.'
        pwMsgType.value = 'err'
        return
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: pwNew.value })
      if (updateErr) {
        const msg = updateErr.message?.toLowerCase() ?? ''
        if (msg.includes('same_password') || msg.includes('same password'))
          pwMsg.value = 'Password baru tidak boleh sama dengan password lama.'
        else if (msg.includes('weak'))
          pwMsg.value = 'Password terlalu lemah. Gunakan minimal 6 karakter.'
        else
          pwMsg.value = 'Gagal mengubah password. Coba lagi nanti.'
        pwMsgType.value = 'err'
        return
      }
      pwMsg.value = 'Password berhasil diubah! ✅'
      pwMsgType.value = 'ok'
      pwOld.value = ''
      pwNew.value = ''
      pwConfirm.value = ''
      setTimeout(() => { pwMsg.value = '' }, 3000)
    } catch {
      pwMsg.value = 'Terjadi kesalahan. Coba lagi nanti.'
      pwMsgType.value = 'err'
    } finally {
      pwSaving.value = false
    }
  }

  return {
    pwOld, pwNew, pwConfirm, pwSaving, pwMsg, pwMsgType,
    showPwOld, showPwNew, showPwConfirm,
    changePassword,
  }
}
