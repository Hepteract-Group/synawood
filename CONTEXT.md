# Synawood

Go-to-market operating system: runbooks, dashboard, automations, and Creative Studio. Customer brand lives on an Organization you create in the app. `products/demo/` is a fixture kit so Studio boots without a customer.

## Language

**Synawood** — the system in this repository. Not a social scheduler (a scheduler is an adapter). Not a consumer editor sold as the whole company.

**Organization** — the company or team that owns Studio, brand, members, and billing. Same database row as product tenancy (`products` + `product_members`). Do not add a second `organizations` table.

**Creative Studio** — chat-to-timeline product for Final ads. Success is a 30–120s ad the team can Approve without hiring an editor or motion designer: talking-head, motion graphics, or both.

**Studio Agent** — in-product LLM tool loop that edits a Studio Project. Not a coding agent. Not LangChain.

**Operator** — a member who cuts, chats, or Approves in Studio.

**Final asset** — channel-ready media after Approve. Intermediate renders are not Finals.

**Brief** — audience, one idea, proof, channel, length. Beautiful motion that says nothing is still slop.

**Player** — the picture for authored Remotion compositions. Timeline MAIN is for footage. Export encodes the Player.

**Runbook** — a product-agnostic procedure. Automate only after a human has run it.

**Core** — product-agnostic modules under `core/`.

Avoid: Synawood, Synawood, tenant, workspace, dumping a marketed product pack into git.
