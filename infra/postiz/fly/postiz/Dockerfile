# Postiz on Fly. Upstream image plus a cookie-domain patch.
#
# fly.dev is on the Public Suffix List. This image's tldts still treats
# mos-postiz.fly.dev as domain=fly.dev, so login sets Domain=.fly.dev and
# browsers drop the cookie (register looks like a no-op; sign-in just refreshes).
# Same class as gitroomhq/postiz-app#1143. Host-only cookie via hostname.
# Keep the patch after a custom domain — it is still correct there.
FROM ghcr.io/gitroomhq/postiz-app:latest

USER root
RUN python3 - <<'PY'
from pathlib import Path

old = "return url.domain ? '.' + url.domain : url.hostname;"
new = "return url.hostname;"
hits = 0
for path in Path("/app").rglob("subdomain.management.js"):
    text = path.read_text()
    if old not in text:
        continue
    path.write_text(text.replace(old, new))
    hits += 1
    print(f"patched {path}")
if hits == 0:
    raise SystemExit("cookie-domain patch did not match subdomain.management.js")
PY
