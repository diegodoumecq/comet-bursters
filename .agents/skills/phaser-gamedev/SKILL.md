---
name: phaser-gamedev
description: Battle-tested patterns and best practices for Phaser 3 game development. Use when writing game code, implementing mechanics, setting up scenes, handling physics, animations, or input.
license: MIT
context: main
user-invocable: true
compatibility: Phaser 3.x, TypeScript/JavaScript
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Phaser 3 Game Development

## Quick Start

### Most Common Patterns

**Multi-Scene Flow**
```javascript
const config = {
    scene: [ Boot, Preloader, MainMenu, Game, GameOver ]
};
// Boot → Preloader → MainMenu → Game → GameOver
```

**Object Pooling**
```javascript
create() {
    this.projectiles = this.physics.add.group({
        classType: Projectile,
        frameQuantity: 20,
        active: false,
        visible: false
    });
}

fire() {
    const projectile = this.projectiles.getFirstDead(false);
    if (projectile) projectile.fire(x, y);
}
```

**Global Animations**
```javascript
// In Preloader.js create()
this.anims.create({
    key: 'walk',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
});
```

**JustDown Input**
```javascript
if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
    this.jump();
}
```

## Navigation Guide

This skill provides access to 18 comprehensive pattern files. Use Read or Grep to access them.

**Quick lookup by number:**
- 01 = Scene Architecture
- 02 = Asset Management
- 03 = Physics & Collision
- 04 = Movement Patterns
- 05 = Animation System
- 06 = Input Handling
- 07 = State Management
- 08 = Object Pooling & Memory
- 09 = Grid Systems
- 10 = Custom Game Objects
- 11 = UI/HUD Patterns
- 12 = Tween & Visual Effects
- 13 = Audio Integration
- 14 = Game Loop Patterns
- 15 = Algorithm Implementations
- 16 = Performance Optimization
- 17 = Code Organization
- 18 = Development Philosophy

**Example usage:**
```
Read knowledgebase/06-input-handling.md
Grep "object pooling" knowledgebase/
```

## Table of Contents

### 1. Scene Architecture
`knowledgebase/01-scene-architecture.md`
Multi-scene flow, parallel scenes for UI overlays, scene transitions with effects, data passing between scenes.

### 2. Asset Management
`knowledgebase/02-asset-management.md`
Two-stage loading, texture atlases, multi-format audio, font synchronization.

### 3. Physics & Collision
`knowledgebase/03-physics-collision.md`
Physics configuration, collision vs overlap, dynamic responses, state-gated collision.

### 4. Movement Patterns
`knowledgebase/04-movement-patterns.md`
Velocity-based, time-based discrete, timer-based, pursuit, direction validation.

### 5. Animation System
`knowledgebase/05-animation-system.md`
Global animation creation, reverse animations, animation-driven logic.

### 6. Input Handling
`knowledgebase/06-input-handling.md`
Keyboard, pointer, touch, JustDown pattern, dual input support, input gating.

### 7. State Management
`knowledgebase/07-state-management.md`
Scene-level state, registry for persistence, localStorage, state machines.

### 8. Object Pooling & Memory
`knowledgebase/08-object-pooling-memory.md`
Group-based pooling, enable/disable pattern, object reuse.

### 9. Grid Systems
`knowledgebase/09-grid-systems.md`
Dual coordinates, 2D arrays, adjacency helpers, grid alignment.

### 10. Custom Game Objects
`knowledgebase/10-custom-game-objects.md`
Extending Sprite/Image, composition pattern, self-registration.

### 11. UI/HUD Patterns
`knowledgebase/11-ui-hud-patterns.md`
Text styling, positioning, dynamic updates, bitmap fonts.

### 12. Tween & Visual Effects
`knowledgebase/12-tween-visual-effects.md`
Basic tweens, staggered animations, camera effects, particles.

### 13. Audio Integration
`knowledgebase/13-audio-integration.md`
Sound management, audio lock handling, centralized audio.

### 14. Game Loop Patterns
`knowledgebase/14-game-loop-patterns.md`
Standard update, event-driven, preUpdate for custom objects, timers.

### 15. Algorithm Implementations
`knowledgebase/15-algorithm-implementations.md`
Flood fill, smart random placement, solvable puzzle generation.

### 16. Performance Optimization
`knowledgebase/16-performance-optimization.md`
Object pooling, texture caching, minimize update logic, static groups.

### 17. Code Organization
`knowledgebase/17-code-organization.md`
File structure, ES6 modules, constants management.

### 18. Development Philosophy
`knowledgebase/18-development-philosophy.md`
Architecture principles, when to use physics, scene decisions.

## Additional References

- **[references/core-patterns.md](references/core-patterns.md)** - Detailed code examples for scene setup, custom objects, grid systems, collision, input, animation, state
- **[references/common-pitfalls.md](references/common-pitfalls.md)** - Critical mistakes to avoid

## Performance Tips

- **Object pools** for frequently created/destroyed objects
- **Texture atlases** combine sprites into single image
- **Static groups** for immovable platforms/walls
- **Event-driven** over polling in update()
- **Minimal update logic** - only what's necessary each frame
- **Cache lookups** - don't search arrays every frame
- **Set depth once** - don't sort every frame

## When to Read Detailed Files

**Starting a new game?** → `01-scene-architecture.md`
**Performance issues?** → `16-performance-optimization.md`
**Grid-based game?** → `09-grid-systems.md`
**Complex animations?** → `05-animation-system.md` and `12-tween-visual-effects.md`
**Input problems?** → `06-input-handling.md`
**Memory leaks?** → `08-object-pooling-memory.md`
**Implementing algorithms?** → `15-algorithm-implementations.md`
**Architecture decisions?** → `18-development-philosophy.md`

## Quick Reference Cheat Sheet

### Scene Flow
```javascript
Boot → Preloader → MainMenu → Game → GameOver
this.scene.start('NextScene', { score: this.score });
this.scene.launch('GameUI');  // Parallel scene
```

### Physics
```javascript
this.physics.add.collider(a, b);          // Physical blocking
this.physics.add.overlap(a, b, callback); // Trigger only
sprite.setCollideWorldBounds(true);
sprite.setImmovable(true);
```

### Groups & Pooling
```javascript
this.items = this.physics.add.group({ frameQuantity: 20 });
const item = this.items.getFirstDead(false);
item.enableBody(true, x, y, true, true);
item.disableBody(true, true);
```

### Input
```javascript
this.cursors = this.input.keyboard.createCursorKeys();
Phaser.Input.Keyboard.JustDown(key)
this.input.on('pointerdown', callback, this);
```

### Tweens
```javascript
this.tweens.add({
    targets: sprite,
    x: 400,
    duration: 1000,
    ease: 'Power2',
    onComplete: () => {}
});
```

### Camera
```javascript
this.cameras.main.shake(duration, intensity);
this.cameras.main.fadeOut(duration);
this.cameras.main.flash(duration, r, g, b);
```
