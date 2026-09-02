'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { StudioProject } from '@synawood/creative/project/schema'
import { formatProjectMoney } from '@synawood/creative/locale/money'
import type { MissingTranslationChip } from '@synawood/creative/locale'

export const STUDIO_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'ar', label: 'العربية' },
  { code: 'he', label: 'עברית' },
] as const

const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD'] as const
const CHIP_PREVIEW_LIMIT = 8

type LocaleAction = 'set' | 'translate' | 'dub' | 'money'

type LocaleActionFields = {
  locale?: string
  currency?: string
  amountMinor?: number
  applyToCta?: boolean
  applyToPreview?: boolean
}

type LocaleActionRequest = LocaleActionFields & {
  projectId: string
  expectedRevision: number
  action: LocaleAction
  confirmSpend?: boolean
}

export const requestProjectLocale = async (
  input: LocaleActionRequest,
): Promise<{ project?: StudioProject; error?: string; status: number }> => {
  const response = await fetch(`/api/studio/projects/${input.projectId}/locale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: input.expectedRevision,
      action: input.action,
      confirmSpend: input.confirmSpend,
      locale: input.locale,
      currency: input.currency,
      amountMinor: input.amountMinor,
      applyToCta: input.applyToCta,
      applyToPreview: input.applyToPreview,
    }),
  })
  const body = (await response.json()) as { project?: StudioProject; error?: string }
  return { project: body.project, error: body.error, status: response.status }
}

type UseLocaleProjectActionsInput = {
  projectId: string
  project: StudioProject | null
  confirmSpend: boolean
  disabled?: boolean
  onProjectChanged: (project: StudioProject) => void
  onError: (message: string) => void
  onRevisionConflict?: () => Promise<void>
}

export const useLocaleProjectActions = ({
  projectId,
  project,
  confirmSpend,
  disabled = false,
  onProjectChanged,
  onError,
  onRevisionConflict,
}: UseLocaleProjectActionsInput) => {
  const [busy, setBusy] = useState(false)
  const inflight = useRef(false)

  const run = useCallback(
    async (action: LocaleAction, extra: LocaleActionFields = {}) => {
      if (!project || inflight.current || disabled) return false
      inflight.current = true
      setBusy(true)
      try {
        const body = await requestProjectLocale({
          projectId,
          expectedRevision: project.revision,
          action,
          confirmSpend,
          ...extra,
        })
        if (body.status >= 400 || !body.project) {
          if (body.status === 409 && onRevisionConflict) {
            await onRevisionConflict()
          }
          onError(body.error ?? 'Locale update failed')
          return false
        }
        onProjectChanged(body.project)
        return true
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Locale update failed')
        return false
      } finally {
        inflight.current = false
        setBusy(false)
      }
    },
    [confirmSpend, disabled, onError, onProjectChanged, onRevisionConflict, project, projectId],
  )

  return { busy, run }
}

type LocaleSwitcherProps = {
  project: StudioProject
  disabled?: boolean
  busy: boolean
  onError: (message: string) => void
  onAction: (action: LocaleAction, extra?: LocaleActionFields) => Promise<boolean>
}

const localeLabel = (code: string): string =>
  STUDIO_LOCALES.find((item) => item.code === code)?.label ?? code

export const LocaleSwitcher = ({
  project,
  disabled = false,
  busy,
  onError,
  onAction,
}: LocaleSwitcherProps) => {
  const selectId = useId()
  const moneyId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const localization = project.localization
  const [moneyOpen, setMoneyOpen] = useState(false)
  const [currency, setCurrency] = useState(localization.money?.currency ?? 'GBP')
  const [amountMajor, setAmountMajor] = useState(
    localization.money?.amountMinor != null
      ? (localization.money.amountMinor / 100).toFixed(2)
      : '',
  )

  useEffect(() => {
    setCurrency(localization.money?.currency ?? 'GBP')
    setAmountMajor(
      localization.money?.amountMinor != null
        ? (localization.money.amountMinor / 100).toFixed(2)
        : '',
    )
  }, [localization.money?.amountMinor, localization.money?.currency])

  useEffect(() => {
    if (!moneyOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoneyOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMoneyOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [moneyOpen])

  const locales = useMemo(() => {
    const listed = localization.locales.length ? localization.locales : ['en']
    const extra = STUDIO_LOCALES.map((item) => item.code).filter((code) => !listed.includes(code))
    return { listed, extra }
  }, [localization.locales])

  const moneyPreview = formatProjectMoney(
    {
      currency,
      amountMinor: amountMajor.trim() ? Math.round(Number(amountMajor) * 100) : undefined,
    },
    localization.activeLocale,
  )

  return (
    <div className="studio-locale-switcher" ref={rootRef}>
      <label className="studio-locale-switcher-field" htmlFor={selectId}>
        <span className="sr-only">Locale</span>
        <select
          id={selectId}
          value={localization.activeLocale}
          disabled={disabled || busy}
          aria-label="Active locale"
          title="Preview copy in this language. Missing strings stay in the default locale."
          onChange={(event) => void onAction('set', { locale: event.target.value })}
        >
          {locales.listed.map((code) => (
            <option key={code} value={code}>
              {localeLabel(code)}
            </option>
          ))}
          {locales.extra.length > 0 ? (
            <optgroup label="Add language">
              {locales.extra.map((code) => (
                <option key={code} value={code}>
                  {localeLabel(code)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
      <button
        type="button"
        className="studio-brand-chip"
        aria-expanded={moneyOpen}
        aria-controls={moneyId}
        disabled={disabled || busy}
        title="Price shown on the call to action"
        onClick={() => setMoneyOpen((open) => !open)}
      >
        {localization.money?.amountMinor != null
          ? (formatProjectMoney(localization.money, localization.activeLocale) ?? 'Price')
          : 'Price'}
      </button>
      {moneyOpen ? (
        <form
          id={moneyId}
          className="studio-locale-money"
          onSubmit={(event) => {
            event.preventDefault()
            const amountMinor = amountMajor.trim()
              ? Math.round(Number(amountMajor) * 100)
              : undefined
            if (amountMinor != null && !Number.isFinite(amountMinor)) {
              onError('Enter a valid price')
              return
            }
            void onAction('money', { currency, amountMinor, applyToCta: true }).then((ok) => {
              if (ok) setMoneyOpen(false)
            })
          }}
        >
          <label>
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount
            <input
              type="text"
              inputMode="decimal"
              placeholder="12.99"
              value={amountMajor}
              onChange={(event) => setAmountMajor(event.target.value)}
            />
          </label>
          {moneyPreview ? <p className="muted">{moneyPreview} on the CTA</p> : null}
          <button type="submit" disabled={busy}>
            Apply price
          </button>
        </form>
      ) : null}
    </div>
  )
}

type LocaleBannerProps = {
  chips: MissingTranslationChip[]
  fontWarning: string | null
  confirmSpend: boolean
  busy?: boolean
  onTranslate: () => void
  onDub: () => void
}

export const LocaleMissingBanner = ({
  chips,
  fontWarning,
  confirmSpend,
  busy = false,
  onTranslate,
  onDub,
}: LocaleBannerProps) => {
  if (chips.length === 0 && !fontWarning) return null
  const preview = chips.slice(0, CHIP_PREVIEW_LIMIT)
  const extra = chips.length - preview.length
  return (
    <div
      className="studio-locale-banner"
      role="region"
      aria-busy={busy}
      aria-label="Locale copy status"
    >
      <div className="studio-locale-banner-copy">
        {chips.length > 0 ? (
          <>
            <p>
              <strong>
                {chips.length} string{chips.length === 1 ? '' : 's'} still in the default language.
              </strong>{' '}
              Preview uses English fallback until you translate. Approve is not blocked.
            </p>
            <ul className="studio-locale-chips">
              {preview.map((chip) => (
                <li key={chip.key}>
                  <span className="studio-locale-chip-key">{chip.key}</span>
                  {chip.source}
                </li>
              ))}
              {extra > 0 ? <li className="is-more">+{extra} more</li> : null}
            </ul>
            {busy ? (
              <p aria-live="polite">
                <strong>Updating locale…</strong> Translate and Dub stay paused until this finishes.
                The banner remains if you leave the price popover.
              </p>
            ) : null}
          </>
        ) : null}
        {fontWarning ? <p>{fontWarning}</p> : null}
        {chips.length > 0 && !confirmSpend ? (
          <p className="muted">
            Tick Confirm spend in chat before Translate or Dub on a live model. v1 still uses the
            stub translator.
          </p>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="studio-locale-banner-actions">
          <button type="button" disabled={busy} onClick={onTranslate}>
            {busy ? 'Working…' : 'Translate missing'}
          </button>
          <button type="button" disabled={busy} onClick={onDub}>
            {busy ? 'Working…' : 'Dub as branch'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
