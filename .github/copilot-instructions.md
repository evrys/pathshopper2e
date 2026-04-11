## Stack

This is a pure-frontend project. Modern ES syntax and strict TypeScript is favored in this project.

## Workflow

Add a failing test for any new functionality you want to add. Then, implement the functionality until the test passes. This ensures that your code is well-tested and that you have a clear definition of "done" for each feature.

After making changes, run `pnpm checks` to verify everything passes (TypeScript, Biome linting, and tests). Fix any errors before considering work complete.

If you need to check visual changes, assume the dev server is already running at 5900.

## Goal

This is a small website for players of Pathfinder 2e to make shopping lists for their campaigns. Since PF2e is a tabletop RPG with a large number of items, players often struggle to keep track of what is available in the game.