const fs = require('node:fs')
const path = require('node:path')

const packagePath = path.resolve(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(packageJson.version)

if (!match) {
  console.error(`Cannot roll build number: package version "${packageJson.version}" is not valid semver.`)
  process.exit(1)
}

const [, major, minor, patch, prerelease] = match
let nextVersion
if (prerelease) {
  const suffix = /^(.*?)(\d+)$/.exec(prerelease)
  nextVersion = suffix
    ? `${major}.${minor}.${patch}-${suffix[1]}${Number(suffix[2]) + 1}`
    : `${major}.${minor}.${patch}-${prerelease}.1`
} else {
  nextVersion = `${major}.${minor}.${Number(patch) + 1}`
}
packageJson.version = nextVersion

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
console.log(`Building Oyama AI Video Studio ${nextVersion}`)
