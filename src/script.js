import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'dat.gui'
import vertexShader from './shaders/vertexShader.glsl'
import fragmentShader from './shaders/fragmentShader.glsl'

/**
 * ===== Base =====
 */
const gui = new dat.GUI()
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()

// --- New: reference to the intro popup element ---
const introPopup = document.getElementById('intro-popup')

/**
 * ===== Parameters =====
 */
const parameters = {
  // galaxy shape
  count: 944400,
  size: 0.005,
  radius: 7.77,
  branches: 3,
  spin: 1,
  randomness: 0.831,
  randomnessPower: 5.134,
  insideColor: '#475dea',
  outsideColor: '#5f173e',

  // collision & effects
  separation: 9.5,
  collisionSpeed: 0.009,
  glowColor: '#f1e6e6',

  // randomness seed (for reproducibility)
  seed: 14382
}

/**
 * ===== Seeded Random Generator =====
 */
let seed = parameters.seed
function seededRandom() {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

/**
 * ===== Globals =====
 */
let renderer
let galaxyA, galaxyB
let glowSprites = []

/**
 * ===== Helpers =====
 */
function disposeGalaxy(g) {
  if (!g) return
  scene.remove(g.points)
  g.geometry.dispose()
  g.material.dispose()
}

function createGalaxy() {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(parameters.count * 3)
  const colors = new Float32Array(parameters.count * 3)
  const scales = new Float32Array(parameters.count)
  const randomness = new Float32Array(parameters.count * 3)

  const insideColor = new THREE.Color(parameters.insideColor)
  const outsideColor = new THREE.Color(parameters.outsideColor)

  for (let i = 0; i < parameters.count; i++) {
    const i3 = i * 3
    const radius = seededRandom() * parameters.radius
    const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2

    const randX = Math.pow(seededRandom(), parameters.randomnessPower) * (seededRandom() < 0.5 ? 1 : -1) * parameters.randomness * radius
    const randY = Math.pow(seededRandom(), parameters.randomnessPower) * (seededRandom() < 0.5 ? 1 : -1) * parameters.randomness * radius
    const randZ = Math.pow(seededRandom(), parameters.randomnessPower) * (seededRandom() < 0.5 ? 1 : -1) * parameters.randomness * radius

    positions[i3]     = Math.cos(branchAngle) * radius + randX
    positions[i3 + 1] = randY
    positions[i3 + 2] = Math.sin(branchAngle) * radius + randZ

    randomness[i]     = randX
    randomness[i + 1] = randY
    randomness[i + 2] = randZ

    const mixed = insideColor.clone().lerp(outsideColor, radius / parameters.radius)
    colors[i3]     = mixed.r
    colors[i3 + 1] = mixed.g
    colors[i3 + 2] = mixed.b

    scales[i] = seededRandom()
  }

  geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color',      new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aScale',     new THREE.BufferAttribute(scales, 1))
  geometry.setAttribute('aRandomness',new THREE.BufferAttribute(randomness, 3))

  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 20.0 * renderer.getPixelRatio() }
    }
  })

  const points = new THREE.Points(geometry, material)
  return { points, geometry, material }
}

function regenerateGalaxies() {
  disposeGalaxy(galaxyA)
  disposeGalaxy(galaxyB)
  seed = parameters.seed // reset seed each regeneration

  galaxyA = createGalaxy()
  galaxyA.points.position.x = -parameters.separation
  scene.add(galaxyA.points)

  galaxyB = createGalaxy()
  galaxyB.points.position.x = parameters.separation
  scene.add(galaxyB.points)
}

function createRadialTexture(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0,0,size,size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

function createGlow(colorHex) {
  glowSprites.forEach(s => scene.remove(s))
  glowSprites = []

  const map = createRadialTexture(512)
  const color = new THREE.Color(colorHex)

  function ring(scale, opacity) {
    const mat = new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
    const sp = new THREE.Sprite(mat)
    sp.scale.set(scale, scale, 1)
    scene.add(sp)
    glowSprites.push(sp)
  }

  ring(4.0, 0.55)
  ring(6.5, 0.28)
  ring(9.0, 0.14)
}

/**
 * ===== Sizes & Camera & Renderer =====
 */
const sizes = { width: window.innerWidth, height: window.innerHeight }

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 200)
camera.position.set(3, 4, 8)
scene.add(camera)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// --- Disable controls initially until popup disappears ---
controls.enabled = false

renderer = new THREE.WebGLRenderer({ canvas })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 12))

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// Initial build
regenerateGalaxies()
createGlow(parameters.glowColor)

const blackHole = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }))
scene.add(blackHole)

/**
 * ===== GUI =====
 */
const gal = gui.addFolder('Galaxy')
function rebuild() { regenerateGalaxies() }

gal.add(parameters, 'count', 100, 1000000, 100).onFinishChange(rebuild)
gal.add(parameters, 'radius', 0.01, 20, 0.01).onFinishChange(rebuild)
gal.add(parameters, 'branches', 2, 20, 1).onFinishChange(rebuild)
gal.add(parameters, 'randomness', 0, 2, 0.001).onFinishChange(rebuild)
gal.add(parameters, 'randomnessPower', 1, 10, 0.001).onFinishChange(rebuild)
gal.addColor(parameters, 'insideColor').onFinishChange(rebuild)
gal.addColor(parameters, 'outsideColor').onFinishChange(rebuild)
gal.add(parameters, 'seed', 1, 999999, 1).onFinishChange(rebuild).name('seed')

const fx = gui.addFolder('Effects')
fx.add(parameters, 'separation', 2, 20, 0.1).onFinishChange(rebuild)
fx.add(parameters, 'collisionSpeed', 0, 0.05, 0.001)
fx.addColor(parameters, 'glowColor').onChange(c => createGlow(c))

/**
 * ===== Animate =====
 */
const clock = new THREE.Clock()

function tick() {
  const t = clock.getElapsedTime()

  if (galaxyA) galaxyA.material.uniforms.uTime.value = t
  if (galaxyB) galaxyB.material.uniforms.uTime.value = t

  if (galaxyA) galaxyA.points.rotation.y += 0.0015
  if (galaxyB) galaxyB.points.rotation.y -= 0.0012

  if (galaxyA && galaxyB) {
    if (galaxyA.points.position.x < -2) galaxyA.points.position.x += parameters.collisionSpeed
    if (galaxyB.points.position.x >  2) galaxyB.points.position.x -= parameters.collisionSpeed
  }

  const pulse = 1 + 0.05 * Math.sin(t * 1.6)
  glowSprites.forEach((s, i) => {
    s.scale.setScalar([4.0, 6.5, 9.0][i] * pulse)
    s.material.rotation += 0.002 * (i + 1)
  })

  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

// --- Start animation loop ---
tick()

// --- Hide popup and enable controls after 2 seconds ---
setTimeout(() => {
  introPopup.classList.add('fade-out')
  setTimeout(() => {
    introPopup.style.display = 'none'
    controls.enabled = true
  }, 500) // matches fade out CSS transition duration
}, 2000)
