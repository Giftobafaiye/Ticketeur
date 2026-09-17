import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Image from 'next/image'

import {
  TERMS_EFFECTIVE_DATE,
  TERMS_LAST_UPDATED,
  TERMS_PREAMBLE,
  TERMS_SECTIONS,
  type TermsBlock,
} from './terms-content'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your access to and use of the Ticketeur platform.',
}

const BODY =
  'font-heading text-foreground/90 text-base leading-7 md:text-lg md:leading-8'
const LIST = `${BODY} ml-5 flex list-disc flex-col gap-1.5`

export default function TermsPage() {
  return (
    <>
      <section
        aria-label="Terms of service header"
        className="relative isolate flex min-h-[360px] w-full items-center justify-center overflow-hidden md:min-h-[546px]"
      >
        <Image
          src="/legal.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 mx-auto flex w-full max-w-360 flex-col items-center gap-3 px-6 py-20 text-center md:py-24">
          <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight text-white sm:text-5xl md:text-[56px] md:leading-[1.2]">
            Terms of Service
          </h1>
          <p className="font-heading text-base font-semibold text-white/90 md:text-xl">
            Last updated: {TERMS_LAST_UPDATED}
          </p>
        </div>
      </section>

      <article className="mx-auto w-full max-w-[823px] px-6 py-16 md:py-20">
        <p className="text-muted-foreground text-sm font-medium">
          Effective Date: {TERMS_EFFECTIVE_DATE} · Last Updated:{' '}
          {TERMS_LAST_UPDATED}
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {TERMS_PREAMBLE.map((para, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'font-heading text-foreground/90 text-lg leading-7 md:text-xl md:leading-8'
                  : BODY
              }
            >
              {para}
            </p>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-9 md:gap-10">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.n} className="flex flex-col gap-3.5">
              <h2 className="font-heading text-foreground text-lg font-bold tracking-tight md:text-xl">
                {section.n}. {section.title}
              </h2>
              {section.blocks.map((block, i) => (
                <Block key={blockKey(section.n, block, i)} block={block} />
              ))}
            </section>
          ))}
        </div>
      </article>
    </>
  )
}

function blockKey(sectionN: string, block: TermsBlock, i: number) {
  if (block.kind === 'clause') return `${sectionN}-${block.n}`
  return `${sectionN}-${block.kind}-${i}`
}

function Block({ block }: { block: TermsBlock }) {
  switch (block.kind) {
    case 'lead':
      return <p className={BODY}>{block.text}</p>

    case 'clause':
      return (
        <div className="flex flex-col gap-2">
          <p className={BODY}>
            <span className="text-foreground font-semibold">{block.n}</span>{' '}
            {block.text}
          </p>
          {block.items ? <BulletList items={block.items} /> : null}
        </div>
      )

    case 'list':
      return <BulletList items={block.items} />

    case 'sub':
      return (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-foreground text-base font-semibold md:text-lg">
            {block.title}
          </h3>
          <p className={BODY}>{block.lead}</p>
          <BulletList items={block.items} />
          {block.tail ? <p className={BODY}>{block.tail}</p> : null}
        </div>
      )

    case 'contact':
      return (
        <div className="border-border/70 bg-muted/30 mt-1 flex flex-col gap-1 rounded-xl border p-4 md:p-5">
          {block.lines.map((line, i) => (
            <ContactLine key={i} line={line} />
          ))}
        </div>
      )
  }
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className={LIST}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function ContactLine({ line }: { line: string }) {
  const sep = line.indexOf(': ')
  if (sep === -1) {
    return <p className="text-foreground text-sm font-semibold">{line}</p>
  }
  const label = line.slice(0, sep)
  const value = line.slice(sep + 2)

  let valueNode: ReactNode = value
  if (label === 'Email') {
    valueNode = (
      <a
        href={`mailto:${value}`}
        className="text-primary font-medium hover:underline"
      >
        {value}
      </a>
    )
  } else if (label === 'Website') {
    valueNode = (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-medium hover:underline"
      >
        {value.replace(/^https?:\/\//, '').replace(/\/$/, '')}
      </a>
    )
  }

  return (
    <p className="text-foreground/90 text-sm md:text-base">
      <span className="text-muted-foreground font-medium">{label}:</span>{' '}
      {valueNode}
    </p>
  )
}
