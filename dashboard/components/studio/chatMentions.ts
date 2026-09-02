import {
  assetLabel,
  assetTokenFor,
  type AssetRefLike,
} from '@synawood/creative/project/asset-token'
import {
  sceneLabel,
  sceneTokenFor,
  type SceneRefLike,
} from '@synawood/creative/project/scene-token'
import {
  slideLabel,
  slideTokenFor,
  type SlideRefLike,
} from '@synawood/creative/project/slide-token'

export type MentionItem =
  | { kind: 'asset'; asset: AssetRefLike; token: string; label: string; meta: string }
  | { kind: 'slide'; slide: SlideRefLike; token: string; label: string; meta: string }
  | { kind: 'scene'; scene: SceneRefLike; token: string; label: string; meta: string }

export type MentionCategoryId = 'images' | 'videos' | 'audio' | 'other' | 'slides' | 'scenes'

export type MentionCategory = {
  id: MentionCategoryId
  label: string
}

export type MentionRow =
  | { type: 'item'; key: string; item: MentionItem }
  | { type: 'category'; key: string; category: MentionCategory; count: number }
  | { type: 'back'; key: string }

const CATEGORIES: MentionCategory[] = [
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'other', label: 'Other media' },
  { id: 'slides', label: 'Slides' },
  { id: 'scenes', label: 'Scenes' },
]

const kindMeta = (kind: string): string => {
  switch (kind) {
    case 'image':
      return 'Image'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Audio'
    default:
      return 'Media'
  }
}

const categoryForAsset = (kind: string): MentionCategoryId => {
  if (kind === 'image') return 'images'
  if (kind === 'video') return 'videos'
  if (kind === 'audio') return 'audio'
  return 'other'
}

const matchesQuery = (haystacks: string[], query: string): boolean => {
  if (!query) return true
  const needle = query.toLowerCase()
  return haystacks.some((value) => value.toLowerCase().includes(needle))
}

export const mentionQueryAt = (
  value: string,
  cursor: number,
): { start: number; query: string } | null => {
  const before = value.slice(0, cursor)
  const match = before.match(/(^|[\s([{])@([^\s@]*)$/)
  if (!match) return null
  return { start: before.length - match[2].length - 1, query: match[2] }
}

const collectItems = (
  assets: AssetRefLike[],
  slides: SlideRefLike[],
  scenes: SceneRefLike[],
  query: string,
): MentionItem[] => {
  const raw = query.toLowerCase()
  const prefix = raw.match(/^(asset|image|video|audio|slide|scene)s?:(.*)$/)
  const typed = prefix?.[1]
  const needle = (prefix ? prefix[2] : raw).trim()

  const items: MentionItem[] = []

  if (!typed || typed === 'asset' || typed === 'image' || typed === 'video' || typed === 'audio') {
    for (const asset of assets) {
      const cat = categoryForAsset(asset.kind)
      if (typed === 'image' && cat !== 'images') continue
      if (typed === 'video' && cat !== 'videos') continue
      if (typed === 'audio' && cat !== 'audio') continue
      if (
        matchesQuery(
          [assetLabel(asset), assetTokenFor(asset), asset.kind, asset.id, asset.blobKey ?? ''],
          needle,
        )
      ) {
        items.push({
          kind: 'asset',
          asset,
          token: assetTokenFor(asset),
          label: assetLabel(asset),
          meta: kindMeta(asset.kind),
        })
      }
    }
  }

  if (!typed || typed === 'slide') {
    for (const slide of slides) {
      if (
        matchesQuery(
          [slideLabel(slide), slideTokenFor(slide), slide.id, String(slide.order + 1)],
          needle,
        )
      ) {
        items.push({
          kind: 'slide',
          slide,
          token: slideTokenFor(slide),
          label: slideLabel(slide),
          meta: 'Slide',
        })
      }
    }
  }

  if (!typed || typed === 'scene') {
    for (const scene of scenes) {
      if (
        matchesQuery(
          [sceneLabel(scene), sceneTokenFor(scene), scene.role, scene.label, scene.id],
          needle,
        )
      ) {
        items.push({
          kind: 'scene',
          scene,
          token: sceneTokenFor(scene),
          label: sceneLabel(scene),
          meta: 'Scene',
        })
      }
    }
  }

  return items
}

const itemsInCategory = (items: MentionItem[], categoryId: MentionCategoryId): MentionItem[] =>
  items.filter((item) => {
    if (categoryId === 'slides') return item.kind === 'slide'
    if (categoryId === 'scenes') return item.kind === 'scene'
    if (item.kind !== 'asset') return false
    return categoryForAsset(item.asset.kind) === categoryId
  })

/** Build Cursor-style rows: named matches first, then category browse rows. */
export const buildMentionRows = (input: {
  assets: AssetRefLike[]
  slides: SlideRefLike[]
  scenes: SceneRefLike[]
  query: string
  browse: MentionCategoryId | null
}): MentionRow[] => {
  const all = collectItems(input.assets, input.slides, input.scenes, input.query)
  const rows: MentionRow[] = []

  if (input.browse) {
    rows.push({ type: 'back', key: 'back' })
    const category = CATEGORIES.find((item) => item.id === input.browse)
    const scoped = itemsInCategory(all, input.browse)
    for (const item of scoped.slice(0, 24)) {
      rows.push({ type: 'item', key: `${item.kind}:${item.token}`, item })
    }
    if (scoped.length === 0 && category) {
      // keep back only — empty category
    }
    return rows
  }

  for (const item of all.slice(0, 8)) {
    rows.push({ type: 'item', key: `${item.kind}:${item.token}`, item })
  }

  // Category sections (only when non-empty), Cursor-style after the flat list.
  for (const category of CATEGORIES) {
    const count = itemsInCategory(all, category.id).length
    if (count === 0) continue
    rows.push({
      type: 'category',
      key: `cat:${category.id}`,
      category,
      count,
    })
  }

  return rows
}

export const mentionHintFor = (input: { hasSlides: boolean; hasScenes: boolean }): string => {
  if (input.hasSlides && input.hasScenes) {
    return 'Describe the edit. Type @ to mention a media asset, slide, or scene.'
  }
  if (input.hasScenes) {
    return 'Describe the edit. Type @ to mention a media asset or scene.'
  }
  if (input.hasSlides) {
    return 'Describe the edit. Type @ to mention a slide or asset.'
  }
  return 'Describe the edit. Type @ to mention an asset.'
}
