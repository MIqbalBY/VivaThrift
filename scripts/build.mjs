import { spawn } from 'node:child_process'
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

const packageManagerEntrypoint = process.env.npm_execpath
const packageManagerCommand = packageManagerEntrypoint
  ? process.execPath
  : process.platform === 'win32'
    ? 'pnpm.cmd'
    : 'pnpm'
const buildArgs = packageManagerEntrypoint
  ? [packageManagerEntrypoint, 'exec', 'nuxt', 'build']
  : ['exec', 'nuxt', 'build']

if (process.env.VERCEL && !process.env.NITRO_PRESET) {
  buildArgs.push('--preset', 'vercel')
}

const child = spawn(packageManagerCommand, buildArgs, {
  cwd: process.cwd(),
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