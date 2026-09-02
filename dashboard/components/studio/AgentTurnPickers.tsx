'use client'

import { parseTurnMode, TURN_MODE_OPTIONS, type TurnMode } from '@synawood/creative/agent/turn-mode'
import {
  craftFromComposition,
  isVideoSuiteCraftSwitchable,
  parseStudioCraft,
  type CompositionId,
  type StudioCraft,
} from '@synawood/creative/project/client'
import { StudioSelect } from '../StudioSelect'

type AgentTurnPickersProps = {
  turnMode: TurnMode
  onTurnModeChange: (mode: TurnMode) => void
  compositionId?: CompositionId | string | null
  onCraftChange?: (craft: StudioCraft) => void
  disabled?: boolean
}

export const AgentTurnPickers = ({
  turnMode,
  onTurnModeChange,
  compositionId,
  onCraftChange,
  disabled,
}: AgentTurnPickersProps) => {
  const mode = parseTurnMode(turnMode)
  const showCraft = isVideoSuiteCraftSwitchable(compositionId)
  const craft = craftFromComposition(compositionId)

  return (
    <>
      <StudioSelect
        className="model-role"
        label="Mode"
        title="Plan, Ask, Inspect, or Execute"
        description="Plan cannot write the Player. Inspect watches then recommends. Execute makes the ad."
        size="inline"
        placement="up"
        disabled={disabled}
        value={mode}
        options={TURN_MODE_OPTIONS.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        onChange={(next) => onTurnModeChange(parseTurnMode(next))}
      />
      {showCraft && onCraftChange ? (
        <StudioSelect
          className="model-role"
          label="Craft"
          title="Footage cut or motion graphics"
          description="Motion graphics uses Remotion in the Player."
          size="inline"
          placement="up"
          disabled={disabled}
          value={craft}
          options={[
            { value: 'footage', label: 'Footage' },
            { value: 'motion', label: 'Motion graphics' },
          ]}
          onChange={(next) => onCraftChange(parseStudioCraft(next))}
        />
      ) : null}
    </>
  )
}
