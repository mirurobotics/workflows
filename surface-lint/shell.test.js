const test = require('node:test')
const assert = require('node:assert/strict')
const { selectScripts, oversized, codeLines, isExempt, main } = require('./shell.js')

test('selectScripts: keeps every script with no ignores', () => {
  assert.deepEqual(selectScripts(['a.sh', 'b/c.sh'], ''), ['a.sh', 'b/c.sh'])
})

test('selectScripts: drops a listed file and everything under a listed directory', () => {
  const scripts = ['a.sh', 'vendor/x.sh', 'vendor/y/z.sh', 'vendorx/a.sh', 'keep.sh']
  assert.deepEqual(selectScripts(scripts, 'a.sh vendor'), ['vendorx/a.sh', 'keep.sh'])
})

test('selectScripts: ignores a leading ./ and a trailing slash on entries', () => {
  assert.deepEqual(selectScripts(['vendor/x.sh', 'b.sh'], './vendor/  ./b.sh'), [])
})

test('codeLines: skips blank lines, comments and the shebang', () => {
  assert.equal(codeLines('#!/bin/sh\n\n# note\n  # indented\necho a\n  echo b\n'), 2)
})

test('isExempt: matches a nolint:filelen line, not a mention in code', () => {
  assert.equal(isExempt('#!/bin/sh\n# nolint:filelen\necho a'), true)
  assert.equal(isExempt('#nolint:filelen'), true)
  assert.equal(isExempt('echo "# nolint:filelen"'), false)
})

test('oversized: fails only over the limit', () => {
  const files = { 'ok.sh': '# note\n\n'.repeat(50) + 'echo\n'.repeat(100), 'big.sh': 'echo\n'.repeat(101) }
  assert.deepEqual(oversized(['ok.sh', 'big.sh'], (f) => files[f]), [
    'big.sh: file is 101 lines (limit 100); port it to Go or Python'
  ])
})

test('oversized: skips exempt files', () => {
  assert.deepEqual(oversized(['big.sh'], () => '# nolint:filelen\n' + 'echo\n'.repeat(101)), [])
})

function run (args, files) {
  const printed = []
  const code = main(args, (path) => files[path], (line) => printed.push(line))
  return { code, printed }
}

test('main: select prints the scripts left after ignores', () => {
  assert.deepEqual(run(['select', 'list', 'vendor'], { list: 'a.sh\nvendor/b.sh\n' }), { code: 0, printed: ['a.sh'] })
})

test('main: size exits 1 and names an oversized script', () => {
  const files = { list: 'ok.sh\nbig.sh\n', 'ok.sh': 'echo\n', 'big.sh': 'echo\n'.repeat(101) }
  const { code, printed } = run(['size', 'list'], files)
  assert.equal(code, 1)
  assert.match(printed[0], /^big\.sh: file is 101 lines/)
})

test('main: size exits 0 when every script fits', () => {
  assert.deepEqual(run(['size', 'list'], { list: 'ok.sh\n', 'ok.sh': 'echo\n' }), { code: 0, printed: [] })
})

test('main: rejects an unknown command', () => {
  assert.throws(() => run(['sizes', 'list'], { list: '' }), /unknown command: sizes/)
})
