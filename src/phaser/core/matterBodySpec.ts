export type MatterBodySpec = {
  bounce?: number;
  fixedRotation?: boolean;
  frictionAir?: number;
  mass?: number;
};

type MatterBodySpecTarget = {
  setBounce?: (value: number) => unknown;
  setFixedRotation?: () => unknown;
  setFrictionAir?: (value: number) => unknown;
  setMass?: (value: number) => unknown;
};

export function applyMatterBodySpec<T extends MatterBodySpecTarget>(
  target: T,
  spec: MatterBodySpec,
): T {
  if (spec.mass !== undefined) target.setMass?.(spec.mass);
  if (spec.frictionAir !== undefined) target.setFrictionAir?.(spec.frictionAir);
  if (spec.bounce !== undefined) target.setBounce?.(spec.bounce);
  if (spec.fixedRotation) target.setFixedRotation?.();
  return target;
}
