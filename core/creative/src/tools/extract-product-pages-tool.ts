import { enqueueProductExtractJob } from '../extract/enqueue-product-extract-job'
import { publicHttpUrlsFromText } from '../extract/urls-from-text'
import { toolFail, toolOk, type StudioToolContext, type ToolOutcome } from './types'

export const MISSING_EXTRACT_MESSAGE =
  'No extract was queued. This reasoner did not call extract_product_pages, so the Extracts bin is unchanged. Switch Reasoner (GPT or Gemini) and ask again — or retry this one.'

export const urlsForExtractProductPages = (input: {
  urls?: string[]
  url?: string
  userMessage?: string
}): string[] => {
  const fromArgs = [...(input.urls ?? []), ...(input.url ? [input.url] : [])]
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (fromArgs.length > 0) return [...new Set(fromArgs)]
  return publicHttpUrlsFromText(input.userMessage ?? '')
}

export const runExtractProductPagesTool = async (
  ctx: StudioToolContext,
  input: { urls?: string[]; url?: string; confirmSpend?: boolean },
): Promise<ToolOutcome> => {
  const urls = urlsForExtractProductPages({
    urls: input.urls,
    url: input.url,
    userMessage: ctx.userMessage,
  })
  if (urls.length === 0) {
    return toolFail(
      'Need at least one public URL to extract. Paste https://… in chat or pass urls.',
    )
  }
  if (ctx.persist === false) {
    return toolOk(`Would extract ${urls.length} page(s) into the Extracts bin (in-memory)`, {
      urls,
      jobId: null,
    })
  }
  const result = await enqueueProductExtractJob({
    supabase: ctx.supabase,
    productId: ctx.productId,
    projectId: ctx.projectId,
    urls,
    modelProfileId: ctx.modelProfileId,
    confirmSpend: Boolean(input.confirmSpend || ctx.confirmSpend),
  })
  return toolOk(
    `Queued extract of ${result.urls.length} page(s) into the Extracts bin (£${result.estimatedGbp.toFixed(2)}). Watch the banner under the player. If stills never appear, run: npm run extract:local -- --job ${result.job.id}`,
    {
      jobId: result.job.id,
      estimatedGbp: result.estimatedGbp,
      urls: result.urls,
      workerHint: `npm run extract:local -- --job ${result.job.id}`,
    },
  )
}
