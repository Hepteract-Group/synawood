'use client'

import Link from 'next/link'
import { FormEvent, useId, useState } from 'react'
import {
  PROFILE_INTENTS,
  PROFILE_JOBS,
  type ProfileIntent,
  type ProfileJob,
} from '../../../lib/user-profile'
import { PRODUCT_MARK, PRODUCT_NAME } from '../../../lib/product-name'

const JOB_LABELS: Record<ProfileJob, string> = {
  founder: 'Founder',
  marketer: 'Marketer',
  editor: 'Editor',
  other: 'Other',
}

const INTENT_LABELS: Record<ProfileIntent, string> = {
  make_ads: 'Make ads',
  run_gtm: 'Run go-to-market',
  exploring: 'Exploring',
}

export const ProfileOnboardingForm = () => {
  const nameId = useId()
  const errorId = useId()
  const [displayName, setDisplayName] = useState('')
  const [jobTitle, setJobTitle] = useState<ProfileJob | ''>('')
  const [intent, setIntent] = useState<ProfileIntent | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'save' | 'skip' | null>(null)

  const submit = async (skip: boolean) => {
    setError(null)
    setPending(skip ? 'skip' : 'save')
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          skip
            ? { skip: true }
            : {
                displayName,
                jobTitle: jobTitle || null,
                intent: intent || null,
              },
        ),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(body?.error ?? 'Could not save. Try again.')
      }
      window.location.assign('/home')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
      setPending(null)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(false)
  }

  return (
    <div className="auth-shell">
      <a href="#auth-main" className="skip-link">
        Skip to about you
      </a>
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark" aria-hidden>
          {PRODUCT_MARK}
        </span>
        <span>{PRODUCT_NAME}</span>
      </Link>
      <section id="auth-main" className="auth-panel" aria-labelledby="profile-title">
        <p className="auth-step">Step 1 of 2</p>
        <h1 id="profile-title">About you</h1>
        <p className="auth-lede">Optional. Takes under a minute. You can skip.</p>
        <form className="auth-form" onSubmit={onSubmit} aria-busy={pending !== null}>
          <label htmlFor={nameId}>
            Name
            <input
              id={nameId}
              name="displayName"
              autoComplete="name"
              placeholder="What should we call you?"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              disabled={pending !== null}
            />
          </label>
          <fieldset disabled={pending !== null}>
            <legend>What you do</legend>
            <div className="auth-choice-row" role="radiogroup" aria-label="What you do">
              {PROFILE_JOBS.map((job) => (
                <label key={job} className={`auth-choice${jobTitle === job ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="jobTitle"
                    value={job}
                    checked={jobTitle === job}
                    onChange={() => setJobTitle(job)}
                  />
                  {JOB_LABELS[job]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={pending !== null}>
            <legend>Why you are here</legend>
            <div className="auth-choice-row" role="radiogroup" aria-label="Why you are here">
              {PROFILE_INTENTS.map((value) => (
                <label
                  key={value}
                  className={`auth-choice${intent === value ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="intent"
                    value={value}
                    checked={intent === value}
                    onChange={() => setIntent(value)}
                  />
                  {INTENT_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? (
            <p className="auth-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
          <div className="auth-actions">
            <button
              type="submit"
              className="auth-submit"
              disabled={pending !== null}
              aria-busy={pending === 'save'}
            >
              {pending === 'save' ? 'Saving…' : 'Continue'}
            </button>
            <button
              type="button"
              className="auth-text-btn"
              disabled={pending !== null}
              aria-busy={pending === 'skip'}
              onClick={() => void submit(true)}
            >
              {pending === 'skip' ? 'Skipping…' : 'Skip for now'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
