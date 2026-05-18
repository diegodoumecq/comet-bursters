# Agent Instructions

- Do not use `continue` statements in code changes. Prefer positive condition branches, helper functions, or early returns where appropriate.
- Use pnpm
- Keep `src/phaser` organized by domain. Domain behavior, views, and types live together under folders such as `asteroids/`, `player/`, `weapons/`, `world/`, and `particles/`; shared cross-domain primitives belong in `core/`; persistent main-game state belongs in `mainGame/`; scene-specific orchestration stays under `scenes/`. Do not recreate a generic `services/` bucket.
