# Checks

Every commit and push is checked the same way, locally and in CI.

| Command | What it does |
| --- | --- |
| `pnpm format` / `pnpm format:check` | Prettier for TypeScript, JSON, CSS, HTML and YAML. Settings are in `.prettierrc.json`. |
| `pnpm lint` / `pnpm lint:fix` | ESLint (`eslint.config.js`): type-aware TypeScript rules, React hooks and accessibility for web, at most 400 lines a file and 300 a function. |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | API (needs Postgres; see `apps/api/.env.example`), web and package tests |
| `pnpm check` | Format check, lint and typecheck together |

**Mobile (C#):** .NET analyzers and the code-style rules in `apps/mobile/.editorconfig` run on every build, and warnings fail the build. `dotnet format whitespace apps/mobile/Bestowd.Core/Bestowd.Core.csproj` fixes formatting.

**Before each commit:** `pnpm install` installs a lefthook pre-commit hook (`lefthook.yml`). It formats and lints the staged files, and checks C# formatting when `dotnet` is installed. To skip it once, run `LEFTHOOK=0 git commit …`.

**CI:** `.github/workflows/web-api.yml` runs format, lint, typecheck, migrations and tests against Postgres. `.github/workflows/mobile.yml` checks C# formatting, runs the Core tests, and builds Android and iOS.

**Rules switched off** are listed with their reasons in `eslint.config.js` and `apps/mobile/.editorconfig`.
