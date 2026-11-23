const fs = require('node:fs')

const LIMIT = 100

function selectScripts (scripts, ignore) {
  const ignored = ignore.split(/\s+/).filter(Boolean).map(normalize)
  return scripts.filter((script) => !ignored.some((path) => isWithin(script, path)))
}

function normalize (path) {
  return path.replace(/^\.\//, '').replace(/\/+$/, '')
}

function isWithin (script, path) {
  return script === path || script.startsWith(`${path}/`)
}

function oversized (scripts, read) {
  return scripts.flatMap((script) => {
    const text = read(script)
    const lines = codeLines(text)
    if (isExempt(text) || lines <= LIMIT) return []
    return [`${script}: file is ${lines} lines (limit ${LIMIT}); port it to Go or Python`]
  })
}

function codeLines (text) {
  return text.split('\n').filter((line) => !/^\s*(#|$)/.test(line)).length
}

function isExempt (text) {
  return /^#\s*nolint:filelen/m.test(text)
}

function main ([command, listFile, ignore = '']) {
  const scripts = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean)
  if (command === 'select') {
    for (const script of selectScripts(scripts, ignore)) console.log(script)
    return 0
  }
  const errors = oversized(scripts, (script) => fs.readFileSync(script, 'utf8'))
  for (const error of errors) console.log(error)
  return errors.length ? 1 : 0
}

if (require.main === module) process.exitCode = main(process.argv.slice(2))

module.exports = { selectScripts, oversized, codeLines, isExempt }
