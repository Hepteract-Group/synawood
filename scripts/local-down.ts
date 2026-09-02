#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const run = (args: string[]) => {
  spawnSync('docker', args, { stdio: 'inherit', cwd: root })
}

run(['compose', '-f', 'compose.yaml', 'down'])
run([
  'compose',
  '-f',
  'infra/postiz/docker-compose.yaml',
  '-f',
  'infra/postiz/docker-compose.synawood.yaml',
  'down',
])
spawnSync('npx', ['supabase', 'stop'], { stdio: 'inherit', cwd: root })
