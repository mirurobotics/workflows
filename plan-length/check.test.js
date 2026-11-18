const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { countedText, addedPlans, check } = require('./check.js')

test('countedText: skips the implementation sections up to the next ## heading', () => {
  const plan = '# T\n## Scope\nkept\n## Progress\n- [x] dropped\n## Decision Log\ndropped\n## Plan of Work\nkept too\n## Surprises & Discoveries\ndropped\n## Outcomes & Retrospective\ndropped'
  assert.equal(countedText(plan), '# T\n## Scope\nkept\n## Plan of Work\nkept too')
})

test('countedText: ### subsections stay inside a skipped section', () => {
  assert.equal(countedText('## Progress\n### Milestone 1\ndropped\n## Scope\nkept'), '## Scope\nkept')
})

test('countedText: ignores headings inside code fences', () => {
  const fenced = '## Context\n```markdown\n## Progress\n```\n~~~\n## Decision Log\n~~~\nkept'
  assert.equal(countedText(fenced), fenced)
})

test('countedText: normalizes CRLF line endings', () => {
  assert.equal(countedText('## Scope\r\nkept\r\n## Progress\r\ndropped'), '## Scope\nkept')
})

function run (plans, limit = 10) {
  const out = { info: [], error: [], failed: [] }
  const core = {
    info: (m) => out.info.push(m),
    error: (m, props) => out.error.push({ m, file: props.file }),
    setFailed: (m) => out.failed.push(m)
  }
  check({ core, base: 'base', limit, listPlans: () => Object.keys(plans), readPlan: (p) => plans[p] })
  return out
}

test('check: passes a plan at the limit', () => {
  const out = run({ 'plans/backlog/a.md': 'x'.repeat(10) })
  assert.deepEqual(out.failed, [])
  assert.deepEqual(out.info, ['plans/backlog/a.md is 10 characters; the limit is 10.'])
})

test('check: fails a plan over the limit and names its file', () => {
  const out = run({ 'plans/active/a.md': 'x'.repeat(11), 'plans/active/b.md': 'ok' })
  assert.equal(out.failed.length, 1)
  assert.deepEqual(out.error.map((e) => e.file), ['plans/active/a.md'])
})

test('check: counts characters, not bytes', () => {
  assert.deepEqual(run({ 'plans/backlog/日本語.md': 'é'.repeat(10) }).failed, [])
})

test('check: implementation sections do not count', () => {
  assert.deepEqual(run({ 'plans/completed/a.md': 'short\n## Progress\n' + 'x'.repeat(100) }).failed, [])
})

test('check: passes when the PR adds no plans', () => {
  assert.deepEqual(run({}), { info: [], error: [], failed: [] })
})

test('addedPlans: skips plans already under plans/, even when a move more than doubles them', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-length-'))
  const cwd = process.cwd()
  t.after(() => { process.chdir(cwd); fs.rmSync(dir, { recursive: true, force: true }) })
  process.chdir(dir)
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' }).trim()
  const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text) }
  const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
  git('init', '-q')
  write('plans/active/old.md', words(500))
  write('plans/active/edited.md', words(500))
  git('add', '-A')
  git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD')
  fs.mkdirSync('plans/completed')
  git('mv', 'plans/active/old.md', 'plans/completed/old.md')
  write('plans/active/edited.md', words(500) + ' more')
  fs.writeFileSync('plans/completed/old.md', words(500) + '\n## Outcomes & Retrospective\n' + 'x'.repeat(20000))
  write('plans/backlog/new.md', 'new')
  write('plans/backlog/日本語.md', 'new')
  write('notes/other.md', 'not a plan')
  git('add', '-A')
  git('commit', '-qm', 'change')
  assert.deepEqual(addedPlans(base).sort(), ['plans/backlog/new.md', 'plans/backlog/日本語.md'])
})
