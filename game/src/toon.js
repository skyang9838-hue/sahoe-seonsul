// 셀 셰이딩 공용 재료: 3단계 그라데이션 + 뒤집은 껍데기 외곽선
import * as THREE from 'three';

function makeGradient(steps) {
  const d = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
export const GRAD = makeGradient([150, 215, 255]);       // 캐릭터: 부드러운 3단
export const GRAD_ENV = makeGradient([170, 225, 255]);   // 배경: 더 밝게

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = (typeof color === 'number' ? color : 'x') + JSON.stringify(opts);
  if (!opts.map && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color: new THREE.Color(color), gradientMap: opts.env ? GRAD_ENV : GRAD, map: opts.map || null,
    emissive: new THREE.Color(opts.emissive ?? 0x000000), emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide,
  });
  if (!opts.map) matCache.set(key, m);
  return m;
}

// 외곽선: 같은 도형을 법선 방향으로 부풀린 검은 껍데기(뒷면만 그림)
const outlineMats = new Map();
export function outlineMat(width, color = 0x2a1a12) {
  const k = width + ':' + color;
  if (outlineMats.has(k)) return outlineMats.get(k);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\n  transformed += normalize(normal) * ${width.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => 'outline' + k;
  outlineMats.set(k, m);
  return m;
}
export function addOutline(mesh, width = 0.02, color) {
  if (!mesh.isMesh || mesh.userData.noOutline) return;
  const o = new THREE.Mesh(mesh.geometry, outlineMat(width, color));
  o.userData.isOutline = true; o.castShadow = false; o.receiveShadow = false;
  o.renderOrder = -1;
  mesh.add(o);
}

// 불러온 GLB를 셀 셰이딩으로 바꾸고 외곽선을 단다
export function toonify(root, { outline = 0.018, shadows = true } = {}) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const map = src.map || null;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
    o.material = new THREE.MeshToonMaterial({
      color: src.color ? src.color.clone() : new THREE.Color(0xffffff), map, gradientMap: GRAD_ENV,
      transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest,
    });
    o.castShadow = shadows; o.receiveShadow = true;
    if (outline) {
      // 크기를 키운 모델은 외곽선도 커지므로 세계 크기 기준으로 나눠 준다
      addOutline(o, outline);
    }
  }
  return root;
}
