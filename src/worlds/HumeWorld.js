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
          // Wave foam — use world-space noise, not UV grid
          float foam = smoothstep(0.6, 0.9, sin(vWorldPos.x * 3.1 + time * 1.1) * sin(vWorldPos.z * 2.7 + time * 0.8) * 0.5 + 0.5)
                     * smoothstep(0.55, 0.75, sin(vWorldPos.x * 1.8 - vWorldPos.z * 2.3 + time * 0.6));
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
      { label: 'Flame',     color: 0xff6600, pos: [-4, -1.3, -2], size: 1.0, h: 0.7 },
      { label: 'Red Apple', color: 0xff2222, pos: [3,  -1.5, -3], size: 0.9, h: 0.5 },
      { label: 'Thunder',   color: 0x8888ff, pos: [-2, -1.2, 2],  size: 0.8, h: 0.6 },
      { label: 'Cold',      color: 0x88ccff, pos: [4,  -1.4, 2],  size: 0.85, h: 0.55 },
      { label: 'Sweetness', color: 0xff88cc, pos: [0,  -1.6, -4], size: 0.95, h: 0.5 },
      { label: 'Pain',      color: 0x882222, pos: [-5, -1.1, 0],  size: 0.8, h: 0.65 },
    ];

    this.flameParticleGeos = [];

    IMPRESSIONS.forEach(({ label, color, pos, size, h }) => {
      // Island land mass — taller with green top cap
      const islandGeo = new THREE.CylinderGeometry(size * 0.85, size * 1.3, h, 14);
      const islandMat = makeIslandRockMaterial();
      const island = new THREE.Mesh(islandGeo, islandMat);
      island.position.set(...pos);
      this.group.add(island);
      // Green mossy top
      const topMat = new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.9 });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.82, size * 0.85, 0.08, 14), topMat);
      top.position.set(pos[0], pos[1] + h / 2 + 0.04, pos[2]);
      this.group.add(top);

      let obj, light;

      if (label === 'Flame') {
        // Fire pit with particle flames
        const pitMat = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.9, metalness: 0.3 });
        const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.15, 10), pitMat);
        pit.position.set(pos[0], pos[1] + 0.28, pos[2]);
        this.group.add(pit);
        obj = pit;

        // Flame particles
        const fCount = 40;
        const fPos = new Float32Array(fCount * 3);
        for (let i = 0; i < fCount; i++) {
          fPos[i*3]   = pos[0] + (Math.random()-0.5)*0.3;
          fPos[i*3+1] = pos[1] + 0.3 + Math.random() * 0.7;
          fPos[i*3+2] = pos[2] + (Math.random()-0.5)*0.3;
        }
        const fGeo = new THREE.BufferGeometry();
        fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
        const fMat = new THREE.PointsMaterial({ color: 0xff8820, size: 0.1, transparent: true, opacity: 0.85, depthWrite: false });
        this.group.add(new THREE.Points(fGeo, fMat));
        this.flameParticleGeos.push({ geo: fGeo, cx: pos[0], cy: pos[1], cz: pos[2] });

        light = new THREE.PointLight(color, 2.0, 4);
        light.position.set(pos[0], pos[1]+0.7, pos[2]);
        this.group.add(light);

      } else if (label === 'Red Apple') {
        // Apple shape: sphere with brown stem
        const appleGeo = new THREE.SphereGeometry(0.38, 12, 12);
        obj = new THREE.Mesh(appleGeo, new THREE.MeshStandardMaterial({ color: 0xcc1111, emissive: 0x660000, emissiveIntensity: 0.4, roughness: 0.35 }));
        obj.position.set(pos[0], pos[1]+0.65, pos[2]);
        obj.scale.set(1, 1.1, 1);
        this.group.add(obj);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x4a2a08, roughness: 0.9 }));
        stem.position.set(pos[0], pos[1]+1.06, pos[2]);
        this.group.add(stem);
        light = new THREE.PointLight(color, 0.8, 3);
        light.position.set(pos[0], pos[1]+0.5, pos[2]);
        this.group.add(light);

      } else if (label === 'Thunder') {
        // Lightning bolt shape using merged line segments
        const boltPts = [
          new THREE.Vector3(0.0,  0.8, 0), new THREE.Vector3( 0.12, 0.4, 0),
          new THREE.Vector3(0.12, 0.4, 0), new THREE.Vector3(-0.04, 0.4, 0),
          new THREE.Vector3(-0.04, 0.4, 0), new THREE.Vector3( 0.15, 0.0, 0),
          new THREE.Vector3(0.15, 0.0, 0), new THREE.Vector3(-0.05, 0.0, 0),
          new THREE.Vector3(-0.05, 0.0, 0), new THREE.Vector3( 0.0, -0.5, 0),
        ].map(p => p.add(new THREE.Vector3(pos[0], pos[1]+0.4, pos[2])));
        const boltGeo = new THREE.BufferGeometry().setFromPoints(boltPts);
        this.boltMat = new THREE.LineBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.9 });
        obj = new THREE.LineSegments(boltGeo, this.boltMat);
        this.group.add(obj);
        light = new THREE.PointLight(color, 1.2, 3.5);
        light.position.set(pos[0], pos[1]+0.4, pos[2]);
        this.group.add(light);

      } else if (label === 'Cold') {
        // Icy spiky crystals
        const iceMat = new THREE.MeshStandardMaterial({ color: 0x99ddff, emissive: 0x2266aa, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.88 });
        obj = new THREE.Group();
        [[0,0,0],[0.28,0,0.15],[-0.2,0,0.28],[0.08,0,-0.32],[0.0,0,0.1]].forEach(([ox,oy,oz], ci) => {
          const ch = 0.45 + ci * 0.12;
          const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.1, ch, 5), iceMat);
          crystal.position.set(pos[0]+ox, pos[1]+0.4+ch/2, pos[2]+oz);
          crystal.rotation.z = (Math.random()-0.5)*0.35;
          this.group.add(crystal);
        });
        obj.position.set(pos[0], pos[1], pos[2]);
        light = new THREE.PointLight(0x88ccff, 1.0, 3);
        light.position.set(pos[0], pos[1]+0.5, pos[2]);
        this.group.add(light);

      } else if (label === 'Sweetness') {
        // Soft pink swirling sphere — smooth and round
        obj = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 14, 14),
          new THREE.MeshStandardMaterial({ color: 0xff99cc, emissive: 0xaa3366, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.9 })
        );
        obj.position.set(pos[0], pos[1]+0.65, pos[2]);
        this.group.add(obj);
        // Orbiting small spheres
        this.sweetnessOrbiters = [];
        [0, Math.PI*2/3, Math.PI*4/3].forEach((a, si) => {
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffccee }));
          orb.position.set(pos[0]+Math.cos(a)*0.52, pos[1]+0.65, pos[2]+Math.sin(a)*0.52);
          this.group.add(orb);
          this.sweetnessOrbiters.push({ orb, baseA: a, cx: pos[0], cy: pos[1]+0.65, cz: pos[2] });
        });
        light = new THREE.PointLight(color, 0.9, 3);
        light.position.set(pos[0], pos[1]+0.5, pos[2]);
        this.group.add(light);

      } else { // Pain
        // Jagged dark angular geometry
        obj = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.38, 0),
          new THREE.MeshStandardMaterial({ color: 0x660000, emissive: 0x330000, emissiveIntensity: 0.8, roughness: 0.8 })
        );
        obj.position.set(pos[0], pos[1]+0.65, pos[2]);
        this.group.add(obj);
        light = new THREE.PointLight(0xaa0000, 1.5, 3.5);
        light.position.set(pos[0], pos[1]+0.5, pos[2]);
        this.group.add(light);
      }

      this.islands.push({ island, obj, light, color, baseY: pos[1], label });
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

    // Mist — large soft translucent billboard planes drifting over the water
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x8aa0b8,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mistPatches = [];
    for (let i = 0; i < 18; i++) {
      const w = 2.5 + Math.random() * 3.5;
      const d = 1.5 + Math.random() * 2.5;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mistMat.clone());
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (Math.random() - 0.5) * 20,
        -1.4 + Math.random() * 0.6,
        (Math.random() - 0.5) * 20
      );
      patch.userData.driftSpeed = 0.008 + Math.random() * 0.012;
      patch.userData.driftAngle = Math.random() * Math.PI * 2;
      this.group.add(patch);
      this.mistPatches.push(patch);
    }
    // Point mist for depth — smaller count, larger size
    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = -1.2 + Math.random() * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mistGeo = geo;
    this.group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x8aa8c0,
      size: 0.5,
      transparent: true,
      opacity: 0.04,
      depthWrite: false,
    })));
  }

  _update(t) {
    if (this.oceanMat) this.oceanMat.uniforms.time.value = t;
    if (this.skyMat)   this.skyMat.uniforms.time.value = t;

    // Islands bob gently
    this.islands.forEach((isle, i) => {
      const bob = Math.sin(t * 0.4 + i * 1.3) * 0.07;
      isle.island.position.y = isle.baseY + bob;
      if (isle.light) {
        isle.light.position.y = isle.baseY + 0.5 + bob;
        isle.light.intensity = 0.8 + 0.3 * Math.sin(t * 1.5 + i);
      }
      // Only rotate objects that support it (not groups/lines)
      if (isle.obj && isle.obj.rotation && isle.label !== 'Cold') {
        isle.obj.rotation.y = t * 0.5 + i;
      }
    });

    // Flame particles rise and reset
    if (this.flameParticleGeos) {
      this.flameParticleGeos.forEach(({ geo, cx, cy, cz }) => {
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.array[i*3+1] += 0.012;
          pos.array[i*3]   += (Math.random()-0.5)*0.005;
          if (pos.array[i*3+1] > cy + 1.2) {
            pos.array[i*3]   = cx + (Math.random()-0.5)*0.3;
            pos.array[i*3+1] = cy + 0.25;
            pos.array[i*3+2] = cz + (Math.random()-0.5)*0.3;
          }
        }
        pos.needsUpdate = true;
      });
    }

    // Sweetness orbiters circle
    if (this.sweetnessOrbiters) {
      this.sweetnessOrbiters.forEach(({ orb, baseA, cx, cy, cz }) => {
        const a = baseA + t * 1.2;
        orb.position.set(cx + Math.cos(a)*0.52, cy, cz + Math.sin(a)*0.52);
      });
    }

    // Thunder bolt flicker
    if (this.boltMat) {
      this.boltMat.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 2.5 + Math.sin(t * 7)));
    }

    // Mist billboard patches drift slowly
    if (this.mistPatches) {
      this.mistPatches.forEach(p => {
        p.position.x += Math.cos(p.userData.driftAngle) * p.userData.driftSpeed;
        p.position.z += Math.sin(p.userData.driftAngle) * p.userData.driftSpeed;
        if (Math.abs(p.position.x) > 12) p.userData.driftAngle = Math.PI - p.userData.driftAngle;
        if (Math.abs(p.position.z) > 12) p.userData.driftAngle = -p.userData.driftAngle;
      });
    }

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
