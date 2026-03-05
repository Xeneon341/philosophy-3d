import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';

export class WittgensteinWorld extends BaseWorld {
  _build() {
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

  _buildTractatus() {
    // Clean logical space: floating propositions as geometric nodes
    this.propositions = [];
    const PROPS = [
      { text: '1', x: -4, y: 3, z: -2, on: true },
      { text: '1.1', x: -5, y: 2, z: -3, on: true },
      { text: '2', x: -3, y: 1, z: -3, on: true },
      { text: '2.1', x: -4.5, y: 0, z: -4, on: true },
      { text: '6.5', x: -2, y: -1, z: -2, on: true },
      { text: '7', x: -1.5, y: -2, z: -1, on: false }, // silence
    ];

    const onMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    const offMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3,
    });

    PROPS.forEach(({ x, y, z, on }) => {
      const geo = new THREE.OctahedronGeometry(0.15, 0);
      const mesh = new THREE.Mesh(geo, on ? onMat : offMat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      this.propositions.push({ mesh, on });
    });

    // Logic tree lines connecting propositions
    const logicMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    const connections = [[0, 1], [0, 2], [2, 3], [4, 5]];
    connections.forEach(([a, b]) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        PROPS[a] ? new THREE.Vector3(PROPS[a].x, PROPS[a].y, PROPS[a].z) : new THREE.Vector3(),
        PROPS[b] ? new THREE.Vector3(PROPS[b].x, PROPS[b].y, PROPS[b].z) : new THREE.Vector3(),
      ]);
      this.group.add(new THREE.Line(geo, logicMat));
    });
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
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 10, 1, 20), mat);
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
    // Warm, chaotic marketplace — language games
    this.toolMeshes = [];
    const TOOLS = [
      { geo: new THREE.BoxGeometry(0.3, 0.1, 0.5), color: 0xc87840, emissive: 0x603010, pos: [3, -0.5, 2], roughness: 0.85, metalness: 0 },    // book
      { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), color: 0x8060a0, emissive: 0x301030, pos: [3.5, -0.3, 1], roughness: 0.6, metalness: 0.1 }, // pencil
      { geo: new THREE.SphereGeometry(0.15, 8, 8), color: 0x60a860, emissive: 0x103010, pos: [4, -0.2, 2.5], roughness: 0.5, metalness: 0 },  // ball
      { geo: new THREE.ConeGeometry(0.1, 0.3, 6), color: 0xd04040, emissive: 0x501010, pos: [2.5, -0.4, 1.5], roughness: 0.7, metalness: 0.2 }, // tool
    ];

    TOOLS.forEach(({ geo, color, emissive, pos, roughness, metalness }) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.3, roughness, metalness }));
      mesh.position.set(...pos);
      this.group.add(mesh);
      this.toolMeshes.push(mesh);
    });

    // Family resemblance Venn spheres
    const vennColors = [0xc87040, 0x7040c8, 0x40c870];
    const vennCenters = [[2.5, 1, 3], [3.5, 1, 3], [3, 1, 4]];
    this.vennSpheres = [];
    vennColors.forEach((color, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 12),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.15,
          roughness: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      mesh.position.set(...vennCenters[i]);
      this.group.add(mesh);
      this.vennSpheres.push(mesh);
    });

    // Warm ambient light on investigations side
    const warmLight = new THREE.PointLight(0xffa060, 1.5, 8);
    warmLight.position.set(3, 1, 2.5);
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
      m.rotation.y = t * 0.2 + i;
      m.position.y = m.position.y + Math.sin(t * 0.5 + i) * 0.001;
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
