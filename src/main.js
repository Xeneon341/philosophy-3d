import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Universe } from './navigation/Universe.js';
import { OrbitControls } from './navigation/Controls.js';
import { Transition } from './navigation/Transition.js';
import { WORLD_CLASSES } from './worlds/index.js';
import { HotspotPanel } from './ui/HotspotPanel.js';

// ── Renderer ──────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('app').appendChild(renderer.domElement);

// ── Post-processing ───────────────────────────────────────────────────────────

// ── Post-processing (initialised after scene/camera) ─────────────────────────
let composer;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 3;
controls.maxDistance = 16;
controls.setPosition(0, Math.PI / 2.5, 10);
controls.enabled = false; // enabled after title

// ── UI elements ───────────────────────────────────────────────────────────────

const loadingEl = document.getElementById('loading');
const titleScreen = document.getElementById('title-screen');
const enterBtn = document.getElementById('enter-btn');
const backBtn = document.getElementById('back-btn');
const hoverLabel = document.getElementById('hover-label');
const infoPanel = document.getElementById('info-panel');
const worldTitle = document.getElementById('world-title');
const worldHint = document.getElementById('world-hint');
const instructions = document.getElementById('instructions');

// ── State ─────────────────────────────────────────────────────────────────────

let state = 'title'; // 'title' | 'universe' | 'transitioning' | 'world'
let currentWorld = null;
const worldInstances = {};

// ── Systems ───────────────────────────────────────────────────────────────────

// Init post-processing now that scene + camera exist
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9,   // strength
  0.45,  // radius
  0.55,  // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const universe = new Universe(scene, camera, renderer, enterPhilosopher);
const transition = new Transition(scene, camera, renderer);
const hotspotPanel = new HotspotPanel();

// Hide loading
setTimeout(() => {
  loadingEl.style.opacity = '0';
  setTimeout(() => { loadingEl.style.display = 'none'; }, 800);
}, 400);

// ── Title screen ──────────────────────────────────────────────────────────────

enterBtn.addEventListener('click', () => {
  titleScreen.style.opacity = '0';
  setTimeout(() => {
    titleScreen.style.display = 'none';
    state = 'universe';
    controls.enabled = true;
    universe.show();
  }, 1500);
});

// ── Back button ───────────────────────────────────────────────────────────────

backBtn.addEventListener('click', async () => {
  if (state !== 'world') return;
  state = 'transitioning';
  backBtn.classList.remove('visible');
  worldTitle.classList.remove('visible');

  hotspotPanel.hide();
  await transition.fadeOut(0.4);
  if (currentWorld) {
    currentWorld.hide();
    currentWorld = null;
  }
  // Reset all state while screen is black — no flash
  camera.fov = 65;
  camera.updateProjectionMatrix();
  controls.minDistance = 3;
  controls.maxDistance = 16;
  controls.setPosition(0, Math.PI / 2.5, 10);
  bloomPass.strength = 0.9;
  scene.fog = new THREE.FogExp2(0x000000, 0.015);
  worldHint.classList.remove('visible');
  instructions.style.display = '';
  universe.show();
  await transition.fadeIn(0.6);

  state = 'universe';
});

// ── Enter a philosopher world ─────────────────────────────────────────────────

async function enterPhilosopher(philosopherData) {
  if (state !== 'universe') return;
  state = 'transitioning';
  controls.enabled = false;
  hoverLabel.classList.remove('visible');
  infoPanel.classList.remove('visible');

  await transition.flyToPhilosopher(
    philosopherData.position,
    controls,
    () => {
      universe.hide();
      scene.fog = new THREE.FogExp2(0x000000, 0.04);
      camera.fov = 75;
      camera.updateProjectionMatrix();
      camera.position.set(0, 0, 6);
      camera.lookAt(0, 0, 0);
      controls.setPosition(0.3, Math.PI / 2.2, 6);
      controls.minDistance = 2;
      controls.maxDistance = 12;

      // Defer world build to next frame so the fade renders first,
      // preventing a visible freeze on first entry
      requestAnimationFrame(() => {
        const WorldClass = WORLD_CLASSES[philosopherData.id];
        if (WorldClass && !worldInstances[philosopherData.id]) {
          worldInstances[philosopherData.id] = new WorldClass(scene, camera, (data) => hotspotPanel.show(data.title, data.body));
        }
        currentWorld = worldInstances[philosopherData.id] || null;
        if (currentWorld) currentWorld.show(renderer.domElement);
      });

      worldTitle.textContent = philosopherData.name.toUpperCase();
      bloomPass.strength = 1.2;
    }
  );

  controls.enabled = true;
  backBtn.classList.add('visible');
  worldTitle.classList.add('visible');
  worldHint.classList.add('visible');
  instructions.style.display = 'none';
  state = 'world';
}

// ── Mouse events ──────────────────────────────────────────────────────────────

renderer.domElement.addEventListener('mousemove', (e) => {
  universe.onMouseMove(e);
});

renderer.domElement.addEventListener('click', (e) => {
  if (state === 'universe') universe.onClick(e);
});

// ── Resize ────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});

// ── Render loop ───────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);

  if (controls.enabled) controls.update();

  if (state === 'universe') {
    universe.update(hoverLabel, infoPanel);
  }

  if (state === 'world' && currentWorld) {
    currentWorld.update();
  }

  composer.render();
}

animate();
