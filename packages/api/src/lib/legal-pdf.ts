import PDFDocument from 'pdfkit'

// Renders a legal document (the Terms of Service) as a PDF from the same
// structured text the web page renders, so the two cannot drift apart. The
// shape mirrors apps/web/app/(app)/terms/full/terms-content.ts.

export type LegalBlock =
  | { kind: 'lead'; text: string }
  | { kind: 'clause'; n: string; text: string; items?: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'sub'; title: string; lead: string; items: string[]; tail?: string }
  | { kind: 'contact'; lines: string[] }

export type LegalDocument = {
  title: string
  subtitle?: string
  preamble: string[]
  sections: { n: string; title: string; blocks: LegalBlock[] }[]
}

const MARGIN = 64
const BODY_SIZE = 10.5
const INK = '#1f1f1f'
const MUTED = '#5c5c5c'

export async function renderLegalPdf(docData: LegalDocument): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: docData.title, Author: 'Ticketeur' },
    bufferPages: true,
  })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk as Buffer))
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  )

  const width = doc.page.width - MARGIN * 2
  const para = (text: string, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc
      .font('Helvetica')
      .fontSize(BODY_SIZE)
      .fillColor(INK)
      .text(text, { width, lineGap: 2.5, paragraphGap: 6, ...opts })
  const bullets = (items: string[], indent: number) => {
    for (const item of items) {
      doc
        .font('Helvetica')
        .fontSize(BODY_SIZE)
        .fillColor(INK)
        .text(`•  ${item}`, MARGIN + indent, doc.y, {
          width: width - indent,
          lineGap: 2.5,
          paragraphGap: 3,
          indent: 0,
        })
    }
    doc.x = MARGIN
    doc.moveDown(0.4)
  }

  doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(docData.title, {
    width,
  })
  if (docData.subtitle) {
    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(10)
      .fillColor(MUTED)
      .text(docData.subtitle, { width })
  }
  doc.moveDown(1.2)

  for (const p of docData.preamble) para(p)

  for (const section of docData.sections) {
    doc.moveDown(0.8)
    // Keep a heading with at least a couple of lines of its section.
    if (doc.y > doc.page.height - MARGIN - 80) doc.addPage()
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(INK)
      .text(`${section.n}. ${section.title}`, MARGIN, doc.y, { width })
    doc.moveDown(0.5)

    for (const block of section.blocks) {
      switch (block.kind) {
        case 'lead':
          para(block.text)
          break
        case 'clause':
          doc
            .font('Helvetica-Bold')
            .fontSize(BODY_SIZE)
            .fillColor(INK)
            .text(`${block.n}  `, { continued: true, width, lineGap: 2.5 })
            .font('Helvetica')
            .text(block.text, { width, lineGap: 2.5, paragraphGap: 6 })
          if (block.items?.length) bullets(block.items, 18)
          break
        case 'list':
          bullets(block.items, 12)
          break
        case 'sub':
          doc
            .font('Helvetica-Bold')
            .fontSize(BODY_SIZE + 0.5)
            .fillColor(INK)
            .text(block.title, { width, paragraphGap: 4 })
          para(block.lead)
          bullets(block.items, 12)
          if (block.tail) para(block.tail)
          break
        case 'contact':
          for (const line of block.lines) {
            para(line, { paragraphGap: 1 })
          }
          doc.moveDown(0.4)
          break
      }
    }
  }

  // Page numbers, once every page exists.
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    // Drawing inside the bottom margin would otherwise start a new page.
    doc.page.margins.bottom = 0
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        `${docData.title} — page ${i + 1} of ${range.count}`,
        MARGIN,
        doc.page.height - MARGIN / 2 - 6,
        { width, align: 'center', lineBreak: false }
      )
  }

  doc.end()
  return done
}
