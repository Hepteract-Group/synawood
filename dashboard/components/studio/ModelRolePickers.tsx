'use client'

import {
  imageOptionsFor,
  profileIdForImage,
  profileIdForVideo,
  reasonerOptionsFor,
  rolesFromProfileId,
  videoOptionsFor,
} from '@synawood/creative/model-profiles'
import { useState, type ReactNode } from 'react'
import { StudioSelect } from '../StudioSelect'

type ModelRoles = {
  modelProfileId: string
  reasonerModelId: string | null
  videoModelId: string | null
}

type ModelRolePickersProps = {
  projectId: string
  modelProfileId: string
  reasonerModelId?: string | null
  videoModelId?: string | null
  disabled?: boolean
  onChanged: (next: ModelRoles) => void
  leading?: ReactNode
}

const persistRoles = async (
  projectId: string,
  input: { profileId?: string; reasonerModelId?: string | null; videoModelId?: string | null },
): Promise<ModelRoles> => {
  const response = await fetch(`/api/studio/projects/${projectId}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await response.json()) as {
    error?: string
    modelProfileId?: string
    reasonerModelId?: string | null
    videoModelId?: string | null
  }
  if (!response.ok || !body.modelProfileId) {
    throw new Error(body.error ?? 'Failed to switch models')
  }
  return {
    modelProfileId: body.modelProfileId,
    reasonerModelId: body.reasonerModelId ?? null,
    videoModelId: body.videoModelId ?? null,
  }
}

const metaFromId = (id: string): string | undefined => {
  if (id === 'mock-reasoner' || id === 'disabled' || id === 'placeholder') return undefined
  const slash = id.indexOf('/')
  return slash > 0 ? id.slice(0, slash) : undefined
}

/**
 * Compact Reasoner / Image / Video selects beside chat Send.
 * Image → model_profile_id; Reason → reasoner_model_id; Video → video_model_id.
 * Catalogue lives on SessionSpend as a single Model choices control (#1328).
 */
export const ModelRolePickers = ({
  projectId,
  modelProfileId,
  reasonerModelId,
  videoModelId,
  disabled,
  onChanged,
  leading,
}: ModelRolePickersProps) => {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const roles = rolesFromProfileId(modelProfileId, reasonerModelId, videoModelId)
  const busy = Boolean(disabled || saving)

  const reasonerOptions = reasonerOptionsFor(roles.reasonerId)
  const imageOptions = imageOptionsFor(roles.imageId)
  const videoOptions = videoOptionsFor(roles.videoId)

  const apply = async (input: {
    profileId?: string
    reasonerModelId?: string | null
    videoModelId?: string | null
  }) => {
    setSaving(true)
    setError(null)
    try {
      onChanged(await persistRoles(projectId, input))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch models')
    } finally {
      setSaving(false)
    }
  }

  const reasonerValue = reasonerOptions.some((option) => option.id === roles.reasonerId)
    ? roles.reasonerId
    : reasonerOptions[0]!.id
  const imageValue = imageOptions.some((option) => option.id === roles.imageId)
    ? roles.imageId
    : imageOptions[0]!.id
  const videoValue = videoOptions.some((option) => option.id === roles.videoId)
    ? roles.videoId
    : videoOptions[0]!.id

  return (
    <div className="model-role-pickers">
      {leading}
      <StudioSelect
        className="model-role"
        label="Reason"
        title="Model used for chat + tool calls"
        description="Drives chat replies and tool calls."
        size="inline"
        placement="up"
        disabled={busy}
        value={reasonerValue}
        options={reasonerOptions.map((option) => ({
          value: option.id,
          label: option.label,
          meta: metaFromId(option.id),
          disabled: option.disabled,
        }))}
        onChange={(next) => void apply({ reasonerModelId: next })}
      />
      <StudioSelect
        className="model-role"
        label="Image"
        title="Model used for generate_image"
        description="Used when the agent generates stills."
        size="inline"
        placement="up"
        disabled={busy}
        value={imageValue}
        options={imageOptions.map((option) => ({
          value: option.id,
          label: option.label,
          meta: metaFromId(option.id),
          disabled: option.disabled,
        }))}
        onChange={(next) => void apply({ profileId: profileIdForImage(next) })}
      />
      <StudioSelect
        className="model-role"
        label="Video"
        title="Model used to generate clips"
        description="Pick a video model. Confirm when the estimate is above £0."
        size="inline"
        placement="up"
        disabled={busy}
        value={videoValue}
        options={videoOptions.map((option) => ({
          value: option.id,
          label: option.label,
          meta: metaFromId(option.id),
          disabled: option.disabled,
        }))}
        onChange={(next) =>
          void apply({
            profileId: profileIdForVideo(next, modelProfileId),
            videoModelId: next === 'disabled' ? null : next,
          })
        }
      />
      {error ? <p className="error model-role-error">{error}</p> : null}
    </div>
  )
}
