# Comet Bursters

An arcade-style space shooter inspired by Comet Buster! (a 90s shareware game). Pilot your ship, destroy asteroids, and survive waves of increasingly dangerous "comets". Supports local multiplayer with gamepads or keyboard.

> **Note:** This is a work in progress. Currently has no sound, or saving and gameplay is subject to change.

## Features

- **Multiplayer**: Up to 4 players with gamepads, plus keyboard/mouse fallback
- **Weapons**: Small blaster, shotgun, black hole, and pusher
- **Waves**: Progressive difficulty with increasing asteroid counts
- **Planets**: Navigate gravity wells while avoiding collisions
- **Shields**: Limited-use defensive shields (gamepad only)
- **Visual Effects**: Particles, screen shake, and post-processing shaders

## How to Play

### Gamepad

- **Left Stick**: Move
- **Right Stick**: Aim
- **R1**: Small blaster
- **L1**: Pusher
- **R2**: Black hole
- **L2**: Shotgun
- **A**: Activate shield

### Keyboard + Mouse

- **WASD**: Move
- **Mouse**: Aim
- **Left Click**: Small blaster
- **Right Click**: Pusher
- **Q**: Black hole
- **E**: Shotgun
- **Shift**: Activate shield


## Running the Game

```bash
pnpm install
pnpm dev
```

## Tech Stack

Built with TypeScript, HTML5 Canvas, Three.js for shaders, and joymap for gamepad support.
