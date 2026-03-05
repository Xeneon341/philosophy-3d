import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeWoodMaterial, makeCaveStoneMaterial } from '../shaders/materials.js';

export class AristotleWorld extends BaseWorld {
  _build() {
    this._buildGround();
    this._buildTaxonomyTrees();
    this._buildUnmovedMover();
    this._buildCelestialSpheres();
    this._buildParticles();
    this._buildHotspots();

    this._buildSky();

    const ambient = new THREE.AmbientLight(0x0a1808, 0.6);
    const sun = new THREE.DirectionalLight(0xffd080, 1.5);
    sun.position.set(5, 10, 5);
    sun.castShadow = true;
    this.group.add(ambient, sun);
  }

  _buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        void main(){
          float h = vDir.y * 0.5 + 0.5;
          vec3 horizon = vec3(0.55, 0.38, 0.18);
          vec3 zenith  = vec3(0.15, 0.30, 0.55);
          vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.6, h));
          // Sun disc
          vec3 sunDir = normalize(vec3(0.5, 0.8, 0.4));
          float sunDot = dot(normalize(vDir), sunDir);
          col += vec3(1.0, 0.95, 0.7) * smoothstep(0.998, 1.0, sunDot);
          col += vec3(0.8, 0.5, 0.1) * smoothstep(0.97, 0.998, sunDot) * 0.3;
          // Ground haze
          col = mix(vec3(0.40, 0.35, 0.20), col, smoothstep(-0.1, 0.15, vDir.y));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(28, 32, 16), this.skyMat));
  }

  _buildGround() {
    // Procedural earth/grass ground — subdivided for micro-displacement
    const geo = new THREE.PlaneGeometry(30, 30, 80, 80);

    // Displace vertices to break up flatness
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.8) * Math.cos(z * 0.6) * 0.08
              + Math.sin(x * 2.1 + z * 1.7) * 0.04
              + (Math.random() - 0.5) * 0.06;
      pos.setZ(i, n); // PlaneGeometry lies in XY, Z is up before rotation
    }
    geo.computeVertexNormals();

    const groundMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                     mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.2;a*=0.5;} return v; }

        void main() {
          vec2 uv = vWorldPos.xz * 0.4;
          float n = fbm(uv);
          float n2 = fbm(uv * 3.0 + 7.3);
          float stones = smoothstep(0.72, 0.78, n2); // occasional stone patches

          // Grass base with variation
          vec3 grass1 = vec3(0.18, 0.28, 0.08);
          vec3 grass2 = vec3(0.12, 0.20, 0.05);
          vec3 dirt    = vec3(0.28, 0.18, 0.08);
          vec3 stone   = vec3(0.35, 0.32, 0.28);

          vec3 col = mix(grass1, grass2, n);
          col = mix(col, dirt,  smoothstep(0.45, 0.55, fbm(uv * 0.7)));
          col = mix(col, stone, stones);

          // Diffuse lighting from sun direction
          vec3 sunDir = normalize(vec3(0.5, 0.8, 0.4));
          float diff = max(dot(vNormal, sunDir), 0.0) * 0.7 + 0.3;
          col *= diff;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.groundMat = groundMat;

    const floor = new THREE.Mesh(geo, groundMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Golden ratio spiral etched into ground as glowing line
    const spiralPts = [];
    for (let i = 0; i < 300; i++) {
      const angle = i * 0.1;
      const r = 0.05 * Math.pow(1.618, angle / (2 * Math.PI));
      spiralPts.push(new THREE.Vector3(Math.cos(angle) * r, -1.97, Math.sin(angle) * r));
    }
    const spiralGeo = new THREE.BufferGeometry().setFromPoints(spiralPts);
    const spiralMat = new THREE.LineBasicMaterial({ color: 0xd4a84e, transparent: true, opacity: 0.45 });
    this.group.add(new THREE.Line(spiralGeo, spiralMat));

    // Scattered pebbles
    const pebbleMat = makeCaveStoneMaterial();
    for (let i = 0; i < 40; i++) {
      const px = (Math.random() - 0.5) * 20;
      const pz = (Math.random() - 0.5) * 20;
      const ps = 0.04 + Math.random() * 0.12;
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(ps, 0), pebbleMat);
      p.position.set(px, -1.98 + ps * 0.3, pz);
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.group.add(p);
    }
  }

  _buildTaxonomyTrees() {
    this.treeBranches = [];
    const TREES = [
      { x: -3, z: -2, label: 'Substance' },
      { x: 3, z: -3, label: 'Quality' },
      { x: 0, z: -5, label: 'Quantity' },
    ];

    TREES.forEach(({ x, z }) => {
      this._buildTree(x, z);
    });
  }

  _buildTree(x, z) {
    const trunkMat = makeWoodMaterial();
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3a8a30,
      emissive: 0x1a4010,
      emissiveIntensity: 0.2,
      roughness: 0.8,
    });

    const buildBranch = (parent, depth, pos, dir, width) => {
      if (depth === 0) return;
      const length = 0.8 - depth * 0.15;
      const geo = new THREE.CylinderGeometry(width * 0.5, width, length, 5);
      const mesh = new THREE.Mesh(geo, trunkMat.clone());

      const localPos = pos.clone();
      const end = localPos.clone().add(dir.clone().multiplyScalar(length));
      const mid = localPos.clone().lerp(end, 0.5);
      mesh.position.copy(mid);

      // Orient cylinder along dir
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      this.group.add(mesh);
      this.treeBranches.push(mesh);

      // Branch nodes (leaf spheres at terminals)
      if (depth === 1) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), leafMat.clone());
        leaf.position.copy(end);
        this.group.add(leaf);
        this.treeBranches.push(leaf);
      }

      // Sub-branches
      const leftDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 0.5);
      const rightDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 0.5 + 0.5);
      buildBranch(mesh, depth - 1, end, leftDir, width * 0.65);
      buildBranch(mesh, depth - 1, end, rightDir, width * 0.65);
    };

    buildBranch(null, 4, new THREE.Vector3(x, -2, z), new THREE.Vector3(0, 1, 0), 0.1);
  }

  _buildUnmovedMover() {
    // The Unmoved Mover — a rotating plasma/bronze orb with surface energy
    const geo = new THREE.SphereGeometry(0.6, 64, 32);
    this.unmovedMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vPos;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main() {
          vNormal = normalize(normalMatrix * normal);
          // Surface turbulence displacement
          float n = noise(position * 3.5 + time * 0.25) * 0.5
                  + noise(position * 7.0 - time * 0.15) * 0.25
                  + noise(position * 14.0 + time * 0.4) * 0.125;
          float disp = 0.06 * (n - 0.4);
          vec3 displaced = position + normal * disp;
          vPos = displaced;
          vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vPos;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main() {
          vec3 view = normalize(cameraPosition - vWorldPos);
          float rim  = pow(1.0 - max(dot(vNormal, view), 0.0), 2.5);

          // Latitude bands (like a gas giant) — derived from Y position on sphere
          float lat = vPos.y / 0.6; // -1 to 1
          float band = sin(lat * 8.0 + time * 0.4) * 0.5 + 0.5;
          float band2= sin(lat * 20.0 - time * 0.7) * 0.5 + 0.5;

          // Surface noise for cloud-like turbulence
          float n = noise(vPos * 4.0 + time * 0.2) * 0.6
                  + noise(vPos * 9.0 - time * 0.1) * 0.3
                  + noise(vPos * 18.0 + time * 0.35) * 0.1;

          // Colour palette: deep bronze → bright gold → white hot
          vec3 deep   = vec3(0.30, 0.12, 0.02);
          vec3 bronze = vec3(0.75, 0.40, 0.05);
          vec3 gold   = vec3(1.00, 0.75, 0.20);
          vec3 white  = vec3(1.00, 0.95, 0.80);

          vec3 col = mix(deep, bronze, band);
          col = mix(col, gold, band2 * n);
          col += white * rim * (0.6 + 0.3 * sin(time * 2.1));
          col += gold * n * 0.3;

          // Hot spot at "north pole" — the unmoved draws everything
          float pole = smoothstep(0.7, 1.0, vPos.y / 0.6 * 0.5 + 0.5);
          col += vec3(1.0, 0.9, 0.5) * pole * 0.8;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.unmoved = new THREE.Mesh(geo, this.unmovedMat);
    this.unmoved.position.set(0, 1, 0);
    this.group.add(this.unmoved);

    // Corona — outer glow shell
    const coronaGeo = new THREE.SphereGeometry(0.85, 32, 16);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xc87020,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    corona.position.copy(this.unmoved.position);
    this.group.add(corona);
    this.corona = corona;

    // Flare rings around the mover
    this.flareRings = [];
    [0.9, 1.1, 1.35].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.015, 6, 64),
        new THREE.MeshBasicMaterial({ color: 0xd4900a, transparent: true, opacity: 0.25 - i * 0.06, depthWrite: false })
      );
      ring.position.copy(this.unmoved.position);
      ring.rotation.x = Math.PI / 2 + i * 0.4;
      this.group.add(ring);
      this.flareRings.push(ring);
    });

    const light = new THREE.PointLight(0xd4900a, 3.5, 14);
    light.position.copy(this.unmoved.position);
    this.group.add(light);
    this.unmovedLight = light;
  }

  _buildCelestialSpheres() {
    this.spheres = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const r = 2.5 + i * 0.8;
      const geo = new THREE.TorusGeometry(r, 0.02, 6, 60);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc8a96e,
        transparent: true,
        opacity: 0.15 - i * 0.02,
      });
      const torus = new THREE.Mesh(geo, mat);
      torus.rotation.x = (i / count) * Math.PI / 2;
      torus.rotation.y = (i / count) * Math.PI / 3;
      this.group.add(torus);
      this.spheres.push(torus);
    }
  }

  _buildParticles() {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x80c840,
      size: 0.04,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, 1.8, 0],
        title: 'The Unmoved Mover',
        body: `<p>At the summit of Aristotle's cosmology stands the Unmoved Mover — a being of pure thought, thinking only itself, that moves the universe without itself being moved.</p>
        <p>It is not a creator god who made the world, but more like a final cause — the universe strives toward it as a lover strives toward the beloved. It attracts without acting. It is the ultimate explanation for why there is motion and change at all.</p>
        <p>This idea profoundly influenced medieval Islamic and Christian theology — Avicenna and Aquinas both adopted it as the philosophical foundation for the existence of God.</p>`,
      },
      {
        position: [-3, 1, -2],
        title: 'The Four Causes',
        body: `<p>To truly understand anything, Aristotle says you must answer four questions — the four causes:</p>
        <p><strong>Material Cause</strong>: What is it made of? (marble)<br>
        <strong>Formal Cause</strong>: What pattern or form does it have? (the statue's shape)<br>
        <strong>Efficient Cause</strong>: What made it? (the sculptor)<br>
        <strong>Final Cause</strong>: What is it for? (to honor a god)</p>
        <p>Modern science mostly uses only efficient causes. Aristotle thought this impoverished — you don't understand an acorn until you see it as tending toward an oak tree.</p>`,
      },
      {
        position: [3, 0, -3],
        title: 'Virtue Ethics & Eudaimonia',
        body: `<p>Aristotle's ethics begins with a simple question: what is the highest good? His answer: <em>eudaimonia</em> — usually translated "happiness" but closer to "human flourishing."</p>
        <p>Eudaimonia is not a feeling but an activity — the excellent exercise of our distinctively human capacities, especially reason. Virtue (<em>arete</em>) is the stable disposition to act excellently.</p>
        <p>Virtues are acquired through practice. Courage is not a gift but a habit. You become just by doing just acts. Character is destiny — but character is made, not born.</p>`,
      },
      {
        position: [0, 3.5, 0],
        title: 'The Celestial Spheres',
        body: `<p>Aristotle's cosmos consisted of nested crystalline spheres carrying the planets, Sun, and Moon around a stationary Earth. The outermost sphere — the primum mobile — was set in motion by the Unmoved Mover and transmitted motion inward.</p>
        <p>The sublunary world (below the Moon) was composed of the four elements — earth, water, fire, air — all subject to change and decay. The superlunary world was made of a fifth element, the <em>aether</em>, eternal and unchanging.</p>
        <p>This cosmology dominated Western and Islamic science for nearly 2,000 years, until Copernicus, Galileo, and Newton dismantled it.</p>`,
      },
      {
        position: [0, -1.5, 4],
        title: 'Logic: The Organon',
        body: `<p>Aristotle invented formal logic — essentially from scratch. His <em>Organon</em> ("instrument") laid out syllogistic reasoning: if all men are mortal, and Socrates is a man, then Socrates is mortal.</p>
        <p>He identified the three laws of thought: identity (A is A), non-contradiction (nothing can be both A and not-A), and excluded middle (everything is either A or not-A).</p>
        <p>Kant called Aristotle's logic complete — nothing had been added or removed in 2,000 years. He was almost right. It took until the 19th century for Frege to go further.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    // Rotate celestial spheres at different speeds
    this.spheres.forEach((s, i) => {
      s.rotation.y = t * (0.05 + i * 0.03);
      s.rotation.x = t * (0.03 + i * 0.02) + i * 0.5;
    });

    // Unmoved Mover — shader animates, body doesn't rotate (unmoved!), but flares do
    this.unmovedMat.uniforms.time.value = t;
    this.unmovedLight.intensity = 3.0 + 0.8 * Math.sin(t * 0.8);
    this.corona.material.opacity = 0.06 + 0.04 * Math.sin(t * 1.2);
    this.flareRings.forEach((ring, i) => {
      ring.rotation.y = t * (0.3 + i * 0.15);
      ring.rotation.z = t * (0.2 - i * 0.08);
      ring.material.opacity = (0.25 - i * 0.06) * (0.7 + 0.3 * Math.sin(t * 2 + i));
    });

    if (this.skyMat) this.skyMat.uniforms.time.value = t;

    // Leaves shimmer (only leaf spheres have emissive — trunks use ShaderMaterial)
    this.treeBranches.forEach((b, i) => {
      if (b.material.isMeshStandardMaterial && b.material.emissive) {
        b.material.emissiveIntensity = 0.1 + 0.1 * Math.sin(t * 0.5 + i * 0.3);
      }
    });
  }
}
