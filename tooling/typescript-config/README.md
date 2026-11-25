# `@mms/typescript-config`

Shared TypeScript compiler presets for the MMS monorepo. One source of truth for
strictness; each surface keeps only its own emit/module/path deltas.

| Preset       | Extends | Use for                                                                                                                                      |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.json`  | —       | Everything below. Strictness only — no module/target/lib.                                                                                    |
| `node.json`  | base    | `apps/backend`, `packages/db`, `packages/be-core`, `packages/contracts`, `e2e` (NodeNext + ES2022).                                          |
| `react.json` | base    | `apps/frontend`, `packages/ui`, `packages/fe-core` (bundler + JSX + DOM, `noEmit`). `apps/tenant-web`/`apps/platform-web` will use it at P7. |

## Usage

Packages extend the preset by **relative path** so TypeScript never has to resolve
a package specifier for `extends`:

```jsonc
// apps/backend/tsconfig.json
{
  "extends": "../../tooling/typescript-config/node.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
}
```

```jsonc
// packages/ui/tsconfig.json
{
  "extends": "../../tooling/typescript-config/react.json",
  "compilerOptions": { "paths": { "react": ["./node_modules/@types/react"] } },
}
```

A package-specifier form (`"extends": "@mms/typescript-config/react.json"`) is also
exported for future use, but the relative form is the sanctioned default: it has no
`exports`-resolution dependency and works identically in every tool.

## Rules

- The repository-root `tsconfig.base.json` re-exports `base.json`; nothing should
  duplicate its flags.
- Workspace packages resolve through their own `package.json` `exports`; the
  presets deliberately set no `paths` for `@mms/*`, so `NodeNext`/`bundler`
  resolution behaves the same in every consumer.
- Node presets must not set `lib` (`@mms/contracts` needs `DOM`, the backend does not).
- React presets must not set `paths` (each app owns its aliases).
- Adding a stricter flag (e.g. `noUncheckedIndexedAccess`) is a repository-wide
  breaking change: land it as its own PR with the burn-down, never inside a
  refactor.
