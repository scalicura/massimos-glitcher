import { execFileSync } from 'node:child_process';

const COMMIT_PATTERN = /^[a-f0-9]{40}$/i;

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function createReleaseInfo(version, { env = process.env, runGit = git, builtAt = new Date().toISOString(), development = false } = {}) {
  // Netlify supplies the exact deployed revision; never expose other environment data.
  const candidate = env.COMMIT_REF || runGit('rev-parse', 'HEAD');
  const commit = COMMIT_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
  const rawDate = commit ? runGit('show', '-s', '--format=%cI', commit) : '';
  const committedAt = rawDate && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : null;
  return { version, commit, shortCommit: commit?.slice(0, 7) || null, committedAt, builtAt, development };
}

export function releaseInfoPlugin(release) {
  const date = release.committedAt || release.builtAt;
  const displayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(date));
  const replacements = {
    '%APP_VERSION%': release.version,
    '%APP_COMMIT%': release.shortCommit || 'unavailable',
    '%APP_COMMIT_URL%': release.commit ? `https://github.com/scalicura/massimos-glitcher/commit/${release.commit}` : 'https://github.com/scalicura/massimos-glitcher',
    '%APP_RELEASE_DATE%': date,
    '%APP_RELEASE_DATE_DISPLAY%': displayDate,
    '%APP_DATE_LABEL%': release.committedAt ? 'Committed' : 'Built',
    '%APP_DATE_DESCRIPTION%': release.committedAt ? 'Source commit time in Pacific time' : 'Build time in Pacific time; source commit time unavailable',
    '%APP_BUILD_LABEL%': release.development ? 'Local preview' : 'Release',
  };
  return {
    name: 'massimo-release-info',
    transformIndexHtml(html) {
      return html.replace(/%APP_[A-Z_]+%/g, (token) => replacements[token] ?? token);
    },
    configureServer(server) {
      server.middlewares.use('/release.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(release));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify(release, null, 2) });
    },
  };
}
