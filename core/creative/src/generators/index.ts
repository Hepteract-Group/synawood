export { generateImage, isMultimodalImageLlm } from './image'
export {
  generateVideoClip,
  isStubVideoModelId,
  withReferenceImageTags,
  withVideoReferenceTags,
} from './video-clip'
export type { GatewayVideoClient, GatewayVideoReference } from './video-clip'
export { preflightVideoGenerate } from './video-preflight'
export { generateSpeech } from './tts'
export { generateMusic, isStubMusicModelId } from './music'
export { transcribeMedia } from './transcribe'
export { assertGeneratedAssetQc } from './qc'
export type {
  AssetRef,
  GenerateImageInput,
  GenerateMusicInput,
  GenerateSpeechInput,
  GenerateVideoInput,
  TranscribeInput,
  TranscribeResult,
} from './types'
export type { GenerateMusicResult, MusicLicenseMeta } from './music'
