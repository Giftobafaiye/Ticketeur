import { Montserrat, Work_Sans } from 'next/font/google'

// The Terms overview is typeset in the design's own faces rather than the
// site's Trap / Transforma Sans. They are scoped to this route (applied on the
// page's root element, not the root layout) so the rest of the site is
// unaffected and the extra files are only fetched by people reading the Terms.
//
// `next/font/google` self-hosts these at build time — no request to Google is
// made from the browser.

/** Headings — H2 24/32, H3 20/28, H4 18/24, all bold. */
export const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-terms-heading',
  display: 'swap',
})

/** Body copy 14px/2, plus bold 16px lead-ins and links. */
export const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-terms-body',
  display: 'swap',
})
