#!/usr/bin/env node
/**
 * Start local Docker stack: Supabase + Studio dashboard + workers + Postiz
 * on one network (`synawood`). Decoupled from Vercel / Fly / hosted Supabase.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const NETWORK = 'synawood'
const root = process.cwd()

const run = (cmd: string, args: string[], options?: { allowFail?: boolean }) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: root })
  if ((result.status ?? 1) !== 0 && !options?.allowFail) {
    process.exit(result.status ?? 1)
  }
  return result.status ?? 1
}

const networkExists = (): boolean => {
  const result = spawnSync('docker', ['network', 'inspect', NETWORK], { stdio: 'pipe' })
  return result.status === 0
}

const DASHBOARD_CONTAINER = 'synawood-local-dashboard-1'

const dashboardExited = (): boolean => {
  const inspect = spawnSync(
    'docker',
    ['inspect', '-f', '{{.State.Status}}', DASHBOARD_CONTAINER],
    { encoding: 'utf8' },
  )
  return inspect.stdout.trim() === 'exited'
}

const waitUntilDashboardListens = () => {
  for (let i = 0; i < 120; i++) {
    if (dashboardExited()) {
      run('docker', ['compose', '-f', 'compose.yaml', 'logs', 'dashboard'])
      console.error('\nDashboard container exited. Studio is not on http://localhost:3000.\n')
      process.exit(1)
    }
    const curl = spawnSync(
      'curl',
      ['-sS', '-o', '/dev/null', '--connect-timeout', '1', 'http://127.0.0.1:3000/'],
      { stdio: 'pipe' },
    )
    if (curl.status === 0) return
    spawnSync('sleep', ['2'])
  }
  run('docker', ['compose', '-f', 'compose.yaml', 'logs', '--tail', '80', 'dashboard'])
  console.error('\nDashboard did not listen on :3000 in time.\n')
  process.exit(1)
}

const ensurePostizEnv = () => {
  const envPath = path.join(root, 'infra/postiz/.env')
  if (existsSync(envPath)) return
  mkdirSync(path.join(root, 'infra/postiz'), { recursive: true })
  writeFileSync(envPath, `JWT_SECRET=${randomBytes(32).toString('hex')}\n`)
}

if (!networkExists()) {
  run('docker', ['network', 'create', NETWORK])
}

run('npx', ['supabase', 'start', '--network-id', NETWORK])
ensurePostizEnv()
run('docker', [
  'compose',
  '-f',
  'infra/postiz/docker-compose.yaml',
  '-f',
  'infra/postiz/docker-compose.synawood.yaml',
  'up',
  '-d',
])
run('docker', ['compose', '-f', 'compose.yaml', 'up', '-d', '--build'])
waitUntilDashboardListens()

console.log(`
Synawood local stack is up (Docker, not Mac-native Next).

  Studio:   http://localhost:3000
  Supabase: http://localhost:54343
  Postiz:   http://localhost:4007

Stop: npm run local:down
`)
