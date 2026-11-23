const test = require('node:test')
const assert = require('node:assert/strict')
const { selectScripts, oversized, codeLines, isExempt } = require('./shell.js')

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
  const files = { 'ok.sh': 'echo\n'.repeat(100), 'big.sh': 'echo\n'.repeat(101) }
  assert.deepEqual(oversized(['ok.sh', 'big.sh'], (f) => files[f]), [
    'big.sh: file is 101 lines (limit 100); port it to Go or Python'
  ])
})

test('oversized: skips exempt files', () => {
  assert.deepEqual(oversized(['big.sh'], () => '# nolint:filelen\n' + 'echo\n'.repeat(101)), [])
})
