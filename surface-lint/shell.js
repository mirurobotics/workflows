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

function main ([command, listFile, ignore = ''], read = (path) => fs.readFileSync(path, 'utf8'), print = console.log) {
  const scripts = read(listFile).split('\n').filter(Boolean)
  if (command === 'select') {
    selectScripts(scripts, ignore).forEach((script) => print(script))
    return 0
  }
  if (command === 'size') {
    const errors = oversized(scripts, read)
    errors.forEach((error) => print(error))
    return errors.length ? 1 : 0
  }
  throw new Error(`unknown command: ${command}`)
}

if (require.main === module) process.exitCode = main(process.argv.slice(2))

module.exports = { selectScripts, oversized, codeLines, isExempt, main }
