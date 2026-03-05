import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';

export class SpinozaWorld extends BaseWorld {
  _build() {
    this._buildBackground();
    this._buildLattice();
    this._buildAttributes();
    this._buildCentralSubstance();
    this._buildHotspots();

    const ambient = new THREE.AmbientLight(0x0a0520, 0.5);
    this.centralLight = new THREE.PointLight(0xa070ff, 3.5, 20);
    this.centralLight.position.set(0, 0, 0);
    this.group.add(ambient, this.centralLight);
  }

  _buildBackground() {
    // Deep space dome
    const geo = new THREE.SphereGeometry(40, 32, 16);
    this.bgMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        float stars(vec3 d){
          vec3 p = normalize(d) * 200.0;
          vec3 i = floor(p); vec3 f = fract(p);
          float s = hash(i);
          float r = length(f - 0.5);
          return s > 0.994 ? smoothstep(0.15, 0.0, r) * s : 0.0;
        }
        void main() {
          vec3 col = vec3(0.01, 0.005, 0.03);
          col += vec3(0.04, 0.01, 0.12) * max(0.0, 1.0 - abs(vDir.y) * 2.0); // equatorial band
          col += vec3(stars(vDir));
          col += vec3(0.06, 0.02, 0.15) * pow(max(0.0, dot(vDir, vec3(0,1,0))), 3.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(geo, this.bgMat));
  }

  _buildCentralSubstance() {
    // The central Substance node — God/Nature
    const geo = new THREE.IcosahedronGeometry(0.35, 4);
    this.substanceMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPos;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main() {
          vNormal = normalize(normalMatrix * normal);
          float n = noise(position * 4.0 + time * 0.2) * 0.5 + noise(position * 9.0 - time * 0.1) * 0.25;
          float disp = 0.08 * (n - 0.3);
          vec3 pos = position + normal * disp;
          vPos = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          vec3 view = normalize(cameraPosition - vPos);
          float rim = pow(1.0 - max(dot(vNormal, view), 0.0), 2.5);
          float pulse = 0.5 + 0.5 * sin(time * 1.5);
          vec3 core   = vec3(0.6, 0.3, 1.0);
          vec3 atm    = vec3(0.3, 0.1, 0.8);
          vec3 col = mix(core * 0.4, atm, rim) + core * pulse * 0.3;
          gl_FragColor = vec4(col, 0.9);
        }
      `,
      transparent: true,
    });
    this.substanceMesh = new THREE.Mesh(geo, this.substanceMat);
    this.group.add(this.substanceMesh);

    // Outer halo
    const haloGeo = new THREE.SphereGeometry(0.7, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x8040ff, transparent: true, opacity: 0.06, side: THREE.BackSide });
    this.group.add(new THREE.Mesh(haloGeo, haloMat));

    // Equatorial rings
    [0, Math.PI/4, Math.PI/2].forEach((tilt, i) => {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(0.6 + i * 0.15, 0.012, 6, 64),
        new THREE.MeshBasicMaterial({ color: 0xa060ff, transparent: true, opacity: 0.25, depthWrite: false })
      );
      r.rotation.x = Math.PI / 2 + tilt;
      this.group.add(r);
    });
  }

  _buildLattice() {
    this.latticeNodes = [];
    const GRID = 4;
    const SPACING = 1.8;

    // Instanced mesh for performance
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          float dist = length(vPos);
          float pulse = 0.4 + 0.35 * sin(time * 0.9 + dist * 0.8);
          vec3 view = normalize(cameraPosition - vPos);
          float rim = pow(1.0 - max(dot(vNormal, view), 0.0), 2.0);
          vec3 col = vec3(0.5, 0.25, 0.9) * pulse + vec3(0.7, 0.4, 1.0) * rim * 0.6;
          gl_FragColor = vec4(col, 0.85);
        }
      `,
      transparent: true,
    });
    this.latticeMat = nodeMat;

    for (let x = -GRID; x <= GRID; x++) {
      for (let y = -GRID; y <= GRID; y++) {
        for (let z = -GRID; z <= GRID; z++) {
          const dist = Math.sqrt(x*x + y*y + z*z);
          if (dist > GRID + 0.5 || dist < 0.8) continue; // hollow sphere shell
          const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), nodeMat);
          mesh.position.set(x * SPACING, y * SPACING, z * SPACING);
          this.group.add(mesh);
          this.latticeNodes.push(mesh);
        }
      }
    }

    // Lattice edges
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x5030a0, transparent: true, opacity: 0.14, depthWrite: false });
    for (let x = -GRID; x <= GRID; x++) {
      for (let y = -GRID; y <= GRID; y++) {
        for (let z = -GRID; z <= GRID; z++) {
          const dist = Math.sqrt(x*x + y*y + z*z);
          if (dist > GRID + 0.5 || dist < 0.8) continue;
          [[1,0,0],[0,1,0],[0,0,1]].forEach(([dx,dy,dz]) => {
            const nx=x+dx, ny=y+dy, nz=z+dz;
            const ndist = Math.sqrt(nx*nx+ny*ny+nz*nz);
            if (ndist > GRID + 0.5) return;
            const geo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(x*SPACING, y*SPACING, z*SPACING),
              new THREE.Vector3(nx*SPACING, ny*SPACING, nz*SPACING),
            ]);
            this.group.add(new THREE.Line(geo, edgeMat));
          });
        }
      }
    }
  }

  _buildAttributes() {
    // Extension stream (blue) — horizontal ribbons
    this.extensionParticles = this._makeStream(0x3388ff, 500, 'x');
    // Thought stream (gold) — vertical ribbons
    this.thoughtParticles   = this._makeStream(0xffcc44, 500, 'y');
    // Third attribute hint (unknowable) — spiraling
    this.hiddenParticles    = this._makeStream(0xff4488, 200, 'spiral');
  }

  _makeStream(color, count, axis) {
    const positions = new Float32Array(count * 3);
    const RANGE = 7.5;
    for (let i = 0; i < count; i++) {
      if (axis === 'spiral') {
        const t = (i / count) * Math.PI * 8;
        positions[i*3]   = Math.cos(t) * (2 + Math.random());
        positions[i*3+1] = (Math.random() - 0.5) * 12;
        positions[i*3+2] = Math.sin(t) * (2 + Math.random());
      } else {
        positions[i*3]   = (Math.random() - 0.5) * RANGE * 2;
        positions[i*3+1] = (Math.random() - 0.5) * RANGE * 2;
        positions[i*3+2] = (Math.random() - 0.5) * RANGE * 2;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.07, transparent: true, opacity: 0.65, depthWrite: false, sizeAttenuation: true });
    this.group.add(new THREE.Points(geo, mat));
    return { geo, axis, dir: 1 };
  }

  _update(t) {
    this.bgMat.uniforms.time.value = t;
    this.substanceMat.uniforms.time.value = t;
    this.latticeMat.uniforms.time.value = t;
    this.centralLight.intensity = 3.0 + 1.0 * Math.sin(t * 1.3);

    // Slowly rotate lattice as a whole
    this.group.rotation.y = t * 0.04;
    this.group.rotation.x = Math.sin(t * 0.025) * 0.12;

    // Central substance pulse + spin
    this.substanceMesh.rotation.y = t * 0.15;
    this.substanceMesh.rotation.x = t * 0.07;

    // Extension particles flow along X
    const ep = this.extensionParticles.geo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      ep.array[i*3] += 0.025;
      if (ep.array[i*3] > 7.5) ep.array[i*3] = -7.5;
    }
    ep.needsUpdate = true;

    // Thought particles flow along Y
    const tp = this.thoughtParticles.geo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      tp.array[i*3+1] += 0.018;
      if (tp.array[i*3+1] > 7.5) tp.array[i*3+1] = -7.5;
    }
    tp.needsUpdate = true;

    // Hidden attribute spirals
    const hp = this.hiddenParticles.geo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const angle = t * 0.3 + i * 0.05;
      const r = 2 + Math.sin(t * 0.2 + i * 0.1);
      hp.array[i*3]   = Math.cos(angle) * r;
      hp.array[i*3+2] = Math.sin(angle) * r;
      hp.array[i*3+1] += 0.006;
      if (hp.array[i*3+1] > 6) hp.array[i*3+1] = -6;
    }
    hp.needsUpdate = true;
  }

  _buildHotspots() {
    const hotspots = [
      { position: [0, 0, 0], title: 'Deus Sive Natura', body: `<p>"God or Nature" — the most compressed philosophical formula in Western thought. Spinoza's audacious identification: God and Nature are one and the same infinite, eternal substance. There is only one substance in the universe.</p><p>This is not atheism but something stranger — a kind of absolute pantheism. God is not a person who created the world; God <em>is</em> the world, considered under the aspect of infinity. Nature is God expressing itself through its own necessity.</p><p>Spinoza was excommunicated from his Jewish community at 23 for views like this. His books were condemned by Catholics, Protestants, and Jews alike. Einstein, asked if he believed in God, said: "I believe in Spinoza's God."</p>` },
      { position: [3.6, 3.6, 3.6], title: 'Attributes: Thought & Extension', body: `<p>The one Substance (God/Nature) expresses itself through infinitely many attributes — but humans can perceive only two: <em>Thought</em> and <em>Extension</em> (mind and matter).</p><p>These are not two substances (pace Descartes) but two ways of describing one and the same reality. A mental event and its corresponding physical event are identical — just described under different attributes. There is no interaction problem: mind and body don't interact because they're the same thing seen differently.</p><p>This theory is called <em>neutral monism</em> or <em>dual-aspect monism</em>. It anticipates the hard problem of consciousness — and offers the most elegant solution anyone has proposed.</p>` },
      { position: [-3.6, -3.6, -3.6], title: 'Conatus — the Striving to Persist', body: `<p>Every finite thing, Spinoza argues, strives to persist in its own being. This <em>conatus</em> is not a tendency among others but the very essence of a thing — what it is, is inseparable from what it does to remain itself.</p><p>In humans, conatus becomes desire — the fundamental drive of human psychology. Joy is the increase of our power of acting; sadness is its decrease. Good and bad are not objective properties but expressions of what enhances or diminishes our conatus.</p><p>This anticipates Schopenhauer's Will, Nietzsche's Will to Power, Freud's libido, and even Darwin's drive for survival — all descendants of Spinoza's single insight.</p>` },
      { position: [0, 5.4, 0], title: 'The Ethics (More Geometrico)', body: `<p>Spinoza's masterwork, the <em>Ethics</em>, is written in Euclidean form: definitions, axioms, propositions, proofs, corollaries. He believed ethics could be as rigorously demonstrated as geometry.</p><p>This was not mere affectation — it expressed his metaphysical conviction. If everything follows necessarily from God/Nature's essence, then human freedom, human virtue, and human blessedness can be derived from first principles as surely as the angles of a triangle sum to 180°.</p><p>The book took 20 years and was published posthumously in 1677, the year he died of lung disease (probably aggravated by glass-grinding dust — he was a lens-maker). He feared condemnation, and he was right to.</p>` },
      { position: [0, -5.4, 0], title: 'Sub Specie Aeternitatis', body: `<p>Spinoza's ideal of wisdom: to see everything "under the aspect of eternity" (<em>sub specie aeternitatis</em>). Instead of seeing events as good or bad for me, now, in this situation — to see them as necessary expressions of the infinite whole.</p><p>Human bondage is emotional slavery — being buffeted by passions (fear, hope, joy, sadness) triggered by contingent events. Freedom is achieved through adequate ideas — understanding the necessary causes of things, including our own emotions.</p><p>Understanding why you feel what you feel diminishes the emotion's power. The highest good — the "intellectual love of God" (<em>amor intellectualis Dei</em>) — is the mind's eternity: its participation in God's infinite self-knowledge.</p>` },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }
}
