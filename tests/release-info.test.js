import test from 'node:test';
import assert from 'node:assert/strict';
import { createReleaseInfo, releaseInfoPlugin } from '../build/release-info.js';

const sha = 'a'.repeat(40);
const builtAt = '2026-10-17T05:00:00.000Z';

test('release identifies Netlify source rather than a different local checkout', () => {
  const calls = [];
  const release = createReleaseInfo('5.1.0', { env: { COMMIT_REF: sha, SECRET: 'never-publish' }, builtAt, runGit: (...args) => { calls.push(args); return '2026-10-16T21:00:00-07:00'; } });
  assert.equal(release.commit, sha);
  assert.equal(release.shortCommit, 'aaaaaaa');
  assert.equal(release.committedAt, '2026-10-17T04:00:00.000Z');
  assert.deepEqual(calls, [['show', '-s', '--format=%cI', sha]]);
  assert.doesNotMatch(JSON.stringify(release), /never-publish|SECRET/);
});

test('local builds use Git metadata and explicitly mark development', () => {
  const release = createReleaseInfo('5.1.0', { env: {}, builtAt, development: true, runGit: (...args) => args[0] === 'rev-parse' ? sha : '2026-10-17T04:00:00Z' });
  assert.equal(release.commit, sha);
  assert.equal(release.development, true);
});

test('builds without Git use an honest built date and never interpolate invalid revisions', () => {
  const release = createReleaseInfo('5.1.0', { env: { COMMIT_REF: '<bad-ref>' }, runGit: () => { throw new Error('must not run'); }, builtAt });
  assert.equal(release.commit, null);
  assert.equal(release.committedAt, null);
  const html = releaseInfoPlugin(release).transformIndexHtml('%APP_VERSION% %APP_COMMIT% %APP_DATE_LABEL% %APP_RELEASE_DATE%');
  assert.equal(html, `5.1.0 unavailable Built ${builtAt}`);
});

test('footer and machine-readable release manifest share the same build identity', () => {
  const release = createReleaseInfo('5.1.0', { env: { COMMIT_REF: sha }, runGit: () => '2026-10-17T04:00:00Z', builtAt });
  const plugin = releaseInfoPlugin(release);
  const html = plugin.transformIndexHtml('%APP_VERSION% %APP_COMMIT% %APP_DATE_LABEL% %APP_BUILD_LABEL% %APP_RELEASE_DATE_DISPLAY%');
  assert.match(html, /^5\.1\.0 aaaaaaa Committed Release/);
  assert.match(html, /Oct 16, 2026/);
  assert.doesNotMatch(html, /%APP_/);
  let asset;
  plugin.generateBundle.call({ emitFile(value) { asset = value; } });
  assert.equal(asset.fileName, 'release.json');
  assert.deepEqual(JSON.parse(asset.source), release);
});
