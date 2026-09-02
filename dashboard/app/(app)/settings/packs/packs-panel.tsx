'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PackMarkdownPreview } from '@/components/settings/PackMarkdownPreview'
import { readActiveProductIdFromDocument } from '../../../../lib/active-product-cookie'
import { SettingsLocalNav } from '../settings-local-nav'

type PackCatalog = {
  id: string
  slug: string
  kind: 'skill' | 'style'
  title: string
  summary: string
  publisher: string
  status: string
}

type PackVersion = {
  id: string
  packId: string
  semver: string
  manifest: { title?: string; summary?: string }
}

type CatalogListing = { pack: PackCatalog; latestVersion: PackVersion | null }

type InstallRow = {
  install: {
    id: string
    enabled: boolean
    packVersionId: string
    installedAt: string
    productId: string | null
    userId: string | null
  }
  version: PackVersion
  pack: PackCatalog
}

type InstallScope = 'product' | 'account'

type PackPreview = {
  title: string
  entryPath: string
  markdown: string
  kind: 'skill' | 'style'
}

type Tab = 'browse' | 'installed' | 'first-party'

type FirstPartySkill = {
  id: string
  name: string
  description: string
  markdown: string
  source: 'first-party'
  alwaysOn: boolean
  locked: boolean
}

const isMissingPackSchema = (message: string): boolean =>
  /pack_revocations|pack_catalog|pack_installs|pack_versions|schema cache/i.test(message)

const humanizePacksError = (message: string): string => {
  if (isMissingPackSchema(message)) {
    return 'Agent packs are not available yet for this workspace. Try again after setup finishes, or contact your operator.'
  }
  return message
}

const isHepteractPublisher = (publisher: string): boolean =>
  publisher.trim().toLowerCase() === 'hepteract'

export const PacksPanel = () => {
  const [productId, setProductId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('browse')
  const [installScope, setInstallScope] = useState<InstallScope>('product')
  const [skillsShSource, setSkillsShSource] = useState('')
  const [importingSkillsSh, setImportingSkillsSh] = useState(false)
  const [firstParty, setFirstParty] = useState<FirstPartySkill[]>([])
  const [selectedFirstPartyId, setSelectedFirstPartyId] = useState<string | null>(null)
  const [packs, setPacks] = useState<CatalogListing[]>([])
  const [installs, setInstalls] = useState<InstallRow[]>([])
  const [revocations, setRevocations] = useState<Array<{ id: string; reason: string }>>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [preview, setPreview] = useState<PackPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schemaHint, setSchemaHint] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [allowUnsigned, setAllowUnsigned] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const loadBrowse = useCallback(async (id: string) => {
    const response = await fetch(`/api/studio/packs?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as {
      packs?: CatalogListing[]
      allowUnsigned?: boolean
      seededStarters?: boolean
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load marketplace.')
    const nextPacks = body?.packs ?? []
    setPacks(nextPacks)
    setAllowUnsigned(body?.allowUnsigned === true)
    if (body?.seededStarters) {
      setNotice('Hepteract starter packs are ready to install.')
    }
    setSelectedSlug((current) => current ?? nextPacks[0]?.pack.slug ?? null)
  }, [])

  const loadInstalled = useCallback(async (id: string) => {
    const response = await fetch(`/api/studio/packs/installed?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as {
      installs?: InstallRow[]
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load installed packs.')
    setInstalls(body?.installs ?? [])
  }, [])

  const syncRevocations = useCallback(async (id: string) => {
    const syncResponse = await fetch('/api/studio/packs/revocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id }),
    })
    const syncBody = (await syncResponse.json().catch(() => null)) as { error?: string } | null
    if (!syncResponse.ok) {
      const message = syncBody?.error ?? 'Could not sync revocations.'
      if (isMissingPackSchema(message)) {
        setSchemaHint(humanizePacksError(message))
        setRevocations([])
        return
      }
      throw new Error(message)
    }
    const listResponse = await fetch(
      `/api/studio/packs/revocations?productId=${encodeURIComponent(id)}`,
    )
    const listBody = (await listResponse.json().catch(() => null)) as {
      revocations?: Array<{ id: string; reason: string }>
      error?: string
    } | null
    if (!listResponse.ok) {
      const message = listBody?.error ?? 'Could not load revocations.'
      if (isMissingPackSchema(message)) {
        setSchemaHint(humanizePacksError(message))
        setRevocations([])
        return
      }
      throw new Error(message)
    }
    setSchemaHint(null)
    setRevocations(listBody?.revocations ?? [])
  }, [])

  const loadFirstParty = useCallback(async (id: string) => {
    const response = await fetch(`/api/studio/skills?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as {
      skills?: FirstPartySkill[]
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load first-party skills.')
    const next = body?.skills ?? []
    setFirstParty(next)
    setSelectedFirstPartyId((current) => current ?? next[0]?.id ?? null)
  }, [])

  const refresh = useCallback(
    async (id: string) => {
      setError(null)
      await Promise.all([
        loadBrowse(id),
        loadInstalled(id),
        syncRevocations(id),
        loadFirstParty(id),
      ])
    },
    [loadBrowse, loadInstalled, syncRevocations, loadFirstParty],
  )

  useEffect(() => {
    const id = readActiveProductIdFromDocument()
    setProductId(id)
    if (!id) {
      setLoading(false)
      setError('Select or create a Product first.')
      return
    }
    void refresh(id)
      .catch((err) => {
        const raw = err instanceof Error ? err.message : 'Could not load packs.'
        setError(humanizePacksError(raw))
      })
      .finally(() => setLoading(false))
  }, [refresh])

  const selected = packs.find((row) => row.pack.slug === selectedSlug) ?? null

  useEffect(() => {
    if (!productId || !selected?.latestVersion?.id) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    void (async () => {
      try {
        const response = await fetch(
          `/api/studio/packs/versions/${encodeURIComponent(selected.latestVersion!.id)}/content?productId=${encodeURIComponent(productId)}`,
        )
        const body = (await response.json().catch(() => null)) as {
          preview?: PackPreview
          error?: string
        } | null
        if (!response.ok) throw new Error(body?.error ?? 'Could not load pack content.')
        if (!cancelled) setPreview(body?.preview ?? null)
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId, selected?.latestVersion?.id])

  const installedVersionIds = new Set(installs.map((row) => row.install.packVersionId))

  const onSeedStarters = async () => {
    if (!productId) return
    setSeeding(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/packs/starters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not restore starter packs.')
      setNotice('Hepteract starter packs restored.')
      await refresh(productId)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not restore starter packs.'
      setError(humanizePacksError(raw))
    } finally {
      setSeeding(false)
    }
  }

  const onImportSkillsSh = async () => {
    if (!productId || !skillsShSource.trim()) return
    setImportingSkillsSh(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/packs/from-skills-sh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          source: skillsShSource.trim(),
          scope: installScope,
        }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Import failed.')
      setNotice('Skill imported from skills.sh and enabled. Hosted installs never run scripts.')
      setSkillsShSource('')
      await refresh(productId)
      setTab('installed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImportingSkillsSh(false)
    }
  }

  const onInstall = async (packVersionId: string) => {
    if (!productId) return
    setBusyId(packVersionId)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          packVersionId,
          allowUnsigned: true,
          scope: installScope,
        }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Install failed.')
      setNotice(
        installScope === 'account'
          ? 'Pack installed on My account — it applies to every organization you can edit.'
          : 'Pack installed and enabled for this organization.',
      )
      await refresh(productId)
      setTab('installed')
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Install failed.'
      setError(humanizePacksError(raw))
    } finally {
      setBusyId(null)
    }
  }

  const onToggle = async (installId: string, enabled: boolean) => {
    if (!productId) return
    setBusyId(installId)
    setError(null)
    try {
      const response = await fetch(`/api/studio/packs/installed/${encodeURIComponent(installId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, enabled }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Update failed.')
      await refresh(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusyId(null)
    }
  }

  const onUninstall = async (installId: string) => {
    if (!productId) return
    setBusyId(installId)
    setError(null)
    try {
      const response = await fetch(
        `/api/studio/packs/installed/${encodeURIComponent(installId)}?productId=${encodeURIComponent(productId)}`,
        { method: 'DELETE' },
      )
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Uninstall failed.')
      setNotice('Pack uninstalled for this Product.')
      await refresh(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uninstall failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="panel settings-page packs-settings mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Packs
          </p>
          <h1 className="settings-title">Agent packs</h1>
          <p className="page-lede">
            Curated Skill and Style packs for Studio Agent. Install for the active Product; revoke
            sync disables unsafe versions automatically.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/studio" className="btn btn-primary">
            Open Studio
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {!productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before browsing or installing packs.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {schemaHint && !error ? (
        <div className="settings-alert is-warn" role="status">
          <p>{schemaHint}</p>
        </div>
      ) : null}

      {notice ? (
        <div className="settings-alert is-ok" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

      {revocations.length > 0 ? (
        <div className="settings-alert is-warn" role="status">
          <p>
            {revocations.length === 1
              ? `One installed pack version was revoked${revocations[0]?.reason ? `: ${revocations[0].reason}` : ''}. Matching installs were disabled.`
              : `${revocations.length} installed pack versions were revoked. Matching installs were disabled.`}
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading packs…
        </p>
      ) : null}

      {productId && !loading ? (
        <>
          <div className="packs-tabs" role="tablist" aria-label="Pack views">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'browse'}
              className={tab === 'browse' ? 'packs-tab is-active' : 'packs-tab'}
              onClick={() => setTab('browse')}
            >
              Browse marketplace
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'installed'}
              className={tab === 'installed' ? 'packs-tab is-active' : 'packs-tab'}
              onClick={() => setTab('installed')}
            >
              Installed ({installs.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'first-party'}
              className={tab === 'first-party' ? 'packs-tab is-active' : 'packs-tab'}
              onClick={() => setTab('first-party')}
            >
              First-party ({firstParty.length})
            </button>
          </div>

          {tab === 'first-party' ? (
            <div className="packs-browse" role="tabpanel">
              <p className="page-lede">
                First-party skills are locked for this organization. They cannot be removed. They
                are markdown craft — they do not run scripts.
              </p>
              {firstParty.length === 0 ? (
                <div className="settings-empty">
                  <h2 className="settings-empty-title">No first-party skills on disk</h2>
                </div>
              ) : (
                <div className="packs-layout has-detail">
                  <ul className="packs-list">
                    {firstParty.map((skill) => (
                      <li
                        key={skill.id}
                        className={
                          selectedFirstPartyId === skill.id ? 'packs-row is-selected' : 'packs-row'
                        }
                      >
                        <button
                          type="button"
                          className="packs-row-main"
                          onClick={() => setSelectedFirstPartyId(skill.id)}
                        >
                          <span className="packs-row-pills">
                            <span className="packs-kind-pill">skill</span>
                            <span className="packs-publisher-pill">First-party</span>
                          </span>
                          <span className="packs-row-title">{skill.name}</span>
                          <span className="packs-row-meta">Locked · cannot be removed</span>
                          {skill.description ? (
                            <span className="packs-row-summary">{skill.description}</span>
                          ) : null}
                        </button>
                        <div className="packs-row-actions">
                          <span className="packs-installed-chip">Locked</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {firstParty.find((skill) => skill.id === selectedFirstPartyId) ? (
                    <aside className="packs-detail" aria-label="Skill markdown">
                      <h2>{firstParty.find((skill) => skill.id === selectedFirstPartyId)?.name}</h2>
                      <PackMarkdownPreview
                        markdown={
                          firstParty.find((skill) => skill.id === selectedFirstPartyId)?.markdown ??
                          ''
                        }
                      />
                    </aside>
                  ) : null}
                </div>
              )}
            </div>
          ) : tab === 'browse' ? (
            <div className="packs-browse" role="tabpanel">
              <fieldset className="packs-scope" aria-label="Install scope">
                <legend className="packs-scope-legend">Install for</legend>
                <label className="packs-scope-option">
                  <input
                    type="radio"
                    name="pack-install-scope"
                    value="product"
                    checked={installScope === 'product'}
                    onChange={() => setInstallScope('product')}
                  />
                  This organization
                </label>
                <label className="packs-scope-option">
                  <input
                    type="radio"
                    name="pack-install-scope"
                    value="account"
                    checked={installScope === 'account'}
                    onChange={() => setInstallScope('account')}
                  />
                  My account
                </label>
                <p className="page-lede">
                  {installScope === 'account'
                    ? 'My account: this user, every organization you can edit. Not a parent company.'
                    : 'This organization: everyone with access to the active Product.'}
                </p>
              </fieldset>
              <form
                className="packs-skills-sh"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onImportSkillsSh()
                }}
              >
                <label htmlFor="skills-sh-source">
                  Install from skills.sh
                  <input
                    id="skills-sh-source"
                    value={skillsShSource}
                    onChange={(event) => setSkillsShSource(event.target.value)}
                    placeholder="owner/repo or https://skills.sh/owner/repo"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={importingSkillsSh || !skillsShSource.trim()}
                >
                  {importingSkillsSh ? 'Importing…' : 'Import skill'}
                </button>
                <p className="page-lede">
                  Server fetch only — no npx. Hosted Studio refuses scripts/ and binaries.
                </p>
              </form>
              {packs.length === 0 ? (
                <div className="settings-empty">
                  <h2 className="settings-empty-title">No packs published yet</h2>
                  <p className="page-lede">
                    Published Skill and Style packs will appear here when they are available for
                    your workspace.
                  </p>
                  {allowUnsigned ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={seeding}
                      onClick={() => void onSeedStarters()}
                    >
                      {seeding ? 'Restoring…' : 'Restore Hepteract starters'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={`packs-layout${selected ? ' has-detail' : ''}`}>
                  <ul className="packs-list">
                    {packs.map(({ pack, latestVersion }) => {
                      const installed =
                        latestVersion != null && installedVersionIds.has(latestVersion.id)
                      const isSelected = selectedSlug === pack.slug
                      const hepteract = isHepteractPublisher(pack.publisher)
                      return (
                        <li
                          key={pack.id}
                          className={isSelected ? 'packs-row is-selected' : 'packs-row'}
                        >
                          <button
                            type="button"
                            className="packs-row-main"
                            onClick={() => setSelectedSlug(pack.slug)}
                          >
                            <span className="packs-row-pills">
                              <span className="packs-kind-pill">{pack.kind}</span>
                              {hepteract ? (
                                <span className="packs-publisher-pill">Hepteract</span>
                              ) : null}
                            </span>
                            <span className="packs-row-title">{pack.title}</span>
                            <span className="packs-row-meta">
                              {hepteract ? 'Official starter' : pack.publisher}
                              {latestVersion ? ` · v${latestVersion.semver}` : ''}
                            </span>
                            {pack.summary ? (
                              <span className="packs-row-summary">{pack.summary}</span>
                            ) : null}
                          </button>
                          <div className="packs-row-actions">
                            {latestVersion && !installed ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busyId === latestVersion.id}
                                onClick={() => void onInstall(latestVersion.id)}
                              >
                                {busyId === latestVersion.id ? 'Installing…' : 'Install'}
                              </button>
                            ) : null}
                            {installed ? (
                              <span className="packs-installed-chip">Installed</span>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {selected ? (
                    <aside className="packs-detail" aria-label="Pack detail">
                      <div className="packs-row-pills">
                        <span className="packs-kind-pill">{selected.pack.kind}</span>
                        {isHepteractPublisher(selected.pack.publisher) ? (
                          <span className="packs-publisher-pill">Hepteract</span>
                        ) : null}
                      </div>
                      <h2>{selected.pack.title}</h2>
                      <p className="packs-row-meta">
                        {isHepteractPublisher(selected.pack.publisher)
                          ? 'Official starter'
                          : selected.pack.publisher}
                        {selected.latestVersion ? ` · v${selected.latestVersion.semver}` : ''}
                      </p>
                      {selected.pack.summary ? (
                        <p className="page-lede">{selected.pack.summary}</p>
                      ) : null}

                      <div className="packs-detail-body">
                        <h3 className="packs-detail-body-title">What’s inside</h3>
                        {previewLoading ? (
                          <p className="page-lede" role="status">
                            Loading pack content…
                          </p>
                        ) : preview ? (
                          <PackMarkdownPreview markdown={preview.markdown} />
                        ) : (
                          <p className="page-lede">Preview unavailable for this pack version.</p>
                        )}
                      </div>

                      {selected.latestVersion &&
                      !installedVersionIds.has(selected.latestVersion.id) ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyId === selected.latestVersion.id}
                          onClick={() => void onInstall(selected.latestVersion!.id)}
                        >
                          {busyId === selected.latestVersion.id ? 'Installing…' : 'Install pack'}
                        </button>
                      ) : null}
                    </aside>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="packs-installed" role="tabpanel">
              {installs.length === 0 ? (
                <div className="settings-empty">
                  <h2 className="settings-empty-title">Nothing installed</h2>
                  <p className="page-lede">
                    Browse the marketplace and install a Skill or Style pack for this Product.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setTab('browse')}
                  >
                    Browse marketplace
                  </button>
                </div>
              ) : (
                <ul className="packs-list">
                  {installs.map(({ install, pack, version }) => (
                    <li key={install.id} className="packs-row">
                      <div className="packs-row-main">
                        <span className="packs-row-pills">
                          <span className="packs-kind-pill">{pack.kind}</span>
                          {isHepteractPublisher(pack.publisher) ? (
                            <span className="packs-publisher-pill">Hepteract</span>
                          ) : null}
                        </span>
                        <span className="packs-row-title">{pack.title}</span>
                        <span className="packs-row-meta">
                          v{version.semver} · {install.enabled ? 'Enabled' : 'Disabled'} ·{' '}
                          {install.userId ? 'My account' : 'This organization'}
                        </span>
                      </div>
                      <div className="packs-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyId === install.id}
                          onClick={() => void onToggle(install.id, !install.enabled)}
                        >
                          {install.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyId === install.id}
                          onClick={() => void onUninstall(install.id)}
                        >
                          Uninstall
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
