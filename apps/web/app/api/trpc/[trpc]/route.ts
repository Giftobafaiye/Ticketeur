import { appRouter, createTRPCContext } from '@ticketur/api'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

import { auth } from '@/lib/auth'

const handler = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers })

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ session }),
    onError({ error, path, type }) {
      // tRPC returns failures inside a normal HTTP 200 envelope, so Next's
      // onRequestError never sees them and procedure failures are invisible in
      // server logs. Record each one with the call path, its kind, the error
      // code, and the caller so a failing procedure can be located.
      console.error('[web] trpc procedure failed', {
        path: path ?? null,
        type,
        code: error.code,
        userId: session?.user?.id ?? null,
        error,
      })
    },
  })
}

export { handler as GET, handler as POST }
