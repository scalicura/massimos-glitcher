# Security review — October 23, 2026

## Executive risk summary

No immediately exploitable production PHP RCE or certificate-verification bypass was confirmed in the assessed project. This is a static Vite/browser application served by Netlify, with no repository-defined PHP runtime, backend API, Composer dependency, Docker image, or web-server configuration. This conclusion does not cover other repositories or provider internals.

The initial locked dependency graph contained **16 advisories: 9 High, 6 Medium (registry: moderate), 1 Low, 0 Critical**. These include developer-tool command execution and server-package DoS; package presence is confirmed, but production exploitability is not. Compatible dependency updates and a constrained override now produce **zero registry advisories**. Production lacked framing protection and MIME-sniffing protection; a Netlify headers file is prepared locally. Changes are **not committed, pushed, or deployed**. Live production remains version 5.2.0 at source commit `c80803da8366289c9ba1c3b29450c07fd1af74f9`; the prepared release is 5.2.1.

## Scope and evidence limits

Assessed this checkout, tracked configuration and source, hidden repository files, lockfile dependency advisories, selected installed tool versions, and read-only HTTP/TLS connections to `max.calicura.net`. Source review included input handling, imports, DOM updates, iframe messaging, dependency asset emission, and local storage. Unrelated untracked image assets were preserved.

Not accessed: other repositories, Netlify administrative settings/build logs, deployed worker/host package inventories, Cloudflare/WAF settings, private APIs, certificate renewal jobs, production trust stores, historical secrets, organization CI policy, or branch protections. No exploit payloads or stress tests were used. Finding no configuration in Git does not prove a managed service lacks controls.

Evidence files in this directory: `dependency-audit.json`, `http-evidence.txt`, `live-release.json`, and `tls-evidence.json`. `tls-check.mjs` reproduces four certificate-validated protocol probes; it enables legacy offers solely for negative testing. Node's chain output may include locally constructed issuer certificates as well as those supplied by the server.

## Findings and remediation status

Severity in dependency rows is the upstream rating, not a claim of reachable production exploitation.

| File / service | Severity | Issue / reference | Current state / action |
|---|---|---|---|
| `package.json`, lockfile: Vite 7.3.6 | High | Windows editor command execution, [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), CVE-2026-112942 | Updated to 7.3.7. Development tooling; do not expose dev/preview servers publicly. |
| Same Vite package | Medium | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22): editor argument handling and filesystem exposure | Cleared by 7.3.7. |
| Same Vite package | Low | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw): cross-origin script execution via custom middleware | Cleared by 7.3.7; custom middleware exists in `vite.config.js`. |
| EmulatorJS → node-minify → glob 10.3.3 | High | CLI command injection, [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2), CVE-2025-64756 | Overridden to 10.5.0, a patched same-major release per upstream advisory. Requires vulnerable CLI `-c/--cmd` invocation; none found in app build scripts. |
| Vite → PostCSS → nanoid 3.3.16 | High | Generator infinite loop, [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | Updated to 3.3.20; vulnerable invocation not demonstrated. |
| Vite → PostCSS → source-map-js 1.2.1 | High | Source-map DoS, [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | Updated to 1.2.2; build tooling. |
| EmulatorJS → glob → brace-expansion 2.1.4 | High | Recursive expansion DoS: [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Updated to 2.1.7. |
| Same brace-expansion package | Medium | Quadratic expansion DoS, [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Updated to 2.1.7. |
| EmulatorJS → Socket.IO → engine.io 6.6.9 | High | Protocol mismatch DoS, [GHSA-2gc4-cqfq-p2gv](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv), CVE-2026-102599 | Updated to 6.6.11. No Engine.IO server is started by this app; static browser client assets are separately vendored. |
| EmulatorJS → http-server → follow-redirects 1.16.0 | High | Credential stripping bypass: [GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8), [GHSA-8r9p-f939-6h3c](https://github.com/advisories/GHSA-8r9p-f939-6h3c) | Updated to 1.16.1; no app proxy/HTTP server invocation found. |
| EmulatorJS → http-server → qs 6.15.3 | Medium | Parsing DoS: [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | Updated to 6.16.1; not a deployed backend here. |
| Live Netlify responses / `public/_headers` | Medium | Missing `X-Frame-Options`, CSP framing protection, and `X-Content-Type-Options` | Prepared SAMEORIGIN, CSP `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, and `nosniff`. Same-origin Retro Lab embedding remains allowed. Deployment pending. |
| App Content Security Policy | Medium | No script-source restriction; YouTube API executes third-party JavaScript in page context | Partial CSP added; full script/connect/frame policy remains open. Stage a report-only policy and exercise YouTube, blob workers, exports, and EmulatorJS/WASM before enforcement. Zero registry alerts does not attest bundled WASM safety. |
| `src/image-io.js` | Low | 25 MB compressed-file limit does not bound decoded pixel allocation | Local user-selected files can exhaust browser memory. Add format-aware dimension checks before decoding and a pixel budget; do not describe post-decode checks as prevention. No server DoS path identified. |
| Repository CI/CD | Medium | No checked-in workflow, dependency security gate, or runtime pin | Add frozen-lockfile install, dependency audit, tests and build to deployment checks; restrict deployment credentials to protected branches. Provider-side checks/branch protections unverified. |
| Audit workstation Node v24.19.0 / OpenSSL 3.5.7 | Low | Falls within OpenSSL [CVE-2026-35189](https://openssl-library.org/news/vulnerabilities/index.html) affected 3.5 range (<3.5.9), CRLDP allocation DoS | Local tool observation, not production inventory. Upgrade through a supported Node release carrying vendor fixes; applicability requires affected certificate-processing path. No host runtime changed. |
| Transitive deprecated packages | Low | glob 10.5.0, node-domexception 1.0.0, whatwg-encoding 2.0.0 remain deprecated | No remaining registry advisory; track upstream EmulatorJS modernization. Avoid untested major overrides solely to remove deprecation notices. |

## PHP determination and emergency guidance

No `.php`, `php.ini`, Composer manifests/locks, Docker/Compose files, Kubernetes manifests, or PHP deployment scripts were found. Therefore PHP memory, sessions, production errors, Guzzle/cURL, and PHP runtime version checks are **not applicable to this checkout**, rather than compliant by default.

[PHP's October 21 advisory](https://www.php.net/archive/2026.php#2026-10-21-5) confirms CVE-2026-109618 (OOM corruption) and CVE-2026-109619 (stale state), critical unauthenticated RCE affecting web request runtimes. Fixed branch targets: **8.2.35+, 8.3.36+, 8.4.27+, 8.5.12+**. Branch-aware comparisons matter: for example, 8.4.26 is vulnerable even though 8.5.12 exists. Distribution versions require vendor package/backport evidence, not just numeric comparison.

PHP 7.x, 8.0 and 8.1 are [EOL](https://www.php.net/eol.php) and should migrate to a supported branch. Correction to the task premise: PHP supplied emergency minimal **source backports for 7.4/8.0/8.1**; some vendors also backport. These do not restore ongoing upstream support. Validate actual web SAPI and restart all workers after upgrading; a patched CLI executable alone is insufficient.

[PHP's October 23 notice](https://www.php.net/archive/2026.php) additionally recommends `session.upload_progress.enabled=0` pending a regular fix for CVE-2026-115560, involving unusual runtime session-serializer changes. Keep this defense even after the October 21 patches. Request limits and WAF rules are supplemental and do not replace runtime patching. Error suppression does not prevent the stale-state flaw.

## TLS, certificates and trust

At approximately 15:19 PDT, the tested edge rejected TLS 1.0/1.1 with a remote protocol-version alert and accepted TLS 1.2/1.3 with hostname/chain verification enabled. Negotiated suites were ECDHE-ECDSA-AES128-GCM-SHA256 and TLS_AES_128_GCM_SHA256. HTTP redirected with 301 to HTTPS. HTTPS returned `Strict-Transport-Security: max-age=31536000`.

The observed certificate names `max.calicura.net`, issuer Let's Encrypt YE2, expiry **January 1, 2027 15:23:42 UTC**. The client built a valid trust path. This is point-in-time validation, not proof of revocation status, uncompromised intermediates, correct renewal automation, compatibility with every client trust store, or every edge's configuration. Full offered-cipher enumeration (CBC/RC4/3DES/weak finite-field DH), OCSP/revocation checks and provider renewal controls remain unverified. The successful AEAD choices alone do not prove other ciphers are disabled.

No tracked certificate/private-key bundles or custom CA stores were found. App HTTPS requests use browser verification; no `CURLOPT_SSL_VERIFYPEER=false`, Guzzle `verify=false`, `rejectUnauthorized=false`, or disabled Node TLS verification was found in reviewed app/config source. Parent/child emulator messages check both origin and source; dynamic DOM writes reviewed were fixed markup or bounded labels, with user-facing values generally assigned through textContent.

Provider OpenSSL/wolfSSL versions cannot be inferred from a successful TLS connection or Netlify response banner. Obtain provider attestations/SBOMs and compare exact builds and enabled features with [OpenSSL advisories](https://openssl-library.org/news/vulnerabilities/index.html) and [wolfSSL advisories](https://www.wolfssl.com/docs/security-vulnerabilities/). [wolfSSL 5.9.4](https://www.wolfssl.com/wolfssl-5-9-4-release-blog/) addresses three High issues affecting specific trust/OCSP/raw-key configurations; no wolfSSL dependency was found here. Do not equate absence from an npm lockfile with absence in managed infrastructure.

## Direct patches and reference configurations

`remediation.diff` contains the exact repository dependency/header patch. The lockfile refresh updates compatible transitive versions and integrity hashes. `public/_headers` is copied to `dist/_headers` by Vite and applies on Netlify deployment. No fictitious PHP deployment has been added to this static project.

The following blocks are **reference templates only**, not deployed configuration. A PHP environment owner must adapt paths, upload budgets, extensions, routing and image digests, then validate under the actual production SAPI.

```dockerfile
# Example replacement for an older 8.4 runtime. Verify registry availability,
# resolve and pin the reviewed image digest, and rebuild to receive OS updates.
FROM php:8.4.27-fpm-bookworm
COPY security.ini /usr/local/etc/php/conf.d/99-security.ini
# Retain the application's required extensions and non-root pool configuration.
```

```ini
; security.ini — starting budget, not an RCE mitigation or universal capacity plan
memory_limit = 256M
post_max_size = 16M
upload_max_filesize = 12M
max_input_time = 30
max_execution_time = 30
max_input_vars = 1000
session.upload_progress.enabled = 0
session.cookie_secure = 1
session.cookie_httponly = 1
session.cookie_samesite = Lax
session.use_strict_mode = 1
session.use_only_cookies = 1
display_errors = Off
display_startup_errors = Off
log_errors = On
error_log = /proc/self/fd/2
expose_php = Off
; Container stderr must go to access-controlled, retained logs.
; Size FPM worker counts/container limits for concurrent worst-case allocation.
```

```nginx
# Merge inside the production HTTPS server block; validate with nginx -t.
ssl_protocols TLSv1.2 TLSv1.3;
# TLS 1.2 AEAD-only suites; TLS 1.3 uses its separate library defaults.
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Content-Security-Policy "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" always;
client_max_body_size 16m;
client_body_timeout 15s;
# Keep existing valid full-chain/key paths; renew and reload automatically.
# Check nested locations: add_header inheritance can replace parent headers.
# Enforce the same body ceiling in proxies/WAFs and protect origin bypasses.
```

```php
// cURL: keep both chain and hostname verification. Use a patched system CA store.
$curl = curl_init('https://api.example.com/resource');
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_SSLVERSION => CURL_SSLVERSION_TLSv1_2, // minimum; permits TLS 1.3
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_FOLLOWLOCATION => false,
]);
$body = curl_exec($curl);
if ($body === false) {
    // Log a sanitized internal diagnostic; return a generic client error.
    throw new RuntimeException('Upstream HTTPS request failed');
}
// Guzzle equivalent (with a supported, audited package version):
$client = new \GuzzleHttp\Client([
    'verify' => true, 'connect_timeout' => 5, 'timeout' => 20,
    'allow_redirects' => false,
]);
// After a successful login or role elevation, before privileged use:
if (!session_regenerate_id(true)) {
    throw new RuntimeException('Session rotation failed');
}
```

Keep endpoint URLs fixed/allowlisted; TLS verification alone does not prevent SSRF. Configure production logs outside the document root, redact secrets and cookies, and verify that log paths exist under the service identity. For Certbot-managed hosts, inspect timers, run `certbot renew --dry-run`, test reload hooks and alert before expiry; for Netlify, inspect domain certificate/renewal state in its control panel. Never expose phpinfo or an unauthenticated diagnostics endpoint to collect inventory.

## Validation and remaining actions

- `pnpm audit --json`: zero advisories after remediation; no suppression rules added.
- `npm test`: 33 passed, 0 failed.
- `npm run build`: passed with Vite 7.3.7; header file present in output.
- `git diff --check`: passed. Existing untracked image assets preserved.
- These checks do not include interactive browser regression testing of YouTube/emulation, exhaustive dependency source audit, or deployment.

Priority 1: review and deploy the prepared 5.2.1 batch, then verify production headers and `release.json` against the new source commit. Production has not received these fixes merely because local tests pass.

Priority 2: obtain the complete repository/domain inventory and provider access or exports: runtime/SAPI versions, OS security package revisions/SBOMs, web/WAF configuration, TLS policy, renewal status, trust-store contents, deployment settings and CI permissions. Patch any discovered PHP web runtime immediately to its branch target and disable upload progress as above. Backported builds need vendor confirmation.

Priority 3: add a mandatory deployment gate (`pnpm install --frozen-lockfile`, `pnpm audit`, `npm test`, `npm run build`), least-privilege workflow permissions, pinned reviewed actions, protected environments and short-lived deployment identity; implement full CSP after compatibility checks and pre-decode image dimension limits. Confirm full cipher/revocation coverage using an approved TLS scanner and monitor renewal failures.
