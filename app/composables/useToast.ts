type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  function show(message: string, type: ToastType = 'info', duration = 4000) {
    const id = ++nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts: readonly(toasts),
    show,
    success: (msg: string, ms?: number) => show(msg, 'success', ms),
    error:   (msg: string, ms?: number) => show(msg, 'error', ms),
    info:    (msg: string, ms?: number) => show(msg, 'info', ms),
    warning: (msg: string, ms?: number) => show(msg, 'warning', ms),
    dismiss,
  }
}
