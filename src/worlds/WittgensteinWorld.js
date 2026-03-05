import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';

export class WittgensteinWorld extends BaseWorld {
  _build() {
    this._buildFloor();
    this._buildTractatus();
    this._buildWall();
    this._buildSilence();
    this._buildInvestigations();
    this._buildHotspots();

    this._buildSky();
    const ambient = new THREE.AmbientLight(0x0a0a0a, 0.8);
    this.group.add(ambient);
  }

  _buildSky() {
    // Left side (Tractatus): cold clean void. Right side (Investigations): warm dark.
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        void main(){
          // Left (negative x) = cold logical white, right = warm amber
          float side = vDir.x * 0.5 + 0.5;
          vec3 cold = vec3(0.03, 0.03, 0.06);
          vec3 warm = vec3(0.06, 0.04, 0.02);
          vec3 col  = mix(cold, warm, side);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(18, 24, 12), this.skyMat));
  }

  _buildFloor() {
    // Single unified floor spanning both sides — cold on left (Tractatus), warm on right (Investigations)
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        void main(){
          float gx = step(0.97, fract(vW.x * 0.5 + 50.0));
          float gz = step(0.97, fract(vW.z * 0.5 + 50.0));
          float grid = max(gx, gz);

          // Blend: left = cold logic tile, right = warm wood
          float side = smoothstep(-1.5, 1.5, vW.x); // 0=Tractatus, 1=Investigations
          float n = noise(vW.xz * 0.8) * 0.4;

          vec3 coldBase = vec3(0.04, 0.04, 0.08);
          vec3 coldLine = vec3(0.20, 0.20, 0.30);
          vec3 warmBase = vec3(0.16, 0.10, 0.06) + n * 0.06;
          vec3 warmLine = vec3(0.08, 0.05, 0.03);

          vec3 coldCol = mix(coldBase, coldLine, grid * 0.7);
          vec3 warmCol = mix(warmBase, warmLine, grid * 0.5);
          vec3 col = mix(coldCol, warmCol, side);

          // Vignette
          float r = length(vW.xz) / 16.0;
          col *= 1.0 - r * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 24, 1, 1), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2, 0);
    this.group.add(floor);
  }

  _buildTractatus() {

    // Clean logical space: floating propositions as geometric nodes
    this.propositions = [];
    const PROPS = [
      { text: '1',   x: -4,   y: 3,   z: -1,  on: true,  size: 0.22 },
      { text: '1.1', x: -5.5, y: 1.8, z: -2,  on: true,  size: 0.15 },
      { text: '1.2', x: -2.8, y: 1.5, z: -2,  on: true,  size: 0.15 },
      { text: '2',   x: -4,   y: 0.5, z: -3,  on: true,  size: 0.20 },
      { text: '2.1', x: -5.5, y:-0.5, z: -3.5, on: true, size: 0.13 },
      { text: '2.2', x: -4,   y:-0.8, z: -4,  on: true,  size: 0.13 },
      { text: '3',   x: -2.5, y:-0.2, z: -2.5, on: true, size: 0.18 },
      { text: '6',   x: -3,   y:-1.5, z: -1.5, on: true, size: 0.16 },
      { text: '6.5', x: -2,   y:-1.8, z: -0.8, on: true, size: 0.14 },
      { text: '7',   x: -1.5, y:-2.2, z: -0.2, on: false, size: 0.18 }, // silence — dark
    ];

    const onMat = new THREE.MeshStandardMaterial({
      color: 0xdde8ff,
      emissive: 0x8899cc,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.1,
    });
    const offMat = new THREE.MeshStandardMaterial({
      color: 0x080808,
      roughness: 0.9,
      transparent: true,
      opacity: 0.25,
    });

    PROPS.forEach(({ x, y, z, on, size }) => {
      const geo = new THREE.OctahedronGeometry(size, 0);
      const mesh = new THREE.Mesh(geo, on ? onMat.clone() : offMat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      this.propositions.push({ mesh, on });

      // Glow halo on active nodes
      if (on) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(size * 2.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x4466bb, transparent: true, opacity: 0.04, side: THREE.BackSide, depthWrite: false })
        );
        halo.position.copy(mesh.position);
        this.group.add(halo);
      }
    });

    // Logic tree lines — hierarchical connectors
    const logicMat = new THREE.LineBasicMaterial({ color: 0x8899cc, transparent: true, opacity: 0.35 });
    const connections = [[0,1],[0,2],[3,4],[3,5],[0,3],[3,6],[7,8],[6,7]];
    connections.forEach(([a, b]) => {
      if (!PROPS[a] || !PROPS[b]) return;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(PROPS[a].x, PROPS[a].y, PROPS[a].z),
        new THREE.Vector3(PROPS[b].x, PROPS[b].y, PROPS[b].z),
      ]);
      this.group.add(new THREE.Line(geo, logicMat));
    });

    // Cold overhead light on Tractatus side
    const tractLight = new THREE.PointLight(0x8899dd, 1.8, 12);
    tractLight.position.set(-4, 4, -2);
    this.group.add(tractLight);
  }

  _buildWall() {
    // The wall — limit of language, glowing seam (thin plane with animated edge glow)
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          float pulse = 0.5 + 0.5 * sin(time * 0.8 + vUv.y * 4.0);
          vec3 cold = vec3(0.55, 0.55, 0.65);
          vec3 glow = vec3(0.80, 0.85, 1.00);
          vec3 col = mix(cold * 0.3, glow, edge * pulse * 0.6);
          gl_FragColor = vec4(col, 0.55 + edge * 0.25);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.wallMat = mat;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 10, 2, 20), mat);
    wall.position.set(0.5, 0, -1);
    wall.rotation.y = Math.PI / 2;
    this.group.add(wall);

    // Inscription glow
    const light = new THREE.PointLight(0xffffff, 0.5, 4);
    light.position.set(0.5, 0, -1);
    this.group.add(light);
    this.wallLight = light;
  }

  _buildSilence() {
    // Whereof one cannot speak — represented by deep darkness on the Tractatus side.
    // No geometry needed; the dark sky dome + absence of light handles it.
  }

  _buildInvestigations() {
    // Floor y = -2. Post height 2.2 → center at y = -2 + 1.1 = -0.9, top at y = 0.1
    const FLOOR_Y = -2;
    const POST_H  = 2.2;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.9 });

    // Market stalls spread out in front of the camera (positive z) on the right side (positive x)
    [
      [2.0, -3.0], [4.5, -2.0], [2.5, -5.5], [5.5, -4.5],
    ].forEach(([sx, sz]) => {
      [[0,0],[1.6,0],[0,1.6],[1.6,1.6]].forEach(([dx,dz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, POST_H, 5), woodMat);
        post.position.set(sx + dx, FLOOR_Y + POST_H / 2, sz + dz);
        this.group.add(post);
      });
      // Horizontal crossbars at top of posts
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.06), woodMat);
      bar1.position.set(sx + 0.8, FLOOR_Y + POST_H - 0.05, sz);
      this.group.add(bar1);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.06), woodMat);
      bar2.position.set(sx + 0.8, FLOOR_Y + POST_H - 0.05, sz + 1.6);
      this.group.add(bar2);
      const bar3 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), woodMat);
      bar3.position.set(sx, FLOOR_Y + POST_H - 0.05, sz + 0.8);
      this.group.add(bar3);
      const bar4 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), woodMat);
      bar4.position.set(sx + 1.6, FLOOR_Y + POST_H - 0.05, sz + 0.8);
      this.group.add(bar4);
    });

    // Language-game objects sitting on the floor
    this.toolMeshes = [];
    const TOOLS = [
      { geo: new THREE.BoxGeometry(0.28, 0.08, 0.4),       color: 0xc87840, emissive: 0x603010, pos: [2.5,  FLOOR_Y+0.04, -3.4], r: 0.85, m: 0 },
      { geo: new THREE.BoxGeometry(0.22, 0.06, 0.32),      color: 0xb06030, emissive: 0x502010, pos: [2.9,  FLOOR_Y+0.03, -3.1], r: 0.85, m: 0 },
      { geo: new THREE.CylinderGeometry(0.04,0.04,0.45,6), color: 0x8060a0, emissive: 0x301030, pos: [4.8,  FLOOR_Y+0.22, -2.4], r: 0.6,  m: 0.1 },
      { geo: new THREE.SphereGeometry(0.14, 8, 8),         color: 0x60a860, emissive: 0x103010, pos: [3.8,  FLOOR_Y+0.14, -3.0], r: 0.5,  m: 0 },
      { geo: new THREE.ConeGeometry(0.09, 0.28, 6),        color: 0xd04040, emissive: 0x501010, pos: [5.0,  FLOOR_Y+0.14, -5.0], r: 0.7,  m: 0.2 },
      { geo: new THREE.BoxGeometry(0.18, 0.18, 0.18),      color: 0xd0a020, emissive: 0x604000, pos: [3.2,  FLOOR_Y+0.09, -5.2], r: 0.6,  m: 0.3 },
      { geo: new THREE.CylinderGeometry(0.12,0.12,0.06,12),color: 0x608080, emissive: 0x203030, pos: [4.4,  FLOOR_Y+0.03, -4.5], r: 0.7,  m: 0.4 },
      { geo: new THREE.BoxGeometry(0.35, 0.04, 0.25),      color: 0xa06040, emissive: 0x402010, pos: [6.0,  FLOOR_Y+0.02, -3.5], r: 0.9,  m: 0 },
    ];

    TOOLS.forEach(({ geo, color, emissive, pos, r, m }) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.3, roughness: r, metalness: m }));
      mesh.position.set(...pos);
      mesh.rotation.y = Math.random() * Math.PI;
      this.group.add(mesh);
      this.toolMeshes.push(mesh);
    });

    // Family resemblance Venn spheres — hovering at eye level on Investigations side
    const vennColors  = [0xc87040, 0x7040c8, 0x40c870];
    const vennCenters = [[3.0, 1.0, -2.0], [4.2, 1.0, -2.0], [3.6, 1.0, -3.0]];
    this.vennSpheres = [];
    vennColors.forEach((color, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 14, 14),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.13, roughness: 0.5, side: THREE.DoubleSide, depthWrite: false })
      );
      mesh.position.set(...vennCenters[i]);
      this.group.add(mesh);
      this.vennSpheres.push(mesh);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.015, 6, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false })
      );
      ring.position.set(...vennCenters[i]);
      this.group.add(ring);
    });

    // Warm lanterns hanging from stall tops
    [[2.8, FLOOR_Y+POST_H+0.2, -2.8], [4.8, FLOOR_Y+POST_H+0.2, -3.8], [3.2, FLOOR_Y+POST_H+0.2, -5.8]].forEach(([lx, ly, lz]) => {
      const pl = new THREE.PointLight(0xffaa50, 1.4, 7);
      pl.position.set(lx, ly - 0.5, lz);
      this.group.add(pl);
      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.18, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffcc60, transparent: true, opacity: 0.8 })
      );
      lantern.position.set(lx, ly - 0.5, lz);
      this.group.add(lantern);
      // Hanging wire
      const wirePts = [new THREE.Vector3(lx, ly, lz), new THREE.Vector3(lx, ly - 0.45, lz)];
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePts),
        new THREE.LineBasicMaterial({ color: 0x888060 })));
    });

    // Warm fill light
    const warmLight = new THREE.PointLight(0xffa060, 1.2, 14);
    warmLight.position.set(4, 1, -4);
    this.group.add(warmLight);
  }

  _update(t) {
    // Propositions flicker in logical space
    this.propositions.forEach(({ mesh, on }, i) => {
      if (on) {
        mesh.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 1.5 + i);
      }
      mesh.rotation.x = t * 0.2 + i;
      mesh.rotation.y = t * 0.15 + i * 0.7;
    });

    if (this.skyMat) this.skyMat.uniforms.time.value = t;
    if (this.wallMat) this.wallMat.uniforms.time.value = t;

    // Wall shimmer
    if (this.wallLight) {
      this.wallLight.intensity = 0.4 + 0.2 * Math.sin(t * 0.8);
    }

    // Tools wobble gently
    this.toolMeshes.forEach((m, i) => {
      m.rotation.y = t * 0.15 + i;
    });

    // Venn spheres pulse
    this.vennSpheres.forEach((s, i) => {
      s.material.opacity = 0.12 + 0.06 * Math.sin(t * 0.7 + i);
      s.scale.setScalar(1 + 0.05 * Math.sin(t * 0.5 + i));
    });
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [-4, 1, -3],
        title: 'The Picture Theory of Meaning',
        body: `<p>In the <em>Tractatus Logico-Philosophicus</em> (1922), Wittgenstein proposed that language pictures the world. A meaningful proposition is a logical picture of a possible fact — it shares logical form with the state of affairs it depicts.</p>
        <p>"The world is everything that is the case." Facts, not things, are the basic units of reality. Language represents facts. A sentence is a picture. If the picture matches the world, the sentence is true.</p>
        <p>This gives a hard boundary to what language can say: it can picture facts. It cannot picture its own logical form — that shows itself. Ethics, aesthetics, the meaning of life — these cannot be said, only shown. Hence: "Whereof one cannot speak, thereof one must be silent."</p>`,
      },
      {
        position: [0.5, 0, -1],
        title: 'The Limits of Language',
        body: `<p>"The limits of my language mean the limits of my world." Wittgenstein in the <em>Tractatus</em> drew a sharp line: inside the limit, everything that can be said; outside, everything that shows itself but cannot be said.</p>
        <p>Ethics, God, the soul, the meaning of life — these are not false propositions but <em>nonsense</em>, outside the limits of meaningful language. The proper response is not philosophical argument but silence.</p>
        <p>The <em>Tractatus</em> ends: "My propositions serve as elucidations in the following way: anyone who understands me eventually recognizes them as nonsensical... He must transcend these propositions; then he sees the world rightly."</p>`,
      },
      {
        position: [3, 1, 2],
        title: 'Language Games',
        body: `<p>The later Wittgenstein (the <em>Philosophical Investigations</em>, 1953) rejected almost everything in the <em>Tractatus</em>. There is no single essence of language — no picture theory, no logical atoms.</p>
        <p>Instead: language is a collection of practices — "language games" — each with its own rules. Asking, ordering, joking, praying, greeting: these are different games. Meaning is not a mental image behind the word but the word's <em>use</em> in a practice.</p>
        <p>"Don't ask for the meaning, ask for the use." Philosophy's job is not to construct theories but to describe language in use — and to dissolve philosophical puzzles by showing they arise from misusing language, taking it out of its home game.</p>`,
      },
      {
        position: [2.5, 1.5, 3],
        title: 'Family Resemblance',
        body: `<p>What do all games have in common? Wittgenstein's answer: nothing. Card games, ball games, board games, Olympic games — they share criss-crossing similarities, like the overlapping features of family members. No single feature is shared by all.</p>
        <p>This dissolves the Platonic search for essences. "What is knowledge?" "What is language?" "What is justice?" — philosophy has been trying to answer these by finding the essence behind the word. There is no essence. There are only overlapping family resemblances.</p>
        <p>This is not relativism — family resemblances are real patterns. But they don't add up to a definition. Wittgenstein called the urge to seek essences a "grammatical illusion."</p>`,
      },
      {
        position: [3.5, 0, 1],
        title: 'Private Language Argument',
        body: `<p>Can there be a language intelligible only to one person — a language naming inner experiences that only I can know? Wittgenstein says no.</p>
        <p>A private language has no criterion for correct use. If I "define" a sensation S by concentrating on it and writing S in a diary — what makes my next use of "S" correct? Only my memory. But memory isn't a check on correctness, just another application of the rule.</p>
        <p>Language requires public criteria — agreement in practice, a form of life. This undermines Cartesian inner certainty: there is no private mental theater to which language refers. Meaning is irreducibly public and social.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }
}
