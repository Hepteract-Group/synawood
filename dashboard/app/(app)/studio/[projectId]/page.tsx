import { StudioWorkspace } from '@/components/studio/StudioWorkspace'
import { Suspense } from 'react'

const StudioProjectPage = async ({ params }: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await params
  return (
    <Suspense fallback={<p className="muted">Loading Studio…</p>}>
      <StudioWorkspace projectId={projectId} />
    </Suspense>
  )
}

export default StudioProjectPage
