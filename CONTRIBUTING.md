# Contributing to bitcoin-wallet-connector

Thank you for your interest in contributing to bitcoin-wallet-connector!

## Prerequisites

This project uses [mise](https://mise.jdx.dev/) for tool version management. Make sure you have mise installed:

```bash
# macOS
brew install mise

# Or see https://mise.jdx.dev/getting-started.html for other installation methods
```

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/user/bitcoin-wallet-connector.git
cd bitcoin-wallet-connector
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the project:

```bash
pnpm build
```

## Development

### Available Scripts

| Script                 | Description                    |
| ---------------------- | ------------------------------ |
| `pnpm build`           | Build the library              |
| `pnpm test`            | Run tests                      |
| `pnpm storybook`       | Start Storybook dev server     |
| `pnpm build-storybook` | Build Storybook for production |

### Project Structure

```
src/
├── adapters/           # Wallet adapter implementations
│   ├── *Adapter.ts     # Adapter factory (public API)
│   └── *Adapter.impl.ts # Adapter implementation (internal)
├── utils/              # Shared utilities
├── BitcoinWalletConnector.ts    # Core connector class
├── BitcoinConnectionProvider.tsx # React context provider
└── WalletAdapters.types.ts      # Type definitions
```

### Adding a New Wallet Adapter

1. Create `src/adapters/YourWalletAdapter.ts` with the factory function
2. Create `src/adapters/YourWalletAdapter.impl.ts` with the implementation
3. Export from `src/adapters/index.ts`
4. Add wallet icon to `src/_/`
5. Update README.md with the new wallet

## Code Style

- This project uses ESLint and Prettier for code formatting
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- Git hooks are managed by git-hook-pure and will run lint-staged on commit

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

- `feat: add Phantom wallet adapter`
- `fix: handle network switch in Xverse adapter`
- `docs: update installation instructions`

## Pull Request Process

1. Create a feature branch from `master`
2. Make your changes
3. Ensure all tests pass and linting is clean
4. Submit a pull request with a clear description

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
