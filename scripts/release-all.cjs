const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const { version } = require('../package.json')
const output = path.join(root, 'release', version)
const lockPath = path.join(root, 'release', '.dual-build.lock')

function run(command, args, label, logPath) {
  return new Promise((resolve, reject) => {
    const log = logPath ? fs.createWriteStream(logPath) : null
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', data => { process.stdout.write(data); log?.write(data) })
    child.stderr.on('data', data => { process.stderr.write(data); log?.write(data) })
    child.once('error', error => { log?.end(); reject(error) })
    child.once('close', code => { log?.end(); if (code === 0) resolve(); else reject(new Error(`${label} failed with exit code ${code}.`)) })
  })
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  let lock
  try { lock = fs.openSync(lockPath, 'wx') } catch { throw new Error('A combined build is already running or its lock remains after an interrupted build: release/.dual-build.lock. Verify no build is running before removing that lock.') }
  try {
    fs.writeFileSync(lock, String(process.pid))
    // Build shared sources exactly once before platform packagers run together.
    const shell = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'sh'
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm lint && pnpm test && pnpm build'] : ['-c', 'pnpm lint && pnpm test && pnpm build']
    await run(shell, args, 'Validation and shared build')
    const cli = require.resolve('electron-builder/out/cli/cli.js')
    const results = await Promise.allSettled([
      run(process.execPath, [cli, '--win', 'nsis', '--x64', '--publish', 'never', '--config.npmRebuild=false', `--config.directories.output=${path.join(output, 'windows')}`], 'Windows', path.join(output, 'windows-build.log')),
      run(process.execPath, [cli, '--linux', 'zip', '--x64', '--publish', 'never', '--config.npmRebuild=false', `--config.directories.output=${path.join(output, 'linux')}`], 'Linux', path.join(output, 'linux-build.log')),
    ])
    const errors = results.filter(result => result.status === 'rejected')
    if (errors.length) throw new AggregateError(errors.map(result => result.reason), 'One or more platform packages failed. Successful artifacts are retained.')
    console.log(`Windows NSIS installer and Linux portable ZIP ready: ${output}`)
  } finally { fs.closeSync(lock); fs.unlinkSync(lockPath) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
