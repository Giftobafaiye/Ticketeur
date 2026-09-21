#!/usr/bin/env node
// Build configs for PostCSS, Next.js, Tailwind, ESLint, Drizzle and Trigger
// are loaded and executed at build time by Next.js/Vercel in the deploy
// container, which holds the projects' production environment. They must stay
// declarative. A fork merge once appended a wallet-drainer payload to
// packages/ui/postcss.config.mjs, so this scan fails the build when a config
// gains module-scope primitives that only such a payload needs.
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
]

// Resolve the repository root and list tracked files from there, so the scan
// covers every workspace config no matter which package directory invokes it.
// Vercel runs this from apps/web and apps/admin during their production builds,
// and the configs that must be checked (including packages/ui/postcss.config.mjs)
// live outside those directories.
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()

const files = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => CONFIG_PATTERNS.some((re) => re.test(f)))

const violations = []
for (const file of files) {
  const lines = readFileSync(resolve(repoRoot, file), 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const { re, why } of FORBIDDEN) {
      if (re.test(line)) violations.push(`${file}:${i + 1}: ${why}: ${line.trim()}`)
    }
  })
}

if (violations.length > 0) {
  console.error('Build configs contain module-scope code execution or network/process primitives:')
  for (const v of violations) console.error(`  ${v}`)
  console.error('Build configs must stay declarative; remove the offending code.')
  process.exit(1)
}

console.log(`Checked ${files.length} build config file(s); no injected primitives found.`)
