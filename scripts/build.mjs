import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'

const suppressedMessages = [
  '[plugin @tailwindcss/vite:generate:build] Sourcemap is likely to be incorrect',
  'Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.',
  '[Sentry] Warning: The Sentry SDK detected a Vercel build.',
]

function isSuppressed(line) {
  return suppressedMessages.some(message => line.includes(message))
}

function pipeFiltered(stream, writer) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  rl.on('line', (line) => {
    if (!isSuppressed(line)) {
      writer(line)
    }
  })
}

const nuxtEntrypoint = resolve(process.cwd(), 'node_modules', 'nuxt', 'dist', 'index.mjs')
const child = spawn(process.execPath, [nuxtEntrypoint, 'build'], {
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
})

pipeFiltered(child.stdout, line => process.stdout.write(`${line}\n`))
pipeFiltered(child.stderr, line => process.stderr.write(`${line}\n`))

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})