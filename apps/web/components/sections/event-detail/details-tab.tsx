'use client'

import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'

import { MarkdownView } from '@ticketur/ui/components/markdown-view'

import type { EventDetailData } from '@/components/sections/event-detail/types'

export function DetailsTab({ event }: { event: EventDetailData }) {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <section aria-labelledby="about-heading" className="flex flex-col gap-4">
        <h2
          id="about-heading"
          className="font-heading text-foreground text-2xl font-semibold"
        >
          About the Event
        </h2>
        {event.description.length > 0 ? (
          <MarkdownView className="dark:text-muted-foreground prose-p:text-[#484848] dark:prose-p:text-muted-foreground text-[#484848]">
            {event.description.join('\n\n')}
          </MarkdownView>
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
            No description provided.
          </p>
        )}
      </section>

      {event.features.length > 0 ? (
        <section
          aria-labelledby="features-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="features-heading"
            className="font-heading text-foreground text-2xl font-semibold"
          >
            Features
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:flex md:flex-wrap md:gap-6">
            {event.features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{
                  delay: i * 0.05,
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -3, scale: 1.02 }}
                className="dark:border-primary/30 dark:bg-primary/10 flex flex-col items-center justify-center gap-4 rounded-xl border border-[#d4c0ff] bg-[#f1ebff] px-6 py-6 md:min-w-[155px]"
              >
                <HugeiconsIcon
                  icon={feature.icon}
                  className="text-primary size-[30px]"
                  strokeWidth={1.8}
                />
                <span className="dark:text-foreground text-center text-sm font-semibold text-[#282828] md:text-base">
                  {feature.label}
                </span>
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
