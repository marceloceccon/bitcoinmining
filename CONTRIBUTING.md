# Contributing to MineForge

Thanks for your interest in contributing! MineForge is an open-source Bitcoin mining profitability calculator, and we welcome contributions of all kinds.

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/bitcoinmining.git
cd bitcoinmining
npm install
cp .env.example .env.local
# Fill in your Supabase credentials
npm run dev
```

### 2. Create a Branch

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/add-noise-calculator` — new feature
- `fix/solar-panel-calculation` — bug fix
- `docs/update-readme` — documentation

### 3. Make Your Changes

- Follow the existing code style (TypeScript, Tailwind CSS)
- Keep components focused and composable
- Add types to `types/index.ts` for shared interfaces
- Use the Zustand store (`lib/store.ts`) for state management
- Test your changes locally with `npm run build`

### 4. Commit

Write clear, concise commit messages:

```
feat: add mining pool fee selector
fix: correct heat output calculation for water-cooled miners
docs: add Supabase setup instructions
```

### 5. Open a Pull Request

- Push your branch and open a PR against `main`
- Describe what you changed and why
- Include screenshots for UI changes
- Make sure the build passes (`npm run build`)

## Code Style

- **TypeScript** — strict mode, no `any` unless absolutely necessary
- **Tailwind CSS** — utility-first, use the design system colors defined in `tailwind.config.ts`
- **Components** — functional components with hooks, no class components
- **Imports** — use `@/` path aliases (e.g., `@/lib/store`, `@/components/ui/Button`)
- **Formatting** — consistent indentation (2 spaces), semicolons

## What We're Looking For

- New ASIC miner data (verify specs from manufacturer sites)
- Calculation accuracy improvements
- UI/UX enhancements
- Performance optimizations
- Documentation improvements
- Bug fixes
- Internationalization (i18n)

## Reporting Issues

Open an issue on GitHub with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info (for UI issues)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
