'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AddFromUrlDialog } from './AddFromUrlDialog'
import { AssetLibrary, type GalleryAsset } from './AssetLibrary'
import { IndexingProgressChip } from './IndexingProgressChip'
import { PaneCollapseControl } from './PaneChrome'
import { StoryBuilder } from './StoryBuilder'
import { TextBinPresets } from './TextBinPresets'
import { CaptionsBin } from './CaptionsBin'
import { ExtractsBin } from './ExtractsBin'
import { ArtefactsBin } from './ArtefactsBin'
import { StickersBin } from './StickersBin'
import { FiltersBin } from './FiltersBin'
import { EffectsBin } from './EffectsBin'
import { SoundsPack } from './SoundsPack'
import type { SfxPackId } from '@synawood/creative/audio'
import type { PlaceAssetOptions } from './story-preview-helpers'
import type { CaptionStyleId, TextPreset } from '@synawood/creative/overlays'
import type { ClipTreatment } from '@synawood/creative/project/schema'
import type { TreatmentId } from '@synawood/creative/effects/treatments'
import type { MotionPresetId } from '@synawood/creative/effects'
import type { GenerationPlanStatus } from '@synawood/creative/generation-plan/schema'

export const BIN_TABS = [
  { id: 'media', label: 'Media' },
  { id: 'audio', label: 'Audio' },
  { id: 'text', label: 'Text' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'effects', label: 'Effects' },
  { id: 'captions', label: 'Captions' },
  { id: 'filters', label: 'Filters' },
] as const

export type BinTabId = (typeof BIN_TABS)[number]['id']
export type MediaBinMode = 'library' | 'story' | 'extracts' | 'artefacts'

type AssetBinProps = {
  projectId: string
  productId: string
  assets: GalleryAsset[]
  revision: number
  pending: boolean
  timelineDragDisabled: boolean
  dragOver: boolean
  onDragStateChange: (over: boolean) => void
  onDropFiles: (files: FileList) => void
  onUpload: (files: FileList | null) => void
  /** Add image from HTTPS URL (#108). Throws on failure for dialog inline error. */
  onAddFromUrl?: (url: string) => Promise<void>
  onRemoved: () => void
  onRemoveAsset: (assetId: string) => Promise<void>
  onRenameAsset?: (assetId: string, name: string) => Promise<void>
  onPlaceAsset: (assetId: string, options?: PlaceAssetOptions) => Promise<void>
  onPlaceExtract: (extractId: string) => Promise<void>
  onEnsureAsset?: (assetId: string) => Promise<GalleryAsset>
  onReferenceAsset: (token: string) => void
  onTranscribeAsset?: (prompt: string) => void
  onCollapse?: () => void
  onOpenMusic?: () => void
  onOpenVoice?: () => void
  planStatus?: GenerationPlanStatus | null
  onOpenPlan?: () => void
  stylePackId?: string | null
  stylePackBusy?: boolean
  onSetStylePack?: (packId: string | null) => Promise<void>
  onPlaceTextPreset?: (preset: TextPreset) => void
  captions?: {
    selectedClipId: string | null
    transcribeBusy: boolean
    line: string
    onLineChange: (value: string) => void
    onTypeLine: () => void
    onFromTranscript: (confirmSpend: boolean) => void
    spendPrompt: string | null
    onDismissSpend: () => void
    styleId: CaptionStyleId
    onStyleId: (id: CaptionStyleId) => void
    highlightsOn?: boolean
    marksOn?: boolean
    hasCaptions?: boolean
    onToggleHighlights?: (on: boolean) => void
    onToggleMarks?: (on: boolean) => void
  }
  stickerBusy?: boolean
  onPlaceSticker?: (stickerId: string) => void
  sfxBusy?: boolean
  onPlaceSfx?: (packId: SfxPackId) => void
  confirmSpend?: boolean
  filterSelectedClipId?: string | null
  clipFilterId?: string | null
  onApplyClipFilter?: (clipId: string, packId: string | null) => Promise<void>
  clipTreatments?: ClipTreatment[]
  onApplyEffect?: (clipId: string, effectId: TreatmentId, intensity: number) => Promise<void>
  onClearEffect?: (clipId: string, effectId: TreatmentId) => Promise<void>
  onRegenEffect?: (clipId: string, effectId: TreatmentId) => Promise<void>
  onApplyMotionPreset?: (clipId: string, presetId: MotionPresetId) => Promise<void>
  /** Product-page extract in flight — Media bin switches to Extracts. */
  extractInFlight?: boolean
}

const libraryAssets = (assets: GalleryAsset[], tab: BinTabId): GalleryAsset[] => {
  const visible = assets.filter(
    (asset) => asset.source !== 'brand_kit' && asset.probe?.role !== 'sticker',
  )
  if (tab === 'audio') return visible.filter((asset) => asset.kind === 'audio')
  return visible
}

export const AssetBin = ({
  projectId,
  productId,
  assets,
  revision,
  pending,
  timelineDragDisabled,
  dragOver,
  onDragStateChange,
  onDropFiles,
  onUpload,
  onAddFromUrl,
  onRemoved,
  onRemoveAsset,
  onRenameAsset,
  onPlaceAsset,
  onPlaceExtract,
  onEnsureAsset,
  onReferenceAsset,
  onTranscribeAsset,
  onCollapse,
  onOpenMusic,
  onOpenVoice,
  planStatus = null,
  onOpenPlan,
  stylePackId = null,
  stylePackBusy = false,
  onSetStylePack,
  onPlaceTextPreset,
  captions,
  stickerBusy = false,
  onPlaceSticker,
  sfxBusy = false,
  onPlaceSfx,
  confirmSpend = false,
  filterSelectedClipId = null,
  clipFilterId = null,
  onApplyClipFilter,
  clipTreatments = [],
  onApplyEffect,
  onClearEffect,
  onRegenEffect,
  onApplyMotionPreset,
  extractInFlight = false,
}: AssetBinProps) => {
  const [tab, setTab] = useState<BinTabId>('media')
  const [mediaMode, setMediaMode] = useState<MediaBinMode>('library')
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const showLibrary = tab === 'media' || tab === 'audio'
  const storyMode = tab === 'media' && mediaMode === 'story'
  const extractsMode = tab === 'media' && mediaMode === 'extracts'
  const artefactsMode = tab === 'media' && mediaMode === 'artefacts'
  const filtered = libraryAssets(assets, tab)

  useEffect(() => {
    if (!extractInFlight) return
    setTab('media')
    setMediaMode('extracts')
  }, [extractInFlight])

  return (
    <section className="asset-bin" aria-label="Media and assets">
      <div className="asset-bin-top">
        <nav className="asset-bin-tabs" aria-label="Asset categories">
          {BIN_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'asset-bin-tab is-active' : 'asset-bin-tab'}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {onCollapse ? (
          <PaneCollapseControl title="Hide media bin" onClick={onCollapse} glyph="‹" />
        ) : null}
      </div>

      {tab === 'text' ? (
        <TextBinPresets
          disabled={pending || timelineDragDisabled || !onPlaceTextPreset}
          onPlace={(preset) => onPlaceTextPreset?.(preset)}
        />
      ) : tab === 'captions' ? (
        <CaptionsBin
          disabled={pending || timelineDragDisabled}
          selectedClipId={captions?.selectedClipId ?? null}
          transcribeBusy={captions?.transcribeBusy ?? false}
          line={captions?.line ?? ''}
          onLineChange={(value) => captions?.onLineChange(value)}
          onTypeLine={() => captions?.onTypeLine()}
          onFromTranscript={(confirmSpend) => captions?.onFromTranscript(confirmSpend)}
          spendPrompt={captions?.spendPrompt ?? null}
          onDismissSpend={() => captions?.onDismissSpend()}
          styleId={captions?.styleId ?? 'band'}
          onStyleId={(id) => captions?.onStyleId(id)}
          highlightsOn={captions?.highlightsOn ?? false}
          marksOn={captions?.marksOn ?? false}
          hasCaptions={captions?.hasCaptions ?? false}
          onToggleHighlights={captions?.onToggleHighlights}
          onToggleMarks={captions?.onToggleMarks}
        />
      ) : tab === 'stickers' ? (
        <StickersBin
          projectId={projectId}
          disabled={pending || timelineDragDisabled || !onPlaceSticker}
          busy={stickerBusy}
          confirmSpend={confirmSpend}
          onPlace={(stickerId) => onPlaceSticker?.(stickerId)}
        />
      ) : tab === 'effects' ? (
        <EffectsBin
          projectId={projectId}
          disabled={pending || timelineDragDisabled || !onApplyEffect}
          selectedClipId={filterSelectedClipId}
          treatments={clipTreatments}
          onApply={(effectId, intensity) => {
            if (!filterSelectedClipId || !onApplyEffect) return Promise.resolve()
            return onApplyEffect(filterSelectedClipId, effectId, intensity)
          }}
          onClear={(effectId) => {
            if (!filterSelectedClipId || !onClearEffect) return Promise.resolve()
            return onClearEffect(filterSelectedClipId, effectId)
          }}
          onRegen={
            filterSelectedClipId && onRegenEffect
              ? (effectId) => onRegenEffect(filterSelectedClipId, effectId)
              : undefined
          }
          onApplyMotionPreset={
            filterSelectedClipId && onApplyMotionPreset
              ? (presetId) => onApplyMotionPreset(filterSelectedClipId, presetId)
              : undefined
          }
        />
      ) : tab === 'filters' ? (
        <FiltersBin
          projectId={projectId}
          disabled={pending || !onSetStylePack}
          busy={stylePackBusy}
          scope={filterSelectedClipId ? 'clip' : 'cut'}
          activePackId={filterSelectedClipId ? (clipFilterId ?? stylePackId) : stylePackId}
          onApply={(packId) => {
            if (filterSelectedClipId && onApplyClipFilter) {
              return onApplyClipFilter(filterSelectedClipId, packId)
            }
            return onSetStylePack?.(packId) ?? Promise.resolve()
          }}
        />
      ) : showLibrary ? (
        <div
          className={dragOver ? 'asset-bin-body is-dragover' : 'asset-bin-body'}
          onDragOver={(event) => {
            event.preventDefault()
            onDragStateChange(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            onDragStateChange(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            onDragStateChange(false)
            if (event.dataTransfer.files.length) onDropFiles(event.dataTransfer.files)
          }}
        >
          <IndexingProgressChip productId={productId} projectId={projectId} revision={revision} />

          {tab === 'media' ? (
            <div
              className={
                storyMode
                  ? 'asset-bin-mode is-story is-four-col'
                  : extractsMode
                    ? 'asset-bin-mode is-extracts is-four-col'
                    : artefactsMode
                      ? 'asset-bin-mode is-artefacts is-four-col'
                      : 'asset-bin-mode is-four-col'
              }
              role="tablist"
              aria-label="Media bin mode"
            >
              <button
                type="button"
                role="tab"
                id="asset-bin-mode-library"
                aria-controls="asset-bin-mode-panel"
                aria-selected={mediaMode === 'library'}
                className={
                  mediaMode === 'library' ? 'asset-bin-mode-btn is-active' : 'asset-bin-mode-btn'
                }
                onClick={() => setMediaMode('library')}
              >
                Library
              </button>
              <button
                type="button"
                role="tab"
                id="asset-bin-mode-story"
                aria-controls="asset-bin-mode-panel"
                aria-selected={mediaMode === 'story'}
                className={
                  mediaMode === 'story' ? 'asset-bin-mode-btn is-active' : 'asset-bin-mode-btn'
                }
                onClick={() => setMediaMode('story')}
              >
                Story
              </button>
              <button
                type="button"
                role="tab"
                id="asset-bin-mode-extracts"
                aria-controls="asset-bin-mode-panel"
                aria-selected={mediaMode === 'extracts'}
                className={
                  mediaMode === 'extracts' ? 'asset-bin-mode-btn is-active' : 'asset-bin-mode-btn'
                }
                onClick={() => setMediaMode('extracts')}
              >
                Extracts
              </button>
              <button
                type="button"
                role="tab"
                id="asset-bin-mode-artefacts"
                aria-controls="asset-bin-mode-panel"
                aria-selected={mediaMode === 'artefacts'}
                className={
                  mediaMode === 'artefacts' ? 'asset-bin-mode-btn is-active' : 'asset-bin-mode-btn'
                }
                onClick={() => setMediaMode('artefacts')}
              >
                Artefacts
              </button>
            </div>
          ) : null}

          <div
            id="asset-bin-mode-panel"
            role="tabpanel"
            aria-labelledby={
              storyMode
                ? 'asset-bin-mode-story'
                : extractsMode
                  ? 'asset-bin-mode-extracts'
                  : artefactsMode
                    ? 'asset-bin-mode-artefacts'
                    : 'asset-bin-mode-library'
            }
          >
            {extractsMode ? (
              <ExtractsBin
                productId={productId}
                placementDisabled={timelineDragDisabled}
                onPlaceExtract={onPlaceExtract}
              />
            ) : artefactsMode ? (
              <ArtefactsBin productId={productId} planStatus={planStatus} onOpenPlan={onOpenPlan} />
            ) : storyMode ? (
              <StoryBuilder
                productId={productId}
                projectId={projectId}
                assets={filtered}
                placementDisabled={timelineDragDisabled}
                onPlaceAsset={onPlaceAsset}
                onEnsureAsset={onEnsureAsset}
                onReferenceAsset={onReferenceAsset}
              />
            ) : (
              <>
                <div className="asset-bin-ingest-row">
                  <label className="upload-action asset-bin-upload">
                    <span className="asset-bin-upload-icon" aria-hidden>
                      +
                    </span>
                    <span className="upload-action-text">
                      {pending
                        ? 'Uploading…'
                        : tab === 'audio'
                          ? 'Drop audio here or browse'
                          : 'Drop media here or browse'}
                    </span>
                    <input
                      id="studio-media-upload"
                      type="file"
                      accept={
                        tab === 'audio'
                          ? 'audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac'
                          : 'video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,image/png,image/jpeg,image/webp'
                      }
                      disabled={pending}
                      onChange={(event) => onUpload(event.target.files)}
                    />
                  </label>
                  {tab === 'media' && onAddFromUrl ? (
                    <button
                      type="button"
                      className="btn btn-ghost asset-bin-url-btn"
                      disabled={pending}
                      onClick={() => setUrlDialogOpen(true)}
                    >
                      Add from URL
                    </button>
                  ) : null}
                  {tab === 'audio' && onOpenMusic ? (
                    <button
                      type="button"
                      className="btn btn-ghost asset-bin-url-btn"
                      disabled={pending}
                      onClick={onOpenMusic}
                    >
                      Generate music bed
                    </button>
                  ) : null}
                  {tab === 'audio' && onOpenVoice ? (
                    <button
                      type="button"
                      className="btn btn-ghost asset-bin-url-btn"
                      disabled={pending}
                      onClick={onOpenVoice}
                    >
                      Voice Studio
                    </button>
                  ) : null}
                </div>
                {tab === 'audio' && onPlaceSfx ? (
                  <SoundsPack
                    disabled={pending || timelineDragDisabled}
                    busy={sfxBusy}
                    onPlace={onPlaceSfx}
                  />
                ) : null}
                {tab === 'audio' && filtered.length === 0 ? (
                  <p className="muted asset-bin-empty-hint">
                    No audio yet. Upload MP3/WAV, open Voice Studio, or use Generate music bed.{' '}
                    <Link href="/settings/voice">Voice profiles</Link> live in Settings.
                  </p>
                ) : null}
                <AssetLibrary
                  projectId={projectId}
                  assets={filtered}
                  revision={revision}
                  disabled={pending}
                  dragDisabled={timelineDragDisabled}
                  placementDisabled={timelineDragDisabled}
                  onRemoved={onRemoved}
                  onRemoveAsset={onRemoveAsset}
                  onRenameAsset={onRenameAsset}
                  onPlaceAsset={onPlaceAsset}
                  onReferenceAsset={onReferenceAsset}
                  onTranscribeAsset={onTranscribeAsset}
                />
                {onAddFromUrl ? (
                  <AddFromUrlDialog
                    open={urlDialogOpen}
                    pending={pending}
                    onClose={() => setUrlDialogOpen(false)}
                    onSubmit={onAddFromUrl}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
