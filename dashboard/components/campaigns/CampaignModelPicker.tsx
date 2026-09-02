'use client'

import {
  DEFAULT_CAMPAIGN_MODEL_PROFILE_ID,
  listCampaignImageProfiles,
} from '@synawood/creative/model-profiles'

type Props = {
  value: string
  disabled?: boolean
  onChange: (profileId: string) => void
  /** When set, persist via profile API after local onChange. */
  projectId?: string
  onPersisted?: (profileId: string) => void
  onError?: (message: string) => void
}

const OPTIONS = listCampaignImageProfiles()

export const CampaignModelPicker = ({
  value,
  disabled,
  onChange,
  projectId,
  onPersisted,
  onError,
}: Props) => {
  const safeValue = OPTIONS.some((option) => option.id === value)
    ? value
    : DEFAULT_CAMPAIGN_MODEL_PROFILE_ID

  const apply = async (profileId: string) => {
    onChange(profileId)
    if (!projectId) return
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })
      const body = (await response.json()) as { modelProfileId?: string; error?: string }
      if (!response.ok || !body.modelProfileId) {
        throw new Error(body.error ?? 'Could not switch model profile')
      }
      onPersisted?.(body.modelProfileId)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not switch model profile')
    }
  }

  return (
    <label className="campaigns-field">
      <span>Image model</span>
      <select
        value={safeValue}
        disabled={disabled}
        onChange={(event) => void apply(event.target.value)}
      >
        {OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="muted campaigns-model-hint">
        Draft is cheaper stills. Best quality costs more.
      </span>
    </label>
  )
}
