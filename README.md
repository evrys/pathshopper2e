# Pathshopper

A shopping list builder for Pathfinder 2e. Browse the full equipment catalog, filter by type/rarity/level, and build a priced shopping cart you can share via URL.

Item data is sourced from the [Foundry VTT PF2e system](https://github.com/foundryvtt/pf2e) (Apache-2.0), with links to [Archives of Nethys](https://2e.aonprd.com).

## Quick start

```
pnpm install
pnpm dev
```

Visit http://localhost:5900.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm checks` | Run all checks (tsc + biome + tests) |
| `pnpm tsc` | Type-check only |
| `pnpm biome` | Lint and format check |
| `pnpm format` | Auto-fix formatting |
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm fetch-data` | Re-fetch item data from Foundry VTT |

