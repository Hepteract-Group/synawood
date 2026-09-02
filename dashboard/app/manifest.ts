import type { MetadataRoute } from 'next'
import { buildWebManifest } from '@/lib/web-manifest'

export default function manifest(): MetadataRoute.Manifest {
  return buildWebManifest()
}
