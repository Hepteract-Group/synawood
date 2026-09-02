'use client'

import { FormEvent, ReactNode } from 'react'
import {
  DNA_FIELD_HINTS,
  DNA_FIELD_LABELS,
  type BrandDna,
  type DnaFieldKey,
} from '@synawood/creative/brand/dna'

export type DnaSection = 'overview' | 'business'

type BrandDnaFormProps = {
  dna: BrandDna
  onChange: (next: BrandDna) => void
  section: DnaSection
  onSection: (section: DnaSection) => void
  busy: boolean
  onSave: (event: FormEvent) => void
  onReset: () => void
}

const fieldId = (field: DnaFieldKey): string => `dna-${field.replace(/\./g, '-')}`

const setLocked = (dna: BrandDna, field: DnaFieldKey, locked: boolean): BrandDna => ({
  ...dna,
  lockedFields: locked
    ? [...new Set([...dna.lockedFields, field])]
    : dna.lockedFields.filter((key) => key !== field),
})

const linesFromText = (value: string): string[] =>
  value
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)

const DnaField = ({
  field,
  dna,
  onChange,
  recommended,
  optional,
  children,
}: {
  field: DnaFieldKey
  dna: BrandDna
  onChange: (next: BrandDna) => void
  recommended?: boolean
  optional?: boolean
  children: ReactNode
}) => {
  const id = fieldId(field)
  const hintId = `${id}-hint`
  const locked = dna.lockedFields.includes(field)
  return (
    <div className={recommended ? 'dna-field is-essential' : 'dna-field'}>
      <div className="dna-field-head">
        <label htmlFor={id}>
          {DNA_FIELD_LABELS[field]}
          {recommended ? <span className="dna-flag">useful for ads</span> : null}
          {optional ? <span className="dna-flag is-muted">optional</span> : null}
        </label>
        <button
          type="button"
          className={locked ? 'dna-protect is-on' : 'dna-protect'}
          aria-pressed={locked}
          title="Stop website import from overwriting this field"
          onClick={() => onChange(setLocked(dna, field, !locked))}
        >
          {locked ? 'Protected' : 'Protect'}
        </button>
      </div>
      <p className="dna-hint" id={hintId}>
        {DNA_FIELD_HINTS[field]}
      </p>
      {children}
    </div>
  )
}

const BriefPreview = ({ dna, section }: { dna: BrandDna; section: DnaSection }) => {
  if (section === 'business') {
    const name = dna.business.legalName.trim()
    const website = dna.business.url.trim()
    const category = dna.business.category.trim()
    const language = dna.business.locale.trim()
    const empty = !name && !website
    return (
      <aside className="dna-brief" aria-label="How the company will read">
        <p className="dna-brief-kicker">Company at a glance</p>
        {empty ? (
          <p className="dna-brief-empty">
            Add a website and legal name. Fetching copy from a page uses the website.
          </p>
        ) : (
          <>
            {name ? <p className="dna-brief-tagline">{name}</p> : null}
            {website ? (
              <div className="dna-brief-block">
                <p className="dna-brief-label">Website</p>
                <p>{website}</p>
              </div>
            ) : null}
            {category ? (
              <div className="dna-brief-block">
                <p className="dna-brief-label">Category</p>
                <p>{category}</p>
              </div>
            ) : null}
            {language ? (
              <div className="dna-brief-block">
                <p className="dna-brief-label">Language and region</p>
                <p>{language}</p>
              </div>
            ) : null}
          </>
        )}
      </aside>
    )
  }

  const tagline = dna.tagline.trim()
  const who = dna.icp.trim()
  const offer = dna.offer.trim()
  const empty = !tagline && !who && !offer
  return (
    <aside className="dna-brief" aria-label="How ads will read this copy">
      <p className="dna-brief-kicker">How ads will read this</p>
      {empty ? (
        <p className="dna-brief-empty">
          Add a tagline and who it is for. Studio uses this copy in ads.
        </p>
      ) : (
        <>
          {tagline ? <p className="dna-brief-tagline">{tagline}</p> : null}
          {who ? (
            <div className="dna-brief-block">
              <p className="dna-brief-label">Who it is for</p>
              <p>{who}</p>
            </div>
          ) : null}
          {offer ? (
            <div className="dna-brief-block">
              <p className="dna-brief-label">Offer</p>
              <p>{offer}</p>
            </div>
          ) : null}
        </>
      )}
    </aside>
  )
}

export const BrandDnaForm = ({
  dna,
  onChange,
  section,
  onSection,
  busy,
  onSave,
  onReset,
}: BrandDnaFormProps) => {
  const optionalCopyCount = dna.values.length + dna.proofPoints.length
  const locale = dna.business.locale.trim()
  const optionalCompanyCount =
    Number(Boolean(dna.business.category.trim())) + Number(Boolean(locale) && locale !== 'en')

  return (
    <div className="dna-desk">
      <div className="dna-desk-main">
        <div className="dna-desk-intro">
          <h2 className="dna-desk-title">Brand copy</h2>
          <p className="dna-desk-lede">
            Brand DNA is this product&apos;s copy. Fill the first two fields on Overview, or the
            website on Business. Everything else can stay empty.
          </p>
        </div>
        <div className="packs-tabs dna-tabs" role="tablist" aria-label="Brand copy sections">
          <button
            type="button"
            role="tab"
            aria-selected={section === 'overview'}
            aria-controls="dna-panel-overview"
            id="dna-tab-overview"
            className={section === 'overview' ? 'packs-tab is-active' : 'packs-tab'}
            onClick={() => onSection('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === 'business'}
            aria-controls="dna-panel-business"
            id="dna-tab-business"
            className={section === 'business' ? 'packs-tab is-active' : 'packs-tab'}
            onClick={() => onSection('business')}
          >
            Business
          </button>
        </div>
        <p className="dna-tab-note">
          {section === 'overview'
            ? 'Product copy. Tagline and who it is for are enough to start.'
            : 'Company details. Website is the field used when fetching a public page.'}
        </p>
        <form onSubmit={onSave} className="dna-form" aria-busy={Boolean(busy)}>
          <div
            role="tabpanel"
            id="dna-panel-overview"
            aria-labelledby="dna-tab-overview"
            hidden={section !== 'overview'}
          >
            <DnaField field="tagline" dna={dna} onChange={onChange} recommended>
              <input
                id={fieldId('tagline')}
                value={dna.tagline}
                aria-describedby={`${fieldId('tagline')}-hint`}
                onChange={(event) => onChange({ ...dna, tagline: event.target.value })}
              />
            </DnaField>
            <DnaField field="icp" dna={dna} onChange={onChange} recommended>
              <textarea
                id={fieldId('icp')}
                rows={4}
                value={dna.icp}
                aria-describedby={`${fieldId('icp')}-hint`}
                onChange={(event) => onChange({ ...dna, icp: event.target.value })}
              />
            </DnaField>
            <DnaField field="offer" dna={dna} onChange={onChange} optional>
              <textarea
                id={fieldId('offer')}
                rows={3}
                value={dna.offer}
                aria-describedby={`${fieldId('offer')}-hint`}
                onChange={(event) => onChange({ ...dna, offer: event.target.value })}
              />
            </DnaField>
            <details className="dna-more">
              <summary>
                Values and proof
                {optionalCopyCount > 0 ? (
                  <span className="dna-flag is-muted">{optionalCopyCount} filled</span>
                ) : null}
              </summary>
              <DnaField field="values" dna={dna} onChange={onChange} optional>
                <textarea
                  id={fieldId('values')}
                  rows={3}
                  value={dna.values.join('\n')}
                  aria-describedby={`${fieldId('values')}-hint`}
                  onChange={(event) =>
                    onChange({ ...dna, values: linesFromText(event.target.value) })
                  }
                />
              </DnaField>
              <DnaField field="proofPoints" dna={dna} onChange={onChange} optional>
                <textarea
                  id={fieldId('proofPoints')}
                  rows={3}
                  value={dna.proofPoints.join('\n')}
                  aria-describedby={`${fieldId('proofPoints')}-hint`}
                  onChange={(event) =>
                    onChange({ ...dna, proofPoints: linesFromText(event.target.value) })
                  }
                />
              </DnaField>
            </details>
          </div>
          <div
            role="tabpanel"
            id="dna-panel-business"
            aria-labelledby="dna-tab-business"
            hidden={section !== 'business'}
          >
            <DnaField field="business.url" dna={dna} onChange={onChange} recommended>
              <input
                id={fieldId('business.url')}
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                placeholder="Paste a public homepage"
                value={dna.business.url}
                aria-describedby={`${fieldId('business.url')}-hint`}
                onChange={(event) =>
                  onChange({
                    ...dna,
                    business: { ...dna.business, url: event.target.value },
                  })
                }
              />
            </DnaField>
            <DnaField field="business.legalName" dna={dna} onChange={onChange} optional>
              <input
                id={fieldId('business.legalName')}
                value={dna.business.legalName}
                aria-describedby={`${fieldId('business.legalName')}-hint`}
                onChange={(event) =>
                  onChange({
                    ...dna,
                    business: { ...dna.business, legalName: event.target.value },
                  })
                }
              />
            </DnaField>
            <details className="dna-more">
              <summary>
                Optional company details
                {optionalCompanyCount > 0 ? (
                  <span className="dna-flag is-muted">{optionalCompanyCount} filled</span>
                ) : null}
              </summary>
              <DnaField field="business.category" dna={dna} onChange={onChange} optional>
                <input
                  id={fieldId('business.category')}
                  value={dna.business.category}
                  aria-describedby={`${fieldId('business.category')}-hint`}
                  onChange={(event) =>
                    onChange({
                      ...dna,
                      business: { ...dna.business, category: event.target.value },
                    })
                  }
                />
              </DnaField>
              <DnaField field="business.locale" dna={dna} onChange={onChange} optional>
                <input
                  id={fieldId('business.locale')}
                  value={dna.business.locale}
                  placeholder="en"
                  aria-describedby={`${fieldId('business.locale')}-hint`}
                  onChange={(event) =>
                    onChange({
                      ...dna,
                      business: { ...dna.business, locale: event.target.value },
                    })
                  }
                />
              </DnaField>
            </details>
          </div>
          <div className="dna-save">
            <button type="submit" className="btn btn-primary" disabled={Boolean(busy)}>
              Save brand copy
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={Boolean(busy)}
              onClick={onReset}
            >
              Reset to kit
            </button>
            <p className="dna-save-note">Nothing here is required. Empty fields stay empty.</p>
          </div>
        </form>
      </div>
      <BriefPreview dna={dna} section={section} />
    </div>
  )
}
