'use client'

import { StudioSelect, type StudioSelectOption } from '../StudioSelect'

export type SpendScopeOption = StudioSelectOption

type SpendScopeSelectProps = {
  label: string
  value: string
  options: SpendScopeOption[]
  onChange: (value: string) => void
}

/** Usage page scope control — shared StudioSelect chrome. */
export const SpendScopeSelect = ({ label, value, options, onChange }: SpendScopeSelectProps) => (
  <StudioSelect
    className="spend-scope"
    label={label}
    value={value}
    options={options}
    onChange={onChange}
    placement="down"
    size="default"
  />
)
