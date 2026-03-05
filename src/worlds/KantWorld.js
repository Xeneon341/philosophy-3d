import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeDarkStoneMaterial, makeMarbleMaterial } from '../shaders/materials.js';

export class KantWorld extends BaseWorld {
  _build() {
    this._buildFloor();
    this._buildColumns();
    this._buildCeiling();
    this._buildWindowsToWorld();
    this._buildSealedDoor();
    this._buildMoralLaw();
    this._buildHotspots();

    this._buildSky();

    const ambient = new THREE.AmbientLight(0x1a1a28, 0.6);
    const topLight = new THREE.DirectionalLight(0xe8e8f0, 0.8);
    topLight.position.set(0, 10, 0);
    // Four corner fill lights replacing 12 per-column point lights
    [[ 4,4, 0],[-4,4, 0],[0,4, 4],[0,4,-4]].forEach(([fx,fy,fz]) => {
      const fl = new THREE.PointLight(0x6080c0, 0.4, 10);
      fl.position.set(fx, fy, fz);
      this.group.add(fl);
    });
    this.group.add(ambient, topLight);
  }

  _buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        void main(){
          float h = vDir.y * 0.5 + 0.5;
          vec3 col = mix(vec3(0.04,0.04,0.1), vec3(0.01,0.01,0.06), h);
          // Very faint starfield
          float s = hash(normalize(vDir)*400.0);
          col += vec3(0.8,0.85,1.0) * (s>0.996 ? 0.5 : 0.0);
          // Subtle zenith glow
          col += vec3(0.1,0.1,0.3) * pow(max(0.0,vDir.y), 3.0) * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), this.skyMat));
  }

  _buildFloor() {
    // Categorical Imperative tessellation on floor
    const geo = new THREE.PlaneGeometry(12, 12, 40, 40);
    const mat = makeDarkStoneMaterial();
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    this.group.add(floor);

    // Gold tessellation lines
    this.moralLines = [];
    for (let i = -5; i <= 5; i++) {
      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-5, -1.98, i),
        new THREE.Vector3(5, -1.98, i),
      ]);
      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, -1.98, -5),
        new THREE.Vector3(i, -1.98, 5),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0xc8a96e,
        transparent: true,
        opacity: 0.3,
      });
      this.group.add(new THREE.Line(hGeo, mat));
      this.group.add(new THREE.Line(vGeo, mat));
    }
  }

  _buildColumns() {
    const CATEGORIES = [
      'Unity', 'Plurality', 'Totality',
      'Reality', 'Negation', 'Limitation',
      'Subsistence', 'Causality', 'Community',
      'Possibility', 'Existence', 'Necessity',
    ];

    const colMat = makeMarbleMaterial();

    this.columns = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 4;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const geo = new THREE.CylinderGeometry(0.15, 0.18, 6, 8);
      const col = new THREE.Mesh(geo, colMat);
      col.position.set(x, 1, z);
      this.group.add(col);
      this.columns.push(col);

      // Capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), colMat);
      cap.position.set(x, 4, z);
      this.group.add(cap);
    }
  }

  _buildCeiling() {
    // Vaulted ceiling = Space and Time themselves
    const geo = new THREE.SphereGeometry(6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    this.ceilingMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          float r = length(vPos.xz) / 6.0;
          // Time rings
          float timeRing = sin(r * 10.0 - time * 0.5) * 0.5 + 0.5;
          // Space grid
          float spaceGrid = step(0.95, sin(vUv.x * 20.0)) + step(0.95, sin(vUv.y * 20.0));
          spaceGrid = clamp(spaceGrid, 0.0, 1.0);
          vec3 col = vec3(0.08, 0.08, 0.18);
          col += vec3(0.1, 0.1, 0.4) * timeRing * 0.3;
          col += vec3(0.3, 0.3, 0.6) * spaceGrid * 0.4;
          gl_FragColor = vec4(col, 0.9);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const ceiling = new THREE.Mesh(geo, this.ceilingMat);
    ceiling.position.y = 4;
    ceiling.rotation.x = Math.PI;
    this.group.add(ceiling);
  }

  _buildWindowsToWorld() {
    // Four stone walls with frosted windows cut into them
    this.windows = [];
    const wallMat = makeDarkStoneMaterial();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9aabcc,
      transparent: true,
      opacity: 0.22,
      roughness: 0.75,
      transmission: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const WALL_DEFS = [
      { x: 0,    z: -4.8, ry: 0 },
      { x: 0,    z:  4.8, ry: Math.PI },
      { x: -4.8, z:  0,   ry: Math.PI / 2 },
      { x:  4.8, z:  0,   ry: -Math.PI / 2 },
    ];

    WALL_DEFS.forEach(({ x, z, ry }) => {
      // Full wall panel
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 7, 8, 6), wallMat);
      wall.position.set(x, 1.5, z);
      wall.rotation.y = ry;
      this.group.add(wall);

      // Frosted glass window inset
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), glassMat);
      // Offset slightly in front of wall so it doesn't z-fight
      const offset = 0.05;
      glass.position.set(
        x + Math.sin(ry) * offset,
        1.5,
        z + Math.cos(ry) * offset
      );
      glass.rotation.y = ry;
      this.group.add(glass);
      this.windows.push(glass);

      // Glow through window from the phenomenal world outside
      const winLight = new THREE.PointLight(0x7088cc, 0.6, 8);
      winLight.position.set(x + Math.sin(ry) * 3, 1.5, z + Math.cos(ry) * 3);
      this.group.add(winLight);
    });
  }

  _buildSealedDoor() {
    // The door to the thing-in-itself — sealed
    const doorGeo = new THREE.BoxGeometry(1, 2.2, 0.15);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x100810,
      emissive: 0x2a0050,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.5,
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0, -4.73);
    this.group.add(door);

    // Glow around door frame
    const light = new THREE.PointLight(0x6600aa, 1.5, 3);
    light.position.set(0, 0, -4.73);
    this.group.add(light);
    this.doorLight = light;
  }

  _buildMoralLaw() {
    // Categorical Imperative as glowing geometric star on floor
    const starPoints = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? 1.5 : 0.7;
      starPoints.push(new THREE.Vector3(Math.cos(angle) * r, -1.97, Math.sin(angle) * r));
    }
    starPoints.push(starPoints[0].clone()); // close

    const starGeo = new THREE.BufferGeometry().setFromPoints(starPoints);
    this.starMat = new THREE.LineBasicMaterial({
      color: 0xc8a96e,
      transparent: true,
      opacity: 0.7,
    });
    this.group.add(new THREE.Line(starGeo, this.starMat));
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, -1.5, 0],
        title: 'The Categorical Imperative',
        body: `<p>Kant's supreme principle of morality: "Act only according to that maxim whereby you can at the same time will that it should become a universal law."</p>
        <p>Before acting, ask: what if everyone did this? If universalizing your maxim leads to contradiction or absurdity, the act is forbidden. Lying fails the test — a world of universal lying destroys the institution of communication that makes lying possible.</p>
        <p>Kant offers a second formulation: "Act so that you treat humanity, whether in your own person or that of another, always as an end and never as a means only." People are not tools. They have dignity — unconditional worth that cannot be traded away.</p>`,
      },
      {
        position: [0, 4, 0],
        title: 'Space, Time & the Categories',
        body: `<p>Kant's Copernican revolution: instead of asking how the mind conforms to objects, ask how objects conform to the mind. We don't passively receive experience — we actively structure it.</p>
        <p>Space and Time are not features of the world in itself — they are the forms of our intuition, the lenses through which we must perceive. The twelve Categories of the Understanding (Causality, Substance, Unity...) are the concepts we necessarily impose on experience.</p>
        <p>Result: we can know the phenomenal world (as structured by our faculties) with certainty. But the <em>noumenal</em> world — things as they are in themselves — is forever beyond us.</p>`,
      },
      {
        position: [0, 0, -4.5],
        title: 'The Thing-In-Itself',
        body: `<p>Behind the phenomenal world we experience lies the noumenal world — reality as it is in itself, undistorted by our cognitive apparatus. Kant insists it exists. He equally insists we can never know it.</p>
        <p>This sealed door is the most provocative idea in modern philosophy. Fichte removed it (the self posits the non-self). Hegel turned it into the Absolute unfolding in history. Schopenhauer identified it with the Will. Each was responding to the problem Kant created.</p>
        <p>The thing-in-itself remains one of philosophy's deepest wounds — the point where knowledge runs out and speculation begins.</p>`,
      },
      {
        position: [4, 1, 0],
        title: 'The Critique of Pure Reason',
        body: `<p>Kant spent eleven years working on the <em>Critique of Pure Reason</em> (1781), then wrote it in four to five months. He called it a "Copernican revolution" in philosophy.</p>
        <p>The book asked: what can reason know without any input from experience? His answer: the structure of possible experience — the forms of intuition (space and time) and the categories of understanding. But reason cannot reach beyond experience to prove God, the soul, or free will.</p>
        <p>The "antinomies" — where pure reason produces contradictions (is the world finite or infinite? is the will free or determined?) — prove that metaphysics overreaches. Reason has hard limits.</p>`,
      },
      {
        position: [-4, 1, 0],
        title: 'The Sublime',
        body: `<p>In the <em>Critique of Judgment</em>, Kant distinguished beauty from the sublime. Beauty pleases because the world fits our faculties — the world and our minds are in harmony.</p>
        <p>The sublime is different: it arises when nature overwhelms our faculties — a storm at sea, an infinite starry sky, a mountain range that dwarfs the human. First we feel fear; then, as we realize that our <em>reason</em> can conceive the infinite even if our senses can't grasp it, we feel a strange exaltation.</p>
        <p>The sublime makes us aware of our dual nature: small as physical beings, immense as rational ones. "Two things fill the mind with ever new and increasing admiration: the starry sky above me, and the moral law within me."</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    if (this.ceilingMat) this.ceilingMat.uniforms.time.value = t;
    if (this.skyMat)     this.skyMat.uniforms.time.value = t;

    // Pulse door light
    if (this.doorLight) {
      this.doorLight.intensity = 1.0 + 0.5 * Math.sin(t * 0.7);
    }

    // Windows shimmer
    this.windows.forEach((w, i) => {
      w.material.opacity = 0.25 + 0.1 * Math.sin(t * 0.5 + i);
    });

    // Column subtle pulse — handled by point lights at each capital

    // Moral law star pulse
    if (this.starMat) {
      this.starMat.opacity = 0.5 + 0.3 * Math.sin(t * 1.2);
    }
  }
}
