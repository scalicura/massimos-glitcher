# Release identity

For user-visible changes, increment the version in `package.json` once per release batch before committing and pushing. Use `npm run version:patch` for fixes, visual polish, and small changes; use `npm run version:minor` for new features. Do not bump again for follow-up repairs within the same unreleased batch.

The header and Made by Dad footer read that version through Vite's release plugin. The deployed source commit and its timestamp are generated at build time; never hardcode a commit hash, release date, or a separate display version. Netlify's `COMMIT_REF` identifies production source. `release.json` is emitted with each build for verification.

Run `npm test` and `npm run build` before shipping. A pushed commit is not proof of deployment: when live-site verification is part of the request, check `https://max.calicura.net/release.json` against the pushed commit. Preserve unrelated local changes and untracked assets.
