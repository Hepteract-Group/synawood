import type { ReactNode } from 'react'
import { GuideHost } from '@/components/guides/GuideHost'
import { Sidebar } from '@/components/Sidebar'

const MosLayout = ({ children }: { children: ReactNode }) => (
  <Sidebar>
    <GuideHost />
    {children}
  </Sidebar>
)

export default MosLayout
