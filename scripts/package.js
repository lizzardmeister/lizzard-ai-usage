const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const outputDirectory = path.join(root, 'installer-versions');
const outputFile = path.join(outputDirectory, `${manifest.name}-${manifest.version}.vsix`);

mkdirSync(outputDirectory, { recursive: true });
execFileSync(process.execPath, [require.resolve('@vscode/vsce/vsce'), 'package', '--no-dependencies', '--out', outputFile], {
  cwd: root,
  stdio: 'inherit'
});
