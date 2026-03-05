import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';

// Layout:
//   Centre (0,0,0)  : Inspection tower — the unseen watcher
//   r=6.5 ring      : Circular cell block — the watched subjects
//   z=-8.8 wall     : Archive — knowledge/power documents
//   Outer wall r=9  : Institutional perimeter, crack at z=+9

export class FoucaultWorld extends BaseWorld {
  _build() {
    // Build shared concrete material once — reused across all geometry
    this._concreteMat = this._makeConcreteMat();

    this._buildSky();
    this._buildFloor();
    this._buildTower();
    this._buildCellRing();
    this._buildArchiveWall();
    this._buildOuterWall();
    this._buildPowerGrid();
    this._buildDocumentDrift();
    this._buildHotspots();

    // ── LIGHTING ──────────────────────────────────────────────────────────────
    // Institutional cold light — bright enough to read the concrete
    const ambient = new THREE.AmbientLight(0x9aa8bc, 1.4);

    // Strong overhead fill simulating fluorescent ceiling lights
    const fluoro1 = new THREE.DirectionalLight(0xa0b0c8, 1.2);
    fluoro1.position.set(0, 10, 0);
    const fluoro2 = new THREE.DirectionalLight(0x8090a8, 0.6);
    fluoro2.position.set(5, 8, 5);
    const fluoro3 = new THREE.DirectionalLight(0x8090a8, 0.6);
    fluoro3.position.set(-5, 8, -5);

    // Tower interior glow
    this.towerLight = new THREE.PointLight(0xc8d8f0, 3.5, 18);
    this.towerLight.position.set(0, 4, 0);

    // Extra fill lights around the ring so cells are visible
    [0, 1, 2, 3].forEach(i => {
      const a = (i / 4) * Math.PI * 2;
      const fl = new THREE.PointLight(0x9aaac0, 1.5, 12);
      fl.position.set(Math.cos(a) * 3, 3, Math.sin(a) * 3);
      this.group.add(fl);
    });

    this.searchlight = new THREE.SpotLight(0xdde8ff, 5.0, 22, Math.PI / 12, 0.25, 1.0);
    this.searchlight.position.set(0, 7, 0);
    this.searchlightTarget = new THREE.Object3D();
    this.searchlightTarget.position.set(8.5, 0, 0);
    this.group.add(this.searchlightTarget);
    this.searchlight.target = this.searchlightTarget;

    this.archiveLight = new THREE.PointLight(0xffa020, 2.5, 14);
    this.archiveLight.position.set(0, 2, -9.5);

    this.group.add(ambient, fluoro1, fluoro2, fluoro3, this.towerLight, this.searchlight, this.archiveLight);
  }

  _makeConcreteMat() {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
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
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        void main(){
          vec2 uv = vWorldPos.xz * 0.4 + vWorldPos.xy * 0.3;
          float n1 = noise(uv * 1.1);
          float n2 = noise(uv * 3.7 + 1.3);
          float n3 = noise(uv * 9.2 + 5.7);
          vec3 col = vec3(0.18, 0.19, 0.21);
          col = mix(col, vec3(0.24, 0.25, 0.27), n1 * 0.5);
          col = mix(col, vec3(0.13, 0.14, 0.15), n2 * 0.3);
          float stain = smoothstep(0.72, 0.75, noise(vec2(vWorldPos.x * 0.8, vWorldPos.y * 0.15)));
          col = mix(col, vec3(0.10, 0.11, 0.13), stain * 0.5);
          col += (n3 - 0.5) * 0.03;
          float diff = max(dot(vNormal, normalize(vec3(0.3, 1.0, 0.5))), 0.0) * 0.3 + 0.7;
          col *= diff;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }

  _buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        void main(){
          float h = vDir.y * 0.5 + 0.5;
          vec3 col = mix(vec3(0.28, 0.30, 0.34), vec3(0.06, 0.07, 0.09), h);
          float cloud = noise(vDir.xz * 2.0 + time * 0.01);
          col += vec3(0.04) * cloud * (1.0 - h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(22, 24, 12), this.skyMat));
  }

  _buildFloor() {
    // Use ShaderMaterial with baked-in concrete colour + grid lines
    // so lighting doesn't affect it — floor is always readable
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main(){
          vUv = uv;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        void main(){
          // Cold concrete base — visible mid-grey
          float n = noise(vWorldPos.xz * 0.6) * 0.5 + noise(vWorldPos.xz * 2.1) * 0.3;
          vec3 col = vec3(0.18, 0.19, 0.21) + n * 0.06;
          // Subtle tile/slab lines
          float gx = step(0.97, fract(vWorldPos.x * 0.5));
          float gz = step(0.97, fract(vWorldPos.z * 0.5));
          col = mix(col, vec3(0.12, 0.13, 0.14), max(gx, gz) * 0.6);
          // Radial darkening toward edges — vignette
          float r = length(vWorldPos.xz) / 13.0;
          col *= 1.0 - r * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(13, 64, 0, Math.PI * 2), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.group.add(floor);
  }

  _buildTower() {
    const concMat = this._concreteMat;

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 12), concMat);
    plinth.position.y = 0.2;
    this.group.add(plinth);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 8, 12), concMat);
    shaft.position.y = 4.4;
    this.group.add(shaft);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 0.5, 12), concMat);
    deck.position.y = 7.5;
    this.group.add(deck);

    this.windowMeshes = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const slitMat = new THREE.MeshBasicMaterial({ color: 0xc8d8ff, transparent: true, opacity: 0.7 });
      const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.35), slitMat);
      slit.position.set(Math.cos(angle) * 1.15, 7.55, Math.sin(angle) * 1.15);
      slit.rotation.y = -angle;
      this.group.add(slit);
      this.windowMeshes.push({ mat: slitMat });
    }

    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.2, 12), concMat);
    cap.position.y = 8.4;
    this.group.add(cap);

    const beamMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying float vH; void main(){ vH=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; varying float vH;
        void main(){
          float alpha = (1.0 - vH) * 0.06 * (0.9 + 0.1 * sin(time * 3.0 + vH * 5.0));
          gl_FragColor = vec4(0.85, 0.90, 1.0, alpha);
        }
      `,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beamMat = beamMat;
    this.searchlightBeam = new THREE.Mesh(new THREE.ConeGeometry(0.15, 8, 8, 1, true), beamMat);
    this.searchlightBeam.position.y = 3.5;
    this.group.add(this.searchlightBeam);
  }

  _box(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  _buildCellRing() {
    const concMat = this._concreteMat;
    const CELLS = 12;
    const RING_R = 8.5;
    this.cells = [];

    for (let i = 0; i < CELLS; i++) {
      const angle = (i / CELLS) * Math.PI * 2;
      const cx = Math.cos(angle) * RING_R;
      const cz = Math.sin(angle) * RING_R;
      const cellGroup = new THREE.Group();
      cellGroup.position.set(cx, 0, cz);
      cellGroup.rotation.y = -angle + Math.PI;

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.5, 3, 4), concMat);
      backWall.position.z = -1.0;
      cellGroup.add(backWall);

      [-1.0, 1.0].forEach(sx => {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.5, 2, 4), concMat);
        sw.rotation.y = Math.PI / 2;
        sw.position.x = sx;
        cellGroup.add(sw);
      });

      const cf = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), concMat);
      cf.rotation.x = -Math.PI / 2;
      cf.position.y = 0.01;
      cellGroup.add(cf);

      const barMat = new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.8, metalness: 0.6 });
      for (let b = -1; b <= 1; b++) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.0, 5), barMat);
        bar.position.set(b * 0.45, 2.0, 0.02);
        cellGroup.add(bar);
      }

      const figMat = new THREE.MeshStandardMaterial({
        color: 0x0d0f11, roughness: 1.0,
        emissive: 0x060810, emissiveIntensity: 0.15,
      });
      const figGroup = new THREE.Group();
      const torso = this._box(0, 1.0, -0.5, 0.22, 0.55, 0.16, figMat);
      figGroup.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), figMat);
      head.position.set(0, 1.65, -0.5);
      figGroup.add(head);
      figGroup.add(this._box(-0.32, 1.0, -0.5, 0.08, 0.42, 0.1, figMat));
      figGroup.add(this._box( 0.32, 1.0, -0.5, 0.08, 0.42, 0.1, figMat));
      figGroup.add(this._box(-0.1, 0.3, -0.5, 0.1, 0.5, 0.1, figMat));
      figGroup.add(this._box( 0.1, 0.3, -0.5, 0.1, 0.5, 0.1, figMat));
      // Store head for looking-around animation
      figGroup.userData.head = head;
      figGroup.userData.phase = Math.random() * Math.PI * 2;
      cellGroup.add(figGroup);

      this.group.add(cellGroup);
      this.cells.push({ group: cellGroup, angle, figMat, figGroup, cx, cz });
    }

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(10.0, 10.0, 5.5, 36, 3, true), this._concreteMat);
    ring.position.y = 2.75;
    this.group.add(ring);
  }

  _buildArchiveWall() {
    const concMat = this._concreteMat;

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6, 5, 4), concMat);
    wall.position.set(0, 3.0, -10.8);
    this.group.add(wall);

    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.6, metalness: 0.4 });
    const handleMat  = new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.3, metalness: 0.8 });
    [-3.5, -1.2, 1.2, 3.5].forEach(cx => {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.7), cabinetMat);
      cab.position.set(cx, 1.1, -10.2);
      this.group.add(cab);
      [0.5, -0.1, -0.7].forEach(dy => {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.65), cabinetMat);
        seam.position.set(cx, 1.1 + dy, -10.2);
        this.group.add(seam);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), handleMat);
        handle.position.set(cx, 1.1 + dy, -9.87);
        this.group.add(handle);
      });
    });

    this.docMeshes = [];
    const docPositions = [
      [-3.5, 4.5], [-1.8, 3.8], [0.2, 4.8], [2.1, 3.5], [3.8, 4.2],
      [-2.6, 2.8], [0.8, 2.5], [-4.0, 2.2], [4.2, 2.8], [1.5, 4.0],
    ];
    docPositions.forEach(([dx, dy]) => {
      const docMat = new THREE.ShaderMaterial({
        uniforms: {
          time:   { value: 0 },
          offset: { value: Math.random() * Math.PI * 2 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          uniform float time; uniform float offset;
          varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
          void main(){
            float line   = step(0.88, sin(vUv.y * 28.0));
            float redact = step(0.6, hash(floor(vUv * vec2(3.0, 8.0))));
            float pulse  = 0.6 + 0.4 * sin(time * 0.4 + offset);
            vec3 col = vec3(0.08, 0.09, 0.07);
            col += vec3(0.55, 0.45, 0.10) * line * (1.0 - redact) * pulse;
            col += vec3(0.04, 0.05, 0.04) * redact;
            float alpha = 0.75 + 0.15 * sin(time * 0.3 + offset);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const w = 0.5 + Math.random() * 0.4;
      const h = 0.65 + Math.random() * 0.3;
      const doc = new THREE.Mesh(new THREE.PlaneGeometry(w, h), docMat);
      doc.position.set(dx, dy, -10.7);
      doc.rotation.z = (Math.random() - 0.5) * 0.3;
      this.group.add(doc);
      this.docMeshes.push(docMat);
    });
  }

  _buildOuterWall() {
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.5, 5.0, 40, 2, true), this._concreteMat);
    outer.position.y = 2.5;
    this.group.add(outer);

    this.crackMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        void main(){
          float cx = vUv.x - 0.5;
          float waver = hash(vec2(floor(vUv.y * 12.0), 0.0)) * 0.15 - 0.075;
          float crack = smoothstep(0.04, 0.0, abs(cx - waver * sin(vUv.y * 8.0)));
          float warmth = 0.8 + 0.2 * sin(time * 0.6 + vUv.y * 3.0);
          vec3 col = mix(vec3(1.0, 0.75, 0.3), vec3(1.0, 0.92, 0.6), vUv.y) * warmth;
          gl_FragColor = vec4(col, crack * 0.9);
        }
      `,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3.5, 2, 12), this.crackMat);
    crack.position.set(0, 1.75, 11.4);
    this.group.add(crack);

    this.crackLight = new THREE.PointLight(0xffa040, 1.5, 5);
    this.crackLight.position.set(0, 1.5, 11.2);
    this.group.add(this.crackLight);
  }

  _buildPowerGrid() {
    this.gridMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float linePos;
        varying float vPos;
        void main(){ vPos=linePos; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform float time; varying float vPos;
        void main(){
          float pulse = sin(vPos * 6.0 - time * 2.5) * 0.5 + 0.5;
          gl_FragColor = vec4(0.9, 0.55, 0.1, pulse * 0.35);
        }
      `,
      transparent: true, depthWrite: false,
    });

    // All spokes merged into one LineSegments draw call
    const spokePts = [];
    const spokeLp  = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      spokePts.push(new THREE.Vector3(0, 0.05, 0));
      spokePts.push(new THREE.Vector3(Math.cos(angle) * 11.0, 0.05, Math.sin(angle) * 11.0));
      spokeLp.push(0, 1);
    }
    const spokeGeo = new THREE.BufferGeometry().setFromPoints(spokePts);
    spokeGeo.setAttribute('linePos', new THREE.Float32BufferAttribute(spokeLp, 1));
    this.group.add(new THREE.LineSegments(spokeGeo, this.gridMat));

    // All rings merged into one LineSegments draw call
    const ringPts = [];
    const ringLp  = [];
    [3.0, 6.0, 9.0].forEach(r => {
      const SEGS = 48;
      for (let i = 0; i < SEGS; i++) {
        const a0 = (i / SEGS) * Math.PI * 2;
        const a1 = ((i + 1) / SEGS) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a0) * r, 0.05, Math.sin(a0) * r));
        ringPts.push(new THREE.Vector3(Math.cos(a1) * r, 0.05, Math.sin(a1) * r));
        ringLp.push(r / 11.0, r / 11.0);
      }
    });
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    ringGeo.setAttribute('linePos', new THREE.Float32BufferAttribute(ringLp, 1));
    this.group.add(new THREE.LineSegments(ringGeo, this.gridMat));
  }

  _buildDocumentDrift() {
    const count = 120;
    const positions = new Float32Array(count * 3);
    const speeds    = new Float32Array(count);
    const phases    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = -8.5 - Math.random() * 2;
      speeds[i] = 0.003 + Math.random() * 0.004;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.driftGeo    = geo;
    this.driftSpeeds = speeds;
    this.driftPhases = phases;
    const mat = new THREE.PointsMaterial({
      color: 0xd4a820, size: 0.06, transparent: true, opacity: 0.55,
      depthWrite: false, sizeAttenuation: true,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, 8.5, 0],
        title: 'The Panopticon',
        body: `<p>Jeremy Bentham designed the Panopticon in 1791 — a circular prison where a single guard in a central tower could observe all inmates at once, without them knowing when they were being watched.</p>
        <p>Foucault seized on it as the perfect diagram of modern power. The genius is that you don't need to actually watch everyone — you only need them to <em>believe</em> they might be watched. The prisoner disciplines herself. The watcher becomes unnecessary.</p>
        <p>"He who is subjected to a field of visibility, and who knows it, assumes responsibility for the constraints of power; he makes them play spontaneously upon himself." This is how modern institutions work — schools, hospitals, offices, social media.</p>`,
      },
      {
        position: [5.5, 3.5, 0],
        title: 'Discipline & Punish',
        body: `<p>Published in 1975, <em>Discipline and Punish</em> traces the shift from public torture to the modern prison — from power that operated on the body through spectacle, to power that operates through constant surveillance and normalisation.</p>
        <p>Foucault's insight: the prison didn't fail — it succeeded perfectly. It produces delinquents who can then be monitored, classified, and controlled. The goal was never rehabilitation.</p>
        <p>Discipline works through three instruments: hierarchical observation (always being watched), normalising judgment (measured against a norm), and the examination (combining both into a permanent record). You are your file.</p>`,
      },
      {
        position: [0, 3.5, -7.5],
        title: 'Power / Knowledge',
        body: `<p>Foucault's most radical claim: knowledge and power are not opposites — they are the same thing. Every system of knowledge produces a regime of power; every exercise of power produces knowledge.</p>
        <p>The doctor's gaze, the psychiatrist's diagnosis, the criminologist's report — these are not neutral descriptions of reality. They create the very categories (the madman, the criminal, the pervert) that they claim to merely observe.</p>
        <p>"Truth is a thing of this world: it is produced only by virtue of multiple forms of constraint. And it induces regular effects of power." There is no view from nowhere. Every truth claim is also a power claim.</p>`,
      },
      {
        position: [0, 2.5, 9.5],
        title: 'Resistance',
        body: `<p>If power is everywhere, is resistance possible? Foucault insisted yes — "where there is power, there is resistance." Power is not a thing possessed by rulers; it is a relation, and relations can be reversed, subverted, escaped.</p>
        <p>The crack in the wall is not the end of the institution — it is the reminder that no system of power is total. Every norm produces its transgressor. Every classification produces someone who refuses to be classified.</p>
        <p>In his later work Foucault turned to "care of the self" — the ancient Greek practice of working on oneself as a form of freedom. Not escape from power, but the creation of oneself as a work of art, on one's own terms.</p>`,
      },
      {
        position: [-5.5, 3.5, 0],
        title: 'The Birth of the Clinic',
        body: `<p>In <em>The Birth of the Clinic</em> (1963), Foucault examined how the medical gaze — the doctor's way of seeing and speaking about the body — was invented in the late 18th century.</p>
        <p>Before this, illness was a pattern of symptoms narrated by the patient. Afterwards, disease became a lesion in the body, revealed by dissection and the clinic's systematic examination. The patient's experience became secondary to the doctor's gaze.</p>
        <p>This is the template for all modern institutions: the school transforms the student into measurable competencies; the psychiatric hospital transforms distress into a diagnosable disorder. The examined subject becomes knowable — and therefore governable.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    // Searchlight sweeps cell ring
    const sweepAngle = t * 0.4;
    const sx = Math.cos(sweepAngle) * 8.5;
    const sz = Math.sin(sweepAngle) * 8.5;
    this.searchlightTarget.position.set(sx, 0, sz);
    if (this.searchlightBeam) {
      this.searchlightBeam.rotation.y = -sweepAngle;
      this.searchlightBeam.position.set(Math.cos(sweepAngle) * 0.5, 3.5, Math.sin(sweepAngle) * 0.5);
    }
    if (this.beamMat) this.beamMat.uniforms.time.value = t;

    // Prisoners light up when searchlight hits them — heads turn to tower
    this.cells.forEach(({ figMat, figGroup, cx, cz }) => {
      const dist = Math.sqrt((cx - sx) ** 2 + (cz - sz) ** 2);
      const lit = dist < 1.5;
      figMat.emissiveIntensity = lit ? 0.8 : 0.08 + 0.04 * Math.sin(t * 0.3);

      // Head subtly looks toward tower when lit, shifts nervously otherwise
      if (figGroup && figGroup.userData.head) {
        const h = figGroup.userData.head;
        const phase = figGroup.userData.phase;
        if (lit) {
          // Snap to look slightly toward tower (positive z in cell-local space)
          h.position.z = -0.5 + 0.12; // lean toward bars
          h.rotation.x = -0.25;
        } else {
          // Slow nervous shifting
          h.position.z = -0.5 + Math.sin(t * 0.3 + phase) * 0.04;
          h.rotation.x = Math.sin(t * 0.2 + phase) * 0.08;
          h.rotation.y = Math.sin(t * 0.15 + phase * 1.3) * 0.12;
        }
      }
    });

    // Tower windows flicker
    this.windowMeshes.forEach(({ mat }, i) => {
      mat.opacity = 0.5 + 0.35 * Math.sin(t * 1.8 + i * 0.7);
    });

    this.towerLight.intensity   = 2.2 + 0.4 * Math.sin(t * 2.3) + 0.2 * Math.sin(t * 7.1);
    this.archiveLight.intensity = 1.0 + 0.3 * Math.sin(t * 0.5);
    this.crackLight.intensity   = 1.2 + 0.4 * Math.sin(t * 0.7) + 0.2 * Math.sin(t * 2.1);

    if (this.crackMat) this.crackMat.uniforms.time.value = t;
    if (this.skyMat)   this.skyMat.uniforms.time.value   = t;
    if (this.gridMat)  this.gridMat.uniforms.time.value  = t;

    // Document particles drift upward from archive
    const pos = this.driftGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += this.driftSpeeds[i];
      pos.array[i * 3]     += Math.sin(t * 0.6 + this.driftPhases[i]) * 0.003;
      if (pos.array[i * 3 + 1] > 6.0) {
        pos.array[i * 3 + 1] = 0.1;
        pos.array[i * 3]     = (Math.random() - 0.5) * 10;
        pos.array[i * 3 + 2] = -8.5 - Math.random() * 2;
      }
    }
    pos.needsUpdate = true;

    this.docMeshes.forEach(m => { m.uniforms.time.value = t; });
  }
}
