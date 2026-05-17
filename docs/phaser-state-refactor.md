# Phaser State Boundary Refactor

## Target Model

- `ShipState` owns persistent fuel and selected weapons.
- `PlayerRuntimeState` owns per-scene aim, cooldowns, respawn, invulnerability, and shield timing.
- `SceneWeaponPolicy` declares which weapons a scene allows.
- `ArcadeRunState` owns isolated arcade ship/runtime state plus waves, score, and lives.
- `GameWorld` owns scene-local entity collections only.
- `MainGameState` owns the persistent ship used by the main-game scene flow.

## Checklist

- [x] Add persistent ship state and per-scene player runtime state.
- [x] Add scene weapon policy and filter weapon selection/firing through it.
- [x] Replace broad arcade session ownership with arcade-specific run state.
- [x] Add a persistent main-game state owner outside scenes.
- [x] Migrate sandbox to shared ship/runtime state.
- [x] Keep arcade scene isolated from main-game ship state.
- [ ] Wire ship-interior and ATM Phaser scenes to the shared ship state when those Phaser scenes exist. The current Phaser runtime only registers demo, game, and sandbox scenes.
- [x] Keep old state classes/files in place during this pass; do not delete transitional code.
- [x] Run type-check and lint.
- [x] Audit every checklist item before finishing.

## Deferred Cleanup

- `GameSession` and `PlayerState` remain as transitional files after the arcade path moved to `ArcadeRunState`, as requested for this no-deletion pass.
- Phaser ship-interior and ATM scenes still need to be added before they can consume `MainGameState.ship`.
