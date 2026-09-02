const LOCAL_BUNDLE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])

export const collectHttpOrigins = (value: unknown, into: Set<string>): void => {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      try {
        into.add(new URL(value).origin)
      } catch {
        // ignore malformed
      }
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHttpOrigins(item, into)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectHttpOrigins(item, into)
  }
}

export const allowedOriginsFromInputProps = (inputProps: unknown): string[] => {
  const origins = new Set<string>()
  collectHttpOrigins(inputProps, origins)
  return [...origins]
}

/**
 * Chromium may load the Remotion bundle (local webpack serve) and signed project
 * asset URLs. Everything else — including evil.example — is blocked.
 */
export const authoredRequestAllowed = (url: string, allowedOrigins: readonly string[]): boolean => {
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return true
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') return false
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      LOCAL_BUNDLE_HOSTS.has(parsed.hostname)
    ) {
      return true
    }
    return allowedOrigins.includes(parsed.origin)
  } catch {
    return false
  }
}

export const installAuthoredFetchGuardSource = (allowedOrigins: readonly string[]): string => {
  const origins = JSON.stringify(allowedOrigins)
  return `;(function(){
    var allowed = ${origins};
    var local = { localhost:1, '127.0.0.1':1, '0.0.0.0':1, '[::1]':1 };
    var allow = function(url){
      if (!url) return true;
      var s = String(url);
      if (s.indexOf('data:') === 0 || s.indexOf('blob:') === 0 || s.indexOf('about:') === 0) return true;
      try {
        var u = new URL(s, 'https://local.invalid');
        if (u.protocol === 'file:') return false;
        if ((u.protocol === 'http:' || u.protocol === 'https:') && local[u.hostname]) return true;
        return allowed.indexOf(u.origin) !== -1;
      } catch (e) { return false; }
    };
    var orig = globalThis.fetch;
    if (typeof orig === 'function') {
      globalThis.fetch = function(input, init) {
        var href = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input);
        if (!allow(href)) {
          return Promise.reject(new Error('Blocked outbound request to ' + href));
        }
        return orig.call(this, input, init);
      };
    }
    var XHR = globalThis.XMLHttpRequest;
    if (typeof XHR === 'function') {
      var open = XHR.prototype.open;
      XHR.prototype.open = function(method, url) {
        if (!allow(url)) {
          throw new Error('Blocked outbound request to ' + url);
        }
        return open.apply(this, arguments);
      };
    }
  })();`
}
