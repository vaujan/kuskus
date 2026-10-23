/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require('node:child_process')

if (process.argv.length !== 2) {
  console.error('Usage: pnpm release. Set and commit the version before preparing a release.')
  process.exit(1)
}
if (process.platform !== 'win32') {
  console.error('Public releases must be prepared and verified on Windows.')
  process.exit(1)
}
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
// No version, Git tag, or publication is changed by this command.
// Windows needs a shell to invoke the pnpm.cmd shim; every argument is constant.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const run = (args) => execFileSync(pnpm, args, { stdio: 'inherit', shell: true })
run(['check'])
run(['audit', '--prod'])
run(['exec', 'electron-builder', '--win', '--publish', 'never', '--config.forceCodeSigning=true'])
