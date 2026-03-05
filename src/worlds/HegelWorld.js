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
    const HEIGHT_PER_LEVEL = 2;

    for (let level = 0; level < LEVELS; level++) {
      const t = level / LEVELS;
      const baseY = level * HEIGHT_PER_LEVEL - 6;
      const complexity = 0.3 + t * 0.7; // more complex higher up

      // Thesis — solid shape
      const thesisGeo = new THREE.IcosahedronGeometry(0.3 + t * 0.1, Math.floor(complexity * 2));
      const thesisMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.6 - t * 0.2, 0.8, 0.4 + t * 0.2),
        emissive: new THREE.Color().setHSL(0.6 - t * 0.2, 0.8, 0.15),
        emissiveIntensity: 0.5,
        roughness: 0.3,
      });
      const thesis = new THREE.Mesh(thesisGeo, thesisMat);
      thesis.position.set(-1.2, baseY, 0);
      this.group.add(thesis);

      // Antithesis — hollow/wireframe
      const antiGeo = new THREE.IcosahedronGeometry(0.3 + t * 0.1, 0);
      const antiMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.1 + t * 0.1, 0.9, 0.5),
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      const anti = new THREE.Mesh(antiGeo, antiMat);
      anti.position.set(1.2, baseY, 0);
      this.group.add(anti);

      // Synthesis — more complex, between and above
      if (level < LEVELS - 1) {
        const synGeo = new THREE.IcosahedronGeometry(0.35 + t * 0.15, Math.ceil(complexity * 2));
        const synMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.08 + t * 0.05, 0.9, 0.5 + t * 0.1),
          emissive: new THREE.Color().setHSL(0.08, 0.8, 0.2),
          emissiveIntensity: 0.6,
          roughness: 0.2,
          metalness: 0.3,
        });
        const syn = new THREE.Mesh(synGeo, synMat);
        syn.position.set(0, baseY + HEIGHT_PER_LEVEL * 0.5, 0);
        this.group.add(syn);
        this.helixMeshes.push({ thesis, anti, syn, level });

        // Light at synthesis point
        const light = new THREE.PointLight(
          new THREE.Color().setHSL(0.08, 0.9, 0.6),
          0.8,
          3
        );
        light.position.copy(syn.position);
        this.group.add(light);
      }

      // Tension lines between thesis and antithesis
      const tensionGeo = new THREE.BufferGeometry().setFromPoints([
        thesis.position.clone(),
        anti.position.clone(),
      ]);
      const tensionMat = new THREE.LineBasicMaterial({
        color: 0xffa040,
        transparent: true,
        opacity: 0.3,
      });
      this.group.add(new THREE.Line(tensionGeo, tensionMat));
    }

    // Vertical spine
    const spinePts = [];
    for (let i = 0; i < 40; i++) {
      const y = -6 + (i / 39) * LEVELS * HEIGHT_PER_LEVEL;
      spinePts.push(new THREE.Vector3(0, y, 0));
    }
    const spineGeo = new THREE.BufferGeometry().setFromPoints(spinePts);
    const spineMat = new THREE.LineBasicMaterial({
      color: 0xffa040,
      transparent: true,
      opacity: 0.2,
    });
    this.group.add(new THREE.Line(spineGeo, spineMat));
  }

  _buildDialecticLevels() {
    // Ascending light gradient
    this.ascendLight = new THREE.PointLight(0xffcc44, 0, 20);
    this.ascendLight.position.set(0, 10, 0);
    this.group.add(this.ascendLight);
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
