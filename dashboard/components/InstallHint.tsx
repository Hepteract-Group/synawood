'use client'

import { useEffect, useState } from 'react'
import {
  INSTALL_HINT_CHROME,
  INSTALL_HINT_IPHONE,
  INSTALL_HINT_LOGIN_BRIEF,
  INSTALL_HINT_ONLINE,
  INSTALL_HINT_STANDALONE,
  INSTALL_HINT_TITLE,
} from '../lib/install-hint'
import { readStandaloneDisplay } from '../lib/display-mode'

/** Settings — full install steps (#843). */
export const InstallHint = () => {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(readStandaloneDisplay())
  }, [])

  return (
    <aside
      className={`install-hint${standalone ? ' is-standalone' : ''}`}
      aria-label={INSTALL_HINT_TITLE}
    >
      <div className="install-hint-browser">
        <h2 className="install-hint-title">{INSTALL_HINT_TITLE}</h2>
        <p className="install-hint-copy">{INSTALL_HINT_IPHONE}</p>
        <p className="install-hint-copy">{INSTALL_HINT_CHROME}</p>
        <p className="install-hint-copy">{INSTALL_HINT_ONLINE}</p>
      </div>
      <div className="install-hint-standalone">
        <h2 className="install-hint-title">Installed app</h2>
        <p className="install-hint-copy">{INSTALL_HINT_STANDALONE}</p>
      </div>
    </aside>
  )
}

/** Login — one muted line; hidden when already installed. */
export const LoginInstallTip = () => {
  const [standalone, setStandalone] = useState<boolean | null>(null)

  useEffect(() => {
    setStandalone(readStandaloneDisplay())
  }, [])

  if (standalone !== false) return null

  return <p className="auth-install-tip">{INSTALL_HINT_LOGIN_BRIEF}</p>
}
