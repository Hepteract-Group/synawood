import { WorkBoard } from '@/components/content/WorkBoard'

const ContentPage = () => (
  <section className="panel work-board-page">
    <p className="eyebrow">Campaigns</p>
    <h1>Work board</h1>
    <p className="page-lede">
      Approve a Final in Studio first. Then click a card: Schedule or Post now for X, LinkedIn, or
      TikTok, or paste a live URL for paid ads, blog, and email. The paste field is on the card, not
      on this calendar.
    </p>

    <WorkBoard />
  </section>
)

export default ContentPage
