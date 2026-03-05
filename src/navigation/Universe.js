import * as THREE from 'three';
import { PHILOSOPHERS, INFLUENCES } from '../data/philosophers.js';
import {
  starVertexShader, starFragmentShader,
  nodeVertexShader, nodeFragmentShader,
  lineVertexShader, lineFragmentShader,
  nebulaVertexShader, nebulaFragmentShader,
} from '../shaders/starfield.glsl.js';

export class Universe {
  constructor(scene, camera, renderer, onEnterPhilosopher) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.onEnterPhilosopher = onEnterPhilosopher;
    this.nodes = [];
    this.nodeMeshes = [];
    this.lineMaterials = [];
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-9999, -9999);
    this.hoveredNode = null;
    this.active = false;

    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildStarfield();
    this._buildNebulae();
    this._buildNodes();
    this._buildInfluenceLines();
    this._buildDustClouds();
  }

  // ── Starfield ──────────────────────────────────────────────────────────────

  _buildStarfield() {
    const count = 6000;
    const positions  = new Float32Array(count * 3);
    const sizes      = new Float32Array(count);
    const brightnesses = new Float32Array(count);
    const colors     = new Float32Array(count * 3);

    // Star colour temperatures: blue-white, white, yellow-white, orange
    const palette = [
      [0.7, 0.82, 1.0],  // blue-white
      [1.0, 0.98, 0.95], // white
      [1.0, 0.95, 0.75], // yellow-white
      [1.0, 0.80, 0.55], // orange
    ];

    for (let i = 0; i < count; i++) {
      const r     = 35 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);

      sizes[i]       = 0.3 + Math.random() * Math.random() * 3.0; // biased small
      brightnesses[i] = 0.2 + Math.random() * 0.8;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i*3]   = c[0];
      colors[i*3+1] = c[1];
      colors[i*3+2] = c[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size',       new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));
    geo.setAttribute('color',      new THREE.BufferAttribute(colors, 3));

    this.starMaterial = new THREE.ShaderMaterial({
      vertexShader:   starVertexShader,
      fragmentShader: starFragmentShader,
      uniforms: { time: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });

    this.group.add(new THREE.Points(geo, this.starMaterial));
  }

  // ── Procedural nebula planes ───────────────────────────────────────────────

  _buildNebulae() {
    this.nebulaMaterials = [];
    const nebDefs = [
      { color: [0.08, 0.03, 0.22], opacity: 0.18, pos: [-6, 2, -8],  rot: [0.3, 0.1, 0.5],  size: 28 },
      { color: [0.02, 0.06, 0.18], opacity: 0.15, pos: [8, -3, -5],   rot: [0.5, 0.8, 0.1],  size: 24 },
      { color: [0.10, 0.04, 0.08], opacity: 0.12, pos: [3, 5, 6],     rot: [0.9, 0.2, 0.7],  size: 20 },
      { color: [0.03, 0.10, 0.06], opacity: 0.10, pos: [-8, -4, 3],   rot: [0.1, 0.6, 0.3],  size: 22 },
      { color: [0.12, 0.08, 0.02], opacity: 0.08, pos: [0, 7, -12],   rot: [0.4, 0.9, 0.0],  size: 32 },
      { color: [0.06, 0.02, 0.14], opacity: 0.14, pos: [-4, -6, -4],  rot: [0.7, 0.3, 0.8],  size: 18 },
    ];

    nebDefs.forEach(({ color, opacity, pos, rot, size }) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader:   nebulaVertexShader,
        fragmentShader: nebulaFragmentShader,
        uniforms: {
          time:    { value: 0 },
          color:   { value: new THREE.Vector3(...color) },
          opacity: { value: opacity },
        },
        transparent: true,
        depthWrite:  false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      this.group.add(mesh);
      this.nebulaMaterials.push(mat);
    });
  }

  // ── Philosopher nodes ──────────────────────────────────────────────────────

  _buildNodes() {
    PHILOSOPHERS.forEach((p, i) => {
      // Higher-res sphere base
      const geo = new THREE.IcosahedronGeometry(0.20 * p.size, 4);
      const mat = new THREE.ShaderMaterial({
        vertexShader:   nodeVertexShader,
        fragmentShader: nodeFragmentShader,
        uniforms: {
          color:   { value: new THREE.Color(p.color) },
          time:    { value: 0 },
          hovered: { value: 0 },
        },
        transparent: true,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.position);
      mesh.userData = { philosopher: p, index: i };

      // ── Atmosphere halo ──
      const haloGeo = new THREE.SphereGeometry(0.30 * p.size, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
        depthWrite: false,
      });
      mesh.add(new THREE.Mesh(haloGeo, haloMat));

      // ── Orbital rings (2 at different tilts) ──
      [0, Math.PI / 3].forEach((tilt, ri) => {
        const ringGeo = new THREE.TorusGeometry(0.30 * p.size, 0.008 * p.size, 6, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2 + tilt;
        ring.userData.isRing = true;
        ring.userData.ringIdx = ri;
        mesh.add(ring);
      });

      // ── Tiny orbiting moon ──
      const moonGeo = new THREE.SphereGeometry(0.025 * p.size, 8, 8);
      const moonMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.6 });
      const moon = new THREE.Mesh(moonGeo, moonMat);
      moon.userData.isMoon = true;
      mesh.add(moon);

      this.group.add(mesh);
      this.nodeMeshes.push(mesh);
      this.nodes.push({ mesh, data: p });
    });
  }

  // ── Influence lines ────────────────────────────────────────────────────────

  _buildInfluenceLines() {
    const map = {};
    PHILOSOPHERS.forEach(p => { map[p.id] = p; });

    // Single shared material for all lines — one shader compile, one uniform update
    const sharedLineMat = new THREE.ShaderMaterial({
      vertexShader:   lineVertexShader,
      fragmentShader: lineFragmentShader,
      uniforms: {
        time:  { value: 0 },
        color: { value: new THREE.Color(0xc8a96e) },
      },
      transparent: true,
      depthWrite:  false,
    });
    this.lineMaterials.push(sharedLineMat);

    INFLUENCES.forEach(([fromId, toId]) => {
      const from = map[fromId];
      const to   = map[toId];
      if (!from || !to) return;

      const start = new THREE.Vector3(...from.position);
      const end   = new THREE.Vector3(...to.position);
      const mid   = start.clone().lerp(end, 0.5);
      mid.y += 0.6 + Math.random() * 0.8;
      mid.x += (Math.random() - 0.5) * 0.5;

      const curve  = new THREE.QuadraticBezierCurve3(start, mid, end);
      const pts    = curve.getPoints(60);
      const positions = new Float32Array(pts.length * 3);
      const progress  = new Float32Array(pts.length);
      pts.forEach((p, i) => {
        positions[i*3]   = p.x;
        positions[i*3+1] = p.y;
        positions[i*3+2] = p.z;
        progress[i] = i / (pts.length - 1);
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('lineProgress', new THREE.BufferAttribute(progress, 1));

      this.group.add(new THREE.Line(geo, sharedLineMat));
    });
  }

  // ── Foreground dust ────────────────────────────────────────────────────────

  _buildDustClouds() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x8070a0,
      size: 0.018,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  onMouseMove(event) {
    if (!this.active) return;
    this.mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  onClick(event) {
    if (!this.active || !this.hoveredNode) return;
    this.onEnterPhilosopher(this.hoveredNode.philosopher);
  }

  show() { this.active = true;  this.group.visible = true; }
  hide() { this.active = false; this.group.visible = false; }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(hoverLabelEl, infoPanelEl) {
    const t = this.clock.getElapsedTime();

    this.starMaterial.uniforms.time.value = t;
    this.nebulaMaterials.forEach(m => { m.uniforms.time.value = t; });
    this.lineMaterials.forEach(m  => { m.uniforms.time.value = t; });

    // Very slow universe drift
    this.group.rotation.y = t * 0.018;
    this.group.rotation.x = Math.sin(t * 0.004) * 0.04;

    // Animate nodes
    this.nodeMeshes.forEach((mesh, i) => {
      mesh.material.uniforms.time.value = t;

      // Slow axial spin
      mesh.rotation.y = t * 0.18 + i * 0.7;
      mesh.rotation.x = t * 0.07 + i * 0.4;

      // Float
      mesh.position.y = PHILOSOPHERS[i].position[1] + Math.sin(t * 0.35 + i * 1.1) * 0.12;

      mesh.children.forEach(child => {
        // Rings orbit
        if (child.userData.isRing) {
          const speed = child.userData.ringIdx === 0 ? 0.4 : -0.28;
          child.rotation.y = t * speed + i;
        }
        // Moon orbits
        if (child.userData.isMoon) {
          const r = 0.38 * PHILOSOPHERS[i].size;
          child.position.x = Math.cos(t * 0.9 + i * 2.1) * r;
          child.position.z = Math.sin(t * 0.9 + i * 2.1) * r;
          child.position.y = Math.sin(t * 0.5 + i) * 0.08;
        }
      });
    });

    // ── Hover raycasting — false = don't recurse into rings/moons ──
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.nodeMeshes, false);

    this.nodeMeshes.forEach(m => {
      m.material.uniforms.hovered.value = 0;
      m.children.forEach(c => {
        if (c.material && c.userData.isRing) c.material.opacity = 0.18;
      });
    });

    let hitNode = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj) {
        if (obj.userData?.philosopher) { hitNode = obj; break; }
        obj = obj.parent;
      }
    }

    if (hitNode) {
      hitNode.material.uniforms.hovered.value = 1;
      hitNode.children.forEach(c => {
        if (c.material && c.userData.isRing) c.material.opacity = 0.5;
      });
      this.hoveredNode = hitNode.userData;
      document.body.style.cursor = 'pointer';

      const p = hitNode.userData.philosopher;
      hoverLabelEl.textContent = p.name;
      hoverLabelEl.style.left = `${(this.mouse.x * 0.5 + 0.5) * window.innerWidth}px`;
      hoverLabelEl.style.top  = `${(-this.mouse.y * 0.5 + 0.5) * window.innerHeight}px`;
      hoverLabelEl.classList.add('visible');

      infoPanelEl.querySelector('#philosopher-name').textContent  = p.name;
      infoPanelEl.querySelector('#philosopher-dates').textContent = `${p.dates} · ${p.school}`;
      infoPanelEl.querySelector('#philosopher-quote').textContent = `"${p.quote}"`;
      infoPanelEl.classList.add('visible');
    } else {
      this.hoveredNode = null;
      document.body.style.cursor = 'default';
      hoverLabelEl.classList.remove('visible');
      infoPanelEl.classList.remove('visible');
    }
  }
}
