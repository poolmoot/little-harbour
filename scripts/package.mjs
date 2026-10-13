// Zips the contents of dist/ into release/little-harbour-web.zip using the system `zip` command.
// Run with `npm run package` (which builds first). Nothing is uploaded anywhere.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const releaseDir = join(root, 'release');
const zipFile = join(releaseDir, 'little-harbour-web.zip');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!existsSync(join(dist, 'index.html'))) {
  fail('There is no build in dist/. Run "npm run build" first (or just "npm run package", which builds for you).');
}

const probe = spawnSync('zip', ['-v'], { stdio: 'ignore' });
if (probe.error || probe.status !== 0) {
  fail('The "zip" command was not found on this computer, so the zip file could not be made.\n'
    + 'On Mac and Linux it is normally built in. On Windows, use Git Bash or WSL, or zip the contents of the dist/ folder by hand.');
}

mkdirSync(releaseDir, { recursive: true });
rmSync(zipFile, { force: true });

// Run inside dist/ so index.html sits at the top of the zip, not inside a "dist" folder.
const zipped = spawnSync('zip', ['-r', '-q', '-X', zipFile, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: dist, stdio: 'inherit' });
if (zipped.error || zipped.status !== 0) fail('Making the zip file failed.');

const kb = Math.round(statSync(zipFile).size / 1024);
console.log(`\nDone: ${zipFile} (${kb} KB)\nUnzip it anywhere and open index.html through a web server, or upload the files to any static web host.\n`);
