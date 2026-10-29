// Links people paste for their socials and website: "facebook.com/mybiz",
// "www.instagram.com/mybiz", "https://mybiz.ng". Pure, so the vendor profile
// form, the server that saves it, and the public profile that renders it all
// apply the same rule.
//
// Returns an absolute http(s) URL, or null when the input is not a web link.
// Anything with another scheme (javascript:, data:, mailto:) is refused: these
// end up in an <a href> on a public page.
export function normalizeWebUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
  // "facebook.com/x" has no scheme; "localhost:3000" looks like one but isn't a
  // web link anyone puts on a profile, so it is refused like any other scheme.
  const candidate = hasScheme ? value : `https://${value.replace(/^\/+/, '')}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  // A bare word ("facebook") is not a site.
  if (!url.hostname.includes('.')) return null
  return url.toString()
}
