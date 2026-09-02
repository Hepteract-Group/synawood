# Azure Blob + Supabase Postgres as media persistence

Creative Studio persists **binaries in Azure Blob Storage** and **metadata/history in Supabase Postgres** (dedicated Synawood project, free plan acceptable initially). Git `content/` remains a human-readable mirror. Azure ops use **Azure CLI** when authenticated; the app uses SDK + env. Local-first before Vercel.

**Why:** Founder chose Supabase + Azure Blob; Studio needs durable media and queryable history from first export; the private example Supabase must not be reused (boundary risk).

**Rejected:** Neon/Azure-Postgres as default host. Filesystem-only media. Sharing the private example Supabase project. Deploy-first verification on Vercel.
