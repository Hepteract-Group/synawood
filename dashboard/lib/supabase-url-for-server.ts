/**
 * GoTrue URL the Next server (middleware, RSC, API) should call.
 * In Docker the browser uses localhost:54341; the container must use
 * host.docker.internal or the session check after OAuth fails closed (#1387).
 */
export const supabaseUrlForServer = (
  env: Record<string, string | undefined> = process.env,
): string | undefined => env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
