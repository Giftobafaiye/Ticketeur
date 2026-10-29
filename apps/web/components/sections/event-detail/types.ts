import type { IconSvgElement } from '@hugeicons/react'

export type EventFeature = {
  icon: IconSvgElement
  label: string
}

export type EventDetailData = {
  id: string
  slug: string
  title: string
  status: string
  date: string
  time?: string
  location: string
  imageUrl: string
  description: string[]
  features: EventFeature[]
  price: string
  // Finished: the page is a glimpse of what was hosted, with nothing to buy.
  ended: boolean
  // Every ticket tier is gone.
  soldOut: boolean
}
