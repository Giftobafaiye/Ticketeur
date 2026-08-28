import { createTRPCRouter } from '../../trpc'

import { vendorAnalyticsRouter } from './analytics'
import { vendorDashboardRouter } from './dashboard'
import { vendorEventsRouter } from './events'
import { vendorProfileRouter } from './profile'

export const vendorRouter = createTRPCRouter({
  analytics: vendorAnalyticsRouter,
  dashboard: vendorDashboardRouter,
  events: vendorEventsRouter,
  profile: vendorProfileRouter,
})

export type VendorRouter = typeof vendorRouter
