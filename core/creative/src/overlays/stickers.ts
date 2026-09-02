export type FirstPartySticker = {
  id: string
  label: string
  license: 'first-party'
  svg: string
}

export const STICKER_PRESET_MIME = 'application/x-mos-sticker-id'

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">${body}</svg>`

const mark = (id: string, label: string, body: string): FirstPartySticker => ({
  id,
  label,
  license: 'first-party',
  svg: svg(body),
})

export const FIRST_PARTY_STICKERS: readonly FirstPartySticker[] = [
  mark(
    'arrow-right',
    'Arrow',
    '<path d="M12 32h32" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round"/><path d="M34 18l16 14-16 14" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  mark('circle', 'Circle', '<circle cx="32" cy="32" r="18" stroke="#c45c26" stroke-width="6"/>'),
  mark(
    'check',
    'Check',
    '<circle cx="32" cy="32" r="22" fill="#1f6b4a"/><path d="M20 33l8 8 16-18" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  mark(
    'badge-new',
    'New',
    '<rect x="6" y="18" width="52" height="28" rx="8" fill="#c45c26"/><text x="32" y="38" text-anchor="middle" font-size="16" font-family="system-ui,sans-serif" fill="#f4f1ea">NEW</text>',
  ),
  mark(
    'star',
    'Star',
    '<path d="M32 10l5.4 14.2H52l-11.8 8.8 4.4 14.6L32 39.2 19.4 47.6l4.4-14.6L12 24.2h14.6z" fill="#e8c547"/>',
  ),
  mark(
    'heart',
    'Heart',
    '<path d="M32 50s-18-11.4-18-24c0-7 5.4-12 12-12 3.8 0 6 2.2 6 2.2S34.2 14 38 14c6.6 0 12 5 12 12 0 12.6-18 24-18 24z" fill="#c45c26"/>',
  ),
  mark(
    'burst',
    'Burst',
    '<path d="M32 8l4 14 14-4-4 14 14 4-14 4 4 14-14-4-4 14-4-14-14 4 4-14-14-4 14-4-4-14 14 4z" fill="#e8c547"/>',
  ),
  mark(
    'spark',
    'Spark',
    '<path d="M32 6v16M32 42v16M6 32h16M42 32h16M14 14l11 11M39 39l11 11M50 14L39 25M25 39L14 50" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"/>',
  ),
  mark(
    'x-mark',
    'X',
    '<path d="M18 18l28 28M46 18L18 46" stroke="#c45c26" stroke-width="7" stroke-linecap="round"/>',
  ),
  mark(
    'plus',
    'Plus',
    '<path d="M32 14v36M14 32h36" stroke="#f4f1ea" stroke-width="7" stroke-linecap="round"/>',
  ),
  mark(
    'sparkle',
    'Sparkle',
    '<path d="M32 8l4 16 16 4-16 4-4 16-4-16-16-4 16-4z" fill="#f4f1ea"/>',
  ),
  mark('bolt', 'Bolt', '<path d="M36 8L16 36h14L28 56l20-28H34z" fill="#e8c547"/>'),
  mark(
    'pin',
    'Pin',
    '<path d="M32 8c8 0 14 6.4 14 14.4 0 10.4-14 29.6-14 29.6S18 32.8 18 22.4C18 14.4 24 8 32 8z" fill="#c45c26"/><circle cx="32" cy="22" r="6" fill="#f4f1ea"/>',
  ),
  mark(
    'flag',
    'Flag',
    '<path d="M18 10v44" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"/><path d="M20 12h28l-8 10 8 10H20z" fill="#c45c26"/>',
  ),
  mark(
    'tag',
    'Tag',
    '<path d="M12 32l20-20h20v20L32 52z" fill="#3d6b8f"/><circle cx="42" cy="22" r="4" fill="#f4f1ea"/>',
  ),
  mark(
    'badge-sale',
    'Sale',
    '<rect x="6" y="18" width="52" height="28" rx="8" fill="#1f6b4a"/><text x="32" y="38" text-anchor="middle" font-size="14" font-family="system-ui,sans-serif" fill="#f4f1ea">SALE</text>',
  ),
  mark(
    'badge-wow',
    'Wow',
    '<rect x="6" y="18" width="52" height="28" rx="8" fill="#3d6b8f"/><text x="32" y="38" text-anchor="middle" font-size="16" font-family="system-ui,sans-serif" fill="#f4f1ea">WOW</text>',
  ),
  mark(
    'badge-yes',
    'Yes',
    '<rect x="6" y="18" width="52" height="28" rx="8" fill="#1f6b4a"/><text x="32" y="38" text-anchor="middle" font-size="16" font-family="system-ui,sans-serif" fill="#f4f1ea">YES</text>',
  ),
  mark(
    'badge-no',
    'No',
    '<rect x="6" y="18" width="52" height="28" rx="8" fill="#8a3030"/><text x="32" y="38" text-anchor="middle" font-size="16" font-family="system-ui,sans-serif" fill="#f4f1ea">NO</text>',
  ),
  mark(
    'play',
    'Play',
    '<circle cx="32" cy="32" r="22" fill="#c45c26"/><path d="M26 20l20 12-20 12z" fill="#f4f1ea"/>',
  ),
  mark(
    'quote',
    'Quote',
    '<path d="M16 40c0-10 6-16 14-16v8c-4 0-6 2-6 8h10v16H16V40zm18 0c0-10 6-16 14-16v8c-4 0-6 2-6 8h10v16H34V40z" fill="#f4f1ea"/>',
  ),
  mark(
    'target',
    'Target',
    '<circle cx="32" cy="32" r="20" stroke="#c45c26" stroke-width="4"/><circle cx="32" cy="32" r="12" stroke="#f4f1ea" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="#c45c26"/>',
  ),
  mark(
    'ribbon',
    'Ribbon',
    '<path d="M18 14h28l-6 16 10 20H14l10-20z" fill="#c45c26"/><path d="M24 30h16" stroke="#f4f1ea" stroke-width="4"/>',
  ),
  mark(
    'fire',
    'Fire',
    '<path d="M32 10s8 10 8 18c0 8-4 16-8 16s-8-8-8-16c0-8 8-18 8-18z" fill="#c45c26"/><path d="M32 28c3 4 4 8 4 10 0 4-2 8-4 8s-4-4-4-8c0-2 1-6 4-10z" fill="#e8c547"/>',
  ),
  mark(
    'drop',
    'Drop',
    '<path d="M32 8s16 20 16 32a16 16 0 11-32 0c0-12 16-32 16-32z" fill="#3d6b8f"/>',
  ),
  mark(
    'sun',
    'Sun',
    '<circle cx="32" cy="32" r="10" fill="#e8c547"/><path d="M32 8v8M32 48v8M8 32h8M48 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M20 44l-6 6" stroke="#e8c547" stroke-width="4" stroke-linecap="round"/>',
  ),
  mark('moon', 'Moon', '<path d="M40 12a18 18 0 1010 28A16 16 0 0140 12z" fill="#f4f1ea"/>'),
  mark(
    'hash',
    'Hash',
    '<path d="M24 12l-6 40M46 12l-6 40M12 24h40M10 40h40" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"/>',
  ),
]

export const getFirstPartySticker = (id: string): FirstPartySticker | undefined =>
  FIRST_PARTY_STICKERS.find((sticker) => sticker.id === id)

export const listFirstPartyStickers = (): FirstPartySticker[] => [...FIRST_PARTY_STICKERS]

export const encodeStickerDrag = (stickerId: string): string => stickerId

export const parseStickerDrag = (raw: string): string | null => {
  const id = raw.trim()
  return getFirstPartySticker(id) ? id : null
}

export const stickerDataUrl = (sticker: FirstPartySticker): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker.svg)}`
