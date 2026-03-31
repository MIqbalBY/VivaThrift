interface UserSettings {
  chat_popup: boolean
  notif_product: boolean
  show_online: boolean
  read_receipts: boolean
}

export function useUserSettings() {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const settings = useState<UserSettings>('userSettings', () => ({
    chat_popup: true,
    notif_product: true,
    show_online: true,
    read_receipts: true,
  }))

  const settingsLoaded = useState('userSettingsLoaded', () => false)

  async function fetchSettings(userId: string) {
    if (!userId) return
    const { data, error } = await db
      .from('user_settings')
      .select('chat_popup, notif_product, show_online, read_receipts')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[useUserSettings] fetch error:', error.message)
      return
    }

    if (data) {
      settings.value = {
        chat_popup: data.chat_popup ?? true,
        notif_product: data.notif_product ?? true,
        show_online: data.show_online ?? true,
        read_receipts: data.read_receipts ?? true,
      }
    } else {
      // First time — insert default settings
      await db.from('user_settings').insert({ user_id: userId })
    }
    settingsLoaded.value = true
  }

  async function updateSetting(userId: string, key: string, value: boolean) {
    if (!userId) return
    settings.value = { ...settings.value, [key]: value }
    const { error } = await db
      .from('user_settings')
      .upsert({ user_id: userId, [key]: value, updated_at: new Date().toISOString() })
    if (error) console.error('[useUserSettings] update error:', error.message)
  }

  function resetSettings() {
    settings.value = { chat_popup: true, notif_product: true, show_online: true, read_receipts: true }
    settingsLoaded.value = false
  }

  return { settings, settingsLoaded, fetchSettings, updateSetting, resetSettings }
}
