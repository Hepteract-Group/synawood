import { GoalDetailPanel } from '@/components/goals/GoalDetailPanel'

type Params = { params: Promise<{ goalId: string }> }

export default async function GoalDetailPage({ params }: Params) {
  const { goalId } = await params
  return <GoalDetailPanel goalId={goalId} />
}
