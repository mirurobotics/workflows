// Fails when a PR adds a plan that is over the length limit.

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')

const SKIPPED = ['progress', 'surprises & discoveries', 'decision log', 'outcomes & retrospective']
const PLAN_GLOBS = ['plans/backlog/*.md', 'plans/active/*.md', 'plans/completed/*.md']

// The sections filled in during implementation don't count toward the limit.
function countedText (text) {
  const kept = []
  let fenced = false
  let skipping = false
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) fenced = !fenced
    const heading = !fenced && line.match(/^##\s+(.*)$/)
    if (heading) skipping = SKIPPED.includes(heading[1].trim().toLowerCase())
    if (!skipping) kept.push(line)
  }
  return kept.join('\n')
}

// A plan git pairs with a base plan as a rename isn't new, so older long
// plans can still be moved and closed.
function addedPlans (base) {
  const args = ['-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=A', base, 'HEAD', '--', ...PLAN_GLOBS]
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
}

function check ({ core, base, limit, listPlans = addedPlans, readPlan = (p) => readFileSync(p, 'utf8') }) {
  for (const plan of listPlans(base)) {
    const chars = [...countedText(readPlan(plan))].length
    core.info(`${plan} is ${chars} characters; the limit is ${limit}.`)
    if (chars > limit) {
      core.error(`Plan is ${chars} characters, not counting Progress, Surprises & Discoveries, Decision Log or Outcomes & Retrospective; the limit is ${limit}.`, { file: plan })
      core.setFailed('A new plan is over the length limit.')
    }
  }
}

module.exports = { countedText, addedPlans, check }
