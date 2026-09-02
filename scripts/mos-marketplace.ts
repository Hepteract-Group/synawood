#!/usr/bin/env node
/**
 * mos-marketplace CLI (#290) — build / sign / verify agent pack artifacts.
 *
 * Usage (from repo root):
 *   npx tsx scripts/mos-marketplace.ts pack build <pack-dir> [--out path]
 *   npx tsx scripts/mos-marketplace.ts pack sign <artifact.json> --key <private.pem>
 *   npx tsx scripts/mos-marketplace.ts pack verify <artifact.json> [--key <public.pem>] [--sig <b64>]
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildUnsignedLocalArtifact,
  decodePackArtifact,
  packManifestSchema,
  sha256Hex,
  signPackChecksum,
  verifyPackSignature,
  type PackArtifactFileMap,
} from '../core/creative/src/packs'

const usage = () => {
  console.error(`Usage:
  npx tsx scripts/mos-marketplace.ts pack build <pack-dir> [--out <file>]
  npx tsx scripts/mos-marketplace.ts pack sign <artifact.json> --key <private.pem> [--out <sig.txt>]
  npx tsx scripts/mos-marketplace.ts pack verify <artifact.json> [--key <public.pem>] [--sig <b64|file>]`)
  process.exit(1)
}

const readArg = (argv: string[], flag: string): string | undefined => {
  const idx = argv.indexOf(flag)
  if (idx === -1) return undefined
  return argv[idx + 1]
}

const collectFiles = (root: string, relative = ''): PackArtifactFileMap => {
  const abs = path.join(root, relative)
  const entries = readdirSync(abs)
  const files: PackArtifactFileMap = {}
  for (const name of entries) {
    if (name === 'pack.json' || name.startsWith('.')) continue
    const childRel = relative ? `${relative}/${name}` : name
    const childAbs = path.join(root, childRel)
    if (statSync(childAbs).isDirectory()) {
      Object.assign(files, collectFiles(root, childRel))
    } else {
      files[childRel.replaceAll('\\', '/')] = readFileSync(childAbs, 'utf8')
    }
  }
  return files
}

const cmdBuild = (argv: string[]) => {
  const dir = argv[0]
  if (!dir) usage()
  const packDir = path.resolve(dir)
  const manifestPath = path.join(packDir, 'pack.json')
  const manifest = packManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const files = collectFiles(packDir)
  for (const entry of manifest.entries) {
    if (!(entry in files)) {
      throw new Error(`Manifest entry missing from pack dir: ${entry}`)
    }
  }
  const { bytes, checksumSha256 } = buildUnsignedLocalArtifact(manifest, files)
  const out =
    readArg(argv, '--out') ??
    path.join(packDir, `${manifest.slug}-${manifest.semver}.pack.json`)
  mkdirSync(path.dirname(out), { recursive: true })
  writeFileSync(out, bytes)
  console.log(
    JSON.stringify(
      {
        out,
        checksumSha256,
        slug: manifest.slug,
        semver: manifest.semver,
        bytes: bytes.length,
      },
      null,
      2,
    ),
  )
}

const cmdSign = (argv: string[]) => {
  const artifactPath = argv[0]
  const keyPath = readArg(argv, '--key')
  if (!artifactPath || !keyPath) usage()
  const bytes = readFileSync(path.resolve(artifactPath))
  const envelope = decodePackArtifact(bytes)
  const checksum = sha256Hex(bytes)
  const privateKeyPem = readFileSync(path.resolve(keyPath), 'utf8')
  const signature = signPackChecksum({
    checksumSha256: checksum,
    semver: envelope.manifest.semver,
    privateKeyPem,
  })
  const out = readArg(argv, '--out')
  if (out) {
    writeFileSync(path.resolve(out), signature)
  }
  console.log(JSON.stringify({ checksumSha256: checksum, signature }, null, 2))
}

const cmdVerify = (argv: string[]) => {
  const artifactPath = argv[0]
  if (!artifactPath) usage()
  const bytes = readFileSync(path.resolve(artifactPath))
  const envelope = decodePackArtifact(bytes)
  const checksum = sha256Hex(bytes)
  const keyPath = readArg(argv, '--key')
  const sigArg = readArg(argv, '--sig')
  if (!keyPath || !sigArg) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'checksum-only',
          checksumSha256: checksum,
          slug: envelope.manifest.slug,
          semver: envelope.manifest.semver,
        },
        null,
        2,
      ),
    )
    return
  }
  let signature = sigArg
  try {
    if (statSync(sigArg).isFile()) {
      signature = readFileSync(sigArg, 'utf8').trim()
    }
  } catch {
    // treat as raw base64
  }
  const publicKeyPem = readFileSync(path.resolve(keyPath), 'utf8')
  const ok = verifyPackSignature({
    checksumSha256: checksum,
    semver: envelope.manifest.semver,
    signatureBase64: signature,
    publicKeyPem,
  })
  if (!ok) {
    console.error(JSON.stringify({ ok: false, checksumSha256: checksum }, null, 2))
    process.exit(2)
  }
  console.log(
    JSON.stringify(
      { ok: true, checksumSha256: checksum, slug: envelope.manifest.slug, semver: envelope.manifest.semver },
      null,
      2,
    ),
  )
}

const main = () => {
  const [, , domain, action, ...rest] = process.argv
  if (domain !== 'pack' || !action) usage()
  if (action === 'build') return cmdBuild(rest)
  if (action === 'sign') return cmdSign(rest)
  if (action === 'verify') return cmdVerify(rest)
  usage()
}

main()
