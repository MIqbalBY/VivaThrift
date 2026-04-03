<script setup lang="ts">
const props = withDefaults(defineProps<{
  src: string
  autoplay?: boolean
  videoClass?: string
  preload?: string
}>(), {
  preload: 'metadata'
})

const containerRef = ref<HTMLElement>()
const videoRef = ref<HTMLVideoElement>()
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const muted = ref(false)
const controlsVisible = ref(true)
const isFullscreen = ref(false)
const seeking = ref(false)
const playbackRate = ref(1)
const showSpeedMenu = ref(false)

const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]

let hideTimer: ReturnType<typeof setTimeout>

const progressPct = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0
)
const effectiveVolume = computed(() => (muted.value ? 0 : volume.value))

function togglePlay() {
  const v = videoRef.value
  if (!v) return
  v.paused ? v.play() : v.pause()
}

function toggleMute() {
  const v = videoRef.value
  if (!v) return
  muted.value = !muted.value
  v.muted = muted.value
}

function setVolume(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  volume.value = val
  if (videoRef.value) {
    videoRef.value.volume = val
    if (val > 0 && muted.value) {
      muted.value = false
      videoRef.value.muted = false
    } else if (val === 0) {
      muted.value = true
      videoRef.value.muted = true
    }
  }
}

function setSpeed(rate: number) {
  playbackRate.value = rate
  if (videoRef.value) videoRef.value.playbackRate = rate
  showSpeedMenu.value = false
}

function togglePiP() {
  const v = videoRef.value
  if (!v) return
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture()
  } else {
    v.requestPictureInPicture().catch(() => {})
  }
}

async function downloadVideo() {
  const filename = decodeURIComponent(props.src.split('/').pop()?.split('?')[0] || 'video.mp4')
  try {
    const res = await fetch(props.src, { mode: 'cors' })
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch {
    // fallback: open in new tab so user can right-click save
    window.open(props.src, '_blank', 'noopener')
  }
}

function tryGetDuration() {
  const v = videoRef.value
  if (v && v.duration && isFinite(v.duration) && v.duration > 0) {
    duration.value = v.duration
  }
}

function onTimeUpdate() {
  const v = videoRef.value
  if (!v) return
  if (!duration.value) tryGetDuration()
  if (!seeking.value) currentTime.value = v.currentTime
}

function onLoaded() {
  const v = videoRef.value
  if (!v) return
  tryGetDuration()
  v.playbackRate = playbackRate.value
  if (props.autoplay) v.play().catch(() => {})
}

function onDurationChange() {
  tryGetDuration()
}

function startSeeking(e: MouseEvent | TouchEvent) {
  seeking.value = true
  const bar = e.currentTarget as HTMLElement
  const v = videoRef.value
  if (v && !duration.value) tryGetDuration()
  const dur = duration.value || (v?.duration && isFinite(v.duration) ? v.duration : 0)

  function move(ev: MouseEvent | TouchEvent) {
    if (!dur) return
    const rect = bar.getBoundingClientRect()
    const x = 'touches' in ev ? ev.touches[0]!.clientX : ev.clientX
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
    currentTime.value = pct * dur
    if (videoRef.value) videoRef.value.currentTime = currentTime.value
  }

  function up() {
    seeking.value = false
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    document.removeEventListener('touchmove', move)
    document.removeEventListener('touchend', up)
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
  document.addEventListener('touchmove', move)
  document.addEventListener('touchend', up)
  move(e)
}

function toggleFullscreen() {
  if (!containerRef.value) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    containerRef.value.requestFullscreen()
  }
}

function fmt(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function showTemporarily() {
  controlsVisible.value = true
  clearTimeout(hideTimer)
  if (playing.value)
    hideTimer = setTimeout(() => { controlsVisible.value = false }, 2500)
}

function onLeave() {
  showSpeedMenu.value = false
  if (playing.value)
    hideTimer = setTimeout(() => { controlsVisible.value = false }, 1000)
}

watch(() => props.src, () => {
  playing.value = false
  currentTime.value = 0
  duration.value = 0
  controlsVisible.value = true
  showSpeedMenu.value = false
  clearTimeout(hideTimer)
})

watch(playing, (p) => {
  clearTimeout(hideTimer)
  if (p) hideTimer = setTimeout(() => { controlsVisible.value = false }, 2500)
  else controlsVisible.value = true
})

onMounted(() => {
  const handler = () => { isFullscreen.value = !!document.fullscreenElement }
  document.addEventListener('fullscreenchange', handler)
  onUnmounted(() => document.removeEventListener('fullscreenchange', handler))
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden bg-black"
    @mousemove="showTemporarily"
    @mouseleave="onLeave"
    @touchstart.passive="showTemporarily"
  >
    <video
      ref="videoRef"
      :src="src"
      :preload="preload"
      :class="isFullscreen ? 'w-full h-full object-contain' : videoClass"
      playsinline
      @click="togglePlay"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoaded"
      @durationchange="onDurationChange"
      @canplay="tryGetDuration"
      @play="playing = true"
      @pause="playing = false"
    />

    <!-- Center play button -->
    <div
      v-if="!playing && duration > 0"
      class="absolute inset-0 flex items-center justify-center cursor-pointer"
      @click="togglePlay"
    >
      <div class="w-14 h-14 rounded-full bg-black/50 backdrop-blur-xs flex items-center justify-center">
        <svg class="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>

    <!-- Controls bar -->
    <div
      class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-8 px-3 pb-2 transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      @click.stop
    >
      <!-- Progress bar -->
      <div
        class="group/prog relative h-1 hover:h-1.5 bg-white/25 rounded-full cursor-pointer mb-2 transition-all"
        @mousedown="startSeeking"
        @touchstart.prevent="startSeeking"
      >
        <div
          class="absolute left-0 top-0 h-full bg-white rounded-full pointer-events-none"
          :style="{ width: progressPct + '%' }"
        />
        <div
          class="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-sm opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
          :style="{ left: progressPct + '%', transform: 'translate(-50%, -50%)' }"
        />
      </div>

      <!-- Bottom row -->
      <div class="flex items-center gap-3 text-white">
        <!-- Play / Pause -->
        <button @click="togglePlay" class="shrink-0 hover:text-gray-300 transition-colors">
          <svg v-if="playing" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <!-- Time -->
        <span class="text-xs tabular-nums select-none whitespace-nowrap">
          {{ fmt(currentTime) }} / {{ fmt(duration) }}
        </span>

        <div class="flex-1" />

        <!-- Playback speed -->
        <div class="relative">
          <button @click="showSpeedMenu = !showSpeedMenu" class="shrink-0 hover:text-gray-300 transition-colors text-xs font-semibold tabular-nums min-w-[2rem] text-center">
            {{ playbackRate === 1 ? '1x' : playbackRate + 'x' }}
          </button>
          <Transition
            enter-active-class="transition duration-150"
            enter-from-class="opacity-0 scale-95"
            leave-active-class="transition duration-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div v-if="showSpeedMenu" class="absolute bottom-full mb-2 right-1/2 translate-x-1/2 bg-gray-900/95 backdrop-blur-sm rounded-lg py-1 shadow-lg min-w-[4rem]">
              <button
                v-for="s in speedOptions" :key="s"
                @click="setSpeed(s)"
                class="block w-full px-3 py-1 text-xs text-center hover:bg-white/15 transition-colors"
                :class="playbackRate === s ? 'text-sky-400 font-bold' : 'text-white'"
              >
                {{ s }}x
              </button>
            </div>
          </Transition>
        </div>

        <!-- PiP -->
        <button @click="togglePiP" class="shrink-0 hover:text-gray-300 transition-colors" title="Picture-in-Picture">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" />
          </svg>
        </button>

        <!-- Download -->
        <button @click="downloadVideo" class="shrink-0 hover:text-gray-300 transition-colors" title="Download">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        </button>

        <!-- Volume -->
        <div class="flex items-center gap-1 group/vol">
          <button @click="toggleMute" class="shrink-0 hover:text-gray-300 transition-colors">
            <svg v-if="muted || volume === 0" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
            <svg v-else-if="volume < 0.5" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </button>
          <input
            type="range"
            min="0" max="1" step="0.01"
            :value="effectiveVolume"
            @input="setVolume"
            class="video-vol-slider"
          />
        </div>

        <!-- Fullscreen -->
        <button @click="toggleFullscreen" class="shrink-0 hover:text-gray-300 transition-colors">
          <svg v-if="!isFullscreen" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-vol-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  outline: none;
  width: 0;
  opacity: 0;
  transition: width 0.2s, opacity 0.2s;
}
.group\/vol:hover .video-vol-slider {
  width: 64px;
  opacity: 1;
}
.video-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
}
.video-vol-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  border: none;
  cursor: pointer;
}
.video-vol-slider::-moz-range-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}
</style>
