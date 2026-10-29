'use client'

import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Calendar03Icon,
  Call02Icon,
  CheckmarkBadge02Icon,
  Facebook01Icon,
  Globe02Icon,
  InformationCircleIcon,
  InstagramIcon,
  Linkedin01Icon,
  Location01Icon,
  Mail02Icon,
  NewTwitterIcon,
  TiktokIcon,
  WhatsappIcon,
  YoutubeIcon,
} from '@hugeicons/core-free-icons'

import { MarkdownView } from '@ticketur/ui/components/markdown-view'
import { normalizeWebUrl } from '@ticketur/api/lib/web-url'

import type { VendorRecord } from '@/lib/vendors'

export type VendorContact = {
  phone: string | null
  email: string
  location: string
  websiteUrl: string | null
  instagramUrl: string | null
  twitterUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
  linkedinUrl: string | null
  youtubeUrl: string | null
  whatsapp: string | null
}

export function VendorAbout({
  vendor,
  contact,
  previousEvents,
}: {
  vendor: VendorRecord
  contact: VendorContact
  previousEvents: { id: string; title: string }[]
}) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="flex flex-1 flex-col gap-6 md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-5 md:gap-6 md:p-6"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="text-primary size-5"
                strokeWidth={1.8}
              />
              <h2 className="font-heading text-foreground text-lg font-semibold md:text-xl">
                About the Vendor
              </h2>
            </div>
            {vendor.fullDescription.length > 0 ? (
              <MarkdownView className="text-muted-foreground prose-p:text-muted-foreground">
                {vendor.fullDescription.join('\n\n')}
              </MarkdownView>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                No description provided.
              </p>
            )}
            <div className="border-border grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3 sm:gap-4">
              <Stat label="Expertise" value={vendor.expertise} />
              <Stat label="Focus" value={vendor.focus} />
              <Stat label="Experience" value={vendor.experience} />
            </div>
          </motion.div>

          {vendor.certified && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="border-primary/20 dark:border-primary/30 dark:bg-primary/10 flex flex-col gap-4 rounded-2xl border bg-[#f1ebff] p-5 md:gap-5 md:p-6"
            >
              <h3 className="font-heading text-foreground text-lg font-semibold">
                Vendor Quality
              </h3>
              <ul className="flex flex-col gap-3">
                <QualityItem
                  icon={CheckmarkBadge02Icon}
                  title="Certified Partner"
                  description="Fully vetted and verified by the Ticketeur platform."
                />
              </ul>
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="border-border bg-card flex w-full flex-col gap-4 rounded-2xl border p-5 md:w-[320px] md:shrink-0 md:gap-5 md:p-6"
        >
          <h3 className="font-heading text-foreground text-lg font-semibold">
            Contact Information
          </h3>
          <ul className="flex flex-col gap-3.5">
            {contact.phone && (
              <ContactRow icon={Call02Icon} label={contact.phone} />
            )}
            <ContactRow icon={Mail02Icon} label={contact.email} />
            <ContactRow icon={Location01Icon} label={contact.location} />
            {contact.websiteUrl && (
              <ContactRow
                icon={Globe02Icon}
                label={contact.websiteUrl.replace(/^https?:\/\//, '')}
                href={contact.websiteUrl}
              />
            )}
          </ul>

          {contact.instagramUrl ||
          contact.twitterUrl ||
          contact.facebookUrl ||
          contact.tiktokUrl ||
          contact.linkedinUrl ||
          contact.youtubeUrl ||
          contact.whatsapp ? (
            <div className="border-border flex flex-col gap-3 border-t pt-4">
              <span className="text-muted-foreground text-xs font-medium">
                Social Media
              </span>
              {contact.whatsapp && (
                <ContactRow
                  icon={WhatsappIcon}
                  label={contact.whatsapp}
                  href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`}
                />
              )}
              {contact.instagramUrl && (
                <ContactRow
                  icon={InstagramIcon}
                  label={contact.instagramUrl.replace(/^https?:\/\//, '')}
                  href={contact.instagramUrl}
                />
              )}
              {contact.twitterUrl && (
                <ContactRow
                  icon={NewTwitterIcon}
                  label={contact.twitterUrl.replace(/^https?:\/\//, '')}
                  href={contact.twitterUrl}
                />
              )}
              {contact.facebookUrl && (
                <ContactRow
                  icon={Facebook01Icon}
                  label={contact.facebookUrl.replace(/^https?:\/\//, '')}
                  href={contact.facebookUrl}
                />
              )}
              {contact.tiktokUrl && (
                <ContactRow
                  icon={TiktokIcon}
                  label={contact.tiktokUrl.replace(/^https?:\/\//, '')}
                  href={contact.tiktokUrl}
                />
              )}
              {contact.linkedinUrl && (
                <ContactRow
                  icon={Linkedin01Icon}
                  label={contact.linkedinUrl.replace(/^https?:\/\//, '')}
                  href={contact.linkedinUrl}
                />
              )}
              {contact.youtubeUrl && (
                <ContactRow
                  icon={YoutubeIcon}
                  label={contact.youtubeUrl.replace(/^https?:\/\//, '')}
                  href={contact.youtubeUrl}
                />
              )}
            </div>
          ) : null}
        </motion.div>
      </div>

      {previousEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5 md:p-6"
        >
          <h3 className="font-heading text-foreground text-lg font-semibold">
            Previous Events
          </h3>
          <ul className="flex flex-col gap-2">
            {previousEvents.map((event) => (
              <li
                key={event.id}
                className="border-primary/20 bg-primary/5 text-foreground flex items-center gap-2.5 rounded-lg border p-3.5 text-sm font-medium"
              >
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  className="text-muted-foreground size-4 shrink-0"
                  strokeWidth={1.6}
                />
                {event.title}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dark:bg-primary/10 flex flex-col gap-1 rounded-xl bg-[#f1ebff] px-4 py-3">
      <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span className="text-foreground font-semibold">{value}</span>
    </div>
  )
}

function QualityItem({
  icon,
  title,
  description,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  title: string
  description: string
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="bg-primary/15 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
        <HugeiconsIcon icon={icon} className="size-4" strokeWidth={2} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground font-semibold">{title}</span>
        <span className="text-muted-foreground text-sm">{description}</span>
      </div>
    </li>
  )
}

function ContactRow({
  icon,
  label,
  href,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  label: string
  href?: string
}) {
  // Only http(s) links become clickable, and a stored "facebook.com/x" (from
  // before links were normalised on save) is made absolute — as a bare path it
  // pointed back into this site and went nowhere.
  const safeHref = normalizeWebUrl(href) ?? undefined
  const content = (
    <>
      <HugeiconsIcon
        icon={icon}
        className="text-muted-foreground size-4.5 shrink-0"
        strokeWidth={1.6}
      />
      <span className="truncate">{label}</span>
    </>
  )
  return (
    <li className="text-foreground flex items-center gap-2.5 text-sm">
      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary flex min-w-0 items-center gap-2.5 transition-colors"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </li>
  )
}
