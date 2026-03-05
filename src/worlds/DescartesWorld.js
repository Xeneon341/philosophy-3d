import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeWoodMaterial } from '../shaders/materials.js';

export class DescartesWorld extends BaseWorld {
  _build() {
    this._buildStudy();
    this._buildDissolution();
    this._buildCogito();
    this._buildCartesianGrid();
    this._buildParticles();
    this._buildHotspots();

    this._buildSky();
    const ambient = new THREE.AmbientLight(0x050a15, 0.8);
    const cogLight = new THREE.PointLight(0x8ab4d4, 4, 12);
    cogLight.position.set(0, 0, 0);
    this.group.add(ambient, cogLight);
    this.cogLight = cogLight;
  }

  _buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, dissolve: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        uniform float dissolve;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        void main(){
          // Study sky = dark warm brown. Cogito void = pure black. Grid = dark blue.
          vec3 study  = vec3(0.06, 0.04, 0.02);
          vec3 cogito = vec3(0.0, 0.0, 0.0);
          vec3 grid   = vec3(0.01, 0.02, 0.06);
          float cycle = mod(time * 0.166, 6.0);
          float toGrid = smoothstep(4.0, 6.0, cycle);
          vec3 col = mix(mix(study, cogito, dissolve), grid, toGrid);
          // Star-like cogito shimmer
          float s = hash(normalize(vDir) * 500.0);
          col += vec3(0.6, 0.8, 1.0) * (s > 0.998 ? 0.6 * dissolve : 0.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(15, 24, 12), this.skyMat));
  }

  _buildStudy() {
    // Baroque study that dissolves
    const woodMat = makeWoodMaterial();

    // Floor tiles
    const tileGeo = new THREE.BoxGeometry(0.8, 0.05, 0.8);
    const tileMat1 = makeWoodMaterial();
    const tileMat2 = makeWoodMaterial();
    this.studyObjects = [];

    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const tile = new THREE.Mesh(tileGeo, (x + z) % 2 === 0 ? tileMat1 : tileMat2);
        tile.position.set(x * 0.85, -1.5, z * 0.85);
        this.group.add(tile);
        this.studyObjects.push(tile);
      }
    }

    // Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), woodMat);
    desk.position.set(1, -0.5, 0);
    this.group.add(desk);
    this.studyObjects.push(desk);

    // Candle flame
    const candleMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
    this.candle = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 6), candleMat);
    this.candle.position.set(0.5, -0.2, 0);
    this.group.add(this.candle);
    this.studyObjects.push(this.candle);

    this.candleLight = new THREE.PointLight(0xffaa44, 1.5, 5);
    this.candleLight.position.copy(this.candle.position);
    this.group.add(this.candleLight);
  }

  _buildCogito() {
    // The single glowing cogito point
    const geo = new THREE.SphereGeometry(0.08, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.cogito = new THREE.Mesh(geo, mat);
    this.cogito.position.set(0, 0, 0);
    this.cogito.scale.setScalar(0); // starts invisible
    this.group.add(this.cogito);

    // Cogito aura rings
    this.cogitoRings = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.15 + i * 0.3, 0.18 + i * 0.3, 32),
        new THREE.MeshBasicMaterial({
          color: 0x8ab4d4,
          transparent: true,
          opacity: 0.4 - i * 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      this.cogitoRings.push(ring);
      this.group.add(ring);
    }
  }

  _buildCartesianGrid() {
    // X Y Z axes reconstructing from the cogito
    const axisColors = [0xff4444, 0x44ff44, 0x4488ff];
    const dirs = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    this.axes = [];

    dirs.forEach((dir, i) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        dir.clone().multiplyScalar(-8),
        dir.clone().multiplyScalar(8),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: axisColors[i],
        transparent: true,
        opacity: 0,
      });
      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.axes.push(line);
    });

    // Grid planes
    const gridHelper = new THREE.GridHelper(10, 20, 0x1a2a4a, 0x0d1520);
    gridHelper.position.y = -1.5;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0;
    this.group.add(gridHelper);
    this.gridHelper = gridHelper;

    // Cartesian objects reassembling
    this.reassembledObjects = [];
    const shapes = [
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8),
    ];

    shapes.forEach((geo, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8ab4d4,
        transparent: true,
        opacity: 0,
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0x1a3050,
        emissiveIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-2 + i * 2, 0, -2);
      this.group.add(mesh);
      this.reassembledObjects.push(mesh);
    });
  }

  _buildDissolution() {
    this.dissolveProgress = 0; // 0 = study, 1 = pure cogito
    this.phase = 0; // 0: normal, 1: dissolving, 2: cogito, 3: rebuilding
    this.phaseTimer = 0;
  }

  _buildParticles() {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustGeo = geo;
    this.dustPositions = positions;
    const mat = new THREE.PointsMaterial({
      color: 0x5a8ab0,
      size: 0.03,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, 0, 0],
        title: 'Cogito Ergo Sum',
        body: `<p>"I think, therefore I am." The most famous sentence in philosophy — and its simplest. Descartes sought to demolish all inherited knowledge and rebuild on a foundation that doubt itself could not touch.</p>
        <p>He found it in the very act of doubting. Even if everything else is an illusion — the world, his body, mathematics — the fact that he is <em>doubting</em> proves that he, as a thinking thing, exists.</p>
        <p>The cogito is not a syllogism but a direct intuition: the self-evidence of one's own existence in the act of thought. Everything else must be rebuilt from here.</p>`,
      },
      {
        position: [1, -0.4, 0],
        title: 'Methodological Doubt',
        body: `<p>Descartes' method was radical: doubt everything that can possibly be doubted. Senses? They deceive. Mathematics? Perhaps an evil demon is tricking him. Memory, the external world, other minds — all suspect.</p>
        <p>This is not sincere skepticism but a tool — the hyperbolic doubt is designed to be extreme, to see what survives. Only the cogito survives.</p>
        <p>From there, Descartes used the existence of God (proven, he thought, from the clear and distinct idea of a perfect being) to guarantee that his faculties are reliable — and rebuilt the world on that basis.</p>`,
      },
      {
        position: [-2, 0, -1.5],
        title: 'Mind-Body Dualism',
        body: `<p>Descartes drew a sharp line between two substances: <em>res cogitans</em> (thinking substance, the mind) and <em>res extensa</em> (extended substance, the body and all matter). They are completely different in nature.</p>
        <p>The mind is indivisible, immaterial, private. The body is divisible, spatial, mechanical — a complex clock. Animals, having no minds, are just clocks. Pain in an animal is just mechanism.</p>
        <p>The problem this created haunts philosophy still: how do mind and body interact? Descartes said through the pineal gland. Nobody believed him. The "mind-body problem" is his enduring legacy.</p>`,
      },
      {
        position: [2, 0, -1],
        title: 'The Cartesian Coordinate System',
        body: `<p>Legend has it Descartes invented analytic geometry while watching a fly on his ceiling — realizing its position could be described with just two numbers. Whether true or not, his innovation was revolutionary.</p>
        <p>By mapping geometry onto algebra, Descartes unified two great branches of mathematics. Every geometric shape became an equation; every equation became a curve. This made calculus possible, and calculus made modern physics possible.</p>
        <p>The x-y-z axes that structure our 3D world — and this very scene — are Descartes' gift to science.</p>`,
      },
      {
        position: [0, 1, 2],
        title: 'Clear and Distinct Ideas',
        body: `<p>After establishing the cogito, Descartes needed a criterion for truth. He proposed: whatever I perceive <em>clearly and distinctly</em> is true. The cogito itself is clear and distinct — and that clarity is what makes it trustworthy.</p>
        <p>This is the rationalist wager: reason, properly used, can penetrate to necessary truths. The senses deceive; but the mind's own luminous perceptions — mathematical truths, logical relationships, the nature of God — are certain.</p>
        <p>Hume would later devastate this optimism, arguing that reason can only tell us about relations of ideas, never about matters of fact.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    this.phaseTimer += 0.005;
    // Cycle: 0-1 study, 1-2 dissolve, 2-4 cogito, 4-6 rebuild, loop
    const cycle = this.phaseTimer % 6;

    let dissolve = 0;
    let cogitoScale = 0;
    let axisOpacity = 0;

    if (cycle < 1) {
      // Normal study
      dissolve = 0;
    } else if (cycle < 2) {
      // Dissolving
      dissolve = (cycle - 1);
    } else if (cycle < 4) {
      // Cogito moment
      dissolve = 1;
      cogitoScale = Math.min(1, (cycle - 2) * 2);
    } else {
      // Rebuilding
      dissolve = Math.max(0, 1 - (cycle - 4) / 2);
      cogitoScale = Math.max(0, 1 - (cycle - 4) / 2);
      axisOpacity = Math.min(1, (cycle - 4) / 1.5);
    }

    if (this.skyMat) { this.skyMat.uniforms.time.value = t; this.skyMat.uniforms.dissolve.value = dissolve; }

    // Apply dissolve to study objects (only standard materials support opacity fade)
    this.studyObjects.forEach((obj, i) => {
      if (obj.material && obj.material.isMeshStandardMaterial) {
        obj.material.transparent = true;
        obj.material.opacity = Math.max(0, 1 - dissolve * 1.5 + 0.02 * Math.sin(t * 3 + i));
      } else if (obj.material && (obj.material.isShaderMaterial || obj.material.isMeshBasicMaterial)) {
        const s = Math.max(0, 1 - dissolve * 1.5);
        obj.scale.setScalar(s < 0.01 ? 0.001 : 1);
      }
    });

    // Candle flicker and fade
    if (this.candleLight) {
      this.candleLight.intensity = Math.max(0, 1.5 - dissolve * 2) * (1 + 0.2 * Math.sin(t * 9));
    }

    // Cogito pulse
    if (this.cogito) {
      const s = cogitoScale * (1 + 0.08 * Math.sin(t * 4));
      this.cogito.scale.setScalar(s);
      this.cogLight.intensity = cogitoScale * 4;
    }

    // Cogito rings
    this.cogitoRings.forEach((ring, i) => {
      ring.rotation.x = t * (0.3 + i * 0.1);
      ring.rotation.y = t * (0.2 + i * 0.15);
      ring.material.opacity = cogitoScale * (0.4 - i * 0.07);
    });

    // Axes fade in
    this.axes.forEach((axis, i) => {
      axis.material.opacity = axisOpacity;
    });
    if (this.gridHelper) this.gridHelper.material.opacity = axisOpacity * 0.6;

    // Reassembled objects
    this.reassembledObjects.forEach((obj, i) => {
      obj.material.opacity = axisOpacity * 0.8;
      obj.rotation.y = t * 0.3 + i;
      obj.position.y = Math.sin(t * 0.5 + i) * 0.2;
    });

    // Dust particles
    const pos = this.dustGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3] += Math.sin(t * 0.2 + i * 0.1) * 0.001;
      pos.array[i * 3 + 1] += Math.cos(t * 0.15 + i * 0.07) * 0.001;
    }
    pos.needsUpdate = true;
  }
}
