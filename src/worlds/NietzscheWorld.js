import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeMarbleMaterial, makeAshGroundMaterial } from '../shaders/materials.js';

export class NietzscheWorld extends BaseWorld {
  _build() {
    this._buildGround();
    this._buildRuins();
    this._buildEternalSpiral();
    this._buildFires();
    this._buildSkyDome();
    this._buildGodIsDead();
    this._buildHotspots();
    this._buildParticles();
    this._buildZarathustraMountain();

    const ambient = new THREE.AmbientLight(0x0a0005, 0.4);
    this.group.add(ambient);
  }

  _buildGround() {
    // Ash-covered cracked ground
    const geo = new THREE.PlaneGeometry(30, 30, 60, 60);
    // Displace vertices for cracked look
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 2] += (Math.random() - 0.5) * 0.18;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = makeAshGroundMaterial();
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    this.group.add(floor);
  }

  _buildRuins() {
    const marbleMat = makeMarbleMaterial();

    // Toppled columns
    const colGeo = new THREE.CylinderGeometry(0.15, 0.18, 3, 8);
    const positions = [
      [-3, -0.5, -3, 0, 0, Math.PI / 2 + 0.2],
      [2, -0.5, -4, 0.1, 0.3, Math.PI / 2],
      [-1, -0.5, -5, 0, 0.1, Math.PI / 2 + 0.4],
      [4, -0.5, -2, 0, 0, Math.PI / 2 - 0.1],
    ];

    positions.forEach(([x, y, z, rx, ry, rz]) => {
      const col = new THREE.Mesh(colGeo, marbleMat);
      col.position.set(x, y, z);
      col.rotation.set(rx, ry, rz);
      this.group.add(col);

      // Column capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.4), marbleMat);
      cap.position.copy(col.position);
      this.group.add(cap);
    });

    // Half-buried statue base
    const baseGeo = new THREE.BoxGeometry(1, 0.8, 1);
    const base = new THREE.Mesh(baseGeo, marbleMat);
    base.position.set(0, -1.1, -3);
    this.group.add(base);

    // Cracked statue body
    const statueGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6);
    const statue = new THREE.Mesh(statueGeo, marbleMat);
    statue.position.set(0.2, -0.3, -3.2);
    statue.rotation.z = 0.8;
    this.group.add(statue);
  }

  _buildEternalSpiral() {
    // Eternal recurrence: a spiral staircase that loops
    this.spiralPoints = [];
    const spiralGroup = new THREE.Group();
    spiralGroup.position.set(0, -1.5, 0);

    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 6;
      const radius = 1.5;
      const height = t * 4;

      const stepGeo = new THREE.BoxGeometry(0.4, 0.08, 0.25);
      const stepMat = new THREE.MeshStandardMaterial({
        color: 0x3a2a1a,
        emissive: 0x8b0000,
        emissiveIntensity: 0.1 + t * 0.4,
      });
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      step.rotation.y = -angle;
      spiralGroup.add(step);
      this.spiralPoints.push(step);
    }
    this.group.add(spiralGroup);
    this.spiralGroup = spiralGroup;

    // Center pillar
    const pillarGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.5, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      emissive: 0x8b0000,
      emissiveIntensity: 0.3,
    });
    spiralGroup.add(new THREE.Mesh(pillarGeo, pillarMat));
  }

  _buildFires() {
    this.fires = [];
    const firePositions = [[-4, -1.5, 1], [4, -1.5, 0], [-2, -1.5, 3], [3, -1.5, -5]];

    firePositions.forEach(([x, y, z]) => {
      // Fire pit bowl
      const bowlGeo = new THREE.TorusGeometry(0.3, 0.08, 6, 12);
      const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.85, metalness: 0.6, emissive: 0x3a0800, emissiveIntensity: 0.2 });
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.set(x, y, z);
      bowl.rotation.x = Math.PI / 2;
      this.group.add(bowl);

      // Flame light
      const light = new THREE.PointLight(0xff4400, 2.5, 6);
      light.position.set(x, y + 0.5, z);
      this.group.add(light);
      this.fires.push({ light, baseIntensity: 2.5 + Math.random() });

      // Flame particles (simple)
      const flamePts = [];
      for (let i = 0; i < 30; i++) {
        flamePts.push(new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.3,
          y + Math.random() * 0.8,
          z + (Math.random() - 0.5) * 0.3
        ));
      }
      const flameGeo = new THREE.BufferGeometry().setFromPoints(flamePts);
      const flameMat = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 0.08,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      this.group.add(new THREE.Points(flameGeo, flameMat));
    });
  }

  _buildSkyDome() {
    // Rapidly cycling sky — eternal recurrence of day/night
    const geo = new THREE.SphereGeometry(25, 16, 8);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vPosition;
        void main() {
          float t = mod(time * 0.05, 1.0); // 0-1 cycle
          vec3 night = vec3(0.02, 0.0, 0.05);
          vec3 dawn = vec3(0.6, 0.2, 0.05);
          vec3 noon = vec3(0.3, 0.4, 0.7);
          vec3 dusk = vec3(0.5, 0.1, 0.02);
          vec3 sky;
          float ht = vPosition.y / 25.0;
          if (t < 0.25) sky = mix(night, dawn, t / 0.25);
          else if (t < 0.5) sky = mix(dawn, noon, (t - 0.25) / 0.25);
          else if (t < 0.75) sky = mix(noon, dusk, (t - 0.5) / 0.25);
          else sky = mix(dusk, night, (t - 0.75) / 0.25);
          sky *= mix(0.2, 1.0, clamp(ht + 0.5, 0.0, 1.0));
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(geo, this.skyMat));

    // Sun/moon
    this.sunMat = new THREE.MeshBasicMaterial({ color: 0xffd080 });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), this.sunMat);
    this.group.add(this.sun);
  }

  _buildParticles() {
    // Ash floating upward
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.ashGeo = geo;
    this.ashPositions = positions;
    const mat = new THREE.PointsMaterial({
      color: 0x888880,
      size: 0.04,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _buildGodIsDead() {
    // A toppled cross/monolith — cracked, half-buried, dark
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2028, roughness: 0.9, metalness: 0.05 });
    const crackedMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vW=(modelMatrix*vec4(position,1.0)).xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vW; varying vec3 vN;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        void main(){
          float n = noise(vW.xy*2.0)*0.4 + noise(vW.xz*3.5)*0.3;
          vec3 col = vec3(0.14+n*0.06, 0.12+n*0.05, 0.15+n*0.06);
          // Crack lines
          float crack = smoothstep(0.03,0.0,abs(noise(vW.xy*4.0+vec2(3.1,7.4))-0.5)*0.5);
          col = mix(col, vec3(0.04,0.03,0.04), crack * 0.8);
          float diff = max(dot(vN, normalize(vec3(0.5,1.0,0.3))),0.0)*0.5+0.3;
          gl_FragColor = vec4(col*diff, 1.0);
        }
      `,
      side: THREE.FrontSide,
    });

    // Main upright slab — toppled at an angle
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.4), crackedMat);
    slab.position.set(2, -0.4, -3.5);
    slab.rotation.set(Math.PI/2 - 0.3, 0.4, 0.15); // toppled
    this.group.add(slab);

    // Crossbar
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.38), crackedMat);
    crossBar.position.set(2, 0.0, -3.5);
    crossBar.rotation.copy(slab.rotation);
    this.group.add(crossBar);

    // Broken base stump still standing
    const stump = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.45), stoneMat);
    stump.position.set(2, -1.05, -3.5);
    this.group.add(stump);

    // Half-buried inscription block
    const inscription = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.6), stoneMat);
    inscription.position.set(2, -1.48, -3.2);
    inscription.rotation.y = 0.15;
    this.group.add(inscription);

    // Dark glow at the broken base
    const deadLight = new THREE.PointLight(0x330022, 1.5, 4);
    deadLight.position.set(2, -0.5, -3.5);
    this.group.add(deadLight);
    this.deadLight = deadLight;
  }

  _buildZarathustraMountain() {
    // Distant mountain — procedural dark rock shader
    const geo = new THREE.ConeGeometry(5, 8, 12);
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
          vec3 p = vWorldPos * 0.4;
          float n = fbm(p);
          float n2 = fbm(p * 2.5 + 3.7);
          // Snow near peak
          float height = clamp((vWorldPos.y - 5.5) / 2.0, 0.0, 1.0);
          float snowLine = smoothstep(0.3, 0.7, height + n * 0.3 - 0.1);

          vec3 darkRock  = vec3(0.06, 0.04, 0.07);
          vec3 midRock   = vec3(0.14, 0.10, 0.12);
          vec3 snowColor = vec3(0.65, 0.60, 0.58);

          vec3 col = mix(darkRock, midRock, n);
          col += vec3(0.03, 0.02, 0.03) * n2;
          col = mix(col, snowColor, snowLine);

          vec3 lightDir = normalize(vec3(-0.5, 1.0, 0.5));
          float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.2;
          col *= diff;

          // Atmospheric distance fade to match foggy sky
          col = mix(col, vec3(0.08, 0.04, 0.09), 0.3);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const mountain = new THREE.Mesh(geo, mat);
    mountain.position.set(0, 1, -15);
    this.group.add(mountain);

    // Zarathustra figure — large enough to read from z=6
    const figGroup = new THREE.Group();
    figGroup.position.set(0, 5.5, -15);

    const figMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.75 });
    // Body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.6, 4, 8), figMat);
    body.position.y = 0;
    figGroup.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), figMat);
    head.position.y = 0.65;
    figGroup.add(head);
    // Arms raised (triumph)
    [-1,1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 6), figMat);
      arm.position.set(side * 0.32, 0.25, 0);
      arm.rotation.z = side * (Math.PI / 3);
      figGroup.add(arm);
    });
    // Cloak billowing behind
    const cloakMat = new THREE.MeshBasicMaterial({ color: 0xddbbaa, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const cloak = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), cloakMat);
    cloak.position.set(0, -0.1, 0.2);
    cloak.rotation.x = 0.3;
    figGroup.add(cloak);

    this.zarathFigure = figGroup;
    this.group.add(figGroup);

    // Halo glow behind the figure
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffaa40, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
    );
    halo.position.set(0, 5.5, -15.15);
    this.group.add(halo);
    this.zarathHalo = halo;
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, 0, 0],
        title: 'Eternal Recurrence',
        body: `<p>Nietzsche's most abysmal thought: what if this life — every pain, every joy, every moment — recurred infinitely, exactly as it is, forever? Could you affirm it? Could you will it to repeat?</p>
        <p>This is not a cosmological claim but a psychological test. The person who can say "Yes — <em>da capo</em>, again!" to every moment of their life has achieved the highest form of self-affirmation. They have become what Nietzsche calls the Übermensch.</p>
        <p>The thought first comes to him in <em>The Gay Science</em>: "How well-disposed would you have to become to yourself and to life to <em>crave nothing more fervently</em> than this ultimate eternal confirmation?"</p>`,
      },
      {
        position: [0, 0.5, 0],
        title: 'The Will to Power',
        body: `<p>Nietzsche's fundamental claim: all living things are driven not by self-preservation (contra Darwin) but by a will to expand, overcome, create, dominate — the <em>Will to Power</em>.</p>
        <p>This is not merely political power. A scholar's will to power is the drive to master a field. An artist's is the drive to create. Even asceticism — the saint denying himself — is will to power turned inward, dominating the self.</p>
        <p>Slave morality (Christianity, democracy, egalitarianism) is, Nietzsche argues, the will to power of the weak — a cunning inversion that makes the virtues of strength into vices, and the vices of weakness into virtues.</p>`,
      },
      {
        position: [0, 2, -3],
        title: 'God is Dead',
        body: `<p>"God is dead. God remains dead. And we have killed him." This is not atheist triumphalism but a diagnosis of cultural catastrophe. The Christian moral framework that gave Western civilization its values, its sense of purpose, its ground — has collapsed.</p>
        <p>Science and the Enlightenment have destroyed the credibility of the Christian God. But the values that depended on God — truth, morality, meaning — have not yet been replaced. We are living in the shadow of a death we don't yet feel.</p>
        <p>Nietzsche's challenge: can we create new values from scratch? Can we say Yes to life without the crutch of an afterlife? That project — the <em>Revaluation of All Values</em> — was the task he set himself.</p>`,
      },
      {
        position: [-3, -1, -2],
        title: 'Apollo & Dionysus',
        body: `<p>In his first book, <em>The Birth of Tragedy</em>, Nietzsche identified two drives at the root of Greek culture — and all great art.</p>
        <p><strong>Apollo</strong>: the dream, individuation, beauty, form, the measured clarity of sculpture and epic poetry. <strong>Dionysus</strong>: intoxication, dissolution of self, music, ecstasy, the terrifying unity of all things.</p>
        <p>Great tragedy — Aeschylus, Sophocles — balanced both. The Socratic obsession with reason and optimism killed tragedy. Modern culture is impoverished Apollonian — all form, no ecstasy. Wagner (for a time) was his hope for a Dionysian rebirth.</p>`,
      },
      {
        position: [2, -0.5, 2],
        title: 'Master & Slave Morality',
        body: `<p>In <em>On the Genealogy of Morality</em>, Nietzsche traces how our moral vocabulary got inverted. Noble cultures called themselves "good" — strong, vital, creative — and their enemies "bad" (weak, base, reactive).</p>
        <p>The slave revolt in morality (led by the Jews and then Christianity) performed a great inversion: the weak revalued "good" as meek, humble, suffering, resentful — and "evil" as everything the powerful valued in themselves.</p>
        <p>The result: a civilization that glorifies pity, equality, and self-denial — not because these are truly good, but because the resentful (<em>ressentiment</em>) have no other weapon against strength.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    // Cycle sky
    if (this.skyMat) this.skyMat.uniforms.time.value = t;

    // Sun orbits
    if (this.sun) {
      const angle = t * 0.05 * Math.PI * 2;
      this.sun.position.set(Math.cos(angle) * 18, Math.sin(angle) * 12, -10);
    }

    // Flicker fires
    this.fires.forEach((f, i) => {
      f.light.intensity = f.baseIntensity + Math.sin(t * 8 + i * 2.3) * 0.5 + Math.sin(t * 13 + i) * 0.3;
    });

    // Rotate spiral
    if (this.spiralGroup) {
      this.spiralGroup.rotation.y = t * 0.2;
    }
    // Spiral steps pulse
    this.spiralPoints.forEach((step, i) => {
      step.material.emissiveIntensity = 0.1 + 0.4 * (i / this.spiralPoints.length) + 0.1 * Math.sin(t * 2 + i * 0.1);
    });

    // Drift ash
    const pos = this.ashGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += 0.003;
      pos.array[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
      if (pos.array[i * 3 + 1] > 5) pos.array[i * 3 + 1] = -3;
    }
    pos.needsUpdate = true;

    // Zarathustra glow pulse
    if (this.zarathFigure) {
      this.zarathFigure.traverse(c => {
        if (c.material) c.material.opacity = 0.5 + 0.25 * Math.sin(t * 1.5);
      });
    }
    if (this.zarathHalo) {
      this.zarathHalo.material.opacity = 0.15 + 0.15 * Math.sin(t * 1.2);
    }
    if (this.deadLight) {
      this.deadLight.intensity = 0.8 + 0.7 * Math.abs(Math.sin(t * 0.4));
    }
  }
}
