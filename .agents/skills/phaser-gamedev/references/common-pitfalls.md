# Common Pitfalls

Critical mistakes to avoid in Phaser 3 development.

## 1. Forgetting `super.preUpdate(time, delta)` in custom sprites

Animations won't work without this. Always call first thing in preUpdate().

```javascript
preUpdate(time, delta) {
    super.preUpdate(time, delta);  // ESSENTIAL
    // ... rest of logic
}
```

## 2. Not calling `refreshBody()` after scaling static groups

```javascript
this.platforms.create(x, y, 'platform')
    .setScale(2)
    .refreshBody();  // REQUIRED
```

## 3. Creating objects in update() instead of pooling

Causes GC pauses and poor performance. Pre-create pools, recycle with enable/disable.

```javascript
// BAD - creates new object every frame
update() {
    this.add.sprite(x, y, 'bullet');
}

// GOOD - reuse from pool
update() {
    const bullet = this.bullets.getFirstDead(false);
    if (bullet) bullet.fire(x, y);
}
```

## 4. Missing bounds checks on grid access

```javascript
// Always check bounds before accessing
if (x < 0 || x >= width || y < 0 || y >= height) return null;
return this.grid[y][x];
```

## 5. Not cleaning up listeners/timers

```javascript
shutdown() {
    this.input.off('pointerdown', this.handleClick);
    if (this.timer) this.timer.remove();
}
```

## 6. Using wrong collision method

- Use `collider` for physical blocking
- Use `overlap` for triggers/pickups

```javascript
// Physical - entities can't pass through
this.physics.add.collider(player, walls);

// Trigger - entities can overlap, runs callback
this.physics.add.overlap(player, coins, this.collect, null, this);
```

## 7. Polling in update() when events would work

Use physics overlap instead of distance checks. Use pointer events instead of checking every frame.

```javascript
// BAD - checking every frame
update() {
    if (Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) < 50) {
        this.collect();
    }
}

// GOOD - let physics handle it
create() {
    this.physics.add.overlap(a, b, this.collect, null, this);
}
```

## 8. Hard-coding values instead of constants

```javascript
// BAD - magic numbers
sprite.x = 400;

// GOOD - named constants
const GRID_SIZE = 32;
sprite.x = gridX * GRID_SIZE;
```

## 9. Not resetting state in init()

Scene restart won't work properly. Put all resettable state in init(), not constructor.

```javascript
// BAD - state in constructor persists
constructor() {
    super('Game');
    this.score = 0;  // Won't reset on scene restart!
}

// GOOD - state in init() resets
init() {
    this.score = 0;  // Resets every time scene starts
}
```

## 10. Ignoring context binding in callbacks

```javascript
// Use arrow functions or bind
this.time.delayedCall(1000, () => this.start(), [], this);

// Or explicit binding
this.time.delayedCall(1000, this.start, [], this);  // 4th param is context
```
