# TODO

## General

- The direction that the ship points at should not be physics based, instead it should point at where the thruster is pointing. Right now that can only be 8 directions but in the future we will implement a gamepad and that will be able to be any angle
- Secondary weapon shoots in the direction of the ship and not the turrent
- Add joymap as an input layer and apply to a phaser-like abstraction the way joymap works, the game itself should be asking about actions and not literal inputs (AButton vs primaryFire)
- All audio volume should be relative to ship and not the center of the screen/camera
- Fix outline of ship in sandbox, it shouldn't be drawn over the turret so we need to not make the line contiguous since we don't want to draw the turret over the nebula but we do want to draw it "over" the fuel line
- Make particles be affected by gravity
- Change the debri and explosion particles when colliding with planets so the planet itself is not overlayed with particles but the particles instead communicate a collision by "bouncing" off the planet
- Black holes should be formed by a sufficiently big explosions. Incidentally, fuel explosions are considered one big explosion when they are connected. Get what I mean? Yes, if sufficient fuel is in one place and explodes all at once, it should create a black hole.
- All weapons no longer consume fuel except for fuel weapon and black hole weapon
- Primary weapon selection should change the turret being used visually, so each weapon has a dedicated turret sprite. They should all have the same length to simplify gameplay considerations
- After the ship explodes, it should leave its remaining fuel floating as fuel blobs
