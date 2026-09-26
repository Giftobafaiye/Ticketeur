// Plain-English Terms overview, transcribed from the Figma design
// (file 5yIZ0Bwb83SJQbun5zRiWV, node 5633:195). Rendered by ./page.tsx.
//
// This page explains the Terms in human language; it does not replace them.
// The binding document lives at /terms/full — every "Read the Full … →" link
// here points at it, so the two must stay in step when either is revised.
//
// Structure mirrors the design: a section heading (H2) followed by one or more
// groups, each group a run of headings / body / link blocks. Body lines are
// one logical sentence (or sentence run) each — the design breaks after every
// sentence and lets longer ones wrap.

/** A single line within a body block. */
export type OverviewLine =
  /** Regular body copy. */
  | { t: 'p'; text: string }
  /** Body copy at the same size, bolded for emphasis. */
  | { t: 'b'; text: string }
  /** A bolded 16px lead-in line. */
  | { t: 'lead'; text: string }
  /** A numbered list. */
  | { t: 'ol'; items: string[] }
  /** A blank line, used to set a list or closing line apart. */
  | { t: 'gap' }
  /** A call-to-action link sitting in the body's own line flow. */
  | { t: 'link'; label: string; href: string }

export type OverviewBlock =
  | { kind: 'h3'; text: string }
  | { kind: 'h4'; text: string }
  | { kind: 'body'; lines: OverviewLine[] }
  /** A standalone link, optionally introduced by a bold lead-in. */
  | { kind: 'link'; lead?: string; label: string; href: string }

export type OverviewSection = {
  /** Anchor id, also used as the React key. */
  id: string
  heading: string
  /**
   * Gap between the blocks inside one group, in px. The design settles on 32
   * from "Who is responsible for the event?" onwards but sets the opening
   * sections tighter, so those carry an explicit value.
   */
  blockGap?: 12 | 16 | 32
  /** Blocks are grouped; groups sit further apart than the blocks inside one. */
  groups: OverviewBlock[][]
}

export const TERMS_OVERVIEW_LAST_UPDATED = 'September 9, 2026'

/** The binding document these links hand off to. */
const FULL_TERMS = '/terms/full'

export const TERMS_OVERVIEW_SECTIONS: OverviewSection[] = [
  {
    id: 'before-you-use-ticketeur',
    blockGap: 12,
    heading: 'Before You Use Ticketeur',
    groups: [
      [
        { kind: 'h3', text: 'Here’s how this works.' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'You might be here to find your next event.' },
            { t: 'p', text: 'You might be the one creating it.' },
            {
              t: 'p',
              text: 'Or you might be one of the people helping bring it to life.',
            },
            {
              t: 'p',
              text: 'Whatever brought you here, we think you should understand what you’re signing up for.',
            },
            {
              t: 'p',
              text: 'Ticketeur brings attendees, event organisers and vendors together on one platform. These terms explain what you can expect from us, what we expect from you, and what happens when things don’t go according to plan.',
            },
            {
              t: 'p',
              text: 'We’ve written this version in plain English because you shouldn’t need a law degree to understand the rules of a platform you use.',
            },
          ],
        },
        {
          kind: 'link',
          lead: 'Want the precise legal wording? ',
          label: '[Read the Full Terms of Service →]',
          href: FULL_TERMS,
        },
      ],
      [
        { kind: 'h3', text: 'What are you here to do?' },
        { kind: 'h4', text: 'Attend an event' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Discover events, buy tickets and get the information you need before you show up.',
            },
            {
              t: 'link',
              label: '[I’m attending an event]',
              href: '/events',
            },
          ],
        },
        { kind: 'h4', text: 'Organise an event' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Create your event, sell tickets, manage attendees and keep track of your sales.',
            },
            {
              t: 'link',
              label: '[I’m organising an event]',
              href: '/signup?role=organizer',
            },
          ],
        },
        { kind: 'h4', text: 'Provide a service' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Create a vendor profile, showcase what you offer and connect with event organisers looking for businesses like yours.',
            },
            {
              t: 'link',
              label: '[I’m a vendor]',
              href: '/signup?role=vendor',
            },
          ],
        },
      ],
    ],
  },

  {
    id: 'what-is-ticketeur',
    blockGap: 12,
    heading: 'What exactly is Ticketeur?',
    groups: [
      [
        { kind: 'h3', text: 'We bring the people behind events together.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'An event is rarely just an organiser and a crowd.',
            },
            {
              t: 'p',
              text: 'There are attendees looking for something worth showing up for.',
            },
            {
              t: 'p',
              text: 'Organisers trying to turn an idea into an experience.',
            },
            {
              t: 'p',
              text: 'Vendors supplying the goods and services that help make it happen.',
            },
            {
              t: 'p',
              text: 'Ticketeur is the technology platform that helps bring those people together.',
            },
            {
              t: 'p',
              text: 'Organisers can create and manage events, sell tickets and manage attendees.',
            },
            {
              t: 'p',
              text: 'Attendees can discover events, buy tickets and receive information about the events they’re attending.',
            },
            {
              t: 'p',
              text: 'Vendors can create profiles, offer their services and connect with organisers.',
            },
            {
              t: 'p',
              text: 'We also provide technology that can support things like ticketing, payments, verification, promotion and event management.',
            },
            { t: 'p', text: 'But there’s an important distinction:' },
          ],
        },
        {
          kind: 'h3',
          text: 'We provide the platform. The organiser provides the event.',
        },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Unless we specifically tell you otherwise, Ticketeur is not the producer, promoter, owner, sponsor or organiser of a third-party event listed on the platform.',
            },
            { t: 'p', text: 'That distinction matters.' },
            {
              t: 'p',
              text: 'We can provide the infrastructure that helps an event happen.',
            },
            {
              t: 'p',
              text: 'But the organiser remains responsible for actually delivering the event.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the precise legal provisions →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'buying-a-ticket',
    blockGap: 16,
    heading: 'Buying a ticket? Here’s what you should know.',
    groups: [
      [
        { kind: 'h3', text: 'We bring the people behind events together.' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Buying a ticket should be the easy part.' },
            {
              t: 'p',
              text: 'But before you hit Buy, take a moment to make sure you know exactly what you’re buying.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Before you buy' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Check the:' },
            {
              t: 'ol',
              items: [
                'event;',
                'date and time;',
                'venue;',
                'ticket type;',
                'number of tickets;',
                'price;',
                'applicable service fees;',
                'refund conditions;',
                'age restrictions; and',
                'any additional conditions that apply to that particular event.',
              ],
            },
            { t: 'gap' },
            {
              t: 'p',
              text: 'Thirty seconds now can save a lot of confusion later.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'When is my ticket actually confirmed?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Adding a ticket to your basket isn’t the same as owning it.',
            },
            {
              t: 'p',
              text: 'Your purchase is complete once your payment has been successfully processed and confirmation has been issued by Ticketeur or the authorised payment provider.',
            },
            {
              t: 'p',
              text: 'Until then, ticket availability isn’t guaranteed.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'How do I know my Ticketeur ticket is genuine?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'lead',
              text: 'A ticket should be a ticket. Not a gamble.',
            },
            {
              t: 'p',
              text: 'Tickets issued through Ticketeur may include unique identifiers, QR codes, barcodes or other authentication mechanisms designed to identify and validate them.',
            },
            { t: 'p', text: 'Keep your ticket secure.' },
            {
              t: 'p',
              text: 'Don’t copy it, alter it or fraudulently reproduce it.',
            },
            {
              t: 'p',
              text: 'If a ticket is valid for one admission, a duplicated or previously used copy may be refused at the event. Ticketeur and/or the relevant organiser may also invalidate tickets reasonably suspected of being fraudulent or manipulated.',
            },
            {
              t: 'p',
              text: 'And if you buy a ticket outside Ticketeur, we generally can’t guarantee that it’s valid.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Can I transfer or resell my ticket?' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Sometimes.' },
            {
              t: 'p',
              text: 'Ticket transfers and resale are only permitted where Ticketeur and the relevant event allow them.',
            },
            {
              t: 'p',
              text: 'If transfers or resale aren’t permitted for your event, attempting to resell or transfer the ticket may result in the ticket being restricted or cancelled.',
            },
            {
              t: 'p',
              text: 'Always check the conditions attached to your event before transferring a ticket.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the full Ticket Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'cancelled-or-postponed',
    blockGap: 16,
    heading: '3. What happens if my event is cancelled or postponed?',
    groups: [
      [
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Plans change. Sometimes events do too.' },
            {
              t: 'p',
              text: 'An organiser may cancel, postpone, reschedule or materially change an event, subject to the rules that apply to that event and applicable law.',
            },
            {
              t: 'p',
              text: 'When Ticketeur receives notice of a cancellation or postponement, we may use the contact information associated with your transaction to let you know.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Can I get a refund if an event is cancelled?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'That depends on the event, why it was cancelled or changed, the organiser’s applicable refund policy, and any rights you have under applicable law.',
            },
            {
              t: 'p',
              text: 'Unless the law requires otherwise or Ticketeur has expressly said otherwise, Ticketeur is not responsible for providing a refund simply because an organiser cancels, postpones or materially changes an event.',
            },
            {
              t: 'p',
              text: 'Where we process a refund on an organiser’s behalf, we’ll process it according to the applicable refund procedure.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Are service fees refundable?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'They may be refundable or non-refundable depending on the applicable refund terms and the circumstances.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'How do I request a refund?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Use Ticketeur’s designated support channel and make your request within any applicable deadline.',
            },
            {
              t: 'p',
              text: 'And importantly, nothing in our Terms takes away consumer or refund rights that the law says cannot be excluded.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the full Refund & Cancellation Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'who-is-responsible',
    heading: '4. Who is responsible for the event?',
    groups: [
      [
        {
          kind: 'h3',
          text: 'We provide the platform. The organiser provides the event.',
        },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'It’s worth saying twice.' },
            {
              t: 'p',
              text: 'Ticketeur can provide the technology behind an event: ticketing, payment support, verification, promotion and event-management tools.',
            },
            {
              t: 'p',
              text: 'But if a third-party organiser lists an event on Ticketeur, that organiser remains responsible for the event itself.',
            },
            { t: 'p', text: 'That includes things like:' },
            { t: 'gap' },
            {
              t: 'ol',
              items: [
                'planning and organising the event;',
                'the venue;',
                'safety arrangements;',
                'licences and permissions;',
                'the accuracy of the information provided about the event;',
                'complying with applicable laws;',
                'honouring valid tickets;',
                'communicating material changes; and',
                'delivering the event substantially as advertised.',
              ],
            },
            { t: 'gap' },
            {
              t: 'p',
              text: 'We want to make the distinction clear because trust works better when everyone knows where their responsibility begins and ends.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Organiser Responsibility Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'organising-an-event',
    heading: '5. Organising an event? Your event is yours.',
    groups: [
      [
        { kind: 'h3', text: 'We give you the tools to run it.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'If you’re an organiser, Ticketeur can help you:',
            },
            {
              t: 'ol',
              items: [
                'create and manage your event;',
                'publish event information;',
                'create and sell tickets;',
                'manage attendees;',
                'monitor ticket sales; and',
                'use the event-management tools available on the platform.',
              ],
            },
            { t: 'gap' },
            { t: 'p', text: 'That’s our side.' },
            { t: 'gap' },
            { t: 'p', text: 'Here’s yours.' },
          ],
        },
      ],
      [
        {
          kind: 'h3',
          text: 'Tell people the truth about what you’re selling.',
        },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'The information you provide about your event needs to be accurate, complete and not misleading.',
            },
            {
              t: 'p',
              text: 'If the venue changes, the date moves, the event is cancelled or something significant changes, you need to let us know promptly.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Make sure you have the right to run it.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'You’re responsible for having the licences, permissions, approvals and other rights required to organise and promote your event.',
            },
            {
              t: 'p',
              text: 'You’re also responsible for complying with applicable laws, regulations and health and safety requirements.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Honour valid tickets.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'If someone has a valid ticket for your event, you’re expected to honour it subject to the applicable terms.',
            },
            {
              t: 'p',
              text: 'And your event should be provided substantially as you advertised it, or attendees should receive appropriate notice when something material changes.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Only upload what you have the right to use.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'If you give us photographs, music, logos, trademarks, videos, artwork or other material for your event, you need to have the necessary rights to use it.',
            },
            { t: 'p', text: 'Your event is your business.' },
            { t: 'p', text: 'We provide the infrastructure.' },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Organiser Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'joining-as-a-vendor',
    heading: '6. Joining Ticketeur as a vendor?',
    groups: [
      [
        { kind: 'h3', text: 'Good events need good people behind them.' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Caterers. Photographers. Decorators.' },
            { t: 'p', text: 'Production teams.' },
            {
              t: 'p',
              text: 'And all kinds of other businesses and service providers.',
            },
            {
              t: 'p',
              text: 'Ticketeur can help vendors create profiles, offer their goods or services, communicate with organisers and receive event-related opportunities.',
            },
            {
              t: 'p',
              text: 'We may also carry out verification checks before approving or maintaining a vendor profile.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What do we expect from vendors?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Be accurate about who you are, what your business does and what you provide.',
            },
            {
              t: 'p',
              text: 'Have the licences, permits, registrations and approvals you need to provide your goods or services.',
            },
            {
              t: 'p',
              text: 'And take responsibility for the quality, safety, legality and delivery of what you offer.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Does being on Ticketeur guarantee me work?' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'No.' },
            {
              t: 'p',
              text: 'Being listed as a vendor doesn’t guarantee that an organiser will choose you or that you’ll receive any minimum number of engagements.',
            },
            { t: 'p', text: 'Ticketeur helps create the connection.' },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'We make the introduction. You make the deal.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Where an organiser and vendor decide to work together independently, they are responsible for agreeing things like fees, deliverables, timelines and cancellation arrangements between themselves.',
            },
            {
              t: 'p',
              text: 'Unless we expressly agree otherwise, Ticketeur isn’t a party to that independent agreement and doesn’t guarantee it.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Vendor Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'how-money-works',
    heading: '7. How does money work on Ticketeur?',
    groups: [
      [
        { kind: 'h3', text: 'Who decides ticket prices?' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Generally, the organiser does.' },
            {
              t: 'p',
              text: 'Unless we tell you otherwise, the relevant event organiser determines the ticket price.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Does Ticketeur charge service fees?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'We may charge service fees, commissions, processing charges or other applicable fees for use of the platform or particular services.',
            },
            {
              t: 'p',
              text: 'Applicable fees will be disclosed before you complete a transaction where reasonably practicable.',
            },
            {
              t: 'p',
              text: 'Taxes, government charges or other applicable costs may also be added where required.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'Who processes my payment?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Payments may be processed through third-party payment providers.',
            },
            {
              t: 'p',
              text: 'When that happens, your payment is also subject to the relevant provider’s terms and privacy policies.',
            },
            {
              t: 'p',
              text: 'Where a third-party provider handles payment processing, Ticketeur does not ordinarily store your complete payment-card credentials.',
            },
            {
              t: 'p',
              text: 'And please only use payment methods that belong to you or that you’re authorised to use.',
            },
            {
              t: 'p',
              text: 'If we have reasonable grounds to suspect fraud, unauthorised use or unlawful activity, a transaction may be refused or reversed.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Pricing & Payment Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'keeping-ticketeur-trustworthy',
    heading: '8. How do we keep Ticketeur trustworthy?',
    groups: [
      [
        { kind: 'h3', text: 'Trust doesn’t happen by accident.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'A marketplace only works when attendees can trust the tickets they buy, organisers can trust the people they’re dealing with, and legitimate vendors aren’t competing with people pretending to be something they’re not.',
            },
            {
              t: 'p',
              text: 'That’s why Ticketeur may ask for additional information or verification—particularly when we need to verify an organiser or vendor, prevent fraud or comply with the law.',
            },
            {
              t: 'p',
              text: 'It’s also why we may monitor transactions and platform activity for security, fraud prevention, compliance and operational purposes.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What happens when something doesn’t look right?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Where we reasonably suspect fraud, identity theft, ticket manipulation, money laundering or other unlawful activity, we may take action.',
            },
            {
              t: 'p',
              text: 'Depending on the circumstances, that can include:',
            },
            { t: 'gap' },
            {
              t: 'ol',
              items: [
                'asking for additional verification;',
                'suspending or restricting an account;',
                'holding or cancelling a transaction;',
                'invalidating a ticket;',
                'investigating the activity;',
                'withholding funds where legally permitted; or',
                'reporting activity to the appropriate authorities where necessary.',
              ],
            },
            { t: 'gap' },
            {
              t: 'p',
              text: 'Sometimes we may need to act without giving advance notice if immediate action is reasonably necessary to protect users, Ticketeur or other people.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What isn’t allowed on Ticketeur?' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Among other things:' },
            { t: 'gap' },
            { t: 'p', text: 'No fake events.' },
            { t: 'p', text: 'No counterfeit tickets.' },
            { t: 'p', text: 'No stolen payment methods.' },
            { t: 'p', text: 'No impersonating other people.' },
            { t: 'p', text: 'No manipulating ticket availability or prices.' },
            { t: 'p', text: 'No unauthorised ticket resale.' },
            {
              t: 'p',
              text: 'No hacking, malware or attempts to bypass our security.',
            },
            {
              t: 'p',
              text: 'No harvesting user information without lawful authority.',
            },
            {
              t: 'p',
              text: 'No fraud, harassment, deception or criminal activity.',
            },
            { t: 'gap' },
            { t: 'p', text: 'In short:' },
            {
              t: 'b',
              text: 'Use Ticketeur for events. Not for exploiting the people who use it.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Acceptable Use & Fraud Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'content-and-personal-information',
    heading: '9. What happens to my content and personal information?',
    groups: [
      [
        { kind: 'h3', text: 'Your content is still yours.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'If you upload event descriptions, photographs, videos, logos or other content to Ticketeur, you retain ownership of that content.',
            },
            {
              t: 'p',
              text: 'But we need permission to use it to make the platform work.',
            },
            {
              t: 'p',
              text: 'By submitting content, you give Ticketeur a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display, transmit, format, adapt and otherwise use that content for the purposes described in the full Terms, including operating, providing, improving and promoting the platform and applicable services.',
            },
            {
              t: 'p',
              text: 'You also need to make sure you actually have the rights and permissions required to upload the content in the first place.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What about my personal information?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'We process personal information in accordance with our Privacy Policy and applicable data-protection laws.',
            },
            {
              t: 'p',
              text: 'Depending on how you use Ticketeur, that may include processing information for:',
            },
            { t: 'gap' },
            {
              t: 'ol',
              items: [
                'account administration;',
                'ticket transactions;',
                'event management;',
                'verification;',
                'fraud prevention;',
                'communications;',
                'security; and',
                'customer support.',
              ],
            },
          ],
        },
        { kind: 'link', label: '[Read the privacy policy →]', href: '/privacy' },
        {
          kind: 'link',
          label: '[Read the Full Content & Intellectual Property Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'when-something-goes-wrong',
    heading: '10. What happens when something goes wrong?',
    groups: [
      [
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'We work to keep Ticketeur available, functional and secure.',
            },
            {
              t: 'p',
              text: 'But no digital platform can promise that nothing will ever go wrong.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What if Ticketeur is temporarily unavailable?' },
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Maintenance happens.' },
            {
              t: 'p',
              text: 'So do upgrades, technical failures, network problems, security incidents and circumstances outside our reasonable control.',
            },
            {
              t: 'p',
              text: 'We use reasonable efforts to maintain the availability and functionality of the platform, but we don’t guarantee that it will always be uninterrupted or error-free.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What about third-party services?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Ticketeur may rely on or integrate with third-party services, including payment, analytics, communications and other technology providers.',
            },
            {
              t: 'p',
              text: 'Those providers may have their own terms and privacy policies.',
            },
            {
              t: 'p',
              text: 'Their independent actions, availability and policies are generally outside Ticketeur’s control, subject to applicable law.',
            },
          ],
        },
      ],
      [
        { kind: 'h3', text: 'What if my account is suspended?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'We may suspend or terminate access where, for example, someone breaches the Terms, provides false information, is involved in suspected fraud, creates a security or legal risk, harms another user or Ticketeur, or where suspension is required by law or a competent authority.',
            },
            {
              t: 'p',
              text: 'Where reasonably practicable, we’ll provide notice first.',
            },
            {
              t: 'p',
              text: 'But where immediate action is needed to prevent fraud, unlawful conduct, security risks or material harm, we may need to act immediately.',
            },
            {
              t: 'p',
              text: 'The full Terms contain the precise provisions governing platform availability, third-party services, suspension, disclaimers, liability and other circumstances where things don’t go according to plan.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read Those Provisions →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'can-i-stop-using-ticketeur',
    heading: '11. Can I stop using Ticketeur?',
    groups: [
      [
        {
          kind: 'body',
          lines: [
            { t: 'p', text: 'Yes.' },
            {
              t: 'p',
              text: 'You may stop using the platform at any time.',
            },
            {
              t: 'p',
              text: 'Stopping use of Ticketeur doesn’t necessarily erase obligations that arose while you were using it.',
            },
            {
              t: 'p',
              text: 'For organisers and vendors, for example, obligations connected with transactions entered into before termination may continue.',
            },
            {
              t: 'p',
              text: 'And certain provisions of the Terms are designed to continue even after your access ends.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Suspension & Termination Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'if-we-disagree',
    heading: '12. What happens if we disagree?',
    groups: [
      [
        { kind: 'h3', text: 'Talk to us first.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'If you have a complaint or dispute concerning Ticketeur or these Terms, we want the issue raised through the appropriate contact channel so it can be addressed.',
            },
            {
              t: 'p',
              text: 'The full Terms set out the formal process that applies where a dispute cannot be resolved directly.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Dispute Resolution Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'a-few-things-lawyers-insist-on',
    heading: 'A few things lawyers quite rightly insist we tell you',
    groups: [
      [
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'Some parts of an agreement simply need precise legal language.',
            },
            {
              t: 'p',
              text: 'Our full Terms therefore also contain provisions covering:',
            },
            { t: 'gap' },
            {
              t: 'ol',
              items: [
                'disclaimers;',
                'limitation of liability;',
                'indemnification;',
                'circumstances beyond our reasonable control;',
                'changes to these Terms;',
                'legal notices;',
                'governing law;',
                'dispute resolution;',
                'severability; and',
                'the complete legal agreement between you and Ticketeur.',
              ],
            },
            { t: 'gap' },
            {
              t: 'p',
              text: 'We could try to make every one of those sound clever.',
            },
            { t: 'p', text: 'We’d rather make sure they’re accurate.' },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Legal Terms →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },

  {
    id: 'still-have-a-question',
    heading: 'Still have a question?',
    groups: [
      [
        { kind: 'h3', text: 'Talk to us.' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'If something about these Terms, your account, a ticket or the platform isn’t clear, contact Ticketeur through the appropriate support channel.',
            },
            { t: 'p', text: 'We’d rather you ask than guess.' },
          ],
        },
        {
          kind: 'link',
          label: '[Contact Ticketeur →]',
          href: `${FULL_TERMS}#contact`,
        },
      ],
    ],
  },

  {
    id: 'the-full-legal-terms',
    heading: 'The Full Legal Terms of Service',
    groups: [
      [
        { kind: 'h3', text: 'Want the precise wording?' },
        {
          kind: 'body',
          lines: [
            {
              t: 'p',
              text: 'This page was written to help make Ticketeur’s Terms easier to understand.',
            },
            {
              t: 'p',
              text: 'It gives you a human-readable explanation of how the relationship works,',
            },
            {
              t: 'b',
              text: 'but it does not replace, amend or override the legally binding Terms of Service.',
            },
            { t: 'gap' },
            {
              t: 'p',
              text: 'For the exact legal rights, responsibilities, limitations and obligations that apply when you use Ticketeur, please read the complete Terms.',
            },
          ],
        },
        {
          kind: 'link',
          label: '[Read the Full Terms of Service →]',
          href: FULL_TERMS,
        },
      ],
    ],
  },
]
