import { Container, Heading, Preview, Section, Text } from 'react-email'

import { BRAND_NAME_UPPER } from '../components/brand'
import EmailContainer from '../components/container'

export type PayoutUpdateKind =
  | 'account_changed'
  | 'requested'
  | 'approved'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'admin_new_request'

interface PayoutUpdateEmailProps {
  kind: PayoutUpdateKind
  recipientName: string
  amount?: string
  account: string
  organizerName?: string
  reason?: string
  reference?: string
  usableFrom?: string
  url?: string
}

/** Subject lines, kept here so the task and the template agree. */
export function payoutUpdateSubject(kind: PayoutUpdateKind, amount?: string) {
  switch (kind) {
    case 'account_changed':
      return 'Your payout bank account was changed'
    case 'requested':
      return `We received your withdrawal request${amount ? ` for ${amount}` : ''}`
    case 'approved':
      return `Your withdrawal${amount ? ` of ${amount}` : ''} was approved`
    case 'paid':
      return `${amount ?? 'Your withdrawal'} is on its way to your bank`
    case 'rejected':
      return 'Your withdrawal request was declined'
    case 'failed':
      return 'Your withdrawal could not be sent'
    case 'admin_new_request':
      return `Payout request${amount ? ` for ${amount}` : ''} needs review`
  }
}

function Body({
  kind,
  amount,
  account,
  organizerName,
  reason,
  reference,
  usableFrom,
}: PayoutUpdateEmailProps) {
  const line = 'm-0 mb-4 text-base leading-6 text-gray-700'
  switch (kind) {
    case 'account_changed':
      return (
        <>
          <Text className={line}>
            Your earnings will now be paid into <strong>{account}</strong>.
            {usableFrom
              ? ` For your security, it can receive a withdrawal from ${usableFrom}.`
              : ''}
          </Text>
          <Text className="m-0 mb-4 text-base leading-6 font-semibold text-gray-900">
            If you didn&apos;t make this change, reply to this email or contact
            Ticketeur support immediately and change your password.
          </Text>
        </>
      )
    case 'requested':
      return (
        <Text className={line}>
          You asked to withdraw <strong>{amount}</strong> to{' '}
          <strong>{account}</strong>. Our team reviews every withdrawal; you
          will get an email as soon as it has been decided.
        </Text>
      )
    case 'approved':
      return (
        <Text className={line}>
          Your withdrawal of <strong>{amount}</strong> to{' '}
          <strong>{account}</strong> has been approved and is being sent.
        </Text>
      )
    case 'paid':
      return (
        <>
          <Text className={line}>
            <strong>{amount}</strong> has been sent to{' '}
            <strong>{account}</strong>. Most banks show it within minutes;
            some take until the next working day.
          </Text>
          {reference ? (
            <Text className="m-0 mb-4 text-sm leading-5 text-gray-500">
              Reference: <strong>{reference}</strong>
            </Text>
          ) : null}
        </>
      )
    case 'rejected':
      return (
        <>
          <Text className={line}>
            Your request to withdraw <strong>{amount}</strong> was declined.
            The money is back in your available balance.
          </Text>
          {reason ? (
            <Section className="mb-4 rounded-lg bg-gray-50 px-5 py-4">
              <Text className="m-0 text-sm leading-5 text-gray-700">
                {reason}
              </Text>
            </Section>
          ) : null}
        </>
      )
    case 'failed':
      return (
        <Text className={line}>
          We could not send <strong>{amount}</strong> to{' '}
          <strong>{account}</strong>. The money is safe on your balance. Our
          team will retry or contact you — please check your bank details are
          still correct.
        </Text>
      )
    case 'admin_new_request':
      return (
        <Text className={line}>
          <strong>{organizerName}</strong> asked to withdraw{' '}
          <strong>{amount}</strong> to <strong>{account}</strong>. Open{' '}
          <strong>Payouts</strong> in the admin console to review it.
        </Text>
      )
  }
}

export default function PayoutUpdateEmail(
  props: Partial<PayoutUpdateEmailProps>
) {
  const p: PayoutUpdateEmailProps = {
    kind: props.kind ?? 'paid',
    recipientName: props.recipientName ?? 'there',
    account: props.account ?? 'your bank account',
    amount: props.amount ?? '',
    organizerName: props.organizerName,
    reason: props.reason,
    reference: props.reference,
    usableFrom: props.usableFrom,
    url: props.url,
  }
  const subject = payoutUpdateSubject(p.kind, p.amount)
  return (
    <EmailContainer preview={<Preview>{subject}</Preview>}>
      <Container className="mx-auto my-0 max-w-150 px-10">
        <Heading className="text-brand-dark m-0 mb-4 text-2xl font-bold">
          {subject}
        </Heading>
        <Text className="m-0 mb-4 text-base leading-6 text-gray-700">
          Hi {p.recipientName},
        </Text>
        <Body {...p} />
        {p.url ? (
          <Text className="m-0 mb-4 text-sm leading-5 text-gray-500">
            See every withdrawal at{' '}
            <a href={p.url} className="text-brand no-underline">
              {p.url}
            </a>
            .
          </Text>
        ) : null}
        <Text className="m-0 text-sm leading-5 text-gray-500">
          &mdash; The {BRAND_NAME_UPPER} Team
        </Text>
      </Container>
    </EmailContainer>
  )
}

PayoutUpdateEmail.PreviewProps = {
  kind: 'paid',
  recipientName: 'Voices Stage',
  amount: '₦124,000',
  account: 'Access Bank ••••0031 (ADA OBI)',
  reference: 'TKTP-3f2b1c4d5e6f4a7b8c9d0e1f2a3b4c5d-1',
  url: 'https://www.useticketeur.com/org/payouts',
} satisfies PayoutUpdateEmailProps

export { PayoutUpdateEmail }
