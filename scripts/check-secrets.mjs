#!/usr/bin/env node
// GitHub secret scanning only alerts on provider-formatted tokens (an incoming
// Slack webhook, an AWS key). The credentials this estate has actually leaked are
// the classes it cannot see: a mailbox app password, a database URL with an inline
// password, a cookie/HMAC signing key, a committed .env or Streamlit secrets file,
// a password hash. This scan covers those classes in the repository itself and runs
// wherever the injected-code guard runs — CI and both Vercel production builds — so
// one cannot be committed or merged unnoticed. It complements, and does not replace,
// turning on secret scanning's non-provider patterns and validity checks in repo
// settings. Provider tokens are left to GitHub's own scanning and are not re-listed.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

// Files that hold credentials and must never be committed. The .example/.sample/
// .template/.dist variants are the documented, placeholder-only copies.
const SECRET_FILE_PATTERNS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[^/]+$/,
  /(^|\/)\.streamlit\/secrets\.toml$/,
  /(^|\/)secrets?\.(toml|ya?ml|json|ini)$/,
  /(^|\/)credentials?\.(toml|ya?ml|json|ini)$/,
  /(^|\/)\.?netrc$/,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /\.(pem|key|p12|pfx|jks|keystore|ppk)$/,
]
const SECRET_FILE_ALLOW = [/(^|\/)\.env\.(example|sample|template|dist)$/]

// Config-like files, where a secret-named key holding a literal is a credential
// rather than a UI string. Source files are excluded from the assignment scan so a
// line such as `showPassword ? 'Hide password' : 'Show password'` is not a hit.
const CONFIG_EXT = new Set([
  '.env',
  '.toml',
  '.yaml',
  '.yml',
  '.json',
  '.ini',
  '.cfg',
  '.conf',
  '.properties',
  '.tfvars',
])

function isConfigLike(file) {
  const base = file.split('/').pop()
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env'))
    return true
  const dot = base.lastIndexOf('.')
  return dot > 0 && CONFIG_EXT.has(base.slice(dot).toLowerCase())
}

// A secret-named key directly followed by an assigned string literal. The key must
// start a token (so the value of `"check:secrets"` is not read as a key named
// `secrets`) and precede the value (so a line that merely mentions "password" is
// not scanned).
const SECRET_ASSIGNMENT =
  /(?<![A-Za-z0-9_:-])(?:["']?)([A-Za-z0-9_-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|signing[_-]?key|encryption[_-]?key|webhook|credentials?|bearer)[A-Za-z0-9_-]*)(?:["']?)\s*[:=]\s*(['"])([^'"]{6,})\2/i

// Non-provider credential shapes that carry no key name. Each carries a synthetic
// sample the self-check asserts still matches, so narrowing one is reported. The
// samples are invented fixtures, never copied credentials.
const SECRET_VALUE = [
  {
    why: 'password hash',
    re: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{40,}/,
    sample: '$2b$12$' + 'eF7kQ2mZ9pR4tW1yB6nV3cX8jL5hD0sA9uG2iK7oP4zM1qN6vT',
  },
  {
    why: 'password hash',
    re: /\$argon2(id|i|d)\$/,
    sample: '$argon2id$v=19$m=65536,t=3,p=4$' + 'somethingsynthetic',
  },
  {
    why: 'private key block',
    re: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/,
    sample: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
  },
]

// Values that are obviously not a live credential.
const PLACEHOLDER = [
  /^\s*$/,
  /^https?:\/\//i,
  /\$\{.*\}/,
  /^<.*>$/,
  /placeholder/i,
  /example/i,
  /changeme|change[_-]?me/i,
  /your[_-]/i,
  /^\.\.\.$/,
  /^x{3,}$/i,
  /^todo$/i,
  /^test$/i,
  /dummy|fake|sample/i,
  /^user$/i,
  /^password$/i,
]

function shannonEntropy(value) {
  const counts = new Map()
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let bits = 0
  for (const n of counts.values()) {
    const p = n / value.length
    bits -= p * Math.log2(p)
  }
  return bits
}

function isPlaceholder(value) {
  return PLACEHOLDER.some((re) => re.test(value))
}

// A high-entropy literal: long enough to be a credential, drawn from enough
// distinct characters that it is not a word or an id, and shaped like a token. A
// Gmail app password's spaced groups ("abcd efgh ijkl mnop") are measured with the
// spaces removed, so the grouped form is caught as well as the compact form; any
// other spaced value (prose, a shell command) is not a credential.
function isHighEntropyLiteral(value) {
  if (isPlaceholder(value)) return false
  const trimmed = value.trim()
  let compact
  if (/\s/.test(trimmed)) {
    if (!/^[A-Za-z0-9]{3,8}(?: [A-Za-z0-9]{3,8})+$/.test(trimmed)) return false
    compact = trimmed.replace(/ /g, '')
  } else {
    if (!/^[A-Za-z0-9+/=_.:-]+$/.test(trimmed)) return false
    compact = trimmed.replace(/-/g, '')
  }
  if (compact.length < 12) return false
  return shannonEntropy(compact) >= 3
}

// Detection path, kept pure so the self-check below can exercise it end to end.
// `scanAssignments` is on only for config-like files; the credential-shape and URL
// checks run everywhere.
function findSecretViolations(text, scanAssignments) {
  const found = []
  text.split('\n').forEach((line, i) => {
    for (const { re, why } of SECRET_VALUE) {
      if (re.test(line)) found.push({ line: i + 1, why })
    }
    const url = line.match(/:\/\/[^/\s:@]+:([^/\s:@]+)@/)
    if (url && url[1].length >= 8 && !isPlaceholder(url[1])) {
      found.push({ line: i + 1, why: 'URL with inline password' })
    }
    if (scanAssignments) {
      const assigned = line.match(SECRET_ASSIGNMENT)
      if (assigned && isHighEntropyLiteral(assigned[3])) {
        found.push({ line: i + 1, why: 'hardcoded credential literal' })
      }
    }
  })
  return found
}

function isSecretFilePath(file) {
  if (SECRET_FILE_ALLOW.some((re) => re.test(file))) return false
  return SECRET_FILE_PATTERNS.some((re) => re.test(file))
}

// Self-check: verify every path pattern, credential-shape pattern and the detection
// path so a change that narrows the guard is reported instead of quietly passing.
function selfCheck() {
  const tampered = []
  const pathSamples = [
    '.env',
    'apps/web/.env.local',
    '.streamlit/secrets.toml',
    'secrets.yaml',
    'credentials.json',
    'id_rsa',
    'certs/server.pem',
  ]
  for (const f of pathSamples) {
    if (!isSecretFilePath(f))
      tampered.push(`secret file path not detected: ${f}`)
  }
  if (isSecretFilePath('.env.example'))
    tampered.push('.env.example treated as a committed secret')
  for (const { why, sample } of SECRET_VALUE) {
    if (!findSecretViolations(sample, false).some((v) => v.why === why)) {
      tampered.push(`credential shape no longer detected: ${why}`)
    }
  }
  const literalSamples = [
    'app_password = "abcd efgh ijkl mnop"',
    '"api_token": "p8F2kQ9zR4xT7mL1wB6nV3yJ"',
    'db_url = "postgresql://app:Tr0ub4dor3xampl3@db.internal:5432/app"',
  ]
  for (const line of literalSamples) {
    if (findSecretViolations(line, true).length === 0) {
      tampered.push(
        `detection path no longer flags a credential literal: ${line}`
      )
    }
  }
  const cleanSamples = [
    'DATABASE_URL="postgresql://user:password@localhost:5432/ticketur"',
    '"check:secrets": "node scripts/check-secrets.mjs"',
    '"auth_token_url": "https://example.com/oauth/token"',
  ]
  for (const line of cleanSamples) {
    if (findSecretViolations(line, true).length > 0) {
      tampered.push(`detection path now flags a benign line: ${line}`)
    }
  }
  if (
    findSecretViolations(
      "aria-label={showPassword ? 'Hide password' : 'Show password'}",
      false
    ).length > 0
  ) {
    tampered.push(
      'detection path now flags a UI string that mentions a secret word'
    )
  }
  if (isConfigLike('apps/web/components/auth/login-form.tsx')) {
    tampered.push('a source file is treated as config-like')
  }
  return tampered
}

const tampered = selfCheck()
if (tampered.length > 0) {
  console.error(
    'check-secrets.mjs self-check failed; the guard has been narrowed:'
  )
  for (const t of tampered) console.error(`  ${t}`)
  console.error(
    'Restore the guard; a change that weakens it must not pass its own scan.'
  )
  process.exit(1)
}

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
const tracked = execFileSync('git', ['ls-files'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

const violations = []
for (const file of tracked) {
  const abs = resolve(repoRoot, file)
  let info
  try {
    info = statSync(abs)
  } catch {
    continue
  }
  if (!info.isFile() || info.size > 1024 * 1024) continue
  if (isSecretFilePath(file)) {
    violations.push(
      `${file}: secret-bearing file committed; remove it and rotate the value`
    )
    continue
  }
  const text = readFileSync(abs, 'utf8')
  if (text.includes('\u0000')) continue
  for (const { line, why } of findSecretViolations(text, isConfigLike(file))) {
    violations.push(`${file}:${line}: ${why}`)
  }
}

if (violations.length > 0) {
  console.error('Tracked files contain committed credentials:')
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    'Remove the values, rotate them, and read them from environment/secrets at runtime.'
  )
  process.exit(1)
}

console.log(
  `Checked ${tracked.length} tracked file(s); no committed credentials found.`
)
