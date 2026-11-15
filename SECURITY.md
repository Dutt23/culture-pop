# Security

## Dependency vulnerabilities

`npm run audit:gate` (also run in CI on every push, pull request and weekly):

- **Shipped code** (`npm audit --omit=dev`): any advisory fails the gate unless it is reviewed.
- **Dev tooling**: high and critical advisories fail; moderate and low are printed as warnings.
- **Reviewed exceptions** live in [`security/audit-allowlist.json`](security/audit-allowlist.json).
  Each one needs a reason explaining why it can't be exploited here, and an expiry date. Expired
  entries fail the gate, so an exception can't quietly become permanent.
- A registry or network error fails the gate instead of passing on an empty report.

Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm packages and GitHub Actions.
Enable Dependabot alerts and security updates in the GitHub repository settings after the first
push.

**Adding an allowlist entry:** confirm the vulnerable code path is unreachable in this app, write
down why, set an expiry of at most about three months, and plan the upgrade. Never run
`npm audit fix --force` blindly; it can jump major versions.

## Code-level guards

- **ESLint** bans `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML`
  assignment, `insertAdjacentHTML`, `document.write`, `javascript:` URLs, and `target="_blank"`
  without `rel="noopener"`. Network globals (`fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`) are allowed only under `src/services/`.
- **Content Security Policy** (production builds): same-origin scripts, styles, images, workers
  and connections; no plugins. The one inline exception is the hash of an *empty* `<style>`, which
  Motion's `popLayout` creates before inserting its rule through the CSSOM; inline CSS with content
  is still blocked. An e2e test fails on any CSP violation. Phase 2 must add each
  verified retrieval origin to `connect-src` in `vite.config.ts`.
- **Privacy:** no network requests in Phase 1 (unit and e2e tests check this), external links open
  only on tap with `noopener noreferrer`, and stored settings are validated before use.

## Reporting

This is a personal project; report issues to the repository owner directly.
