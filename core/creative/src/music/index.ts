export {
  isMockMusicLicense,
  isMusicLicensePublishable,
  musicGenerationFromRow,
  musicGenerationSchema,
  musicLicenseStatusSchema,
  musicLicenseTierSchema,
  musicProviderSchema,
  parseMusicGeneration,
  type MusicGeneration,
  type MusicLicenseStatus,
  type MusicLicenseTier,
  type MusicProvider,
} from './schema'
export {
  DEFAULT_MUSIC_STYLE,
  loadMusicStyle,
  mergeMusicPrompt,
  musicStyleSchema,
  toMusicPromptBlock,
  type MusicStyle,
} from './style'
export { insertMusicGeneration, listMusicGenerationsForProject } from './persist'
export { assertProjectMusicLicensesPublishable } from './license-gate'
export { estimateMusicGbp, generateMusicForProject } from './generate'
