<script setup>
const { toasts, dismiss } = useToast()
const { isDark } = useDarkMode()

const iconMap = {
  success: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  error:   'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z',
  info:    'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
}

function gradientFor(type) {
  if (isDark.value) {
    return {
      success: 'background: linear-gradient(135deg, #065f46, #047857);',
      error:   'background: linear-gradient(135deg, #7f1d1d, #b91c1c);',
      warning: 'background: linear-gradient(135deg, #78350f, #b45309);',
      info:    'background: linear-gradient(135deg, #0c4a6e, #0369a1);',
    }[type]
  }
  return {
    success: 'background: linear-gradient(135deg, #059669, #10b981);',
    error:   'background: linear-gradient(135deg, #dc2626, #ef4444);',
    warning: 'background: linear-gradient(135deg, #d97706, #f59e0b);',
    info:    'background: linear-gradient(135deg, #1e3a8a, #2563eb);',
  }[type]
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-x-8"
        leave-to-class="opacity-0 translate-x-8"
        move-class="transition-all duration-200 ease-in-out"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-xl cursor-pointer"
          :style="gradientFor(t.type)"
          @click="dismiss(t.id)"
        >
          <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :d="iconMap[t.type]" />
          </svg>
          <span class="flex-1 leading-snug">{{ t.message }}</span>
          <svg class="w-4 h-4 shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
