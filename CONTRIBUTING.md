# Contributing

Contributions are welcome! This is a small, opinionated project — the goal is to stay minimal.

## Getting started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/stream-of-consciousness.git`
3. Install dependencies: `npm install`
4. Build: `npm run build`

## Development

After editing `src/index.ts`, run `npm run build`. Claude Code picks up the new build on the next conversation.

To test as a local plugin:

```bash
claude plugin add ./
```

## Pull requests

- Keep changes focused and atomic
- Follow the existing code style
- Update the README if you change user-facing behavior
- Describe what you changed and why

## Philosophy

The stream is intentionally minimal. Before adding a feature, consider whether it adds complexity that contradicts the system's design:

- No tags, no priorities, no categories
- No configuration beyond what exists
- Decay is the only organizational force
- Less is more

## Reporting issues

Use the [GitHub issue tracker](https://github.com/onebit0fme/stream-of-consciousness/issues). Search existing issues before creating a new one.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
