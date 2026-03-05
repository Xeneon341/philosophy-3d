import * as THREE from 'three';

// Minimal orbit controls implementation
export class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = true;

    this.target = new THREE.Vector3();
    this.minDistance = 2;
    this.maxDistance = 20;
    this.dampingFactor = 0.08;

    this._spherical = new THREE.Spherical();
    this._spherical.setFromVector3(camera.position.clone().sub(this.target));

    this._targetSpherical = this._spherical.clone();

    this._isDragging = false;
    this._lastMouse = new THREE.Vector2();
    this._rotateSpeed = 0.005;
    this._zoomSpeed = 0.1;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this._posVec = new THREE.Vector3(); // reused every frame — no per-frame allocation

    domElement.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: true });
    domElement.addEventListener('touchstart', this._onTouchStart, { passive: true });
    document.addEventListener('touchmove', this._onTouchMove, { passive: true });
    document.addEventListener('touchend', this._onTouchEnd, { passive: true });
  }

  _onMouseDown(e) {
    if (!this.enabled) return;
    this._isDragging = true;
    this._lastMouse.set(e.clientX, e.clientY);
  }

  _onMouseMove(e) {
    if (!this._isDragging || !this.enabled) return;
    const dx = e.clientX - this._lastMouse.x;
    const dy = e.clientY - this._lastMouse.y;
    this._lastMouse.set(e.clientX, e.clientY);
    this._targetSpherical.theta -= dx * this._rotateSpeed;
    this._targetSpherical.phi -= dy * this._rotateSpeed;
    this._targetSpherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._targetSpherical.phi));
  }

  _onMouseUp() { this._isDragging = false; }

  _onWheel(e) {
    if (!this.enabled) return;
    this._targetSpherical.radius *= 1 + e.deltaY * this._zoomSpeed * 0.01;
    this._targetSpherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._targetSpherical.radius));
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._isDragging = true;
      this._lastMouse.set(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  _onTouchMove(e) {
    if (!this._isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - this._lastMouse.x;
    const dy = e.touches[0].clientY - this._lastMouse.y;
    this._lastMouse.set(e.touches[0].clientX, e.touches[0].clientY);
    this._targetSpherical.theta -= dx * this._rotateSpeed;
    this._targetSpherical.phi -= dy * this._rotateSpeed;
    this._targetSpherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._targetSpherical.phi));
  }

  _onTouchEnd() { this._isDragging = false; }

  update() {
    this._spherical.theta += (this._targetSpherical.theta - this._spherical.theta) * this.dampingFactor;
    this._spherical.phi += (this._targetSpherical.phi - this._spherical.phi) * this.dampingFactor;
    this._spherical.radius += (this._targetSpherical.radius - this._spherical.radius) * this.dampingFactor;

    this._posVec.setFromSpherical(this._spherical).add(this.target);
    this.camera.position.copy(this._posVec);
    this.camera.lookAt(this.target);
  }

  setPosition(theta, phi, radius) {
    this._targetSpherical.theta = theta;
    this._targetSpherical.phi = phi;
    this._targetSpherical.radius = radius;
  }

  dispose() {
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
  }
}
