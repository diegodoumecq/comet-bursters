import Phaser from 'phaser';

export type Vec3Uniform = {
  x: number;
  y: number;
  z: number;
};

export type ShaderUniformSetter = (gl: WebGLRenderingContext, program: WebGLProgram) => void;

export type ShaderTextureInput = {
  setUniforms: ShaderUniformSetter;
  textureKey: string;
  textureSize: number;
};

const vertexShader = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export function createShaderTexture(
  scene: Phaser.Scene,
  textureKey: string,
  fragmentShader: string,
  textureSize: number,
  setUniforms: ShaderUniformSetter,
): boolean {
  const shaderCanvas = document.createElement('canvas');
  shaderCanvas.width = textureSize;
  shaderCanvas.height = textureSize;
  const gl = shaderCanvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    stencil: false,
  });
  if (!gl) return false;

  const program = createProgram(gl, fragmentShader);
  if (!program) return false;

  gl.viewport(0, 0, textureSize, textureSize);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    gl.deleteProgram(program);
    return false;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  setUniforms(gl, program);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.finish();

  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const context = canvas.getContext('2d');
  if (!context) {
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    return false;
  }
  const pixels = new Uint8Array(textureSize * textureSize * 4);
  gl.readPixels(0, 0, textureSize, textureSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const imageData = context.createImageData(textureSize, textureSize);
  flipFramebufferPixels(pixels, imageData.data, textureSize, textureSize);
  context.putImageData(imageData, 0, 0);

  gl.deleteBuffer(positionBuffer);
  gl.deleteProgram(program);
  scene.textures.addCanvas(textureKey, canvas);
  return true;
}

export function createShaderTextures(
  scene: Phaser.Scene,
  fragmentShader: string,
  inputs: readonly ShaderTextureInput[],
): boolean {
  const maxTextureSize = inputs.reduce(
    (maxSize, input) => Math.max(maxSize, input.textureSize),
    1,
  );
  const shaderCanvas = document.createElement('canvas');
  shaderCanvas.width = maxTextureSize;
  shaderCanvas.height = maxTextureSize;
  const gl = shaderCanvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    stencil: false,
  });
  if (!gl) return false;

  const program = createProgram(gl, fragmentShader);
  if (!program) return false;

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    gl.deleteProgram(program);
    return false;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  const created = inputs.every((input) =>
    renderShaderTexture(scene, gl, program, input.textureKey, input.textureSize, input.setUniforms),
  );
  gl.deleteBuffer(positionBuffer);
  gl.deleteProgram(program);
  return created;
}

function renderShaderTexture(
  scene: Phaser.Scene,
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  textureKey: string,
  textureSize: number,
  setUniforms: ShaderUniformSetter,
): boolean {
  gl.viewport(0, 0, textureSize, textureSize);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  setUniforms(gl, program);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const context = canvas.getContext('2d');
  if (!context) return false;

  const pixels = new Uint8Array(textureSize * textureSize * 4);
  gl.readPixels(0, 0, textureSize, textureSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const imageData = context.createImageData(textureSize, textureSize);
  flipFramebufferPixels(pixels, imageData.data, textureSize, textureSize);
  context.putImageData(imageData, 0, 0);
  scene.textures.addCanvas(textureKey, canvas);
  return true;
}

function flipFramebufferPixels(
  source: Uint8Array,
  target: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const rowStride = width * 4;
  for (let y = 0; y < height; y += 1) {
    const sourceStart = (height - 1 - y) * rowStride;
    const targetStart = y * rowStride;
    for (let x = 0; x < rowStride; x += 1) {
      target[targetStart + x] = source[sourceStart + x];
    }
  }
}

function createProgram(gl: WebGLRenderingContext, fragmentShader: string): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function setFloatUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  value: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform1f(location, value);
}

export function setVec2Uniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  x: number,
  y: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform2f(location, x, y);
}

export function setVec3Uniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  value: Vec3Uniform,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform3f(location, value.x, value.y, value.z);
}

export function hexToVec3Uniform(hex: string): Vec3Uniform {
  const value = hex.replace('#', '');
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value;
  const int = Number.parseInt(normalized, 16);
  return {
    x: ((int >> 16) & 255) / 255,
    y: ((int >> 8) & 255) / 255,
    z: (int & 255) / 255,
  };
}
