# Git hooks

Three hooks, installed by `npm install` through `husky` (`prepare` script).

| Hook | What runs |
|---|---|
| `pre-commit` | `npm run lint -- --fix --max-warnings=50` then `npm run typecheck` |
| `commit-msg` | Rejects AI attribution lines (`Co-authored-by: claude`, `Generated with Claude Code`, `Claude-Session:`), then `commitlint` with the conventional-commits config (`.commitlintrc.json`) |
| `pre-push` | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` |

There is no lint-staged, coverage gate, dependency audit or secret scan in the
hooks; CI (`.github/workflows/ci.yml`) adds the integration suite, the
accessibility sweep and the build.

## Commit messages

```text
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`,
`ci`, `build`, `revert`. Lowercase imperative subjects, e.g.
`fix(card): keep the card focusable through the intro`.

## Bypassing

`git commit --no-verify` / `git push --no-verify` skip the hooks. Reserve it
for a genuine emergency; CI still runs everything.

## Re-installing

```bash
npm run prepare
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```
