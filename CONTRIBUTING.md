# Contributing to SyncMind

Thank you for your interest in contributing to SyncMind! Every contribution helps make shared AI memory better for everyone.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/syncmind.git
   cd syncmind
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Set up** the database and environment — see the [Quick Start](README.md#quick-start) guide
5. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

```bash
npm run dev     # Start the dev server at http://localhost:3000
npm run build   # Verify production build
npm run lint    # Run ESLint
```

### MCP Server / CLI Development

```bash
cd mcp-server
npm install
npm link        # Makes `syncmind` and `syncmind-mcp` available globally
```

## What Can I Contribute?

- **Bug fixes** — Found something broken? Fix it and submit a PR.
- **New memory source types** — Add auto-capture support for new tools or workflows.
- **IDE integrations** — Improve or add MCP configs for new editors.
- **Dashboard improvements** — Better filtering, visualization, or UX.
- **Documentation** — Clarify setup steps, add examples, fix typos.
- **Tests** — Help improve test coverage.

## Pull Request Guidelines

1. **Keep PRs focused** — One feature or fix per PR. Smaller PRs are easier to review.
2. **Write clear commit messages** — Describe what changed and why.
3. **Update documentation** — If your change affects usage, update the README or relevant docs.
4. **Test your changes** — Make sure `npm run build` and `npm run lint` pass.
5. **Follow existing code style** — Match the patterns already in the codebase.

## Commit Message Format

Use clear, descriptive commit messages:

```
Add memory export feature
Fix dedup threshold for short memories
Update CLI help text for capture command
```

## Reporting Issues

- Use [GitHub Issues](https://github.com/ExceptionRegret/syncmind/issues) to report bugs or request features
- Check existing issues before creating a new one
- Include steps to reproduce for bug reports

## Questions?

Reach out at **exceptionregret@gmail.com** or open a [discussion](https://github.com/ExceptionRegret/syncmind/issues).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
