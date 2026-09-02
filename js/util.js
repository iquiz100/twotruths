// Generates an unguessable session ID. This ID *is* the access credential
// for a session (no login exists), so it needs to be long and random.
export function generateSessionId() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(24);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < bytes.length; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

// Builds an absolute link to another page in this app, preserving whatever
// sub-path the site is deployed at (e.g. a GitHub Pages project path).
export function buildLink(page, params) {
  const url = new URL(page, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

export function getParams() {
  return new URLSearchParams(window.location.search);
}
