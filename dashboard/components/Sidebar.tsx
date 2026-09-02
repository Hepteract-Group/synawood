'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { ComponentType, MouseEvent, ReactNode, SVGProps } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  IconChart,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClapperboard,
  IconHome,
  IconKanban,
  IconLayoutDashboard,
  IconLogOut,
  IconPackage,
  IconSettings,
  IconSparkles,
  IconImage,
  IconLayers,
} from './icons'
import { useDragResize } from './studio/useDragResize'
import { authBrowserCookieOptions } from '../lib/auth-browser-cookie'
import { LANDING_HREF, signOutToLanding } from '../lib/sign-out-to-landing'
import { PRODUCT_MARK, PRODUCT_NAME } from '../lib/product-name'

/** Sketch IA (ADR-0016 / dashboard-shell.md). Schedule + Observability deferred. */
const NAV: {
  href: string
  label: string
  exact?: boolean
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { href: '/home', label: 'Dashboard', exact: true, Icon: IconLayoutDashboard },
  { href: '/products', label: 'Products', Icon: IconPackage },
  { href: '/studio', label: 'Studio', Icon: IconClapperboard },
  { href: '/campaigns', label: 'Campaigns', Icon: IconImage },
  { href: '/goals', label: 'Goals', Icon: IconSparkles },
  { href: '/approvals', label: 'Approvals', Icon: IconCheck },
  { href: '/content', label: 'Work board', Icon: IconKanban },
  { href: '/insights', label: 'Insights', Icon: IconLayers },
  { href: '/ai-media', label: 'AI Media', Icon: IconSparkles },
  { href: '/usage', label: 'Usage', Icon: IconChart },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
]

export const SHELL_NAV_HREFS = NAV.map((item) => item.href)
export const SHELL_ACCOUNT_HREFS = [LANDING_HREF] as const

const COLLAPSE_KEY = 'mos.shell.collapsed'
const WIDTH_KEY = 'mos.shell.sidebarWidth'

/** Synawood sidebar becomes a labeled Menu at this width (`docs/ui/responsive.md`). */
export const SHELL_PHONE_MAX_PX = 760

export const Sidebar = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutPending, setSignOutPending] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const supabaseConfigured = useMemo(
    () =>
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    [],
  )

  const client = useMemo(() => {
    if (!supabaseConfigured) return null
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: authBrowserCookieOptions },
    )
  }, [supabaseConfigured])

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])

  useEffect(() => {
    for (const item of NAV) {
      router.prefetch(item.href)
    }
  }, [router])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const toggle = () => {
    setCollapsed((current) => {
      const next = !(current ?? false)
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  const onMarketingSite = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    // Next intercepts same-origin <a> and can keep the operator shell mounted.
    event.preventDefault()
    window.location.assign(LANDING_HREF)
  }

  const onSignOut = async () => {
    setSignOutError(null)
    setSignOutPending(true)
    try {
      if (!client) {
        throw new Error('Sign out is temporarily unavailable. Try again shortly.')
      }
      await signOutToLanding({
        signOut: () => client.auth.signOut(),
        assign: (url) => window.location.assign(url),
      })
    } catch (err) {
      setSignOutPending(false)
      setSignOutError(err instanceof Error ? err.message : 'Could not sign out. Try again.')
    }
  }

  const isCollapsed = collapsed ?? false
  const { size, handleProps } = useDragResize({
    storageKey: WIDTH_KEY,
    initial: 248,
    min: 200,
    max: 340,
    direction: 'horizontal',
    enabled: !isCollapsed,
  })

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div
        className={
          collapsed === null
            ? 'shell-layout'
            : isCollapsed
              ? 'shell-layout is-collapsed'
              : 'shell-layout'
        }
        style={
          collapsed === null || isCollapsed
            ? undefined
            : {
                // Cap nav width vs viewport so main never collapses to 0 while shrinking.
                gridTemplateColumns: `minmax(0, min(${size}px, 36vw)) 5px minmax(0, 1fr)`,
              }
        }
      >
        <aside className="shell-sidebar">
          <div className="shell-sidebar-top">
            <Link href="/home" className="brand shell-brand" title={PRODUCT_NAME}>
              <span className="shell-brand-mark" aria-hidden>
                {PRODUCT_MARK}
              </span>
              <span className="shell-brand-text">{PRODUCT_NAME}</span>
            </Link>
            <button
              type="button"
              className="shell-collapse"
              onClick={toggle}
              aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {isCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
            </button>
            <button
              type="button"
              className="shell-menu"
              aria-expanded={menuOpen}
              aria-controls="shell-primary-nav"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
          <nav
            id="shell-primary-nav"
            className={menuOpen ? 'shell-nav mos-stagger is-open' : 'shell-nav mos-stagger'}
            aria-label="Primary"
          >
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
              const { Icon } = item
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? 'shell-nav-link is-active' : 'shell-nav-link'}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  data-label={item.label}
                  data-guide={
                    item.href === '/home'
                      ? 'nav-home'
                      : item.href === '/studio'
                        ? 'nav-studio'
                        : item.href === '/settings'
                          ? 'nav-settings'
                          : undefined
                  }
                >
                  <span className="shell-nav-glyph" aria-hidden>
                    <Icon />
                  </span>
                  <span className="shell-nav-label">{item.label}</span>
                </Link>
              )
            })}
            <div className="shell-nav-account">
              <a
                href={LANDING_HREF}
                className="shell-nav-link"
                aria-label="Marketing site"
                data-label="Marketing site"
                onClick={onMarketingSite}
              >
                <span className="shell-nav-glyph" aria-hidden>
                  <IconHome />
                </span>
                <span className="shell-nav-label">Marketing site</span>
              </a>
              <button
                type="button"
                className={signOutError ? 'shell-nav-link is-error' : 'shell-nav-link'}
                aria-label="Sign out"
                data-label={signOutError ?? 'Sign out'}
                title={signOutError ?? undefined}
                disabled={signOutPending}
                aria-busy={signOutPending}
                onClick={() => {
                  void onSignOut()
                }}
              >
                <span className="shell-nav-glyph" aria-hidden>
                  <IconLogOut />
                </span>
                <span className="shell-nav-label">
                  {signOutPending ? 'Signing out…' : 'Sign out'}
                </span>
              </button>
              {signOutError ? (
                <p className="shell-nav-error" role="alert">
                  {signOutError}
                </p>
              ) : null}
            </div>
          </nav>
          {menuOpen ? (
            <button
              type="button"
              className="shell-menu-backdrop"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            />
          ) : null}
          <div className="shell-sidebar-foot">
            <span className="shell-env-dot" aria-hidden />
            <span className="shell-env-copy">
              <span className="shell-env-label">Local workspace</span>
              <span className="shell-env-meta">Ready</span>
            </span>
          </div>
        </aside>
        <div
          className="shell-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation"
          {...handleProps}
        />
        <main id="main" className="shell-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  )
}
