# Fuel Implementation Plan

## Goal

Introduce `fuel` as a player resource shared across playable scenes. Fuel powers thrusters, weapons, and shield collision absorption. Fuel does not regenerate and does not have pickups in the first implementation. It refills only when the player respawns.

## Agreed Rules

- Fuel belongs to the shared `Player` state, not to an individual scene.
- Fuel is available in every playable scene.
- Fuel does not refill on scene transitions.
- Fuel refills only on respawn.
- Thrusters consume fuel while acceleration is applied.
- At `0` fuel, thrusters stop accelerating the ship, but existing velocity/drift remains.
- All weapons consume fuel while fuel is above the low-fuel threshold.
- Each weapon has its own fuel cost.
- Low fuel starts at `10%`.
- At or below `10%`, the ship enters emergency mode:
  - the fuel contour pulses red
  - small shot becomes degraded
  - small shot is free
  - pusher, shotgun, and black hole are blocked
- Degraded small shot:
  - half damage
  - half impact
  - half lifetime, which gives half distance
  - unchanged recoil, so the ship can still move by shooting
  - unchanged speed and fire rate
- Shield being active does not passively consume fuel.
- Shield collisions consume fuel based on hit strength.

## Initial Constants

Add fuel tuning constants to `src/constants.ts`.

```ts
export const PLAYER_MAX_FUEL = 100;
export const LOW_FUEL_RATIO = 0.1;
export const FUEL_THRUST_PER_SECOND = 5;

export const FUEL_WEAPON_COSTS = {
  small: 0.75,
  pusher: 0.2,
  shotgun: 3,
  blackHole: 12,
} as const;

export const SHIELD_COLLISION_FUEL_COSTS = {
  small: 4,
  medium: 8,
  big: 14,
  mega: 22,
} as const;
```

These values are starting points and should be playtested.

## Player State

Update the `Player` interface in `src/constants.ts`:

```ts
fuel: number;
maxFuel: number;
```

Initialize both fields in `createPlayer()` in `src/scenes/GameScene/player.ts`:

```ts
fuel: PLAYER_MAX_FUEL;
maxFuel: PLAYER_MAX_FUEL;
```

Do not reset fuel in `resetState()` or scene transitions.

## Fuel Helpers

Add small helpers near the player update logic or in a shared gameplay utility if reuse becomes awkward.

```ts
function getFuelRatio(player: Player): number {
  return player.maxFuel > 0 ? player.fuel / player.maxFuel : 0;
}

function isLowFuel(player: Player): boolean {
  return getFuelRatio(player) <= LOW_FUEL_RATIO;
}

function spendFuel(player: Player, amount: number): boolean {
  if (player.fuel < amount) {
    return false;
  }

  player.fuel = Math.max(0, player.fuel - amount);
  return true;
}

function drainFuel(player: Player, amount: number): void {
  player.fuel = Math.max(0, player.fuel - amount);
}
```

## Thruster Behavior

Update movement in:

- `src/scenes/GameScene/player.ts`
- `src/scenes/ShipInteriorScene/ShipInteriorScene.ts`

Behavior:

- If movement input is active and `fuel > 0`, spend thrust fuel and apply acceleration.
- If fuel reaches `0`, stop applying acceleration.
- Existing velocity continues.
- Thruster flame and particles should only show when acceleration actually happens.

Use elapsed time where available:

```ts
const thrustFuelCost = FUEL_THRUST_PER_SECOND * (deltaTime / 1000);
```

If a function does not currently receive `deltaTime`, pass it through instead of hard-coding a new drain amount.

## Weapon Behavior

Update shooting in:

- `src/scenes/GameScene/player.ts`
- `src/scenes/ShipInteriorScene/ShipInteriorScene.ts`

Behavior:

- Small shot:
  - if fuel ratio is above `10%`, require and spend `FUEL_WEAPON_COSTS.small`
  - if fuel ratio is `10%` or below, fire degraded small shot for free
- Pusher, shotgun, and black hole:
  - blocked when fuel ratio is `10%` or below
  - require enough fuel for their configured cost
  - spend fuel only when the shot actually fires after cooldown checks pass
- Recoil applies only when a shot is actually fired.

Add support for degraded small shot without mutating `BULLET_CONFIGS.small`.

Possible approach:

```ts
type BulletMode = 'normal' | 'degraded';

function createBullet(
  player: Player,
  type: 'small' | 'blackHole' | 'pusher' | 'shotgun',
  mode: BulletMode = 'normal',
) {
  const config = BULLET_CONFIGS[type];
  const damage = mode === 'degraded' && type === 'small' ? config.damage * 0.5 : config.damage;
  const impact = mode === 'degraded' && type === 'small' ? config.impact * 0.5 : config.impact;
  const lifetime = mode === 'degraded' && type === 'small' ? config.lifetime * 0.5 : config.lifetime;
}
```

## Shield Collision Fuel Drain

Update shield collision handling where player collisions are processed.

Likely files:

- `src/scenes/GameScene/collision.ts`
- `src/scenes/GameScene/GameScene.ts`
- `src/scenes/ShipInteriorScene/ShipInteriorScene.ts`

Behavior:

- Shield being held does not consume fuel.
- When shield absorbs a collision, drain fuel.
- Start with deterministic asteroid-size costs.
- If relative velocity is straightforward to calculate in the collision code, multiply or add based on hit speed.
- Clamp fuel at `0`.

For the first pass, size-based costs are acceptable and easier to tune:

```ts
const fuelCost = SHIELD_COLLISION_FUEL_COSTS[asteroid.size];
drainFuel(player, fuelCost);
```

## Respawn Refill

Set `player.fuel = player.maxFuel` only when the player respawns.

Likely locations:

- `GameScene.enter()` when starting a new run
- `GameScene.update()` when respawning after death
- `ShipInteriorScene.enter()` when starting a new run or first creating the player
- `ShipInteriorScene` respawn handling, if present

Avoid refilling fuel on ordinary scene transitions.

## Ship-Integrated Fuel Display

Draw fuel diegetically as a literal border around the spaceship, conforming to the ship silhouette itself.

Implementation location:

- `drawOnePlayer()` in `src/scenes/GameScene/player.ts`

Display rules:

- Draw the fuel gauge on the ship itself, inside the existing ship transform.
- The gauge should be the ship's border/contour, not a detached HUD element, halo, nearby arc, or decorative line.
- The border must conform to the current ship shape and follow the same outline/silhouette the player reads as the hull.
- Above `10%` fuel:
  - draw a dim full contour base
  - draw the lit fuel portion over it
  - fill direction should be rear-to-front
- At or below `10%` fuel:
  - pulse the entire contour red
  - at `0` fuel, keep the same full red pulse
- Use a line width large enough to read while the ship rotates.
- Keep the contour visually separate from shield rendering.

Suggested helper:

```ts
function drawFuelContour(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  const fuelRatio = getFuelRatio(player);
  const lowFuel = fuelRatio <= LOW_FUEL_RATIO;
  const pulse = 0.45 + Math.sin(now / 120) * 0.35;

  // Draw dim base contour.
  // Draw filled contour above threshold.
  // Draw full red pulse at or below threshold.
}
```

Start by tracing the existing ship hull outline as the fuel border. If readability requires an inset, keep it tightly conformal to the hull silhouette so it still reads as the ship's own border rather than an independent gauge.

## Validation

Run:

```bash
pnpm type-check
pnpm lint
```

Manual checks:

- Fuel is initialized on a new run.
- Fuel does not refill on scene transition.
- Fuel refills on respawn.
- Thrusters consume fuel.
- Thrusters stop accelerating at `0` fuel.
- Existing velocity remains when fuel is empty.
- Normal small shot consumes fuel above `10%`.
- Small shot degrades and becomes free at or below `10%`.
- Degraded small shot has half damage, half impact, and half lifetime.
- Degraded small shot keeps recoil.
- Pusher, shotgun, and black hole are blocked at or below `10%`.
- Pusher, shotgun, and black hole spend fuel only when fired.
- Shield collisions drain fuel.
- Shield being held does not drain fuel.
- Fuel contour displays normal fuel above `10%`.
- Fuel contour pulses red at or below `10%`.
- Fuel behavior works in `game.html`.
- Fuel behavior works in `shipinterior` gameplay.

## Part 2: Refueling Infrastructure and Planet Extraction

Part 2 expands the fuel system beyond respawn refills. Fuel still does not passively regenerate and still does not refill on scene transitions. Refueling must come from explicit world mechanics:

- Ship interior refuel stations
- Sandbox planet fuel extractors
- Sandbox large-asteroid fuel drops
- Respawn refill

## Part 2A: Ship Interior Refuel Stations

Refuel stations exist in `ShipInteriorScene` and refill the player by proximity.

Rules:

- Refuel stations refill through walls.
- No line-of-sight check is needed.
- No interaction button is needed.
- If the player is inside the station radius, fuel refills over time.
- Fuel is clamped at `player.maxFuel`.
- Stations are infinite for the first version.
- Stations should be visible in the scene.

Possible station type:

```ts
type RefuelStation = {
  id: string;
  x: number;
  y: number;
  radius: number;
  refillPerSecond: number;
};
```

Update behavior:

```ts
for (const station of refuelStations) {
  const dx = player.x - station.x;
  const dy = player.y - station.y;
  const inRange = dx * dx + dy * dy <= station.radius * station.radius;

  if (inRange && player.fuel < player.maxFuel) {
    player.fuel = Math.min(
      player.maxFuel,
      player.fuel + station.refillPerSecond * (deltaTime / 1000),
    );
  }
}
```

Implementation notes:

- Prefer a level-authored entity type such as `refuelStation` if the editor changes are manageable.
- A hardcoded station is acceptable only as a temporary playable slice.
- Since refueling works through walls, render a clear station field or glow so the mechanic is understandable.
- When actively refueling, intensify the station glow and rely on the ship fuel contour visibly filling.

## Part 2B: Sandbox Planet Fuel Extractors

Planet extraction exists only in `SandboxScene`, because planets currently exist only there.

Planets do not directly refill the player. A planet may have one or more fuel extraction buildings attached to its surface. Each building extracts fuel from the planet on an interval and produces a compact metaball fuel cloud above the building. The player refuels by touching individual fuel metaballs.

Rules:

- Planets have a finite fuel reserve.
- Fuel extractor buildings should be placeable through the level editor rather than only hardcoded.
- Add a level editor entity type for extractor buildings, consistent with the existing entity placement flow.
- Planets with extractors should have random very slow rotation so attached buildings and clouds visibly track the surface.
- A fuel extractor building is anchored to a planet surface angle.
- The building tracks planet rotation.
- The external fuel cloud tracks the building as the planet rotates.
- Extraction runs on a fixed interval.
- Each extraction tick creates one external fuel blob if:
  - the planet has enough fuel
  - the extractor cloud is not at capacity
- Each external blob is worth exactly `5` fuel.
- If player fuel is full, touching a blob does not collect it.
- If player fuel is not full, touching a blob collects it, adds up to `5` fuel, clamps at max fuel, and removes the blob.
- Planet fuel reserves should be multiples of `5` for the first version.
- Extraction pauses when the planet reserve is empty.
- Extraction pauses while the extractor has its maximum number of blobs.

Suggested constants:

```ts
export const FUEL_BLOB_AMOUNT = 5;
export const FUEL_BLOB_RADIUS = 10;
export const PLANET_FUEL_EXTRACT_INTERVAL_MS = 2000;
export const PLANET_FUEL_EXTRACTOR_MAX_BLOBS = 8;
export const PLANET_MIN_ROTATION_SPEED = 0.00002;
export const PLANET_MAX_ROTATION_SPEED = 0.00008;
```

Possible data types:

```ts
type FuelBlob = {
  id: string;
  localOffsetX: number;
  localOffsetY: number;
  wobbleSeed: number;
};

type FuelExtractor = {
  id: string;
  anchorAngle: number;
  extractIntervalMs: number;
  nextExtractAt: number;
  maxBlobs: number;
  blobs: FuelBlob[];
};
```

Extend `Planet` with:

```ts
fuelReserve: number;
fuelExtractors: FuelExtractor[];
rotationSpeed: number;
```

Assign `rotationSpeed` randomly when planets are created. Keep values very small so rotation is readable over time without making surface buildings look unstable.

Level editor support:

- Add a placeable fuel extractor building entity to the editor's entity tool.
- The editor should let authored levels place extractor buildings instead of requiring temporary hardcoded extractors.
- Persist the extractor in level data with enough information to attach it to a target planet and surface angle.
- When loading a sandbox level, convert authored extractor entities into `FuelExtractor` entries on the matching planet.
- If the current editor only supports ship interior levels, extend the plan for the sandbox/planet authoring path before implementing extractors, rather than bypassing editor support.

Extraction behavior:

```ts
if (now >= extractor.nextExtractAt) {
  extractor.nextExtractAt = now + extractor.extractIntervalMs;

  if (planet.fuelReserve < FUEL_BLOB_AMOUNT) return;
  if (extractor.blobs.length >= extractor.maxBlobs) return;

  planet.fuelReserve -= FUEL_BLOB_AMOUNT;
  extractor.blobs.push(createFuelBlob());
}
```

Blob collection behavior:

```ts
if (player.fuel < player.maxFuel && overlaps(player, blob)) {
  player.fuel = Math.min(player.maxFuel, player.fuel + FUEL_BLOB_AMOUNT);
  removeBlob(blob);
}
```

## Planet-Anchored Positioning

Extractor and blob positions should be derived from the planet every frame rather than stored as independent world positions.

```ts
const surfaceAngle = planet.rotation + extractor.anchorAngle;
const normalX = Math.cos(surfaceAngle);
const normalY = Math.sin(surfaceAngle);
const tangentX = -normalY;
const tangentY = normalX;

const buildingX = planet.x + normalX * planet.getRadius();
const buildingY = planet.y + normalY * planet.getRadius();

const cloudCenterX = planet.x + normalX * (planet.getRadius() + buildingHeight + cloudOffset);
const cloudCenterY = planet.y + normalY * (planet.getRadius() + buildingHeight + cloudOffset);

const blobX = cloudCenterX + tangentX * blob.localOffsetX + normalX * blob.localOffsetY;
const blobY = cloudCenterY + tangentY * blob.localOffsetX + normalY * blob.localOffsetY;
```

This keeps the extractor and cloud stuck to the rotating planet surface.

## External Fuel Cloud Rendering

The external fuel cloud should read as compact metaballs rather than loose pickups.

Rendering approach:

- Render fuel metaballs with real Three.js/WebGL shader rendering.
- Do not fake the effect with loose radial gradients, 2D canvas compositing, or JavaScript per-pixel field calculations.
- Use a dedicated Three.js-managed canvas/layer for fuel metaballs, following the same separate-canvas pattern used by the black hole shader path.
- Keep the renderer GPU-oriented and performant: scene/gameplay code should pass compact blob data to Three.js, and the shader/material should handle the visual metaball merging.
- Render order must be normal 2D scene first, fuel metaballs second, and the black hole shader/effect after fuel so black holes naturally affect the already-rendered fuel visuals.
- Keep collision per blob.
- Treat metaballs as game logic only for collision, collection, fuel value, position, radius, and stable animation seeds.
- Do not put visual merging, scalar-field evaluation, contour extraction, or other metaball surface logic in gameplay state.
- Use stable local offsets with subtle wobble.
- Keep blob value fixed at `5` fuel even if visual scale wobbles slightly.
- Draw the extractor building before or after the cloud depending on readability, but keep the building always visible.

## Part 2C: Sandbox Large-Asteroid Fuel Drops

In `SandboxScene`, larger asteroids can sometimes release fuel metaballs when destroyed.

Rules:

- Only `big` and `mega` asteroids can drop fuel blobs.
- `medium` and `small` asteroids do not drop fuel for the first version.
- Drops happen when the asteroid is destroyed, before or alongside normal asteroid splitting.
- Dropped fuel blobs use the same `FuelBlob` collection value, collision behavior, and Three.js/WebGL metaball rendering path as extractor-created blobs.
- Dropped blobs should spawn near the destroyed asteroid's position with slight local scatter.
- Drop chances should be tunable constants, with `mega` higher than `big`.
- Dropped blobs should have a maximum lifetime so uncollected fuel does not accumulate forever in the sandbox.

Suggested constants:

```ts
export const ASTEROID_FUEL_DROP_CHANCES = {
  big: 0.2,
  mega: 0.45,
} as const;

export const ASTEROID_FUEL_DROP_MAX_BLOBS = {
  big: 1,
  mega: 3,
} as const;

export const ASTEROID_FUEL_BLOB_LIFETIME_MS = 20000;
```

## Part 2D: Inspection Probe

Planets do not normally display their internal fuel reserve. The player can fire a consumable inspection probe to reveal one planet's fuel content for a limited duration.

Rules:

- The inspection probe is a new weapon/tool.
- It replaces one existing input slot for now.
- Replace the black hole input first.
- The black hole weapon remains in code but becomes inaccessible through current controls.
- A later weapon switching system can re-expose black hole and other weapons/tools.
- Probes are consumable.
- Probe charges refill on respawn.
- Probe firing does not cost fuel.
- If the player has no probe charges, pressing the probe input does nothing.
- Firing a probe consumes one charge immediately, even if it misses.
- The probe affects only the planet it hits.
- Inspection lasts for a fixed duration.
- Hitting an already inspected planet refreshes the duration.
- Extractor buildings are always visible, even without inspection.
- Internal fuel metaballs use the same visual style as external fuel blobs for now.

Suggested constants:

```ts
export const STARTING_INSPECTION_PROBES = 3;
export const INSPECTION_PROBE_DURATION_MS = 15000;
export const INSPECTION_PROBE_SPEED = 18;
export const INSPECTION_PROBE_LIFETIME_MS = 1500;
export const INSPECTION_PROBE_RADIUS = 5;
export const FUEL_INSPECTION_BLOB_AMOUNT = FUEL_BLOB_AMOUNT * 10;
```

Update `Player` with:

```ts
inspectionProbes: number;
```

Refill probes on respawn:

```ts
player.inspectionProbes = STARTING_INSPECTION_PROBES;
```

Add timed inspection state to `Planet`:

```ts
inspectedUntil: number;
```

Inspection check:

```ts
const inspected = now < planet.inspectedUntil;
```

On probe hit:

```ts
planet.inspectedUntil = now + INSPECTION_PROBE_DURATION_MS;
```

## Inspection Probe Projectile

Prefer a separate inspection probe projectile if it fits `SandboxScene` cleanly. Reuse `Bullet` only if the existing projectile infrastructure is clearly simpler after inspecting the scene.

Expected behavior:

- Fired from the ship toward the aim direction.
- Has no damage.
- Collides with planets.
- Disappears on planet hit.
- Disappears when lifetime expires.
- Does not interact with asteroid damage or weapon fuel costs.

## X-Ray Planet Rendering

When a planet is inspected, render its internal fuel reserve without showing it in normal view.

Rendering rules:

- Draw the planet normally enough to preserve its crust/border.
- Apply a simple `50%` opacity black overlay over the planet body.
- Keep the crust/border as visible as before so it reads like an outline.
- Draw internal fuel metaballs inside the planet using the same Three.js/WebGL metaball renderer approach as external fuel clouds.
- Clip internal metaballs to the planet interior.
- Internal blobs represent `50` fuel each, because external blobs represent `5` fuel.
- Internal blob count should reflect current `planet.fuelReserve`.
- As extractors drain the planet, the inspected fuel display should update.

Internal blob count:

```ts
const internalBlobCount = Math.ceil(planet.fuelReserve / FUEL_INSPECTION_BLOB_AMOUNT);
```

Internal metaball motion:

- Internal blobs should move and morph so the reserve looks fluid.
- Fewer blobs should mean less motion.
- With one blob, use subtle drift or pulsing only.
- With many blobs, allow more visible swirling and morphing.
- Use stable seeded motion so the display feels coherent frame to frame.
- Keep blobs inside the planet crust.

## Part 2 Validation

Manual checks:

- Ship interior refuel stations refill by proximity.
- Ship interior refuel stations refill through walls.
- Ship interior refuel stations clamp fuel at max.
- Sandbox planets can have finite fuel reserves.
- Fuel extractor buildings can be authored through the level editor.
- Authored extractor buildings load into sandbox planets with stable planet attachment and surface angle.
- Extractor buildings stay attached to the rotating planet surface.
- Extractor clouds stay above their buildings while planets rotate.
- Extractors produce one `5` fuel blob per interval.
- Extractors pause when their cloud is full.
- Extractors stop when the planet reserve is empty.
- Player collects fuel blobs only by touching individual blobs.
- Fuel blobs are not collected when player fuel is full.
- Collected blobs add fuel and disappear.
- Fuel metaballs render through Three.js/WebGL, not canvas gradient overlap or JavaScript per-pixel calculations.
- Fuel metaballs use a separate renderer canvas/layer and draw before the black hole effect.
- Black hole distortion/effects apply after fuel metaballs are rendered.
- In SandboxScene, destroyed `big` and `mega` asteroids sometimes spawn collectible fuel metaballs.
- `medium` and `small` asteroids do not spawn fuel metaballs.
- Uncollected asteroid fuel drops expire after their configured lifetime.
- Inspection probes consume charges when fired.
- Inspection probes do not cost fuel.
- Probe charges refill on respawn.
- Probe replaces the black hole input.
- Black hole remains in code but is inaccessible through current controls.
- Probe hit reveals only the hit planet.
- Probe inspection expires after the configured duration.
- Re-probing refreshes inspection duration.
- Inspected planets show the x-ray overlay and preserve visible crust.
- Internal fuel metaballs reflect remaining planet fuel.
- Internal fuel metaballs animate without leaving the planet interior.
