// Klack-inspired scroll-reveal using IntersectionObserver.
// Usage:
//   const { reveal } = useScrollReveal()
//   <div :ref="reveal">...</div>                    → fade-in-up on scroll
//   <div :ref="reveal" data-delay="200">...</div>   → with 200 ms delay

export function useScrollReveal() {
  let observer: IntersectionObserver | null = null

  const targets = new Set<Element>()

  function ensureObserver() {
    if (observer) return
    if (typeof window === 'undefined') return
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('vt-revealed')
            observer!.unobserve(entry.target)
            targets.delete(entry.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
  }

  // Template ref callback — use as :ref="reveal"
  function reveal(el: Element | ComponentPublicInstance | null) {
    if (!el) return
    const dom = (el as any).$el ?? el
    if (!(dom instanceof Element)) return
    dom.classList.add('vt-reveal')
    ensureObserver()
    if (observer && !targets.has(dom)) {
      targets.add(dom)
      observer.observe(dom)
    }
  }

  onUnmounted(() => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    targets.clear()
  })

  return { reveal }
}
