# Arcade Scene Performance Plan

This plan breaks the arcade-scene profiling findings into independent work items that can be executed one by one later. Each item should preserve current visual fidelity unless a step explicitly says it is only a diagnostic toggle.

## 1. Black-Hole Rendering

Measured impact: `arcade.render.blackHoles` averaged about 75-79 ms per rendered frame in the black-hole crossing scenario, with spikes above 216 ms.

Primary files:

- `src/phaser/scenes/arcade/ArcadeRenderEffects.ts`
- `src/phaser/projectiles/blackHoleShader.ts`
- `src/phaser/projectiles/blackHoleCaptureCanvas.ts`
- `src/phaser/scenes/arcade/arcadeBlackHoles.ts`
- `src/phaser/fuel/metaballs.ts` as the implementation model for scissor-bound rendering

Plan:

1. Add an early return in `BlackHoleShaderRenderer.render` before `ensureInitialized()` when there are no black-hole samples and the renderer has not been created yet.
2. Add a measured render bounds helper for black-hole samples based on `getBlackHoleInfluenceRadius`, including wrap samples from `buildArcadeBlackHoleScreenSamples`.
3. Change the black-hole shader renderer to support bounded/scissored rendering, following the pattern in `FuelMetaballRenderer`.
4. Avoid full-screen canvas compositing when bounds are smaller than the screen. Copy only the affected source region into the composite source, with enough padding for distortion.
5. Keep visual output identical by preserving current shader uniforms, distortion radius, tint, rim, and source sampling behavior.
6. Add tests around the bounds helper, especially edge wrapping and multiple black holes.
7. Profile the black-hole crossing scenario again and compare `arcade.render.blackHoles` average and max against the baseline.

Acceptance criteria:

- Zero-black-hole arcade frames do not initialize or render the black-hole WebGL layer.
- Black-hole visual appearance matches the current effect at center, edge, and wrapped positions.
- `arcade.render.blackHoles` is reduced substantially in the black-hole crossing scenario.

Suggested verification:

- `pnpm type-check`
- `pnpm lint`
- `pnpm test src/phaser/scenes/arcade/arcadeBlackHoles.test.ts src/phaser/projectiles/blackHoles.test.ts`
- Browser profile with `?sandboxPerfMarkers=true&arcadeRiftDebug=true&arcadeRiftDebugScenario=blackHoleCrossing`

## 2. Portal Window Capture

Measured impact: active window portals averaged about 11-12 ms per portal frame after warmup, with a large first-capture spike near 900 ms.

Primary files:

- `src/phaser/portals/PortalWindowRenderer.ts`
- `src/phaser/portals/PortalSceneCapture.ts`
- `src/phaser/scenes/arcade/ArcadeRenderer.ts`
- `src/phaser/scenes/arcade/rift/RiftSpaceScene.ts`
- `src/phaser/portals/PortalMetaballRenderer.ts`

Plan:

1. Add instrumentation around portal capture/render paths as temporary profiling markers or reusable perf markers.
2. Prewarm portal capture resources when a portal plan is created or during the opening visual phase, before the portal is fully visible.
3. Cache the capture entries list in `PortalSceneCapture` and invalidate it only when scene children change or capture-excluded state changes.
4. Add a portal aperture capture bounds helper using visual radius, aperture, scale, and distortion margin.
5. Render only the destination aperture region into the capture texture when the portal is in window mode.
6. Keep a full-scene fallback path for camera-transfer portals or any case where regional capture cannot represent the current view correctly.
7. Consider decimating destination capture refresh to every other frame only if bounded capture is not enough; keep portal animation at full frame rate.
8. Profile active window portals again after each step so we know which sub-change carries the win.

Acceptance criteria:

- Portal window visuals remain visually equivalent, including destination scene content, overlays, and black-hole/fuel effects.
- First visible portal frame no longer causes a large capture spike.
- Steady active window portal cost drops below the current 11-12 ms/frame baseline.

Suggested verification:

- `pnpm type-check`
- `pnpm lint`
- `pnpm test src/phaser/portals/PortalWindowRenderer.test.ts`
- Browser profile with a forced active `window` portal and `?sandboxPerfMarkers=true`

## 3. Startup Stutters

Measured impact: starfield texture generation costs about 20-33 ms per layer and currently happens for both arcade and rift scenes. Black-hole renderer startup also costs work that can be avoided when no black holes exist.

Primary files:

- `src/phaser/world/Starfield.ts`
- `src/phaser/scenes/arcade/ArcadeSpaceBackground.ts`
- `src/phaser/world/DimensionBackground.ts`
- `src/phaser/projectiles/blackHoleShader.ts`
- `src/phaser/scenes/arcade/ArcadeScene.ts`
- `src/phaser/scenes/arcade/rift/RiftSpaceScene.ts`

Plan:

1. Share or cache starfield textures by screen size, layer config, and seed instead of generating unique textures per scene instance.
2. Add reference counting or scene-shutdown ownership rules so shared starfield textures are not removed while another scene still uses them.
3. Prewarm starfield textures during boot or the menu scene if startup smoothness matters more than initial menu load.
4. Apply the black-hole zero-sample lazy initialization from the black-hole rendering plan.
5. Add profiling markers around starfield creation and background construction so startup regressions are visible.
6. Test scene restart, resize, and switching between arcade/rift/sandbox to verify texture reuse and cleanup.

Acceptance criteria:

- Arcade and rift scenes do not regenerate identical starfield layers for the same viewport and seed.
- Scene shutdown does not remove a shared texture still used by another active scene.
- Starting arcade no longer shows starfield generation spikes on every scene launch.

Suggested verification:

- `pnpm type-check`
- `pnpm lint`
- Existing background/starfield tests if added
- Manual scene restart and resize smoke test in browser

## 4. High-Entity-Count CPU And Allocation Work

Measured impact: lower priority than black holes and portal capture, but likely to scale poorly with many asteroids, particles, fuel blobs, projectiles, and active portals.

Primary files:

- `src/phaser/asteroids/bodies.ts`
- `src/phaser/combat/matterContacts.ts`
- `src/phaser/combat/portalBridge.ts`
- `src/phaser/scenes/arcade/ArcadeScene.ts`
- `src/phaser/world/gravity.ts`
- `src/phaser/projectiles/blackHoles.ts`
- `src/phaser/particles/logic.ts`
- `src/phaser/particles/views.ts`

Plan:

1. Add broader frame-section markers to arcade update/render, similar to sandbox's `startPerformanceFrame` usage.
2. Add a repeatable high-entity profiling scenario with many asteroids, particles, fuel blobs, projectiles, an active portal, and at least one mature black hole.
3. Replace per-frame portal `.filter(...)` allocations with reusable scratch arrays or iterator-style helpers scoped to active portal aperture checks.
4. Maintain a near-portal working set for asteroids, projectiles, particles, and fuel blobs while a portal is active.
5. Optimize `AsteroidBodies.syncToroidalAll` so it only reconciles toroidal copies for attached asteroids near edges or recently teleported copies.
6. Avoid rebuilding asteroid body-id sets every frame in `MatterContacts.syncAsteroid`; sync only when toroidal body membership changes.
7. Review black-hole lifecycle loops that clone arrays with `[...items]`; replace with backwards index loops or staged removal lists where mutation safety is needed.
8. Consider particle pooling for burst-heavy effects, especially `Graphics` particles that redraw every frame.
9. Profile after each sub-change and keep changes that produce measurable improvement under the high-entity scenario.

Acceptance criteria:

- Arcade has update/render section markers that identify simulation, combat, portal bridge, effects, and draw costs.
- High-entity profiling can be repeated without manual setup.
- Allocation-heavy paths are reduced without changing collision, portal, black-hole, or particle behavior.

Suggested verification:

- `pnpm type-check`
- `pnpm lint`
- `pnpm test src/phaser/combat/portalBridge.test.ts src/phaser/combat/matterContacts.test.ts src/phaser/asteroids/bodies.test.ts src/phaser/projectiles/blackHoles.test.ts`
- Browser profile with the high-entity scenario and `?sandboxPerfMarkers=true`

## Execution Order

1. Black-hole zero-sample early return.
2. Black-hole bounded/scissored rendering.
3. Portal capture instrumentation and prewarm.
4. Portal bounded capture and capture-entry caching.
5. Shared/prewarmed starfield textures.
6. Arcade frame-section markers.
7. High-entity repeatable scenario.
8. Portal bridge and Matter contact allocation reductions.
9. Toroidal asteroid and particle pooling improvements.
