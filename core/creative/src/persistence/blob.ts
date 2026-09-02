import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob'
import { buildBlobKey } from './blob-key'

export type BlobEnv = {
  connectionString: string
  containerName: string
  useLocalPrefix: boolean
  accountName: string
  accountKey: string
}

const INCOMPLETE_CONNECTION_HINT =
  'Unset any shell export of AZURE_STORAGE_CONNECTION_STRING (a bare `;` truncates it) so dashboard/.env.local can load, or quote the full connection string.'

export const parseConnectionStringParts = (connectionString: string): Record<string, string> =>
  Object.fromEntries(
    connectionString
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        return idx === -1 ? [part, ''] : [part.slice(0, idx), part.slice(idx + 1)]
      }),
  ) as Record<string, string>

const parseConnectionString = (
  connectionString: string,
  fallbacks?: { accountName?: string; accountKey?: string },
): { accountName: string; accountKey: string } => {
  const parts = parseConnectionStringParts(connectionString)
  const accountName = (parts.AccountName || fallbacks?.accountName || '').trim()
  const accountKey = (parts.AccountKey || fallbacks?.accountKey || '').trim()
  if (!accountName || !accountKey) {
    const keys = Object.keys(parts).join(', ') || '(none)'
    throw new Error(
      `AZURE_STORAGE_CONNECTION_STRING must include AccountName and AccountKey (parsed keys: ${keys}). ${INCOMPLETE_CONNECTION_HINT}`,
    )
  }
  return { accountName, accountKey }
}

/** Ensure Shared Key credentials are present for SAS signing (#479). */
export const resolveBlobConnectionString = (
  env: NodeJS.ProcessEnv = process.env,
): { connectionString: string; accountName: string; accountKey: string } => {
  const raw = env.AZURE_STORAGE_CONNECTION_STRING?.trim()
  if (!raw) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for Blob access')
  }
  const fallbacks = {
    accountName: env.AZURE_STORAGE_ACCOUNT_NAME?.trim(),
    accountKey: env.AZURE_STORAGE_ACCOUNT_KEY?.trim(),
  }
  const { accountName, accountKey } = parseConnectionString(raw, fallbacks)
  const parts = parseConnectionStringParts(raw)
  // Rebuild when the process inherited a truncated shell export but discrete
  // account env vars (or a fuller string after fallback) supply Shared Key.
  if (!parts.AccountName || !parts.AccountKey) {
    return {
      connectionString: `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`,
      accountName,
      accountKey,
    }
  }
  return { connectionString: raw, accountName, accountKey }
}

export const readBlobEnv = (env: NodeJS.ProcessEnv = process.env): BlobEnv => {
  const containerName = env.AZURE_STORAGE_CONTAINER ?? 'marketing-os'
  const { connectionString, accountName, accountKey } = resolveBlobConnectionString(env)
  return {
    connectionString,
    containerName,
    useLocalPrefix: env.AZURE_BLOB_LOCAL_PREFIX !== 'false',
    accountName,
    accountKey,
  }
}

export const createBlobContainerClient = (blobEnv: BlobEnv) => {
  const service = BlobServiceClient.fromConnectionString(blobEnv.connectionString)
  return service.getContainerClient(blobEnv.containerName)
}

export const putBlob = async (input: {
  blobEnv: BlobEnv
  productId: string
  kind: 'uploads' | 'generated' | 'renders' | 'brand-kit' | 'finals' | 'library' | 'extract'
  parts: string[]
  data: Buffer | Uint8Array | string
  contentType?: string
}): Promise<{ blobKey: string }> => {
  const blobKey = buildBlobKey({
    productId: input.productId,
    kind: input.kind,
    parts: input.parts,
    localPrefix: input.blobEnv.useLocalPrefix,
  })
  const container = createBlobContainerClient(input.blobEnv)
  const block = container.getBlockBlobClient(blobKey)
  const body =
    typeof input.data === 'string' ? Buffer.from(input.data, 'utf8') : Buffer.from(input.data)
  await block.uploadData(body, {
    blobHTTPHeaders: input.contentType ? { blobContentType: input.contentType } : undefined,
  })
  return { blobKey }
}

export const getBlobText = async (input: {
  blobEnv: BlobEnv
  blobKey: string
}): Promise<string> => {
  const container = createBlobContainerClient(input.blobEnv)
  const block = container.getBlockBlobClient(input.blobKey)
  const response = await block.download()
  const chunks: Buffer[] = []
  const stream = response.readableStreamBody
  if (!stream) {
    throw new Error(`No body for blob ${input.blobKey}`)
  }
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export const deleteBlob = async (input: { blobEnv: BlobEnv; blobKey: string }): Promise<void> => {
  const container = createBlobContainerClient(input.blobEnv)
  await container.getBlockBlobClient(input.blobKey).deleteIfExists()
}

export const getBlobBytes = async (input: {
  blobEnv: BlobEnv
  blobKey: string
}): Promise<Buffer> => {
  const container = createBlobContainerClient(input.blobEnv)
  const block = container.getBlockBlobClient(input.blobKey)
  const response = await block.download()
  const chunks: Buffer[] = []
  const stream = response.readableStreamBody
  if (!stream) {
    throw new Error(`No body for blob ${input.blobKey}`)
  }
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export const getBlobContentLength = async (input: {
  blobEnv: BlobEnv
  blobKey: string
}): Promise<number> => {
  const container = createBlobContainerClient(input.blobEnv)
  const block = container.getBlockBlobClient(input.blobKey)
  const props = await block.getProperties()
  return props.contentLength ?? 0
}

/** Bounded read for HTTP Range / early video metadata without loading the full file. */
export const getBlobByteRange = async (input: {
  blobEnv: BlobEnv
  blobKey: string
  offset: number
  count: number
  /** Skip an extra getProperties round-trip when the caller already knows size. */
  totalSize?: number
}): Promise<{ bytes: Buffer; totalSize: number }> => {
  const container = createBlobContainerClient(input.blobEnv)
  const block = container.getBlockBlobClient(input.blobKey)
  const totalSize =
    typeof input.totalSize === 'number'
      ? input.totalSize
      : ((await block.getProperties()).contentLength ?? 0)
  const offset = Math.max(0, Math.floor(input.offset))
  const count = Math.max(1, Math.floor(input.count))
  if (totalSize > 0 && offset >= totalSize) {
    return { bytes: Buffer.alloc(0), totalSize }
  }
  const response = await block.download(offset, count)
  const chunks: Buffer[] = []
  const stream = response.readableStreamBody
  if (!stream) {
    throw new Error(`No body for blob ${input.blobKey}`)
  }
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return { bytes: Buffer.concat(chunks), totalSize }
}

export const createSignedBlobUrl = (input: {
  blobEnv: BlobEnv
  blobKey: string
  expiresInSeconds?: number
}): string => {
  const expiresOn = new Date(Date.now() + (input.expiresInSeconds ?? 60 * 60) * 1000)
  const credential = new StorageSharedKeyCredential(
    input.blobEnv.accountName,
    input.blobEnv.accountKey,
  )
  const sas = generateBlobSASQueryParameters(
    {
      containerName: input.blobEnv.containerName,
      blobName: input.blobKey,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    },
    credential,
  ).toString()
  const container = createBlobContainerClient(input.blobEnv)
  return `${container.getBlockBlobClient(input.blobKey).url}?${sas}`
}

export { buildBlobKey }
