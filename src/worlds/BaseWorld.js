import * as THREE from 'three';
import { HotspotManager } from '../ui/Hotspots.js';

export class BaseWorld {
  constructor(scene, camera, onHotspot) {
    this.scene = scene;
    this.camera = camera;
    this.onHotspot = onHotspot;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.clock = new THREE.Clock();
    this._built = false;
    this.hotspots = new HotspotManager(scene, camera, this.group, onHotspot);
  }

  build() {
    if (this._built) return;
    this._built = true;
    this._build();
  }

  _build() {}

  show(domElement) {
    this.build();
    this.group.visible = true;
    this.clock.start();
    if (domElement) this.hotspots.enable(domElement);
  }

  hide() {
    this.group.visible = false;
    this.hotspots.disable();
  }

  update() {
    if (!this.group.visible) return;
    const t = this.clock.getElapsedTime();
    this._update(t);
    this.hotspots.update(t);
  }

  _update(t) {}

  dispose() {
    this.hotspots.dispose();
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
