import Link from 'next/link'
import { SettingsGuidesCard } from '@/components/guides/SettingsGuidesCard'
import { InstallHint } from '@/components/InstallHint'
import { SettingsLocalNav } from './settings-local-nav'

const DESTINATIONS = [
  {
    href: '/settings/brand',
    mark: 'B',
    title: 'Brand DNA and Catalog',
    body: 'Tagline, ICP, values, URL ingest drafts, and offer Catalog (not the Media bin).',
    cta: 'Edit brand',
  },
  {
    href: '/settings/voice',
    mark: 'V',
    title: 'Voice profiles',
    body: 'Synth and clone voices. Clone requires a recorded consent check before use.',
    cta: 'Edit voices',
  },
  {
    href: '/settings/outcomes',
    mark: 'O',
    title: 'Outcomes',
    body: 'Manual views, clicks, signups, and revenue. Unmatched URLs stay unattributed.',
    cta: 'Record outcomes',
  },
  {
    href: '/settings/billing',
    mark: '£',
    title: 'Billing',
    body: 'Plan, wallet balance, trial countdown, and monthly generator cap.',
    cta: 'Open billing',
  },
  {
    href: '/settings/members',
    mark: 'M',
    title: 'Members and invites',
    body: 'Invite by job function, revoke pending invites, and see who can Approve or publish.',
    cta: 'Manage members',
  },
  {
    href: '/settings/roles',
    mark: 'R',
    title: 'Roles',
    body: 'What founder, editor, reviewer, publisher, and analyst can each do in this organization.',
    cta: 'Read roles',
  },
  {
    href: '/settings/audit',
    mark: 'A',
    title: 'Audit log',
    body: 'Who was invited, who joined, and when a job function changed.',
    cta: 'Open log',
  },
  {
    href: '/settings/packs',
    mark: 'P',
    title: 'Agent packs',
    body: 'Install curated Skill and Style packs for this organization. Enable, disable, or uninstall anytime.',
    cta: 'Open packs',
  },
  {
    href: '/settings/channels',
    mark: 'S',
    title: 'Postiz channels',
    body: 'Bind X, LinkedIn, and TikTok accounts connected in Postiz. Ads stay on paste URL.',
    cta: 'Bind channels',
  },
  {
    href: '/settings/api',
    mark: 'K',
    title: 'API keys',
    body: 'Call first-party Studio Tools over HTTP with a Product key.',
    cta: 'Open API',
  },
  {
    href: '/settings/agent-tools',
    mark: 'T',
    title: 'Agent tools',
    body: 'See every first-party Studio tool. Locked tools stay on. Optional generators can be turned off — turning off generate_video_clip makes “make a video” fail out loud. Register inbound MCP servers here too.',
    cta: 'Open agent tools',
  },
  {
    href: '/onboarding',
    mark: '+',
    title: 'Create an organization',
    body: 'Start a team: Studio, brand kit, and members. You become owner. Invite people next.',
    cta: 'Create organization',
  },
  {
    href: '/products',
    mark: '↔',
    title: 'Organizations',
    body: 'Switch which team you are working in across Studio and Settings.',
    cta: 'Switch organization',
  },
] as const

export default function SettingsPage() {
  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">Settings</p>
          <h1 className="settings-title">Settings</h1>
          <p className="page-lede">
            Membership, Brand DNA, Voice profiles, Postiz channels, agent packs, and which
            organization you are in.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/usage" className="btn btn-ghost">
            Usage ledger
          </Link>
          <Link href="/home" className="btn btn-primary">
            Dashboard
          </Link>
        </div>
      </header>
      <SettingsLocalNav />
      <SettingsGuidesCard />
      <InstallHint />

      <div className="settings-grid mos-stagger">
        {DESTINATIONS.map((item) => (
          <Link key={item.href} href={item.href} className="settings-card">
            <span className="settings-card-mark" aria-hidden>
              {item.mark}
            </span>
            <div className="settings-card-body">
              <h2 className="settings-card-title">{item.title}</h2>
              <p className="page-lede">{item.body}</p>
              <span className="settings-card-cta">{item.cta}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
