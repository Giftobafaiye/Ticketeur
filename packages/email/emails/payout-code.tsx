import { Container, Heading, Preview, Section, Text } from 'react-email'

import { BRAND_NAME_UPPER } from '../components/brand'
import EmailContainer from '../components/container'

interface PayoutCodeEmailProps {
  // The one-time code. It exists here and in the organizer's browser only —
  // the database holds a scrypt digest.
  code: string
  purpose: 'add_account' | 'request_payout'
  // What the code authorises, e.g. "Access Bank ••••0031 (ADA OBI)" or
  // "₦50,000 to Access Bank ••••0031". The code works for exactly this.
  detail: string
  expiresInMinutes: number
}

export default function PayoutCodeEmail({
  code = '482916',
  purpose = 'request_payout',
  detail = '₦50,000 to Access Bank ••••0031',
  expiresInMinutes = 10,
}: Partial<PayoutCodeEmailProps>) {
  const adding = purpose === 'add_account'
  return (
    <EmailContainer
      preview={
        <Preview>
          {adding
            ? 'Confirm your payout bank account'
            : 'Confirm your withdrawal'}
        </Preview>
      }
    >
      <Container className="mx-auto my-0 max-w-150 px-10">
        <Heading className="text-brand-dark m-0 mb-4 text-2xl font-bold">
          {adding ? 'Confirm your bank account' : 'Confirm your withdrawal'}
        </Heading>

        <Text className="m-0 mb-6 text-base leading-6 text-gray-700">
          {adding
            ? 'Enter this code to make this the account your Ticketeur earnings are paid into:'
            : 'Enter this code to ask for this withdrawal:'}
        </Text>

        <Section className="mb-6 rounded-lg bg-gray-50 px-5 py-4">
          <Text className="m-0 text-base leading-6 font-semibold text-gray-900">
            {detail}
          </Text>
        </Section>

        <Section className="bg-brand-light border-brand-light mb-6 rounded-lg border border-solid p-6 text-center">
          <Text className="text-brand m-0 font-mono text-4xl font-bold tracking-widest">
            {code}
          </Text>
          <Text className="text-brand-dark m-0 mt-3 text-sm leading-5">
            This code expires in{' '}
            <strong>
              {expiresInMinutes} {expiresInMinutes === 1 ? 'minute' : 'minutes'}
            </strong>{' '}
            and only works for the {adding ? 'account' : 'amount and account'}{' '}
            above.
          </Text>
        </Section>

        <Text className="m-0 mb-4 text-sm leading-5 font-semibold text-gray-900">
          Didn&apos;t ask for this? Don&apos;t share the code with anyone —
          including someone claiming to be from Ticketeur — and change your
          password straight away. Nothing happens unless the code is entered.
        </Text>

        <Text className="m-0 text-sm leading-5 text-gray-500">
          &mdash; The {BRAND_NAME_UPPER} Team
        </Text>
      </Container>
    </EmailContainer>
  )
}

PayoutCodeEmail.PreviewProps = {
  code: '482916',
  purpose: 'request_payout',
  detail: '₦50,000 to Access Bank ••••0031',
  expiresInMinutes: 10,
} satisfies PayoutCodeEmailProps

export { PayoutCodeEmail }
