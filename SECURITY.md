# Security Policy

## Supported versions

Security fixes are applied to the default branch (`main`) of active OpenLyceum
repositories listed in [structure/repos.json](https://github.com/OpenLyceum/Baton/blob/main/structure/repos.json).

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use [GitHub Security Advisories](https://github.com/advisories) on the
affected repository:

1. Open the repository on GitHub.
2. Go to **Security** → **Report a vulnerability**.
3. Submit a private advisory with steps to reproduce and impact.

If you cannot use GitHub Security Advisories for a given repository, open a
private report via the OpenLyceum organization contact channels.

We aim to acknowledge reports within a reasonable timeframe and will coordinate
disclosure once a fix is available.

## Content Security Policy

`vite.config.ts` serves a CSP on the dev server and on `vite preview`. A static
host does not get it for free — if this sim is deployed somewhere that can set
response headers, mirror the policy there.

Three relaxations are deliberate. Each is a dependency on SceneryStack, not a
choice a sim would make on its own, so each should be re-audited when
SceneryStack changes:

| Relaxation | Why it is there | When it can go |
|---|---|---|
| `script-src 'unsafe-eval'` | QueryStringMachine builds its parameter schema with `Function`/`eval`. | When SceneryStack parses query parameters without dynamic code evaluation. |
| `script-src-attr 'unsafe-hashes'` + two `sha256-` hashes | Scenery sets `onclick` on some parallel-DOM primary siblings (the step-forward button, for one) to suppress default activation, using two values: `return false` and the empty string. Without the hashes the browser blocks them and logs a CSP error on every activation. | When Scenery attaches those handlers with `addEventListener` instead of attributes. The hashes cover exactly those two strings and nothing else; they do not admit inline `<script>`. |
| `style-src 'unsafe-inline'` | Scenery styles the display and parallel DOM through `element.style` / `cssText`. | When SceneryStack moves that styling into a stylesheet or adopts nonces. |

`'unsafe-inline'` is deliberately **absent** from `script-src`, and
`object-src 'none'` / `base-uri 'self'` / `frame-ancestors 'none'` are set — so
the policy still blocks injected script tags, plugin content, base-tag
hijacking and framing.
