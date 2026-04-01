<script setup>
const { init } = useDarkMode()
const { setupGlobalPresence, cleanup: cleanupPresence } = usePresence()
const { settings: userSettings } = useUserSettings()
const supabase = useSupabaseClient()
let presenceUid = null

onMounted(async () => {
  init()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id && userSettings.value.show_online) {
    presenceUid = session.user.id
    setupGlobalPresence(session.user.id)
  }
})

watch(() => userSettings.value.show_online, async (val) => {
  if (!val) {
    cleanupPresence()
    presenceUid = null
  } else if (!presenceUid) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      presenceUid = session.user.id
      setupGlobalPresence(session.user.id)
    }
  }
})

onBeforeUnmount(() => cleanupPresence())
</script>

<template>
  <!-- No footer — chat needs the full viewport height -->
  <div class="font-sans flex flex-col vt-layout" style="height: 100svh; overflow: hidden;">
    <Navbar />
    <main class="flex-1 overflow-hidden">
      <slot />
    </main>
  </div>
</template>

<style>
.vt-layout {
  background: linear-gradient(135deg, #eef2ff 0%, #e8effe 20%, #f0f4ff 40%, #e6eeff 60%, #edf2ff 80%, #f0f5ff 100%);
}
.dark .vt-layout {
  background: linear-gradient(135deg, #0f172a 0%, #111827 30%, #0f1f3d 60%, #162d6e 100%);
}
</style>
