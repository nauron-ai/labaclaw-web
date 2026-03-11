import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const packageJsonPath = resolve(repoRoot, 'package.json');
const distDir = resolve(repoRoot, 'dist');
const releaseDir = resolve(repoRoot, 'release');

if (!existsSync(distDir)) {
  console.error('Missing dist/. Run "npm run build" before packaging a release artifact.');
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const releaseVersion = process.env.LABACLAW_WEB_RELEASE_VERSION ?? `v${packageJson.version}`;
const artifactName = process.env.LABACLAW_WEB_RELEASE_NAME ?? `labaclaw-web-${releaseVersion}.zip`;

if (artifactName !== basename(artifactName)) {
  console.error('LABACLAW_WEB_RELEASE_NAME must be a file name without path separators.');
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const artifactPath = resolve(releaseDir, artifactName);
rmSync(artifactPath, { force: true });

const packaged = spawnSync('zip', ['-qr', artifactPath, '.'], {
  cwd: distDir,
  stdio: 'inherit',
});

if (packaged.error) {
  if (packaged.error.code === 'ENOENT') {
    console.error('Missing "zip" command. Install it before packaging release artifacts.');
  } else {
    console.error(packaged.error.message);
  }
  process.exit(1);
}

if (packaged.status !== 0) {
  process.exit(packaged.status ?? 1);
}

console.log(`Created release artifact at ${artifactPath}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `artifact_path=${artifactPath}\n`);
}
