'use client'

import {
  buildModelCatalogue,
  FROZEN_MODEL_SENTENCE,
  type ModelCatalogue,
  type ModelCatalogueEntry,
} from '@synawood/creative/model-profiles'

type ModelCatalogueContentProps = {
  catalogue?: ModelCatalogue
  highlightId?: string | null
}

const ModelCatalogueRow = ({
  entry,
  highlighted,
}: {
  entry: ModelCatalogueEntry
  highlighted: boolean
}) => {
  const frozen = entry.status === 'frozen'
  return (
    <article
      className={[
        'model-catalogue-row',
        frozen ? 'is-frozen' : '',
        highlighted ? 'is-highlighted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-disabled={frozen || undefined}
    >
      <div className="model-catalogue-row-head">
        <h3 className="model-catalogue-name">{entry.label}</h3>
        <span
          className={frozen ? 'model-catalogue-badge is-frozen' : 'model-catalogue-badge is-live'}
        >
          {frozen ? 'Frozen' : 'Live'}
        </span>
      </div>
      <p className="model-catalogue-use-when">{entry.useWhen}</p>
      <p className="model-catalogue-meta">{entry.meta}</p>
      {frozen ? <p className="model-catalogue-frozen-copy">{FROZEN_MODEL_SENTENCE}</p> : null}
    </article>
  )
}

export const ModelCatalogueContent = ({
  catalogue = buildModelCatalogue(),
  highlightId,
}: ModelCatalogueContentProps) => (
  <div className="model-catalogue">
    <p className="model-catalogue-intro">{catalogue.intro}</p>
    {catalogue.sections.map((section) => (
      <section key={section.role} className="model-catalogue-section" aria-label={section.title}>
        <h2 className="model-catalogue-section-title">{section.title}</h2>
        <div className="model-catalogue-rows">
          {section.entries.map((entry) => (
            <ModelCatalogueRow
              key={`${section.role}-${entry.id}`}
              entry={entry}
              highlighted={Boolean(highlightId && highlightId === entry.id)}
            />
          ))}
        </div>
      </section>
    ))}
  </div>
)
