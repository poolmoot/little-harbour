import * as THREE from 'three';

/**
 * See-through fade for whatever stands between the camera and the player: a building corner, a tree, a barrel.
 * Materials that use `seeThrough` thin out (a fine dither, never fully gone) near the line from the player to the
 * camera. The baked, shared town meshes can all do it because it happens per pixel in the shader, with two shared
 * uniforms updated once a frame by `updateOcclusion`. Nothing is allocated per frame.
 */
const player = { value: new THREE.Vector3() };
const camera = { value: new THREE.Vector3() };
/** How wide the see-through hole is (m) and how much of a surface can thin out at most (0..1). */
const RADIUS = 2.1;
const MAX_FADE = 0.85;

export function updateOcclusion(cam: THREE.Camera, playerPos: THREE.Vector3): void {
  player.value.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
  camera.value.copy(cam.position);
}

const VERT_DECL = 'varying vec3 vOccPos;\n';
const VERT_BODY = `
  vec4 occW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  occW = instanceMatrix * occW;
  #endif
  vOccPos = ( modelMatrix * occW ).xyz;`;
const FRAG_DECL = `
varying vec3 vOccPos;
uniform vec3 uOccPlayer, uOccCam;
void occCut() {
  vec3 ab = uOccCam - uOccPlayer;
  float t = dot( vOccPos - uOccPlayer, ab ) / dot( ab, ab );
  vec3 c = uOccPlayer + ab * clamp( t, 0.0, 1.0 );
  float d = distance( vOccPos, c );
  float f = ( 1.0 - smoothstep( ${(RADIUS * 0.45).toFixed(2)}, ${RADIUS.toFixed(2)}, d ) )
          * smoothstep( 0.1, 0.22, t ) * smoothstep( 0.4, 1.0, vOccPos.y ) * ${MAX_FADE.toFixed(2)};
  float n = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
  if ( f > n ) discard;
}
`;

/** Add the see-through fade to a material's shader (call from onBeforeCompile, after any other changes). */
export function seeThrough(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }): void {
  shader.uniforms.uOccPlayer = player;
  shader.uniforms.uOccCam = camera;
  shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
  shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace('void main() {', 'void main() {\n  occCut();');
}

/** Wrap a material's existing shader changes (such as wind) and then add the fade. */
export function withSeeThrough<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    seeThrough(shader);
  };
  return m;
}
