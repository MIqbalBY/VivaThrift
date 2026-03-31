export function useDarkMode() {
  const isDark = useState<boolean>('darkMode', () => false)

  function apply(dark: boolean) {
    isDark.value = dark
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', dark)
      localStorage.setItem('vt-dark', dark ? '1' : '0')
    }
  }

  function init() {
    if (!import.meta.client) return
    const stored = localStorage.getItem('vt-dark')
    const prefersDark = stored !== null
      ? stored === '1'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
    apply(prefersDark)
  }

  function toggle() {
    apply(!isDark.value)
  }

  return { isDark, init, toggle }
}
