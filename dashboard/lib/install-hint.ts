/** Install / Add to Home Screen copy (#843). Settings + login only — not a campaign. */

import { PRODUCT_NAME } from './product-name'

export const INSTALL_HINT_TITLE = 'Install this app'

export const INSTALL_HINT_IPHONE = `On iPhone: tap Share, then Add to Home Screen. The icon opens ${PRODUCT_NAME} without Safari around it.`

export const INSTALL_HINT_CHROME =
  'On Chrome: the browser can offer Install. After you sign in, this window opens at Home.'

export const INSTALL_HINT_ONLINE = 'Needs a network. There is no offline mode.'

/** Login only — one line; full steps live on Settings. */
export const INSTALL_HINT_LOGIN_BRIEF = 'Add to Home Screen or Install for a home-screen icon.'

export const INSTALL_HINT_STANDALONE =
  'This window is the installed app. Sign in here so Studio stays in this window, not in the browser.'
