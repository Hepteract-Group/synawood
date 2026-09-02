import { createRoot } from 'react-dom/client'
import AuthoredPlayerFrame from './authored-player-frame'

const root = document.getElementById('root')
if (!root) throw new Error('Authored player root is missing')
createRoot(root).render(<AuthoredPlayerFrame />)
