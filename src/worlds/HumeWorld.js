import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeIslandRockMaterial } from '../shaders/materials.js';

export class HumeWorld extends BaseWorld {
  _build() {
    this._buildOcean();
    this._buildIslands();
    this._buildBridges();
    this._buildSky();
    this._buildHotspots();

    const ambient = new THREE.AmbientLight(0x0a1520, 0.7);
    this.group.add(ambient);
  }

  _buildOcean() {
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          // Gerstner-inspired wave stack
          float w1 = sin(pos.x * 1.2 + time * 0.9) * 0.18;
          float w2 = sin(pos.x * 2.5 + pos.y * 1.8 + time * 1.3) * 0.08;
          float w3 = sin(pos.x * 0.7 - pos.y * 2.2 + time * 0.7) * 0.12;
          float w4 = sin(pos.x * 4.0 + pos.y * 3.0 + time * 2.1) * 0.03;
          pos.z += w1 + w2 + w3 + w4;
          // Approximate normal from finite difference
          float dx = cos(pos.x * 1.2 + time * 0.9) * 1.2 * 0.18;
          vNormal = normalize(vec3(-dx, 1.0, 0.0));
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.5);
          // Wave foam pattern
          float foam = smoothstep(0.7, 0.9, sin(vUv.x * 30.0 + time * 1.5) * sin(vUv.y * 22.0 + time));
          vec3 deep    = vec3(0.02, 0.05, 0.12);
          vec3 shallow = vec3(0.06, 0.14, 0.28);
          vec3 reflect = vec3(0.15, 0.20, 0.35);
          vec3 col = mix(deep, shallow, fresnel * 0.8);
          col = mix(col, reflect, fresnel * 0.5);
          col += vec3(0.7, 0.8, 0.9) * foam * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const geo = new THREE.PlaneGeometry(30, 30, 40, 40);
    const ocean = new THREE.Mesh(geo, this.oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -2;
    this.group.add(ocean);
  }

  _buildIslands() {
    this.islands = [];
    const IMPRESSIONS = [
      { label: 'Flame', color: 0xff6600, pos: [-4, -1, -2], size: 0.7 },
      { label: 'Red Apple', color: 0xff2222, pos: [3, -1, -3], size: 0.6 },
      { label: 'Thunder', color: 0x8888ff, pos: [-2, -1, 2], size: 0.5 },
      { label: 'Cold', color: 0x88ccff, pos: [4, -1, 2], size: 0.5 },
      { label: 'Sweetness', color: 0xff88cc, pos: [0, -1, -4], size: 0.55 },
      { label: 'Pain', color: 0x882222, pos: [-5, -1, 0], size: 0.5 },
    ];

    IMPRESSIONS.forEach(({ color, pos, size }) => {
      // Island land mass
      const islandGeo = new THREE.CylinderGeometry(size, size * 1.2, 0.4, 12);
      const islandMat = makeIslandRockMaterial();
      const island = new THREE.Mesh(islandGeo, islandMat);
      island.position.set(...pos);
      this.group.add(island);

      // Impression object on island
      const objGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const objMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      const obj = new THREE.Mesh(objGeo, objMat);
      obj.position.set(pos[0], pos[1] + 0.4, pos[2]);
      this.group.add(obj);

      // Glow
      const light = new THREE.PointLight(color, 1, 3);
      light.position.copy(obj.position);
      this.group.add(light);

      this.islands.push({ island, obj, light, color, baseY: pos[1] });
    });
  }

  _buildBridges() {
    // Frayed rope bridges between some islands — custom association types
    const CONNECTIONS = [
      { from: 0, to: 1, label: 'Resemblance' },
      { from: 1, to: 4, label: 'Cause & Effect' },
      { from: 0, to: 2, label: 'Contiguity' },
      { from: 3, to: 5, label: 'Cause & Effect' },
    ];

    this.bridges = [];
    CONNECTIONS.forEach(({ from, to }) => {
      const a = this.islands[from].island.position;
      const b = this.islands[to].island.position;

      // Bridge planks
      const dir = b.clone().sub(a);
      const len = dir.length();
      const steps = Math.floor(len / 0.4);
      const bridgeGroup = new THREE.Group();

      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const plankGeo = new THREE.BoxGeometry(0.3, 0.04, 0.08);
        const plankMat = new THREE.MeshStandardMaterial({
          color: 0x5a3a1a,
          roughness: 0.9,
          transparent: true,
          opacity: 0.6 + Math.random() * 0.4, // some planks missing/frayed
        });
        // Random plank missing
        if (Math.random() > 0.85) return;
        const plank = new THREE.Mesh(plankGeo, plankMat);
        const pos = a.clone().lerp(b, t);
        plank.position.set(pos.x, pos.y + 0.2 + Math.sin(t * Math.PI) * 0.1, pos.z);
        plank.rotation.y = Math.atan2(dir.x, dir.z);
        plank.rotation.z = (Math.random() - 0.5) * 0.1; // slight sway
        bridgeGroup.add(plank);
      }

      // Rope lines
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const p = a.clone().lerp(b, t);
        p.y += 0.2 + Math.sin(t * Math.PI) * 0.15 - 0.1;
        pts.push(p);
      }
      const ropeGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const ropeMat = new THREE.LineBasicMaterial({
        color: 0x7a5a2a,
        transparent: true,
        opacity: 0.5,
      });
      bridgeGroup.add(new THREE.Line(ropeGeo, ropeMat));

      this.group.add(bridgeGroup);
      this.bridges.push(bridgeGroup);
    });
  }

  _buildSky() {
    // Overcast — no certain light, just grey-blue mist and rolling cloud
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p*=2.1;a*=0.5;} return v; }
        void main(){
          float h = vDir.y * 0.5 + 0.5;
          vec2 uv = vDir.xz / max(0.01, abs(vDir.y) + 0.3);
          float cloud = fbm(uv * 1.5 + time * 0.01);
          vec3 overcast = vec3(0.12, 0.16, 0.22);
          vec3 cloud_col = vec3(0.18, 0.22, 0.30);
          vec3 col = mix(overcast, cloud_col, cloud * smoothstep(0.0, 0.3, h));
          col = mix(vec3(0.05,0.08,0.12), col, smoothstep(-0.05, 0.2, vDir.y));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    const skyGeo = new THREE.SphereGeometry(22, 24, 12);
    this.group.add(new THREE.Mesh(skyGeo, this.skyMat));

    // Mist particles
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = -1.5 + Math.random() * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mistGeo = geo;
    const mat = new THREE.PointsMaterial({
      color: 0x7890a0,
      size: 0.15,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _update(t) {
    if (this.oceanMat) this.oceanMat.uniforms.time.value = t;
    if (this.skyMat)   this.skyMat.uniforms.time.value = t;

    // Islands bob gently
    this.islands.forEach((isle, i) => {
      const bob = Math.sin(t * 0.4 + i * 1.3) * 0.07;
      isle.island.position.y = isle.baseY + bob;
      isle.obj.position.y = isle.baseY + 0.4 + bob;
      isle.light.position.y = isle.baseY + 0.5 + bob;

      // Impression objects rotate
      isle.obj.rotation.y = t * 0.5 + i;
      isle.light.intensity = 0.8 + 0.3 * Math.sin(t * 1.5 + i);
    });

    // Mist drift
    const pos = this.mistGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3] += Math.sin(t * 0.1 + i) * 0.003;
      if (pos.array[i * 3] > 10) pos.array[i * 3] = -10;
    }
    pos.needsUpdate = true;

    // Bridges sway
    this.bridges.forEach((b, i) => {
      b.rotation.y = Math.sin(t * 0.2 + i) * 0.02;
    });
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [-4, 0, -2],
        title: 'Impressions & Ideas',
        body: `<p>Hume's starting point: the mind contains only <em>perceptions</em>, divided into impressions (vivid, forceful — the direct experience of heat, red, pain) and ideas (faint copies of impressions — memories, imagination).</p>
        <p>There are no innate ideas. Every idea traces back to an impression. If a philosopher uses a concept — God, substance, self — Hume asks: from what impression does this idea derive? If none can be found, the concept is meaningless.</p>
        <p>This "copy principle" is a philosophical acid that dissolves most of traditional metaphysics. What impression gives us the idea of "necessary connection" in cause and effect? Hume's answer: none. We only observe constant conjunction — not necessity.</p>`,
      },
      {
        position: [3, 0, -3],
        title: 'The Problem of Causation',
        body: `<p>Hume's most devastating argument: we never perceive causation — only sequence. The billiard ball strikes another; the second moves. We see two events in succession. But the "necessary connection" between them? We never see it. We feel it only as habit — the expectation our minds have formed from past experience.</p>
        <p>This means inductive reasoning — all of science — has no rational foundation. We believe the sun will rise tomorrow because it always has. But no number of past observations logically entails any future event.</p>
        <p>"Hume's problem" woke Kant from his "dogmatic slumber" and drove him to write the <em>Critique of Pure Reason</em>. It remains unsolved.</p>`,
      },
      {
        position: [0, 0, -4],
        title: 'The Bundle Theory of Self',
        body: `<p>Descartes had found the self — the thinking thing — at the foundation of all knowledge. Hume looked for it and found... nothing. Or rather, he found a bundle.</p>
        <p>"When I enter most intimately into what I call myself, I always stumble on some particular perception or other... I never can catch myself at any time without a perception."</p>
        <p>The self is not a substance or a soul but a "bundle of perceptions" — a rapid succession of experiences with no unified owner. Personal identity is a fiction of the imagination, a narrative we tell about a stream of disconnected impressions.</p>
        <p>Buddhist philosophers had reached the same conclusion 2,000 years earlier — a parallel Hume was unaware of.</p>`,
      },
      {
        position: [-2, 0, 2],
        title: 'Reason is Slave to the Passions',
        body: `<p>"Reason is, and ought only to be, the slave of the passions, and can never pretend to any other office than to serve and obey them." Hume's most provocative claim about motivation.</p>
        <p>Reason alone, he argues, can never move us to act. It can tell us facts and relations — but a fact by itself gives no motivation. Only a desire, emotion, or passion can motivate. Reason is the navigator; passion is the engine.</p>
        <p>This upends the rationalist tradition from Plato to Kant. It also anticipates modern neuroscience: Antonio Damasio's work on patients with damaged prefrontal cortex shows that emotional impairment destroys the ability to make decisions, even when reasoning remains intact.</p>`,
      },
      {
        position: [4, 0, 2],
        title: 'The Problem of Miracles',
        body: `<p>Hume's argument against miracles: a miracle is a violation of a law of nature. Laws of nature are established by "a firm and unalterable experience." The evidence for a miracle (human testimony, often from uneducated people long ago) must always be weighed against the evidence for the natural law it violates.</p>
        <p>"No testimony is sufficient to establish a miracle, unless the testimony be of such a kind, that its falsehood would be more miraculous than the fact which it endeavors to establish."</p>
        <p>This was explosively controversial — Hume kept his atheism implicit to avoid persecution. His <em>Dialogues Concerning Natural Religion</em>, published posthumously, is still the most devastating critique of the argument from design.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }
}
