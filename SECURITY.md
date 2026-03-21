# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in SyncMind, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email **exceptionregret@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

## Response Timeline

- **Acknowledgment** — Within 48 hours of your report
- **Assessment** — Within 7 days, we'll confirm the vulnerability and its severity
- **Fix** — Critical issues will be patched as soon as possible

## Scope

The following are in scope:

- SyncMind web application (`app/`, `components/`, `lib/`)
- REST API endpoints (`app/api/`)
- MCP server (`mcp-server/`)
- CLI tool (`mcp-server/cli.js`)

The following are out of scope:

- Third-party services (Neon, PowerSync) — report to their respective security teams
- Issues in dependencies — report upstream, but let us know so we can update

## Best Practices for Deployment

- Never commit `.env.local` or expose your `DATABASE_URL`
- Use environment variables for all secrets
- Restrict API access in production with appropriate authentication
- Keep dependencies updated (`npm audit`)

Thank you for helping keep SyncMind secure.
