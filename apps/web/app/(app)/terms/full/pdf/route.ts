import { renderLegalPdf } from '@ticketur/api/lib/legal-pdf'

import {
  TERMS_EFFECTIVE_DATE,
  TERMS_LAST_UPDATED,
  TERMS_PREAMBLE,
  TERMS_SECTIONS,
} from '../terms-content'

// The full Terms of Service as a PDF, rendered from the same transcription of
// the legal document that /terms/full shows, so the two always say the same
// thing. The content only changes with a deploy, so it is built once per
// deployment and served static.
export const dynamic = 'force-static'

export async function GET() {
  const pdf = await renderLegalPdf({
    title: 'Ticketeur Terms of Service',
    subtitle: `Effective date: ${TERMS_EFFECTIVE_DATE} · Last updated: ${TERMS_LAST_UPDATED}`,
    preamble: TERMS_PREAMBLE,
    sections: TERMS_SECTIONS,
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // Opens in the browser's PDF viewer; saving keeps a sensible name.
      'Content-Disposition':
        'inline; filename="ticketeur-terms-of-service.pdf"',
    },
  })
}
