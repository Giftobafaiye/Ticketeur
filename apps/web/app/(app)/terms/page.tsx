import type { Metadata } from 'next'
import Link from 'next/link'

import { montserrat, workSans } from './fonts'
import {
  TERMS_OVERVIEW_LAST_UPDATED,
  TERMS_OVERVIEW_SECTIONS,
  type OverviewBlock,
  type OverviewLine,
} from './terms-overview-content'

export const metadata: Metadata = {
  title: 'Terms and conditions',
  description:
    'A plain-English guide to how Ticketeur works for attendees, organisers and vendors — and where to find the full legal terms.',
}

// Noise overlay for the two hero circles, exported from the design.
const HERO_TEXTURE = '/terms-hero-texture.png'

const HEADING_FONT = 'font-[family-name:var(--font-terms-heading)]'
const H2 = `${HEADING_FONT} text-[24px] leading-[32px] font-bold text-[#282828]`
const H3 = `${HEADING_FONT} text-[20px] leading-[28px] font-bold text-[#282828]`
const H4 = `${HEADING_FONT} text-[18px] leading-[24px] font-bold text-[#282828]`

// Spelled out rather than interpolated so Tailwind can see the class names.
const BLOCK_GAP = { 12: 'gap-3', 16: 'gap-4', 32: 'gap-8' } as const

export default function TermsPage() {
  return (
    <div className={`${workSans.variable} ${montserrat.variable} bg-white`}>
      <TermsHero />

      <article className="mx-auto flex w-full max-w-[987px] flex-col gap-16 px-6 pt-16 pb-24 font-[family-name:var(--font-terms-body)] md:pt-[84px] md:pb-[100px]">
        {TERMS_OVERVIEW_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="flex scroll-mt-28 flex-col gap-14"
          >
            <h2 className={H2}>{section.heading}</h2>

            <div className="flex flex-col gap-12">
              {section.groups.map((group, groupIndex) => (
                <div
                  key={`${section.id}-group-${groupIndex}`}
                  className={`flex flex-col ${BLOCK_GAP[section.blockGap ?? 32]}`}
                >
                  {group.map((block, blockIndex) => (
                    <Block
                      key={`${section.id}-${groupIndex}-${blockIndex}`}
                      block={block}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </article>
    </div>
  )
}

function TermsHero() {
  return (
    <section
      aria-label="Terms and conditions"
      className="relative isolate flex w-full items-center justify-center overflow-hidden bg-[#31156B] px-6 py-20 md:h-[581px] md:py-0"
    >
      {/* Two 811px circles bleeding off either edge, positioned against the
          1440px design canvas so the composition holds on wider screens. */}
      <HeroCircle className="top-[90px] left-[-565px] md:left-[calc(50%-1285px)]" />
      <HeroCircle className="top-[117px] left-[calc(100%-200px)] md:left-[calc(50%+517px)]" />

      <div className="relative z-10 flex w-full max-w-[801px] flex-col items-center gap-6 text-center">
        <h1 className="font-heading text-[32px] leading-[1.2] font-bold text-white sm:text-[44px] md:text-[56px]">
          Terms and conditions
        </h1>
        <p className="font-heading text-base leading-[28px] font-semibold text-[#E2E8F0] md:text-[20px]">
          Last updated: {TERMS_OVERVIEW_LAST_UPDATED}
        </p>
      </div>
    </section>
  )
}

function HeroCircle({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute size-[811px] rounded-full mix-blend-overlay ${className}`}
    >
      <div
        className="size-full rounded-full bg-cover bg-center opacity-50"
        style={{ backgroundImage: `url(${HERO_TEXTURE})` }}
      />
    </div>
  )
}

function Block({ block }: { block: OverviewBlock }) {
  switch (block.kind) {
    case 'h3':
      return <h3 className={H3}>{block.text}</h3>

    case 'h4':
      return <h4 className={H4}>{block.text}</h4>

    case 'body':
      return <BodyLines lines={block.lines} />

    case 'link':
      return (
        <p className="text-[16px] leading-[24px] font-bold text-[#282828]">
          {block.lead}
          <TermsLink href={block.href} label={block.label} />
        </p>
      )
  }
}

// One body block. Lines stack with no gap of their own — the 2.0 line height
// supplies the rhythm, and `gap` lines add a blank line where the design has
// one.
function BodyLines({ lines }: { lines: OverviewLine[] }) {
  return (
    <div className="text-[14px] leading-[2] text-[#424242]">
      {lines.map((line, i) => {
        const key = `${line.t}-${i}`

        switch (line.t) {
          case 'p':
            return <p key={key}>{line.text}</p>

          case 'b':
            return (
              <p key={key} className="font-bold">
                {line.text}
              </p>
            )

          case 'lead':
            return (
              <p key={key} className="text-[16px] font-bold">
                {line.text}
              </p>
            )

          case 'gap':
            return <div key={key} aria-hidden className="h-7" />

          case 'ol':
            return (
              <ol key={key} className="list-decimal ps-[21px]">
                {line.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )

          case 'link':
            return (
              <p key={key} className="text-[16px] font-bold">
                <TermsLink href={line.href} label={line.label} />
              </p>
            )
        }
      })}
    </div>
  )
}

function TermsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[#7433FF] underline decoration-solid underline-offset-2 transition-opacity hover:opacity-75"
    >
      {label}
    </Link>
  )
}
