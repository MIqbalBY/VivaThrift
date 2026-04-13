<template>
  <footer class="vt-footer w-full" style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); box-shadow: 0 -8px 32px 0 rgba(30,58,138,0.25);">
    <div class="vt-hero-enter vt-hero-enter-d3 w-full px-10 py-8 flex flex-col md:flex-row justify-between items-center gap-4" style="background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
      <div class="flex items-center gap-4">
        <img src="/img/logo-vivathrift.png" alt="VivaThrift" width="40" height="40" class="h-10 opacity-90 drop-shadow-sm" />
        <p class="text-white/80 text-sm">&copy; 2026 VivaThrift.<br>Dikelola oleh PT Viva Niaga Digital.</p>
        <div class="w-px h-8 bg-white/20 hidden sm:block"></div>
        <a href="https://www.its.ac.id/" target="_blank" rel="noopener noreferrer" class="hidden sm:block" title="Institut Teknologi Sepuluh Nopember">
          <img src="/img/logo-its.png" alt="Institut Teknologi Sepuluh Nopember" width="36" height="36" loading="lazy" class="h-9 opacity-90 drop-shadow-sm" />
        </a>
      </div>
      <div class="flex flex-wrap gap-6">
        <NuxtLink to="/about" class="text-white/70 text-sm hover:text-white transition">Tentang VivaThrift</NuxtLink>
        <NuxtLink to="/faq" class="text-white/70 text-sm hover:text-white transition">Bantuan</NuxtLink>
        <NuxtLink to="/terms" class="text-white/70 text-sm hover:text-white transition">Syarat &amp; Ketentuan</NuxtLink>
        <NuxtLink to="/privacy" class="text-white/70 text-sm hover:text-white transition">Privasi</NuxtLink>
        <NuxtLink to="/contact" class="text-white/70 text-sm hover:text-white transition">Kontak</NuxtLink>
      </div>
    </div>
  </footer>
</template>
