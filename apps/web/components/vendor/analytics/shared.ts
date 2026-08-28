// Shared types + constants for the vendor Analytics screens.
//
// The three quick-range pills drive the reporting window; an optional custom
// date narrows it to a specific day's window. Both travel together as the
// `range` passed to every tab and used verbatim as the tRPC input, so the
// server owns the actual date-window math (see vendor.analytics router).

export const ANALYTICS_PERIODS = ['7d', '30d', '90d'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

export const ANALYTICS_TABS = [
  'overall',
  'bookings',
  'ratings',
  'reports',
] as const
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export const ANALYTICS_TAB_LABELS: Record<AnalyticsTab, string> = {
  overall: 'Overall',
  bookings: 'Booking Insights',
  ratings: 'Ratings & Reviews',
  reports: 'Reports',
}

// The resolved selection handed to each tab and sent to the API. `date` is the
// ISO `YYYY-MM-DD` custom anchor, or null when the quick-range pills are used.
export type AnalyticsRange = {
  period: AnalyticsPeriod
  date: string | null
}

// ─── Reports tab ─────────────────────────────────────────────────────────────

export const REPORT_TYPES = [
  'full',
  'booking',
  'ratings',
  'visibility',
] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  full: 'Full Analytics Report',
  booking: 'Booking Summary',
  ratings: 'Ratings Summary',
  visibility: 'Visibility Report',
}

// Shown under each report-type option on the Reports tab.
export const REPORT_TYPE_SHORT_LABELS: Record<ReportType, string> = {
  full: 'Full Analytics',
  booking: 'Booking Summary',
  ratings: 'Ratings Summary',
  visibility: 'Visibility Report',
}

export const REPORT_TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  full: 'All KPIs, activity trends, booking funnel, and reputation summary in one complete report.',
  booking:
    'Booking pipeline, funnel conversion, monthly trends, and a full table of booking activity.',
  ratings:
    'Reputation score, star distribution, recent reviews, and actionable improvement insights.',
  visibility:
    'Profile views, search appearances, conversion rates, and profile completion impact analysis.',
}
