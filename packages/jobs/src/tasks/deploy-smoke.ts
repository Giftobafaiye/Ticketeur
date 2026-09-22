import { render } from '@react-email/render'
import { task } from '@trigger.dev/sdk'
import WelcomeEmail from '@ticketur/email/emails/welcome'

// Deploy smoke test. The release workflow triggers this as the last step of
// every production deploy and fails unless the run reaches COMPLETED, so a
// revision that publishes clean but cannot actually execute is caught before
// it serves a real signup, reset or 2FA email. It renders the welcome template
// — the same @react-email/render + @ticketur/email path every email task uses —
// and sends nothing.
export const deploySmokeTask = task({
  id: 'deploy-smoke',
  run: async (payload: { version?: string } | undefined) => {
    const html = await render(WelcomeEmail({ name: 'Deploy smoke test' }))

    if (!html) {
      throw new Error('deploy-smoke: the welcome template rendered empty')
    }

    return {
      ok: true,
      version: payload?.version ?? null,
      htmlLength: html.length,
      renderedAt: new Date().toISOString(),
    }
  },
})
