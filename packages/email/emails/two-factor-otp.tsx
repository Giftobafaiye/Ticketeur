import { Container, Heading, Preview, Section, Text } from 'react-email'
import { BRAND_NAME_UPPER } from '../components/brand'
import EmailContainer from '../components/container'

interface TwoFactorOTPEmailProps {
  otp: string
  /**
   * Set only on a *copy* sent to a security address other than the person
   * signing in (ADMIN_OTP_COPY_EMAILS). It names the account the code belongs
   * to, so a reader holding codes for several admins knows which one this is —
   * and so the "wasn't you?" warning points at the right account rather than
   * at the reader's own.
   */
  account?: string
}

export default function TwoFactorOTPEmail({
  otp = '384729',
  account,
}: Partial<TwoFactorOTPEmailProps>) {
  const isCopy = Boolean(account)

  return (
    <EmailContainer
      preview={
        <Preview>
          {isCopy
            ? `Admin sign-in code for ${account}`
            : 'Your two-factor authentication code'}
        </Preview>
      }
    >
      <Container className="mx-auto my-0 max-w-150 px-10">
        <Heading className="text-brand-dark m-0 mb-4 text-2xl font-bold">
          {isCopy ? 'Admin sign-in code' : 'Two-factor authentication'}
        </Heading>

        <Text className="m-0 mb-6 text-base leading-6 text-gray-700">
          {isCopy ? (
            <>
              Someone is signing in to the admin console as{' '}
              <strong>{account}</strong>. You are receiving this because your
              address is on the admin security copy list.
            </>
          ) : (
            'Use the following code to complete your sign-in:'
          )}
        </Text>

        <Section className="bg-brand-light border-brand-light mb-6 rounded-lg border border-solid p-6 text-center">
          <Text className="text-brand m-0 font-mono text-4xl font-bold tracking-widest">
            {otp}
          </Text>
          <Text className="text-brand-dark m-0 mt-3 text-sm leading-5">
            This code expires in <strong>5 minutes</strong>.
          </Text>
        </Section>

        <Text className="m-0 mb-4 text-sm leading-5 text-gray-500">
          {isCopy ? (
            <>
              If <strong>{account}</strong> is not signing in right now, that
              account is compromised — reset its password and remove its admin
              role immediately.
            </>
          ) : (
            "If you didn't attempt to sign in, please secure your account immediately."
          )}
        </Text>

        <Text className="m-0 text-sm leading-5 text-gray-500">
          &mdash; The {BRAND_NAME_UPPER} Team
        </Text>
      </Container>
    </EmailContainer>
  )
}

TwoFactorOTPEmail.PreviewProps = {
  otp: '384729',
} satisfies TwoFactorOTPEmailProps

export { TwoFactorOTPEmail }
