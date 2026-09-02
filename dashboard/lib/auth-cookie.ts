// Distinct cookie name for the Synawood session. Without it, @supabase/ssr
// derives "sb-127-auth-token" from the local API URL (http://127.0.0.1:5434x),
// which collides with any other local Supabase app on localhost — their stale
// refresh tokens then poison our middleware session check.
export const AUTH_COOKIE_NAME = 'sb-marketing-os-auth'
