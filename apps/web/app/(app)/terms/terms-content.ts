// Terms of Service content, transcribed from the source legal document.
// Rendered by ./page.tsx. Kept as structured data (rather than one markdown
// blob) so individual clauses stay easy to revise. Legal numbering (1.1, 8.10)
// is preserved verbatim — do not renumber.

export type TermsBlock =
  // A lead-in / standalone paragraph within a section.
  | { kind: 'lead'; text: string }
  // A numbered clause (e.g. "1.1"), optionally followed by a bullet list.
  | { kind: 'clause'; n: string; text: string; items?: string[] }
  // A standalone bullet list (definitions, prohibited activities, …).
  | { kind: 'list'; items: string[] }
  // A titled sub-block with its own lead + list + optional closing line
  // (used for section 6's Attendees / Organizers / Vendors).
  | { kind: 'sub'; title: string; lead: string; items: string[]; tail?: string }
  // A contact card (name / address / email / telephone / website lines).
  | { kind: 'contact'; lines: string[] }

export type TermsSection = {
  n: string
  title: string
  blocks: TermsBlock[]
}

export const TERMS_EFFECTIVE_DATE = '9 September 2026'
export const TERMS_LAST_UPDATED = '9 September 2026'

export const TERMS_PREAMBLE: string[] = [
  'These Terms of Service (“Terms”) govern your access to and use of the Ticketeur website, mobile applications, platforms, products and services (collectively, the “Platform”) operated by TICKETEUR VENTURES, a company incorporated under the laws of the Federal Republic of Nigeria with registration number ( ) and registered address at ( ) (“Ticketeur”, “we”, “us” or “our”).',
  'By accessing, browsing, registering on, or using the Platform, purchasing a ticket, creating an event, registering as a vendor, or otherwise using any Ticketeur service, you acknowledge that you have read, understood and agree to be legally bound by these Terms and any policies or terms expressly incorporated into them.',
  'If you do not agree to these Terms, you must not access or use the Platform.',
  'These Terms constitute a legally binding agreement between you and Ticketeur.',
]

export const TERMS_SECTIONS: TermsSection[] = [
  {
    n: '1',
    title: 'Introduction and Acceptance',
    blocks: [
      {
        kind: 'clause',
        n: '1.1',
        text: 'Ticketeur provides a digital platform through which users may discover, promote, organize, manage and participate in events and related activities, including the creation and sale of tickets and the connection of event organizers with vendors and attendees.',
      },
      {
        kind: 'clause',
        n: '1.2',
        text: 'These Terms apply to all users of the Platform, including attendees, event organizers, vendors and other persons accessing or using Ticketeur’s services.',
      },
      {
        kind: 'clause',
        n: '1.3',
        text: 'Certain services, events, transactions or features may be subject to additional terms, policies, guidelines or conditions. Where such additional terms apply, they shall form part of your agreement with Ticketeur.',
      },
      {
        kind: 'clause',
        n: '1.4',
        text: 'By using the Platform, you confirm that you have the legal capacity to enter into a binding contract under applicable law.',
      },
      {
        kind: 'clause',
        n: '1.5',
        text: 'If you use the Platform on behalf of a company, organization, partnership or other legal entity, you represent and warrant that you have authority to bind that entity to these Terms.',
      },
    ],
  },
  {
    n: '2',
    title: 'Definitions',
    blocks: [
      { kind: 'lead', text: 'For purposes of these Terms:' },
      {
        kind: 'list',
        items: [
          '“Attendee” means a person who accesses the Platform to discover, register for or attend an Event, including a person who purchases or receives a Ticket.',
          '“Event” means any concert, conference, festival, party, exhibition, meeting, seminar, sporting activity, entertainment activity or other event listed or managed through the Platform.',
          '“Event Organizers” or “Organizers” means a person or entity that creates, lists, promotes, manages or otherwise offers an Event through the Platform.',
          '“Platform” means the Ticketeur website, applications, software, systems, interfaces and related digital services.',
          '“Ticket” means any digital or physical ticket, pass, registration confirmation, QR code, access credential or other entitlement issued through or in connection with the Platform.',
          '“Vendor” means a person or entity offering goods or services in connection with an Event or through Ticketeur’s vendor functionality.',
          '“User”, “you” or “your” means any person or entity accessing or using the Platform.',
          '“User Content” means information, text, photographs, videos, logos, descriptions, reviews, comments, event information and other materials submitted, uploaded or displayed by a User through the Platform.',
          '“Transaction” means any purchase, booking, registration, payment, refund, transfer or other commercial interaction carried out through the Platform.',
          '“Service Fees” means any fees, commissions, processing charges or other charges applicable to the use of Ticketeur’s services.',
        ],
      },
    ],
  },
  {
    n: '3',
    title: 'About Ticketeur',
    blocks: [
      { kind: 'clause', n: '3.1', text: 'Ticketeur is a technology platform that facilitates interactions between Event Organizers, Attendees and Vendors.' },
      { kind: 'clause', n: '3.2', text: 'Unless expressly stated otherwise, Ticketeur is not the Organizers, producer, promoter, owner, sponsor or operator of Events listed by third-party Organizers.' },
      { kind: 'clause', n: '3.3', text: 'The Organizers is responsible for the Event, including its planning, organization, venue, safety arrangements, content, representations, compliance with applicable laws and fulfillment of obligations owed to Attendees and Vendors.' },
      { kind: 'clause', n: '3.4', text: 'Ticketeur may provide technological, administrative, ticketing, payment-support, verification, promotional or event-management services in connection with an Event.' },
      { kind: 'clause', n: '3.5', text: 'Ticketeur does not guarantee that any particular Event will take place, meet the Organizer’s representations, or satisfy an Attendee’s expectations.' },
    ],
  },
  {
    n: '4',
    title: 'Eligibility',
    blocks: [
      { kind: 'clause', n: '4.1', text: 'You must be legally capable of entering into a binding agreement to use the Platform.' },
      { kind: 'clause', n: '4.2', text: 'If you are under the applicable age of contractual capacity, you may only use the Platform with the involvement and consent of a parent or legal guardian where required by applicable law.' },
      { kind: 'clause', n: '4.3', text: 'Ticketeur reserves the right to restrict access to particular features where age restrictions, legal requirements or Event-specific restrictions apply.' },
      { kind: 'clause', n: '4.4', text: 'You must not use the Platform if you are prohibited from doing so under applicable law.' },
    ],
  },
  {
    n: '5',
    title: 'Account Registration and Verification',
    blocks: [
      { kind: 'clause', n: '5.1', text: 'Certain features require you to create an account.' },
      { kind: 'clause', n: '5.2', text: 'You agree to provide information that is accurate, complete and current and to promptly update information that becomes inaccurate or incomplete.' },
      { kind: 'clause', n: '5.3', text: 'You are responsible for maintaining the confidentiality of your login credentials and for all activities conducted through your account.' },
      { kind: 'clause', n: '5.4', text: 'You must immediately notify Ticketeur if you suspect that your account has been compromised or accessed without authorisation.' },
      { kind: 'clause', n: '5.5', text: 'Ticketeur may require additional information or verification before permitting access to certain services, particularly where required to prevent fraud, comply with applicable law or verify an Organizers or Vendor.' },
      { kind: 'clause', n: '5.6', text: 'Ticketeur may suspend or restrict an account where information provided is inaccurate, misleading, fraudulent or cannot reasonably be verified.' },
      { kind: 'clause', n: '5.7', text: 'You must not create an account using another person’s identity or impersonate another person or entity.' },
    ],
  },
  {
    n: '6',
    title: 'User Categories',
    blocks: [
      {
        kind: 'sub',
        title: '6.1 Attendees',
        lead: 'Attendees may use the Platform to:',
        items: [
          'discover Events',
          'purchase or obtain Tickets',
          'register for Events',
          'receive Event information',
          'communicate with Organizers where available',
          'use other services made available by Ticketeur.',
        ],
        tail: 'Attendees are responsible for reviewing Event information, Ticket conditions, Event-specific requirements and applicable refund conditions before completing a Transaction.',
      },
      {
        kind: 'sub',
        title: '6.2 Organizers',
        lead: 'Organizers may use the Platform to:',
        items: [
          'create and manage Events',
          'publish Event information',
          'create and sell Tickets',
          'manage attendees',
          'monitor ticket sales',
          'access event-management tools',
          'use other Organizers services provided by Ticketeur.',
        ],
        tail: 'Organizers must ensure that all information supplied to Ticketeur and displayed on the Platform is accurate, complete and not misleading.',
      },
      {
        kind: 'sub',
        title: '6.3 Vendors',
        lead: 'Vendors may use the Platform to:',
        items: [
          'create vendor profiles',
          'offer goods or services associated with Events',
          'communicate with Organizers',
          'receive Event-related opportunities',
          'use other Vendor features made available by Ticketeur.',
        ],
        tail: 'Ticketeur may require Vendor verification before permitting a Vendor to use particular Platform features.',
      },
    ],
  },
  {
    n: '7',
    title: 'Nature of Ticketeur’s Platform',
    blocks: [
      { kind: 'clause', n: '7.1', text: 'Ticketeur operates as a technology intermediary and does not generally act as the seller, producer or Organizers of third-party Events.' },
      { kind: 'clause', n: '7.2', text: 'Where an Attendee purchases a Ticket for an Event organised by a third party, the Event Organizers remains responsible for delivering the Event and complying with applicable Event-specific obligations.' },
      { kind: 'clause', n: '7.3', text: 'Ticketeur may facilitate transactions between Users but does not guarantee the performance, conduct, financial standing, legality or reliability of any User.' },
      { kind: 'clause', n: '7.4', text: 'Information concerning Events, Organizers and Vendors may be supplied by those Users. Ticketeur does not guarantee that all User-supplied information is accurate or complete.' },
    ],
  },
  {
    n: '8',
    title: 'Event Organizers’ Responsibilities',
    blocks: [
      { kind: 'lead', text: 'Each Organizers represents, warrants and agrees that:' },
      { kind: 'clause', n: '8.1', text: 'it has the legal authority and all necessary rights, licences, permissions and approvals required to organise and promote the Event;' },
      { kind: 'clause', n: '8.2', text: 'all Event information supplied to Ticketeur is accurate and not misleading;' },
      { kind: 'clause', n: '8.3', text: 'it will comply with all applicable laws, regulations, licensing requirements, health and safety requirements and regulatory obligations;' },
      { kind: 'clause', n: '8.4', text: 'it will honour valid Tickets issued for its Event, subject to applicable terms;' },
      { kind: 'clause', n: '8.5', text: 'it will provide the Event substantially as advertised or provide appropriate notice where material changes occur;' },
      { kind: 'clause', n: '8.6', text: 'it will establish and communicate applicable Event-specific refund and cancellation conditions;' },
      { kind: 'clause', n: '8.7', text: 'it will not use Ticketeur to facilitate unlawful, fraudulent or deceptive activities;' },
      { kind: 'clause', n: '8.8', text: 'it will promptly notify Ticketeur of any cancellation, postponement or material change affecting an Event;' },
      { kind: 'clause', n: '8.9', text: 'it is responsible for obtaining all rights necessary to use photographs, music, trademarks, logos, videos, artwork and other intellectual property supplied to Ticketeur; and' },
      { kind: 'clause', n: '8.10', text: 'it will not collect, use or disclose Attendee information obtained through Ticketeur except in accordance with applicable data-protection laws and applicable contractual obligations.' },
    ],
  },
  {
    n: '9',
    title: 'Ticket Purchases',
    blocks: [
      { kind: 'clause', n: '9.1', text: 'Tickets may be purchased through the Platform subject to availability and any Event-specific conditions.' },
      {
        kind: 'clause',
        n: '9.2',
        text: 'Before purchasing a Ticket, you should carefully review:',
        items: [
          'Event details',
          'date and time',
          'venue',
          'Ticket type',
          'Ticket quantity',
          'price',
          'applicable Service Fees',
          'refund conditions',
          'age restrictions',
          'any additional Event-specific terms.',
        ],
      },
      { kind: 'clause', n: '9.3', text: 'A Ticket purchase is not complete until payment has been successfully processed and confirmation has been issued by Ticketeur or its authorised payment provider.' },
      { kind: 'clause', n: '9.4', text: 'Ticketeur may reject or cancel a Transaction where there is reasonable evidence of fraud, technical error, unauthorised activity, Ticket manipulation or other unlawful conduct.' },
      { kind: 'clause', n: '9.5', text: 'Ticket availability is not guaranteed until the Transaction has been successfully completed.' },
    ],
  },
  {
    n: '10',
    title: 'Ticket Issuance and Authentication',
    blocks: [
      { kind: 'clause', n: '10.1', text: 'Tickets may be issued electronically through the Platform or by another method specified for the relevant Event.' },
      { kind: 'clause', n: '10.2', text: 'Each Ticket may contain a unique identifier, QR code, barcode or other authentication mechanism.' },
      { kind: 'clause', n: '10.3', text: 'Tickets must be kept secure and must not be copied, duplicated, altered or fraudulently reproduced.' },
      { kind: 'clause', n: '10.4', text: 'Where a Ticket is valid only for one admission, presentation of a duplicated or previously used Ticket may result in denial of entry.' },
      { kind: 'clause', n: '10.5', text: 'Ticketeur and/or the relevant Organizers may invalidate Tickets reasonably suspected to have been obtained fraudulently or manipulated.' },
      { kind: 'clause', n: '10.6', text: 'Entry decisions may be subject to reasonable Event-specific security and verification procedures.' },
    ],
  },
  {
    n: '11',
    title: 'Ticket Transfers and Resale',
    blocks: [
      { kind: 'clause', n: '11.1', text: 'Tickets may only be transferred or resold where the relevant Event and Ticketeur expressly permit such transfer or resale.' },
      { kind: 'clause', n: '11.2', text: 'You must not resell Tickets in violation of Event-specific conditions or applicable law.' },
      { kind: 'clause', n: '11.3', text: 'Ticketeur may restrict or cancel Tickets involved in unauthorised resale, fraud or prohibited commercial activity.' },
      { kind: 'clause', n: '11.4', text: 'Unless expressly stated otherwise, Ticketeur does not guarantee the validity of Tickets purchased outside the Platform.' },
    ],
  },
  {
    n: '12',
    title: 'Pricing and Service Fees',
    blocks: [
      { kind: 'clause', n: '12.1', text: 'Ticket prices are determined by the relevant Organizers unless otherwise stated.' },
      { kind: 'clause', n: '12.2', text: 'Ticketeur may charge Service Fees for the use of its Platform or particular services.' },
      { kind: 'clause', n: '12.3', text: 'Applicable fees will be disclosed before completion of a Transaction where reasonably practicable.' },
      { kind: 'clause', n: '12.4', text: 'Unless otherwise stated, taxes, government charges or other applicable fees may be added to the Transaction price where required.' },
      { kind: 'clause', n: '12.5', text: 'Ticketeur reserves the right to modify its Service Fees prospectively.' },
      { kind: 'clause', n: '12.6', text: 'Changes to fees will not affect Transactions already completed unless otherwise required by law or expressly agreed.' },
    ],
  },
  {
    n: '13',
    title: 'Payments',
    blocks: [
      { kind: 'clause', n: '13.1', text: 'Payments may be processed through third-party payment service providers.' },
      { kind: 'clause', n: '13.2', text: 'By initiating a payment, you authorise the applicable payment provider to process the Transaction in accordance with its terms.' },
      { kind: 'clause', n: '13.3', text: 'Ticketeur does not ordinarily store complete payment-card credentials where payment processing is undertaken by a third-party payment provider.' },
      { kind: 'clause', n: '13.4', text: 'You must provide accurate payment information and must only use payment methods that you are authorised to use.' },
      { kind: 'clause', n: '13.5', text: 'Ticketeur may refuse or reverse a Transaction where there are reasonable grounds to suspect fraud, unauthorised use or unlawful activity.' },
      { kind: 'clause', n: '13.6', text: 'Payment processing may be subject to the terms and privacy policies of the relevant payment provider.' },
    ],
  },
  {
    n: '14',
    title: 'Refunds and Cancellations',
    blocks: [
      { kind: 'clause', n: '14.1', text: 'Refund rights may depend on the nature of the Event, the reason for cancellation and the applicable Event-specific refund policy.' },
      { kind: 'clause', n: '14.2', text: 'Unless otherwise required by applicable law or expressly stated by Ticketeur, Ticketeur is not responsible for providing refunds for an Event that is cancelled, postponed or materially changed by an Organizers.' },
      { kind: 'clause', n: '14.3', text: 'Where Ticketeur processes a refund on behalf of an Organizers, the refund will be handled in accordance with the applicable refund procedure.' },
      { kind: 'clause', n: '14.4', text: 'Service Fees may be refundable or non-refundable depending on the applicable refund terms and circumstances.' },
      { kind: 'clause', n: '14.5', text: 'You should submit refund requests through the designated support channel within any applicable deadline.' },
      { kind: 'clause', n: '14.6', text: 'Nothing in these Terms limits any mandatory refund or consumer rights that cannot lawfully be excluded.' },
    ],
  },
  {
    n: '15',
    title: 'Event Postponement and Cancellation',
    blocks: [
      { kind: 'clause', n: '15.1', text: 'An Organizers may cancel, postpone, reschedule or materially alter an Event subject to applicable law and the terms applicable to the Event.' },
      { kind: 'clause', n: '15.2', text: 'Where Ticketeur receives notice of a cancellation or postponement, it may notify affected Attendees using the contact information associated with their Transactions.' },
      { kind: 'clause', n: '15.3', text: 'The applicable refund or Ticket-transfer arrangements will depend on the circumstances and the Organizer’s refund policy, subject to applicable law.' },
      { kind: 'clause', n: '15.4', text: 'Ticketeur is not responsible for an Organizer’s failure to hold an Event except to the extent caused by Ticketeur’s own breach of its obligations.' },
    ],
  },
  {
    n: '16',
    title: 'Chargebacks and Fraudulent Transactions',
    blocks: [
      { kind: 'clause', n: '16.1', text: 'You must not initiate a fraudulent or dishonest chargeback.' },
      { kind: 'clause', n: '16.2', text: 'Where you believe a Transaction was unauthorised or incorrectly processed, you should first contact Ticketeur through its designated support channel and, where applicable, the payment provider.' },
      { kind: 'clause', n: '16.3', text: 'Ticketeur may investigate disputed Transactions and may provide relevant Transaction information to payment providers, financial institutions, law-enforcement authorities or other competent bodies where legally permitted or required.' },
      { kind: 'clause', n: '16.4', text: 'Ticketeur may suspend an account associated with suspected fraudulent activity while an investigation is ongoing.' },
      { kind: 'clause', n: '16.5', text: 'Ticketeur may recover amounts improperly obtained through fraud, unauthorised Transactions or abuse of refunds.' },
    ],
  },
  {
    n: '17',
    title: 'Vendor Participation',
    blocks: [
      { kind: 'clause', n: '17.1', text: 'Vendors must provide accurate information concerning their identity, business, goods and services.' },
      { kind: 'clause', n: '17.2', text: 'Ticketeur may conduct verification checks before approving or maintaining a Vendor profile.' },
      { kind: 'clause', n: '17.3', text: 'Vendors must possess all licences, permits, registrations and approvals required to provide their goods or services.' },
      { kind: 'clause', n: '17.4', text: 'Vendors are solely responsible for the quality, safety, legality and delivery of their goods or services.' },
      { kind: 'clause', n: '17.5', text: 'Ticketeur does not guarantee that a Vendor will be selected by an Organizers or receive any minimum number of engagements.' },
      { kind: 'clause', n: '17.6', text: 'Ticketeur may remove or suspend a Vendor where the Vendor provides false information, violates these Terms or creates a risk to Users or the Platform.' },
    ],
  },
  {
    n: '18',
    title: 'Organizers / Vendor Relationship',
    blocks: [
      { kind: 'clause', n: '18.1', text: 'Ticketeur may facilitate introductions or communications between Organizers and Vendors.' },
      { kind: 'clause', n: '18.2', text: 'Unless expressly agreed otherwise, Ticketeur is not a party to agreements independently entered into between an Organizers and Vendor.' },
      { kind: 'clause', n: '18.3', text: 'Organizers and Vendors are responsible for negotiating their own commercial arrangements, including fees, deliverables, timelines, cancellation arrangements and other contractual terms.' },
      { kind: 'clause', n: '18.4', text: 'Neither Organizers nor Vendors may represent that Ticketeur guarantees or endorses their independent contractual relationship.' },
    ],
  },
  {
    n: '19',
    title: 'Prohibited Activities',
    blocks: [
      { kind: 'lead', text: 'You must not:' },
      {
        kind: 'list',
        items: [
          'use the Platform for unlawful purposes',
          'impersonate another person or entity',
          'provide false or misleading information',
          'create fraudulent Events',
          'sell counterfeit or invalid Tickets',
          'manipulate Ticket availability or pricing',
          'engage in unauthorised Ticket resale',
          'use bots, scripts or automated systems to interfere with the Platform',
          'attempt to bypass security mechanisms',
          'introduce malware or malicious code',
          'interfere with the operation of the Platform',
          'harvest or collect User data without lawful authority',
          'infringe another person’s intellectual-property rights',
          'use the Platform for harassment, abuse, fraud or deception',
          'conduct transactions using stolen or unauthorised payment methods',
          'use the Platform to facilitate criminal activity',
          'assist another person in engaging in any prohibited activity.',
        ],
      },
    ],
  },
  {
    n: '20',
    title: 'Fraud and Suspicious Activity',
    blocks: [
      { kind: 'clause', n: '20.1', text: 'Ticketeur may monitor Transactions and Platform activity for security, fraud prevention, compliance and operational purposes.' },
      {
        kind: 'clause',
        n: '20.2',
        text: 'Where Ticketeur reasonably suspects fraud, money laundering, identity theft, Ticket manipulation or other unlawful activity, it may:',
        items: [
          'suspend or restrict an account',
          'cancel or hold Transactions',
          'invalidate Tickets',
          'require additional verification',
          'withhold funds where legally permitted',
          'investigate the activity',
          'report the activity to appropriate authorities.',
        ],
      },
      { kind: 'clause', n: '20.3', text: 'Ticketeur may take these measures without prior notice where immediate action is reasonably necessary to protect Users, Ticketeur or third parties.' },
    ],
  },
  {
    n: '21',
    title: 'User-Generated Content',
    blocks: [
      { kind: 'clause', n: '21.1', text: 'Users may submit User Content to the Platform.' },
      { kind: 'clause', n: '21.2', text: 'You remain responsible for User Content that you submit.' },
      { kind: 'clause', n: '21.3', text: 'You represent and warrant that you have all rights and permissions necessary to submit and use the User Content and to grant the licence described in these Terms.' },
      { kind: 'clause', n: '21.4', text: 'User Content must not be unlawful, defamatory, misleading, discriminatory, threatening, fraudulent or infringing.' },
      { kind: 'clause', n: '21.5', text: 'Ticketeur may remove or restrict User Content that violates these Terms, applicable law or the legitimate interests of the Platform or its Users.' },
    ],
  },
  {
    n: '22',
    title: 'Intellectual Property',
    blocks: [
      { kind: 'clause', n: '22.1', text: 'The Platform and its contents, including software, designs, interfaces, trademarks, logos, graphics, text, databases, functionality and other materials, are owned by or licensed to Ticketeur and are protected by applicable intellectual-property laws.' },
      {
        kind: 'clause',
        n: '22.2',
        text: 'Except as expressly permitted by these Terms, you may not:',
        items: [
          'reproduce',
          'modify',
          'distribute',
          'sell',
          'lease',
          'reverse engineer',
          'commercially exploit',
          'create derivative works from any part of the Platform without prior written permission.',
        ],
      },
      { kind: 'clause', n: '22.3', text: 'Nothing in these Terms transfers ownership of Ticketeur’s intellectual property to you.' },
    ],
  },
  {
    n: '23',
    title: 'Licence Granted to Ticketeur',
    blocks: [
      { kind: 'clause', n: '23.1', text: 'By submitting User Content, you grant Ticketeur a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display, transmit, format, adapt and otherwise use that User Content solely to operate, provide, improve and promote the Platform and applicable services.' },
      { kind: 'clause', n: '23.2', text: 'The licence continues for as long as reasonably necessary for the purposes for which the User Content was submitted, subject to applicable law and Ticketeur’s Privacy Policy.' },
      { kind: 'clause', n: '23.3', text: 'You retain ownership of your User Content.' },
      { kind: 'clause', n: '23.4', text: 'Ticketeur will not use User Content for purposes materially inconsistent with its stated purposes without an appropriate legal basis or permission where required.' },
    ],
  },
  {
    n: '24',
    title: 'Marketing and Promotional Content',
    blocks: [
      { kind: 'clause', n: '24.1', text: 'Where an Organizers permits Ticketeur to promote an Event, Ticketeur may display Event information, images, logos and promotional materials supplied by the Organizers.' },
      { kind: 'clause', n: '24.2', text: 'The Organizers represents that it has the necessary rights to grant Ticketeur permission to use such materials.' },
      { kind: 'clause', n: '24.3', text: 'Ticketeur may use aggregated or appropriately de-identified information concerning Platform activity for analytical, operational and promotional purposes, subject to applicable data-protection law.' },
      { kind: 'clause', n: '24.4', text: 'Users may manage marketing communications in accordance with the applicable communication preferences and Privacy Policy.' },
    ],
  },
  {
    n: '25',
    title: 'Platform Availability',
    blocks: [
      { kind: 'clause', n: '25.1', text: 'Ticketeur will use reasonable efforts to maintain the availability and functionality of the Platform.' },
      { kind: 'clause', n: '25.2', text: 'The Platform may occasionally be unavailable due to maintenance, upgrades, technical failures, security incidents, network problems or circumstances beyond Ticketeur’s reasonable control.' },
      { kind: 'clause', n: '25.3', text: 'Ticketeur does not guarantee uninterrupted, error-free or continuous availability of the Platform.' },
      { kind: 'clause', n: '25.4', text: 'Ticketeur may modify, suspend or discontinue particular features where reasonably necessary.' },
    ],
  },
  {
    n: '26',
    title: 'Third-Party Services',
    blocks: [
      { kind: 'clause', n: '26.1', text: 'The Platform may integrate with or contain links to third-party services, including payment providers, analytics providers, communication services and other technology providers.' },
      { kind: 'clause', n: '26.2', text: 'Third-party services may be governed by their own terms and privacy policies.' },
      { kind: 'clause', n: '26.3', text: 'Ticketeur is not responsible for the independent acts, omissions, availability or policies of third-party service providers except to the extent required by applicable law.' },
    ],
  },
  {
    n: '27',
    title: 'Privacy and Data Protection',
    blocks: [
      { kind: 'clause', n: '27.1', text: 'Ticketeur collects and processes personal data in accordance with its Privacy Policy and applicable data-protection laws, including the Nigeria Data Protection Act 2023 (“NDPA”) where applicable.' },
      { kind: 'clause', n: '27.2', text: 'By using the Platform, you acknowledge that your personal data may be processed for purposes including account administration, Ticket transactions, Event management, verification, fraud prevention, communications, security, customer support and other lawful purposes described in the Privacy Policy.' },
      { kind: 'clause', n: '27.3', text: 'Where Ticketeur processes personal data on behalf of an Organizers or other User, the parties shall comply with their respective obligations under applicable data-protection law and any applicable data-processing agreement.' },
      { kind: 'clause', n: '27.4', text: 'The Privacy Policy forms part of these Terms.' },
    ],
  },
  {
    n: '28',
    title: 'Security',
    blocks: [
      { kind: 'clause', n: '28.1', text: 'Ticketeur implements reasonable technical and organisational measures designed to protect the Platform and information processed through it.' },
      { kind: 'clause', n: '28.2', text: 'You are responsible for maintaining the security of your account credentials and devices used to access the Platform.' },
      { kind: 'clause', n: '28.3', text: 'You must promptly notify Ticketeur of suspected unauthorised access, security vulnerabilities or misuse of your account.' },
      { kind: 'clause', n: '28.4', text: 'No digital platform can guarantee absolute security. Accordingly, Ticketeur does not warrant that the Platform will be completely free from security vulnerabilities, subject always to its obligations under applicable law.' },
    ],
  },
  {
    n: '29',
    title: 'Disclaimers',
    blocks: [
      { kind: 'clause', n: '29.1', text: 'To the maximum extent permitted by applicable law, the Platform and its services are provided on an “as available” basis.' },
      {
        kind: 'clause',
        n: '29.2',
        text: 'Ticketeur does not warrant that:',
        items: [
          'every Event will occur as advertised',
          'every Organizers or Vendor will perform its obligations',
          'Event information supplied by Users will always be accurate',
          'the Platform will always be available or error-free',
          'every Ticket or Event will meet a User’s expectations.',
        ],
      },
      { kind: 'clause', n: '29.3', text: 'Nothing in these Terms excludes or limits any warranty, liability or consumer right that cannot lawfully be excluded or limited.' },
    ],
  },
  {
    n: '30',
    title: 'Limitation of Liability',
    blocks: [
      {
        kind: 'clause',
        n: '30.1',
        text: 'To the maximum extent permitted by applicable law, Ticketeur shall not be liable for indirect, incidental, special, consequential or punitive losses arising from:',
        items: [
          'an Organizers’s cancellation or failure to conduct an Event',
          'the acts or omissions of an Organizers or Vendor',
          'unauthorised conduct of another User',
          'third-party services',
          'events outside Ticketeur’s reasonable control',
          'your misuse of the Platform.',
        ],
      },
      { kind: 'clause', n: '30.2', text: 'To the extent permitted by applicable law, Ticketeur’s aggregate liability arising out of or relating to the Platform or these Terms shall not exceed the total fees actually paid by the affected user to Ticketeur during the six (6) months immediately preceding the event giving rise to the claim.' },
      { kind: 'clause', n: '30.3', text: 'The limitations in this section shall not apply to liability that cannot lawfully be excluded or limited under applicable law.' },
      { kind: 'clause', n: '30.4', text: 'Nothing in this section shall exclude liability for fraud, fraudulent misrepresentation, wilful misconduct or other liability that applicable law prohibits Ticketeur from excluding.' },
    ],
  },
  {
    n: '31',
    title: 'Indemnification',
    blocks: [
      {
        kind: 'clause',
        n: '31.1',
        text: 'To the extent permitted by applicable law, you agree to indemnify and hold harmless Ticketeur, its officers, directors, employees, affiliates and service providers from claims, losses, liabilities, damages, costs and expenses arising from:',
        items: [
          'your breach of these Terms',
          'your unlawful use of the Platform',
          'your User Content',
          'your infringement of third-party rights',
          'your fraudulent or unauthorised activity',
          'your violation of applicable law.',
        ],
      },
      { kind: 'clause', n: '31.2', text: 'This indemnity shall not apply to the extent that a claim arises directly from Ticketeur’s own unlawful conduct or liability that cannot lawfully be transferred to you.' },
    ],
  },
  {
    n: '32',
    title: 'Suspension and Termination',
    blocks: [
      { kind: 'clause', n: '32.1', text: 'You may stop using the Platform at any time.' },
      {
        kind: 'clause',
        n: '32.2',
        text: 'Ticketeur may suspend or terminate your access where:',
        items: [
          'you breach these Terms',
          'you provide false or misleading information',
          'your account is involved in suspected fraud',
          'your activities create a security or legal risk',
          'your use of the Platform may harm another User or Ticketeur',
          'suspension is required by law or a competent authority',
          'Ticketeur reasonably determines that continued access is inappropriate.',
        ],
      },
      { kind: 'clause', n: '32.3', text: 'Where reasonably practicable, Ticketeur will provide notice before suspension or termination. Immediate suspension may occur where necessary to prevent fraud, security risks, unlawful conduct or material harm.' },
      { kind: 'clause', n: '32.4', text: 'Organizers and Vendors remain responsible for obligations arising from Transactions entered into before termination, subject to applicable law.' },
    ],
  },
  {
    n: '33',
    title: 'Consequences of Termination',
    blocks: [
      { kind: 'lead', text: 'Upon termination or suspension:' },
      { kind: 'clause', n: '33.1', text: 'your right to access affected Platform features may cease;' },
      { kind: 'clause', n: '33.2', text: 'Ticketeur may deactivate your account;' },
      { kind: 'clause', n: '33.3', text: 'pending Transactions may be cancelled or reviewed where legally permissible;' },
      { kind: 'clause', n: '33.4', text: 'your obligations that by their nature should survive termination shall continue, including provisions concerning intellectual property, indemnification, liability, dispute resolution and applicable payment obligations.' },
    ],
  },
  {
    n: '34',
    title: 'Force Majeure',
    blocks: [
      { kind: 'clause', n: '34.1', text: 'Ticketeur shall not be responsible for delay or failure to perform its obligations where caused by circumstances beyond its reasonable control.' },
      { kind: 'clause', n: '34.2', text: 'Such circumstances may include natural disasters, epidemics, pandemics, war, terrorism, civil unrest, government action, regulatory restrictions, power failures, telecommunications failures, cyberattacks, strikes, labour disputes, infrastructure failures or failures of third-party providers.' },
      { kind: 'clause', n: '34.3', text: 'Where reasonably practicable, Ticketeur will take reasonable steps to mitigate the effects of such circumstances.' },
    ],
  },
  {
    n: '35',
    title: 'Changes to the Terms',
    blocks: [
      { kind: 'clause', n: '35.1', text: 'Ticketeur may amend these Terms from time to time to reflect changes in the Platform, business operations, applicable law, security requirements or regulatory obligations.' },
      { kind: 'clause', n: '35.2', text: 'The updated Terms will be published on the Platform with a revised “Last Updated” date.' },
      { kind: 'clause', n: '35.3', text: 'Where a change is material, Ticketeur will provide reasonable notice where required by applicable law.' },
      { kind: 'clause', n: '35.4', text: 'Your continued use of the Platform after the effective date of amended Terms constitutes acceptance of the amended Terms to the extent permitted by applicable law.' },
      { kind: 'clause', n: '35.5', text: 'If you do not agree to amended Terms, you should discontinue use of the affected services.' },
    ],
  },
  {
    n: '36',
    title: 'Notices',
    blocks: [
      {
        kind: 'clause',
        n: '36.1',
        text: 'Ticketeur may provide notices to you through:',
        items: [
          'email',
          'SMS',
          'in-platform notifications',
          'notices displayed on the Platform',
          'other reasonable electronic means.',
        ],
      },
      { kind: 'clause', n: '36.2', text: 'You are responsible for ensuring that your contact information remains accurate.' },
      { kind: 'clause', n: '36.3', text: 'Legal notices to Ticketeur should be sent to:' },
      {
        kind: 'contact',
        lines: [
          'Name: Ezinne Uche Onwuka',
          'Registered Address: Abia State',
          'Email: Ezinneucheonwuka@gmail.com',
          'Telephone: 09012134576',
        ],
      },
    ],
  },
  {
    n: '37',
    title: 'Governing Law',
    blocks: [
      { kind: 'clause', n: '37.1', text: 'These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria.' },
      { kind: 'clause', n: '37.2', text: 'Nothing in these Terms prevents a consumer from exercising any mandatory rights or remedies available under applicable law.' },
    ],
  },
  {
    n: '38',
    title: 'Dispute Resolution',
    blocks: [
      { kind: 'clause', n: '38.1', text: 'The parties shall first attempt to resolve any dispute arising from these Terms or use of the Platform through good-faith negotiations.' },
      { kind: 'clause', n: '38.2', text: 'A User wishing to raise a dispute should first submit a written complaint to Ticketeur through its designated contact channel.' },
      { kind: 'clause', n: '38.3', text: 'The parties shall use reasonable efforts to resolve the complaint within thirty (30) days of receipt.' },
      { kind: 'clause', n: '38.4', text: 'Where the dispute cannot be resolved through negotiation, either party may pursue any remedy available under applicable Nigerian law.' },
      { kind: 'clause', n: '38.5', text: 'Nothing in this section prevents a party from seeking urgent interim or injunctive relief from a court of competent jurisdiction where necessary.' },
      { kind: 'clause', n: '38.6', text: 'Any dispute arising out of or in connection with this Agreement shall first be resolved amicably between the Parties within fourteen (14) days of notice of the dispute.' },
      { kind: 'clause', n: '38.6.1', text: 'Where the dispute is not resolved amicably, the Parties shall refer the dispute to arbitration in accordance with the provisions of the Arbitration and Mediation Act 2023.' },
      { kind: 'clause', n: '38.6.2', text: 'Where the dispute is not resolved by arbitration, either Party may refer the matter to a court of competent jurisdiction for determination, in accordance with the Constitution of the Federal Republic of Nigeria 1999.' },
    ],
  },
  {
    n: '39',
    title: 'Severability',
    blocks: [
      { kind: 'clause', n: '39.1', text: 'If any provision of these Terms is determined by a competent authority to be unlawful, invalid or unenforceable, that provision shall be interpreted to the minimum extent necessary to make it enforceable.' },
      { kind: 'clause', n: '39.2', text: 'If it cannot be made enforceable, it shall be severed without affecting the validity of the remaining provisions.' },
    ],
  },
  {
    n: '40',
    title: 'Entire Agreement',
    blocks: [
      { kind: 'clause', n: '40.1', text: 'These Terms, together with any applicable Event-specific terms, Privacy Policy, Cookie Policy, Refund Policy and other policies expressly incorporated into them, constitute the agreement between you and Ticketeur concerning your use of the Platform.' },
      { kind: 'clause', n: '40.2', text: 'Where a specific service is governed by additional written terms, those terms shall apply to the relevant service to the extent of any inconsistency.' },
      { kind: 'clause', n: '40.3', text: 'No failure by Ticketeur to enforce a provision of these Terms shall constitute a waiver of its right to enforce that provision subsequently.' },
    ],
  },
  {
    n: '41',
    title: 'Contact Information',
    blocks: [
      { kind: 'lead', text: 'For questions, complaints, support requests or legal notices concerning these Terms, please contact:' },
      {
        kind: 'contact',
        lines: [
          'Ticketeur',
          'Legal Entity: Ezinne Uche Onwuka',
          'Registered Address: Abia State',
          'Email: Ezinneucheonwuka@gmail.com',
          'Telephone: 09012134576',
          'Website: https://www.useticketeur.com/',
        ],
      },
      { kind: 'lead', text: 'For privacy and data-protection matters, please refer to Ticketeur’s Privacy Policy and the designated privacy contact stated therein.' },
    ],
  },
]
