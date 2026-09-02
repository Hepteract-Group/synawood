import { FinalSnapshotPanel } from '@/components/content/FinalSnapshotPanel'

export default async function FinalSnapshotPage({
  params,
}: {
  params: Promise<{ finalId: string }>
}) {
  const { finalId } = await params
  return <FinalSnapshotPanel finalId={finalId} />
}
