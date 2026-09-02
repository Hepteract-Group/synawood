import { CampaignPackDetail } from '@/components/campaigns/CampaignPackDetail'

export default async function CampaignPackPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <CampaignPackDetail projectId={projectId} />
}
