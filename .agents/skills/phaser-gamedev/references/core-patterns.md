# Core Patterns Reference

Detailed code examples for common Phaser 3 patterns.

## Scene Setup

```javascript
export default class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        // Configuration constants
        this.GRID_SIZE = 32;
    }

    init() {
        // Reset resettable state
        this.score = 0;
        this.gameOver = false;
    }

    create() {
        // Initialize objects
        this.player = new Player(this);
        this.enemies = this.physics.add.group();

        // Setup collisions
        this.physics.add.collider(this.player, this.enemies, this.onHit, null, this);
    }

    update(time, delta) {
        if (this.gameOver) return;
        // Game logic
    }
}
```

## Custom Game Object

```javascript
export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player');

        // Self-register
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Configuration
        this.setCollideWorldBounds(true);
        this.isAlive = true;
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);  // ESSENTIAL for animations

        if (!this.isAlive) return;
        this.handleMovement();
    }
}
```

## Grid System

```javascript
// Dual coordinate system
this.gridX = 5;
this.gridY = 3;
this.sprite.x = this.gridX * TILE_SIZE;
this.sprite.y = this.gridY * TILE_SIZE;

// 2D array with bounds checking
getCellXY(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
        return null;
    }
    return this.grid[y][x];
}
```

## Collision Handling

```javascript
// Physical collision
this.physics.add.collider(player, platforms);

// Trigger-based overlap
this.physics.add.overlap(player, coins, this.collectCoin, null, this);

// Collision with state gates
onHit(player, enemy) {
    if (!player.isAlive) return;
    if (player.invincible) return;
    if (enemy.alpha < 1) return;

    this.handleDamage(player, enemy);
}
```

## Input Patterns

```javascript
create() {
    // Cursor keys
    this.cursors = this.input.keyboard.createCursorKeys();

    // Specific key
    this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Pointer/touch
    this.input.on('pointerdown', this.handleClick, this);
}

update() {
    // Continuous input
    if (this.cursors.left.isDown) {
        this.player.setVelocityX(-160);
    }

    // Single-press input
    if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
        this.jump();
    }
}
```

## Animation Setup

```javascript
// In Preloader create() - global animations
this.anims.create({
    key: 'player-walk',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
});

// In Game create() - use animations
this.player.play('player-walk');

// Animation events
this.player.on('animationcomplete-attack', this.spawnProjectile, this);
```

## State Management

```javascript
// Scene-level state
init() {
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
}

// Registry for cross-scene data
this.registry.set('highscore', this.score);
const highscore = this.registry.get('highscore');

// GameObject data
sprite.setData({ gridX: 5, gridY: 3, type: 'enemy' });
const gridX = sprite.data.values.gridX;
```
