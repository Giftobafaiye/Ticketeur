import type { IconSvgElement } from '@hugeicons/react'
import {
  Baby01Icon,
  Book01Icon,
  Camera01Icon,
  Car01Icon,
  CrownIcon,
  DiscIcon,
  DrinkIcon,
  FireworksIcon,
  GameController01Icon,
  GiftIcon,
  GuitarIcon,
  HandshakeIcon,
  LaughIcon,
  MaskTheaterIcon,
  Presentation01Icon,
  PaintBoardIcon,
  PartyPopperIcon,
  PoolIcon,
  Restaurant01Icon,
  SecurityCheckIcon,
  SparklesIcon,
  SpotlightIcon,
  TrophyIcon,
  Wifi01Icon,
} from '@hugeicons/core-free-icons'

// One distinct picture per feature, so a buyer can tell "Live DJ Sets" from
// "Live Music" at a glance. Used to share icons (a music note for both, a
// drink for the bar and for food), which made the tiles look alike.
const PRESET_ICONS: Record<string, IconSvgElement> = {
  'Live DJ Sets': DiscIcon,
  'Laser Show': SpotlightIcon,
  'Open VIP Bar': DrinkIcon,
  Mascots: MaskTheaterIcon,
  Games: GameController01Icon,
  'Food & Drink': Restaurant01Icon,
  Workshops: Presentation01Icon,
  Networking: HandshakeIcon,
  'Live Music': GuitarIcon,
  'Photo Booth': Camera01Icon,
  'Art Showcase': PaintBoardIcon,
}

// Organizers can type their own features; pick a picture from what they
// wrote, first match wins. Order matters: "vip bar" is a bar before it is VIP.
const KEYWORD_ICONS: [RegExp, IconSvgElement][] = [
  [/\b(dj|deejay|disc|turntable)/i, DiscIcon],
  [/\b(laser|light|spotlight)/i, SpotlightIcon],
  [/\b(bar|drink|cocktail|wine|beer|champagne)/i, DrinkIcon],
  [/\b(food|grill|bbq|buffet|dinner|lunch|snack|chop)/i, Restaurant01Icon],
  [/\b(music|band|concert|guitar|live act|perform)/i, GuitarIcon],
  [/\b(game|gaming|arcade|quiz)/i, GameController01Icon],
  [/\b(photo|camera|selfie)/i, Camera01Icon],
  [/\b(art|paint|exhibit|gallery)/i, PaintBoardIcon],
  [/\b(workshop|talk|panel|class|training|session)/i, Presentation01Icon],
  [/\b(network|meet|mixer)/i, HandshakeIcon],
  [/\b(mascot|costume|cosplay|mask)/i, MaskTheaterIcon],
  [/\b(comedy|comedian|stand.?up|laugh)/i, LaughIcon],
  [/\b(vip|premium|exclusive|lounge)/i, CrownIcon],
  [/\b(firework|pyro)/i, FireworksIcon],
  [/\b(pool|swim)/i, PoolIcon],
  [/\b(kid|child|family|baby)/i, Baby01Icon],
  [/\b(parking|car|shuttle|ride)/i, Car01Icon],
  [/\b(wifi|wi-fi|internet)/i, Wifi01Icon],
  [/\b(security|safe)/i, SecurityCheckIcon],
  [/\b(prize|award|competition|contest)/i, TrophyIcon],
  [/\b(gift|giveaway|raffle|freebie)/i, GiftIcon],
  [/\b(book|reading|library)/i, Book01Icon],
  [/\b(party|dance|rave)/i, PartyPopperIcon],
]

export function iconForFeature(label: string): IconSvgElement {
  const preset = PRESET_ICONS[label]
  if (preset) return preset
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(label)) return icon
  }
  return SparklesIcon
}
