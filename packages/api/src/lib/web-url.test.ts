import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeWebUrl } from './web-url'

test('adds https to a link pasted without a scheme', () => {
  assert.equal(
    normalizeWebUrl('facebook.com/tastybites'),
    'https://facebook.com/tastybites'
  )
  assert.equal(
    normalizeWebUrl('  www.instagram.com/tasty  '),
    'https://www.instagram.com/tasty'
  )
})

test('keeps http and https links', () => {
  assert.equal(normalizeWebUrl('https://mybiz.ng/'), 'https://mybiz.ng/')
  assert.equal(
    normalizeWebUrl('http://mybiz.ng/a?b=1'),
    'http://mybiz.ng/a?b=1'
  )
})

test('refuses anything that is not a web link', () => {
  assert.equal(normalizeWebUrl('javascript:alert(1)'), null)
  assert.equal(normalizeWebUrl('JavaScript:alert(1)'), null)
  assert.equal(normalizeWebUrl('data:text/html,hi'), null)
  assert.equal(normalizeWebUrl('mailto:a@b.c'), null)
  assert.equal(normalizeWebUrl('facebook'), null)
  assert.equal(normalizeWebUrl(''), null)
  assert.equal(normalizeWebUrl(null), null)
})
