# Contributing

Thanks for your interest in `webpack-ext-reloader-next`. This guide covers
how to set up, what to work on, and how to land a PR.

## Quick start

```bash
git clone https://github.com/graybearo/webpack-ext-reloader-next
cd webpack-ext-reloader-next
pnpm install
pnpm --filter demo dev
```

Then open `chrome://extensions/`, enable Developer mode, click "Load
unpacked", and pick `packages/demo/dist/`. Edit any file under
`packages/demo/src/` and Chrome's extension reloads automatically.

Requires Node 20+ and pnpm.

## Project layout

```text
packages/
  plugin/   The published webpack plugin
  demo/     A minimal MV3 extension used for manual + e2e testing
```

`packages/plugin` is what ships to npm. `packages/demo` is private
infrastructure and is **not** published.

## Running tests

```bash
pnpm test                       # all packages
pnpm --filter ./packages/plugin test    # plugin only
pnpm --filter demo test         # the build integration test
```

Tests are deliberately minimal. We add a test only when it asserts
observable behavior at a meaningful boundary and would catch a real
regression. Coverage is not measured; high coverage from trivial tests
gives false confidence.

## Commit messages

We use **Conventional Commits**, and `semantic-release` reads them to
compute the next version. Use the wrong type and you'll publish the
wrong version (or skip a release entirely). Format:

```text
<type>(<optional scope>): <subject>

<optional body>

<optional footer, e.g. BREAKING CHANGE: ...>
```

Types and what they trigger:

| Type | Effect | Example |
|------|--------|---------|
| `feat` | minor version bump | `feat(plugin): auto-detect manifest path` |
| `fix` | patch version bump | `fix(client): reconnect on every chrome event` |
| `perf` | patch version bump | `perf(server): debounce build:start broadcast` |
| `refactor` | no release | `refactor(diff): extract classify() helper` |
| `docs` | no release | `docs: add MV3 reload behavior table` |
| `test` | no release | `test(diff): cover css-only change row` |
| `chore` | no release | `chore: bump zod` |
| `ci` | no release | `ci: matrix on Node 20 and 22` |

Breaking changes get a major bump, regardless of type:

```text
feat(plugin): drop manual `entries` config

BREAKING CHANGE: `entries` is now inferred from manifest.json. Users
that relied on the manual override should remove it.
```

## Pull requests

- Branch from `main`.
- One logical change per PR. Smaller is faster to review.
- CI must be green. Run `pnpm test`, `pnpm lint`, and `pnpm build`
  locally before pushing.
- New runtime dependencies need discussion in the PR description.
  We default to writing it ourselves if the dep is small.
- If your change is user-visible, update the README in the same PR.

## Coding style

- Prefer obvious code over clever code.
- Files stay small. When a file grows beyond ~150 lines, split it into
  a folder of focused files.
- Folder-by-feature, not folder-by-layer. No `helpers/` or `utils/`
  dumping grounds.
- Comments explain the WHY, not the WHAT. A comment exists when the
  reason is non-obvious — a constraint, an invariant, a workaround.
- No `any`. Use `unknown` and narrow.
- No banner comments, no section dividers, no JSDoc on self-evident
  exports.
- Dead code is deleted, not commented out. Git remembers.
- Run `pnpm format` before committing.

## Reporting bugs

Open an issue with the **bug report** template. Include:

- `webpack-ext-reloader-next` version
- webpack version
- Manifest version (probably 3)
- Minimum reproduction steps
- Expected vs. actual
- Terminal output if relevant

## Code of conduct

We follow the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

By contributing you agree your contributions are licensed under MIT,
the same license as the project.
