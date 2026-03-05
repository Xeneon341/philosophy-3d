import * as THREE from 'three';
import gsap from 'gsap';

export class Transition {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Full-screen overlay for fade transitions
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed', top: 0, left: 0,
      width: '100%', height: '100%',
      background: '#000',
      opacity: 0,
      pointerEvents: 'none',
      zIndex: 50,
      transition: 'none',
    });
    document.body.appendChild(this.overlay);
  }

  async flyToPhilosopher(targetPosition, controls, onMidpoint) {
    const pos = new THREE.Vector3(...targetPosition);

    return new Promise(resolve => {
      // Fade out
      gsap.to(this.overlay, {
        opacity: 1,
        duration: 0.6,
        ease: 'power2.in',
        onComplete: () => {
          onMidpoint();
          // Fade in
          gsap.to(this.overlay, {
            opacity: 0,
            duration: 0.8,
            delay: 0.1,
            ease: 'power2.out',
            onComplete: resolve,
          });
        }
      });
    });
  }

  async fadeOut(duration = 0.5) {
    return new Promise(resolve => {
      gsap.to(this.overlay, {
        opacity: 1,
        duration,
        ease: 'power2.in',
        onComplete: resolve,
      });
    });
  }

  async fadeIn(duration = 0.8) {
    return new Promise(resolve => {
      gsap.to(this.overlay, {
        opacity: 0,
        duration,
        ease: 'power2.out',
        onComplete: resolve,
      });
    });
  }
}
