import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeVolcanicGroundMaterial } from '../shaders/materials.js';

// Shared dark stone step material for Hegel's helix
function makeStepMaterial(emissiveIntensity) {
  return new THREE.MeshStandardMaterial({
    color: 0x2a1e14,
    roughness: 0.85,
    metalness: 0.1,
    emissive: 0x8b2000,
    emissiveIntensity,
  });
}

export class HegelWorld extends BaseWorld {
  _build() {
    this._buildHelix();
    this._buildDialecticLevels();
    this._buildParticles();
    this._buildBackground();
    this._buildHotspots();

    const ambient = new THREE.AmbientLight(0x050210, 0.5);
    const topLight = new THREE.DirectionalLight(0xffa040, 1);
    topLight.position.set(0, 15, 0);
    this.group.add(ambient, topLight);
  }

  _buildBackground() {
    // Graduated deep-space sky with rising light from below (Absolute ascending)
    this.bgMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        void main(){
          float h = vDir.y * 0.5 + 0.5;
          vec3 bot = vec3(0.12, 0.05, 0.0);
          vec3 mid = vec3(0.04, 0.02, 0.08);
          vec3 top = vec3(0.01, 0.005, 0.02);
          vec3 col = mix(mix(bot, mid, smoothstep(0.0, 0.4, h)), top, smoothstep(0.4, 1.0, h));
          // faint stars
          float s = hash(normalize(vDir)*300.0);
          col += vec3(1.0,0.9,0.8) * (s > 0.995 ? smoothstep(0.995,1.0,s)*0.8 : 0.0);
          // ascending glow
          float glow = pow(max(0.0, dot(vDir, vec3(0,1,0))), 4.0);
          col += vec3(0.4, 0.2, 0.0) * glow * (0.3 + 0.2*sin(time*0.5));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(28, 32, 16), this.bgMat));

    // Ground plane
    const floorMat = makeVolcanicGroundMaterial();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 60, 60), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -8;
    this.group.add(floor);
  }

  _buildHelix() {
    this.helixMeshes = [];
    const LEVELS = 8;
    const HEIGHT_PER_LEVEL = 2.2;
    const RADIUS = 1.8; // helix radius

    for (let level = 0; level < LEVELS; level++) {
      const t = level / (LEVELS - 1);
      const baseY = level * HEIGHT_PER_LEVEL - 6;

      // Thesis angle spirals around the axis (one side of the helix)
      const thesisAngle = (level / LEVELS) * Math.PI * 2;
      const antiAngle = thesisAngle + Math.PI; // opposite side

      const tx = Math.cos(thesisAngle) * RADIUS;
      const tz = Math.sin(thesisAngle) * RADIUS;
      const ax = Math.cos(antiAngle) * RADIUS;
      const az = Math.sin(antiAngle) * RADIUS;

      // Thesis — solid glowing sphere (the positive moment)
      const thesisSize = 0.28 + t * 0.12;
      const thesisMat = new THREE.MeshStandardMaterial({
        color: 0xe8a030,
        emissive: 0x804010,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.2,
      });
      const thesis = new THREE.Mesh(new THREE.SphereGeometry(thesisSize, 12, 12), thesisMat);
      thesis.position.set(tx, baseY, tz);
      this.group.add(thesis);

      // Antithesis — wireframe icosahedron (the negation)
      const antiSize = 0.28 + t * 0.12;
      const anti = new THREE.Mesh(
        new THREE.IcosahedronGeometry(antiSize, 0),
        new THREE.MeshBasicMaterial({ color: 0x40c8e0, wireframe: true, transparent: true, opacity: 0.8 })
      );
      anti.position.set(ax, baseY, az);
      this.group.add(anti);

      // Synthesis — golden icosahedron midway up, on axis between them
      // Sits between thesis and antithesis, elevated by half a level
      if (level < LEVELS - 1) {
        const synAngle = thesisAngle + Math.PI * 0.5; // 90° between, spiraling upward
        const synR = RADIUS * 0.5;
        const syn = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.22 + t * 0.14, 1),
          new THREE.MeshStandardMaterial({
            color: 0xffe060,
            emissive: 0x806010,
            emissiveIntensity: 0.8,
            roughness: 0.15,
            metalness: 0.5,
          })
        );
        syn.position.set(Math.cos(synAngle)*synR, baseY + HEIGHT_PER_LEVEL * 0.5, Math.sin(synAngle)*synR);
        this.group.add(syn);
        this.helixMeshes.push({ thesis, anti, syn, level, thesisAngle });

        // Warm light at each synthesis
        const light = new THREE.PointLight(0xffaa30, 0.7, 4);
        light.position.copy(syn.position);
        this.group.add(light);
      } else {
        this.helixMeshes.push({ thesis, anti, syn: null, level, thesisAngle });
      }

      // Tension line between thesis and antithesis through center
      this.group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(tx, baseY, tz),
          new THREE.Vector3(ax, baseY, az),
        ]),
        new THREE.LineBasicMaterial({ color: 0xff8020, transparent: true, opacity: 0.25 })
      ));

      // Helix strand lines connecting this level to next (thesis strand)
      if (level < LEVELS - 1) {
        const nextAngle = ((level + 1) / LEVELS) * Math.PI * 2;
        const nx = Math.cos(nextAngle) * RADIUS;
        const nz = Math.sin(nextAngle) * RADIUS;
        const nY = (level + 1) * HEIGHT_PER_LEVEL - 6;

        // Thesis strand
        const pts1 = [];
        for (let s = 0; s <= 10; s++) {
          const f = s / 10;
          const a = thesisAngle + f * (nextAngle - thesisAngle + Math.PI * 2 / LEVELS);
          const y = baseY + f * HEIGHT_PER_LEVEL;
          pts1.push(new THREE.Vector3(Math.cos(a)*RADIUS, y, Math.sin(a)*RADIUS));
        }
        this.group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts1),
          new THREE.LineBasicMaterial({ color: 0xe8a030, transparent: true, opacity: 0.35 })
        ));

        // Antithesis strand
        const pts2 = pts1.map(p => new THREE.Vector3(-p.x, p.y, -p.z));
        this.group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts2),
          new THREE.LineBasicMaterial({ color: 0x40c8e0, transparent: true, opacity: 0.35 })
        ));
      }
    }

    // Central vertical spine (the Absolute, the axis of history)
    const spinePts = [];
    for (let i = 0; i < 60; i++) {
      spinePts.push(new THREE.Vector3(0, -6 + (i / 59) * LEVELS * HEIGHT_PER_LEVEL, 0));
    }
    this.group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(spinePts),
      new THREE.LineBasicMaterial({ color: 0xffcc60, transparent: true, opacity: 0.15 })
    ));
  }

  _buildDialecticLevels() {
    // Ascending light gradient
    this.ascendLight = new THREE.PointLight(0xffcc44, 0, 20);
    this.ascendLight.position.set(0, 10, 0);
    this.group.add(this.ascendLight);

    // Circular dais at the base — where the helix begins
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x1a0a04, roughness: 0.85, emissive: 0x3a0800, emissiveIntensity: 0.1 });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.3, 32), daisMat);
    dais.position.set(0, -6.15, 0);
    this.group.add(dais);

    // Concentric rings inlaid on the dais (thesis / antithesis / synthesis circles)
    const ringMat = new THREE.LineBasicMaterial({ color: 0xff8020, transparent: true, opacity: 0.4 });
    [1.5, 2.8, 4.0].forEach(r => {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a)*r, -5.98, Math.sin(a)*r));
      }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    });

    // Radiating spokes on the dais
    const spokeMat = new THREE.LineBasicMaterial({ color: 0xff6010, transparent: true, opacity: 0.25 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -5.98, 0),
        new THREE.Vector3(Math.cos(a)*4.0, -5.98, Math.sin(a)*4.0),
      ]);
      this.group.add(new THREE.Line(geo, spokeMat));
    }

    // 6 standing stone pillars around the dais
    const pillarMat = makeStepMaterial(0.08);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.5, 7), pillarMat);
      pillar.position.set(Math.cos(a)*4.2, -4.5, Math.sin(a)*4.2);
      this.group.add(pillar);
    }

    // Ring of embers at the very base
    const emberCount = 80;
    const ePos = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.5 + Math.random() * 1.5;
      ePos[i*3]   = Math.cos(a) * r;
      ePos[i*3+1] = -5.9 + Math.random() * 0.2;
      ePos[i*3+2] = Math.sin(a) * r;
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    this.group.add(new THREE.Points(eGeo, new THREE.PointsMaterial({
      color: 0xff6010, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false,
    })));

    // Lava glow at the base
    const baseGlow = new THREE.PointLight(0xff4000, 2.5, 10);
    baseGlow.position.set(0, -6, 0);
    this.group.add(baseGlow);
  }

  _buildParticles() {
    const count = 600;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 2;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16 - 3;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      velocities[i * 3] = (Math.random() - 0.5) * 0.005;
      velocities[i * 3 + 1] = 0.01 + Math.random() * 0.015; // always rising
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.005;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.spiritGeo = geo;
    this.spiritPositions = positions;
    this.spiritVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0xffa040,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _update(t) {
    if (this.bgMat) this.bgMat.uniforms.time.value = t;

    // Rotate thesis/antithesis, pulse synthesis
    this.helixMeshes.forEach(({ thesis, anti, syn, level }) => {
      thesis.rotation.y = t * 0.5 + level;
      anti.rotation.x = t * 0.4 + level * 0.5;
      if (syn) {
        syn.rotation.y = -t * 0.3 + level;
        syn.rotation.x = t * 0.2;
        syn.material.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 1.5 + level);
      }
    });

    // Rising Absolute Spirit light
    this.ascendLight.intensity = 1.5 + Math.sin(t * 0.5) * 0.5;

    // Particles spiral upward
    const pos = this.spiritGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const angle = t * 0.3 + i * 0.01;
      const r = 0.5 + (pos.array[i * 3 + 1] + 3) * 0.1;
      pos.array[i * 3] = Math.cos(angle + i) * r;
      pos.array[i * 3 + 1] += this.spiritVelocities[i * 3 + 1];
      pos.array[i * 3 + 2] = Math.sin(angle + i) * r;
      if (pos.array[i * 3 + 1] > 10) pos.array[i * 3 + 1] = -8;
    }
    pos.needsUpdate = true;
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, -4, 0],
        title: 'The Dialectic',
        body: `<p>Hegel's central method: thesis → antithesis → synthesis. Every concept, every historical epoch, every institution contains its own negation. The negation rises, conflicts with the original, and the tension is resolved in a higher unity — the synthesis — which itself becomes a new thesis.</p>
        <p>This is not arbitrary. The dialectic is driven by the inner logic of concepts — contradiction is not an error to be eliminated but a motor of development. Reality itself is rational, and rationality is real.</p>
        <p>"The Rational is the Real; the Real is the Rational." History is the unfolding of Reason — not human reason but Reason itself, the Absolute, coming to know itself through human history.</p>`,
      },
      {
        position: [-1.2, 0, 0],
        title: 'The Phenomenology of Spirit',
        body: `<p>Hegel's 1807 masterwork traces the journey of consciousness from its simplest form (bare sense-certainty: "this stone, here, now") to Absolute Knowledge. Each stage reveals its own inadequacy and drives the mind to a higher, more adequate form of understanding.</p>
        <p>Along the way: the master-slave dialectic (the struggle for recognition that defines social existence), the unhappy consciousness (the medieval soul torn between this world and God), Enlightenment, the Terror of the French Revolution, and finally Spirit's recognition of itself in the world.</p>
        <p>Marx read this as the alienation of human labor. Existentialists read the unhappy consciousness as the modern condition. The book is inexhaustible.</p>`,
      },
      {
        position: [1.2, 0, 0],
        title: 'The Master-Slave Dialectic',
        body: `<p>Two self-consciousnesses meet. Each seeks recognition from the other. A life-and-death struggle ensues. One surrenders, becoming the slave; the other wins, becoming the master.</p>
        <p>But the dialectic inverts: the master, receiving recognition only from a slave (whose recognition is worthless), becomes dependent and stagnant. The slave, forced to work on the world, transforms it — and through labor, transforms himself. The slave becomes conscious of his own freedom.</p>
        <p>Marx used this to explain class struggle. Alexandre Kojève's 1930s lectures on this passage influenced Sartre, Merleau-Ponty, Lacan, Raymond Aron — arguably the whole of 20th-century French thought.</p>`,
      },
      {
        position: [0, 6, 0],
        title: 'Absolute Spirit',
        body: `<p>The endpoint of Hegel's system: Absolute Spirit — the whole of reality understanding itself. Spirit begins unconscious of itself (as nature), becomes self-conscious in individual minds, and finally achieves full self-knowledge through Art, Religion, and Philosophy.</p>
        <p>Philosophy is the highest form: it grasps the Absolute not in images (art) or representations (religion) but in pure concepts. Hegel's own philosophy, he believed, was the moment when Spirit finally understood itself completely.</p>
        <p>This breathtaking ambition — to be the endpoint of all human thought — made Hegel the dominant philosopher of the 19th century, and made the 20th century largely a struggle to escape him.</p>`,
      },
      {
        position: [0, 2, 0],
        title: 'History & Freedom',
        body: `<p>"World history is the progress of the consciousness of freedom." Hegel reads history as the gradual unfolding of freedom — not arbitrary freedom but rational freedom, the freedom of self-determination.</p>
        <p>The Oriental world (one is free — the despot), the Greek and Roman world (some are free — citizens, not slaves), the Germanic-Christian world (all are free — the Protestant principle of subjective conscience). Each epoch is a necessary stage.</p>
        <p>The state, for Hegel, is not the enemy of freedom but its highest actualization — the "march of God in the world." This view alarmed liberals (Marx called it apologetics for Prussia) but Hegel distinguished the actual rational state from any existing corrupt one.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }
}
