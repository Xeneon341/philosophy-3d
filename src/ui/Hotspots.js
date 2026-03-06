import * as THREE from 'three';

// Manages interactive hotspot markers within a philosopher world
export class HotspotManager {
  constructor(scene, camera, group, onActivate) {
    this.scene = scene;
    this.camera = camera;
    this.group = group;
    this.onActivate = onActivate;
    this.hotspots = [];
    this._haloCache = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredHotspot = null;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  add(position, data) {
    this._haloCache = null; // invalidate cache on add
    // Outer pulsing ring
    const ringGeo = new THREE.RingGeometry(0.12, 0.16, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc8a96e,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);

    // Inner dot
    const dotGeo = new THREE.CircleGeometry(0.06, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xfff0c0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);

    // Outer halo (larger, very transparent — for easier clicking)
    const haloGeo = new THREE.CircleGeometry(0.28, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xc8a96e,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.userData.hotspotIndex = this.hotspots.length;

    const pivot = new THREE.Group();
    pivot.add(ring, dot, halo);
    pivot.position.set(...position);
    pivot.userData.hotspotIndex = this.hotspots.length;

    this.group.add(pivot);
    this.hotspots.push({ pivot, ring, dot, halo, ringMat, dotMat, data, basePos: [...position] });
  }

  enable(domElement) {
    this._dom = domElement;
    domElement.addEventListener('mousemove', this._onMouseMove);
    domElement.addEventListener('click', this._onClick);
  }

  disable() {
    if (this._dom) {
      this._dom.removeEventListener('mousemove', this._onMouseMove);
      this._dom.removeEventListener('click', this._onClick);
    }
    this.hoveredHotspot = null;
  }

  _onMouseMove(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this._haloCache) this._haloCache = this.hotspots.map(h => h.halo);
    const hits = this.raycaster.intersectObjects(this._haloCache, false);

    // Reset
    this.hotspots.forEach(h => {
      h.ringMat.color.set(0xc8a96e);
      h.dotMat.opacity = 0.9;
    });
    this.hoveredHotspot = null;
    document.body.style.cursor = 'default';

    if (hits.length > 0) {
      const idx = hits[0].object.userData.hotspotIndex;
      if (idx !== undefined) {
        this.hoveredHotspot = this.hotspots[idx];
        this.hoveredHotspot.ringMat.color.set(0xffffff);
        this.hoveredHotspot.dotMat.opacity = 1;
        document.body.style.cursor = 'pointer';
      }
    }
  }

  _onClick(e) {
    if (!this.hoveredHotspot) return;
    this.onActivate(this.hoveredHotspot.data);
  }

  update(t) {
    this.hotspots.forEach((h, i) => {
      // Always face camera (billboard)
      h.pivot.quaternion.copy(this.camera.quaternion);

      // Pulse ring
      const scale = 1 + 0.15 * Math.sin(t * 2.5 + i * 1.3);
      h.ring.scale.setScalar(scale);
      h.ringMat.opacity = 0.6 + 0.3 * Math.sin(t * 2.5 + i * 1.3);

      // Gentle float
      h.pivot.position.y = h.basePos[1] + Math.sin(t * 0.8 + i) * 0.06;
    });
  }

  dispose() {
    this.disable();
    this.hotspots.forEach(h => this.group.remove(h.pivot));
    this.hotspots = [];
    this._haloCache = null;
  }
}
