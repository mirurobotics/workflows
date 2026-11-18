// Fails when a PR adds a plan that is over the length limit.

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { basename } = require('node:path')

const SKIPPED = ['Progress', 'Surprises & Discoveries', 'Decision Log', 'Outcomes & Retrospective']
const PLAN_GLOBS = ['plans/backlog/*.md', 'plans/active/*.md', 'plans/completed/*.md']

// The sections filled in during implementation don't count toward the limit.
function countedText (text) {
  const kept = []
  let fence = ''
  let skipping = false
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const run = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/)
    if (run && !fence && !(run[1][0] === '`' && run[2].includes('`'))) fence = run[1]
    else if (run && fence && run[1][0] === fence[0] && run[1].length >= fence.length && !run[2].trim()) fence = ''
    const heading = !fence && !run && line.match(/^##\s+(.*)$/)
    if (heading) skipping = SKIPPED.some((name) => name.toLowerCase() === heading[1].trim().toLowerCase())
    if (!skipping) kept.push(line)
  }
  return kept.join('\n')
}

// A plan whose file name is already under plans/ at the base isn't new, so
// older long plans can still be moved and closed.
function addedPlans (base) {
  const git = (...args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const existing = new Set(git('ls-tree', '-r', '--name-only', base, '--', 'plans/').map((p) => basename(p)))
  return git('diff', '--name-only', '--no-renames', '--diff-filter=A', base, 'HEAD', '--', ...PLAN_GLOBS).filter((p) => !existing.has(basename(p)))
}

function check ({ core, base, limit, listPlans = addedPlans, readPlan = (p) => readFileSync(p, 'utf8') }) {
  for (const plan of listPlans(base)) {
    const chars = [...countedText(readPlan(plan))].length
    core.info(`${plan} is ${chars} characters; the limit is ${limit}.`)
    if (chars > limit) {
      core.error(`Plan is ${chars} characters, not counting ${SKIPPED.join(', ')}; the limit is ${limit}.`, { file: plan })
      core.setFailed('A new plan is over the length limit.')
    }
  }
}

module.exports = { countedText, addedPlans, check }
