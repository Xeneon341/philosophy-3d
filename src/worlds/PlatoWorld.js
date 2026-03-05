import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeCaveStoneMaterial } from '../shaders/materials.js';

export class PlatoWorld extends BaseWorld {
  _build() {
    this._buildCaveDome();
    this._buildCave();
    this._buildForms();
    this._buildParticleAscent();
    this._buildShadows();
    this._buildGround();
    this._buildHotspots();

    const ambient = new THREE.AmbientLight(0x0a0820, 0.6);
    const golden = new THREE.PointLight(0xf0c060, 4, 25);
    golden.position.set(0, 8, -2);
    const fireLight = new THREE.PointLight(0xff6820, 3, 10);
    fireLight.position.set(-3, 0, 3);
    const fireLight2 = new THREE.PointLight(0xff4400, 2, 8);
    fireLight2.position.set(3, 0, 3);
    // Two shared lights to illuminate the floating Forms (replaces per-Form lights)
    const formLight1 = new THREE.PointLight(0xf0c040, 1.5, 12);
    formLight1.position.set(-1, 5, -2);
    const formLight2 = new THREE.PointLight(0xf0c040, 1.5, 12);
    formLight2.position.set(1, 5, -1);
    this.group.add(ambient, golden, fireLight, fireLight2, formLight1, formLight2);
    this.fireLight = fireLight;
    this.fireLight2 = fireLight2;
  }

  _buildCaveDome() {
    // Enclose the cave — a sphere dome so no black gaps show outside the wall planes
    const geo = new THREE.SphereGeometry(12, 24, 16);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p*=2.1;a*=0.5;} return v; }
        void main() {
          vec3 p = vWorldPos * 0.5;
          float n = fbm(p);
          float n2 = fbm(p * 2.5 + 4.1);
          float crack = smoothstep(0.0, 0.04, abs(fbm(p * 5.0) - 0.5));
          vec3 dark  = vec3(0.04, 0.02, 0.02);
          vec3 mid   = vec3(0.09, 0.06, 0.04);
          vec3 veinC = vec3(0.15, 0.10, 0.07);
          vec3 col = mix(dark, mid, n);
          col = mix(col, veinC, (1.0 - crack) * 0.3);
          col += vec3(0.02, 0.01, 0.0) * n2;
          vec3 fireDir = normalize(vec3(0.0, -0.5, 1.0));
          float diff = max(dot(-vNormal, fireDir), 0.0) * 0.3 + 0.05;
          col *= diff + 0.7;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(geo, mat));
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(24, 24, 40, 40);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      if (Math.abs(x) > 2 || Math.abs(z) > 2) {
        pos.setY(i, (Math.random() - 0.5) * 0.12);
      }
    }
    geo.computeVertexNormals();
    const floor = new THREE.Mesh(geo, this._caveMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    this.group.add(floor);
  }

  _buildCave() {
    // Single shared material instance for all cave surfaces
    this._caveMat = makeCaveStoneMaterial();
    const wallMat = this._caveMat;

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), wallMat);
    backWall.position.set(0, 1, -5.5);
    this.group.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), wallMat);
    leftWall.position.set(-5.5, 1, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), wallMat);
    rightWall.position.set(5.5, 1, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.group.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    this.group.add(ceiling);

    // Rocky protrusions — reuse the same material
    const rockMat = this._caveMat;
    const rockDefs = [
      [-4, -1.2, -3, 0.7], [4, -1.3, -4, 0.55], [-5, -0.8, 0.5, 0.9],
      [5, -1, -2, 0.65], [3, -1.6, 2.5, 0.5], [-2, -1.7, 3, 0.45],
      [1, -1.8, 4, 0.6], [-4.8, 0.5, -2, 0.4],
    ];
    rockDefs.forEach(([x, y, z, s]) => {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), rockMat);
      r.position.set(x, y, z);
      r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      r.castShadow = true;
      this.group.add(r);
    });

    // Fire pits — brazier bowl + stone base + flame particles
    this.flamePits = [];
    [[-2.5, -1.9, 2.8], [2.5, -1.9, 2.8]].forEach(([x, y, z]) => {
      // Stone pedestal
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.95, metalness: 0 })
      );
      pedestal.position.set(x, y + 0.17, z);
      this.group.add(pedestal);

      // Iron bowl rim
      const bowl = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.07, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.8, metalness: 0.55, emissive: 0x3a0800, emissiveIntensity: 0.25 })
      );
      bowl.rotation.x = Math.PI / 2;
      bowl.position.set(x, y + 0.36, z);
      this.group.add(bowl);

      // Flame — cone shape with emissive orange shader
      const flameGeo = new THREE.ConeGeometry(0.18, 0.6, 6, 1, true);
      const flameMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, seed: { value: Math.random() * 10 } },
        vertexShader: `
          uniform float time;
          uniform float seed;
          varying float vHeight;
          void main() {
            vHeight = (position.y + 0.3) / 0.6;
            // Flicker: taper inward and sway as height increases
            vec3 pos = position;
            float sway = sin(time * 6.0 + seed) * 0.04 * vHeight;
            float taper = 1.0 - vHeight * 0.6;
            pos.x = pos.x * taper + sway;
            pos.z = pos.z * taper + cos(time * 5.3 + seed) * 0.03 * vHeight;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying float vHeight;
          void main() {
            vec3 base = vec3(1.0, 0.55, 0.05);
            vec3 tip  = vec3(0.9, 0.15, 0.0);
            vec3 col  = mix(base, tip, vHeight);
            float alpha = (1.0 - vHeight) * 0.85;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x, y + 0.65, z);
      this.group.add(flame);
      this.flamePits.push(flameMat);

      // Inner bright core
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.6 });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), coreMat);
      core.position.set(x, y + 0.42, z);
      this.group.add(core);
    });
  }

  _buildForms() {
    this.forms = [];
    const FORM_DEFS = [
      { geo: new THREE.TetrahedronGeometry(0.55, 0), label: 'Fire — Tetrahedron' },
      { geo: new THREE.OctahedronGeometry(0.5, 0), label: 'Air — Octahedron' },
      { geo: new THREE.IcosahedronGeometry(0.5, 0), label: 'Water — Icosahedron' },
      { geo: new THREE.DodecahedronGeometry(0.5, 0), label: 'Cosmos — Dodecahedron' },
    ];

    FORM_DEFS.forEach(({ geo }, i) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xf5e870,
        emissive: 0xd4a820,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.82,
        roughness: 0.0,
        metalness: 0.05,
        transmission: 0.25,
        thickness: 0.5,
        envMapIntensity: 1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / FORM_DEFS.length) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 2.2, 4.5 + Math.sin(i) * 0.4, Math.sin(angle) * 2.2 - 1.5);
      mesh.scale.setScalar(0.65 + i * 0.08);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.forms.push(mesh);

      // Wireframe edge overlay
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.5 });
      mesh.add(new THREE.LineSegments(edges, lineMat));
    });
  }

  _buildParticleAscent() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = (Math.random() * 8) - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1.5;
      speeds[i] = 0.003 + Math.random() * 0.006;
      sizes[i] = 0.02 + Math.random() * 0.04;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.particleDelays = speeds;
    this.particleGeo = geo;

    const mat = new THREE.PointsMaterial({
      color: 0xf5d878,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _buildShadows() {
    // Animated shadow puppets projected onto the back wall — dark, semi-transparent, slightly reddish from fire glow
    this.shadowMeshes = [];
    const shapes = [
      new THREE.BoxGeometry(0.7, 0.7, 0.01),
      new THREE.CircleGeometry(0.35, 8),
      new THREE.ConeGeometry(0.3, 0.6, 5),
    ];
    shapes.forEach((geo, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x080302,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-1.8 + i * 1.8, 0, -5.44);
      this.group.add(mesh);
      this.shadowMeshes.push(mesh);
    });
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [2.2, 4.5, -1.5],
        title: 'The Theory of Forms',
        body: `<p>Plato's most radical claim: the physical world is not the real world. Behind every imperfect particular — every beautiful face, every just act — stands a perfect, eternal, unchanging <em>Form</em>.</p>
        <p>The Forms are not mental constructs but objective realities, more real than anything we can touch. The Form of Beauty is more real than any beautiful object; the Form of Justice more real than any just law.</p>
        <p>Knowledge, for Plato, means grasping the Forms through reason — not through the senses, which only ever give us opinion about a shadow-world.</p>`,
      },
      {
        position: [-2.2, 4.5, -3.5],
        title: 'The Allegory of the Cave',
        body: `<p>Imagine prisoners chained in a cave since birth, facing a wall. Behind them, a fire casts shadows of objects onto the wall — and these shadows are the only reality they know.</p>
        <p>Philosophy is the painful process of turning around, walking toward the fire, emerging into sunlight, and finally seeing the Sun itself — the Form of the Good, source of all truth and being.</p>
        <p>Most people, Plato warns, would prefer to return to the cave. The philosopher who returns to describe what he saw will be mocked — or killed, as Socrates was.</p>`,
      },
      {
        position: [-3, -1, 2],
        title: 'The Divided Line',
        body: `<p>Plato divides all reality and knowledge into four levels, like a line split in two, then each half split again:</p>
        <p><strong>Images</strong> (shadows, reflections) → <strong>Visible Things</strong> (physical objects) → <strong>Mathematical Objects</strong> (numbers, geometric forms) → <strong>The Forms</strong> (the highest realities, grasped by pure intellect).</p>
        <p>Corresponding modes of mind: <em>Imagination → Belief → Thought → Understanding</em>. Philosophy is the ascent from bottom to top.</p>`,
      },
      {
        position: [3, -1, 2],
        title: 'The Philosopher King',
        body: `<p>In the <em>Republic</em>, Plato argues that cities will never be just until philosophers become rulers, or rulers become philosophers. Only those who have grasped the Form of the Good can govern wisely.</p>
        <p>This seems elitist — and it is. Plato had no faith in democracy (which, he noted, had executed Socrates). Rule by the ignorant majority is like leaving navigation to a ship of sailors who have never studied the stars.</p>
        <p>The philosopher must be compelled to return to the cave and serve — despite preferring the sunlit world of contemplation.</p>`,
      },
      {
        position: [0, 2, -4],
        title: 'Eros & the Ascent to Beauty',
        body: `<p>In the <em>Symposium</em>, Plato describes love (Eros) as a ladder. You begin by loving one beautiful body — but philosophy teaches you to love beautiful bodies in general, then beautiful souls, then beautiful actions, beautiful knowledge, until finally you glimpse Beauty Itself.</p>
        <p>This is Plato's vision of philosophical motivation: not cold logic, but a burning, erotic desire for the eternal. The philosopher is not a dispassionate reasoner but a lover — of wisdom, of the Good, of the Beautiful.</p>`,
      },
    ];

    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    this.forms.forEach((form, i) => {
      form.rotation.x = t * 0.28 + i * 0.9;
      form.rotation.y = t * 0.45 + i * 0.7;
      form.position.y = 4.5 + Math.sin(t * 0.45 + i) * 0.35;
      form.material.emissiveIntensity = 0.65 + 0.3 * Math.sin(t * 1.4 + i);
    });

    this.fireLight.intensity = 2.5 + Math.sin(t * 7.3) * 0.6 + Math.sin(t * 13.7) * 0.4;
    this.fireLight2.intensity = 2.0 + Math.sin(t * 8.1 + 1) * 0.5 + Math.sin(t * 11.3) * 0.3;

    if (this.flamePits) {
      this.flamePits.forEach(mat => { mat.uniforms.time.value = t; });
    }

    const pos = this.particleGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += this.particleDelays[i];
      if (pos.array[i * 3 + 1] > 6.5) {
        pos.array[i * 3 + 1] = -2;
        pos.array[i * 3]     = (Math.random() - 0.5) * 4;
        pos.array[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1.5;
      }
    }
    pos.needsUpdate = true;

    // Shadow puppets sway
    this.shadowMeshes.forEach((m, i) => {
      m.position.x = -1.8 + i * 1.8 + Math.sin(t * 0.7 + i) * 0.15;
      m.position.y = Math.sin(t * 0.5 + i * 1.3) * 0.1;
      m.rotation.z = Math.sin(t * 0.4 + i) * 0.08;
    });
  }
}
