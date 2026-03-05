import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';
import { makeDarkStoneMaterial, makeMarbleMaterial } from '../shaders/materials.js';

export class AquinasWorld extends BaseWorld {
  _build() {
    this._buildSky();
    this._buildFloor();
    this._buildNave();
    this._buildWindows();
    this._buildAltar();
    this._buildChainOfBeing();
    this._buildIncense();
    this._buildCandles();
    this._buildPews();
    this._buildHotspots();

    // Very dark ambient — cathedral interior should feel dim, mysterious
    const ambient = new THREE.AmbientLight(0x08091a, 0.4);
    // Altar key light — divine shaft from above
    const altarKey = new THREE.DirectionalLight(0xfff0c0, 1.2);
    altarKey.position.set(0, 15, -3);
    // Dim fill from back — soft reflection off rear wall
    const backFill = new THREE.DirectionalLight(0x1a1830, 0.3);
    backFill.position.set(0, 5, 10);
    this.group.add(ambient, altarKey, backFill);
  }

  _buildSky() {
    // Celestial vault — deep blue-violet with golden zenith glow
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
        void main(){
          float h = vDir.y * 0.5 + 0.5;
          vec3 deep   = vec3(0.03, 0.02, 0.10);
          vec3 mid    = vec3(0.06, 0.04, 0.18);
          vec3 zenith = vec3(0.18, 0.12, 0.05);
          vec3 col = mix(mix(deep, mid, smoothstep(0.0, 0.5, h)), zenith, smoothstep(0.5, 1.0, h));
          // Stars as distant angels — very faint
          float s = hash(normalize(vDir) * 380.0);
          col += vec3(0.9, 0.85, 0.7) * (s > 0.997 ? 0.4 : 0.0);
          // Golden zenith radiance — divine light from above
          col += vec3(0.5, 0.35, 0.05) * pow(max(0.0, vDir.y), 5.0) * (0.6 + 0.2 * sin(time * 0.3));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), this.skyMat));
  }

  _buildFloor() {
    // Stone floor with glowing cosmological diagram inlaid
    const geo = new THREE.PlaneGeometry(14, 22, 40, 60);
    const mat = makeDarkStoneMaterial();
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    this.group.add(floor);

    // Great Chain of Being diagram — concentric rings on the floor
    const ringMat = new THREE.LineBasicMaterial({ color: 0xc8a030, transparent: true, opacity: 0.35, depthWrite: false });
    [1.0, 2.0, 3.2, 4.6, 6.2].forEach(r => {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, -1.98, Math.sin(a) * r));
      }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    });

    // Radial spokes
    const spokeMat = new THREE.LineBasicMaterial({ color: 0xc8a030, transparent: true, opacity: 0.2, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const geo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -1.98, 0),
        new THREE.Vector3(Math.cos(a) * 6.2, -1.98, Math.sin(a) * 6.2),
      ]);
      this.group.add(new THREE.Line(geo2, spokeMat));
    }
  }

  _buildNave() {
    // Stone walls closing the cathedral
    const wallMat = makeDarkStoneMaterial();

    // Side walls
    [-5.5, 5.5].forEach(x => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 10, 6, 4), wallMat);
      wall.position.set(x, 3, 0);
      wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(wall);
    });

    // Back wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 10, 4, 4), wallMat);
    backWall.position.set(0, 3, 8);
    backWall.rotation.y = Math.PI;
    this.group.add(backWall);

    // Ribbed vaulted ceiling — arched segments
    const ceilingMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        void main() {
          // Stone base
          float n = noise(vWorldPos.xz * 0.8) * 0.5 + noise(vWorldPos.xz * 2.5) * 0.25;
          vec3 stone = mix(vec3(0.07,0.07,0.12), vec3(0.13,0.12,0.18), n);
          // Rib pattern — thin bright lines along UV grid
          float ribX = smoothstep(0.0, 0.03, abs(fract(vUv.x * 5.0) - 0.5));
          float ribY = smoothstep(0.0, 0.02, abs(fract(vUv.y * 8.0) - 0.5));
          float ribs = (1.0 - ribX) + (1.0 - ribY);
          ribs = clamp(ribs, 0.0, 1.0);
          stone = mix(stone, vec3(0.22, 0.20, 0.30), ribs * 0.5);
          // Divine glow from above (keystone)
          float dist = length(vUv - 0.5);
          stone += vec3(0.4, 0.28, 0.05) * smoothstep(0.5, 0.0, dist) * (0.3 + 0.1 * sin(time * 0.4));
          gl_FragColor = vec4(stone, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
    this.ceilingMat = ceilingMat;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(12, 22, 8, 12), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 7;
    this.group.add(ceiling);

    // Marble columns — pairs down the nave
    const colMat = makeMarbleMaterial();
    [[-4, -4], [-4, 0], [-4, 4], [4, -4], [4, 0], [4, 4]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 9, 10), colMat);
      col.position.set(x, 2.5, z);
      this.group.add(col);

      // Capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), colMat);
      cap.position.set(x, 7, z);
      this.group.add(cap);
    });
  }

  _buildWindows() {
    // Dramatic lancet windows with tracery, stained glass, and strong angled light beams
    this.windowLights = [];
    this.windowMats = [];

    const windowDefs = [
      { z: -4.5, color: new THREE.Color(0.1, 0.25, 0.9),  lightColor: 0x2244cc, label: 'Faith'   },
      { z:  0,   color: new THREE.Color(0.9, 0.65, 0.05), lightColor: 0xcc8800, label: 'Reason'  },
      { z:  4.5, color: new THREE.Color(0.45, 0.1, 0.8),  lightColor: 0x6622aa, label: 'Grace'   },
    ];

    windowDefs.forEach(({ z, color, lightColor }, wi) => {
      [-5.48, 5.48].forEach(x => {
        const ry = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        const side = x < 0 ? 1 : -1; // direction toward interior

        // ── STAINED GLASS — procedural shader with tracery ────────────────
        const glassMat = new THREE.ShaderMaterial({
          uniforms: {
            color:  { value: color },
            time:   { value: 0 },
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `
            uniform vec3 color;
            uniform float time;
            varying vec2 vUv;
            void main() {
              vec2 uv = vUv;
              // Lancet arch shape — top rounded
              float arch = 1.0 - smoothstep(0.35, 0.5, length(uv - vec2(0.5, 0.72)) - 0.18);
              float rect = step(0.08, uv.x) * step(uv.x, 0.92) * step(0.0, uv.y) * step(uv.y, 0.72);
              float shape = min(arch + rect, 1.0);

              // Lead tracery — thin dark dividing lines
              float vLine1 = 1.0 - smoothstep(0.0, 0.012, abs(uv.x - 0.5));
              float hLine1 = 1.0 - smoothstep(0.0, 0.010, abs(uv.y - 0.55));
              float hLine2 = 1.0 - smoothstep(0.0, 0.010, abs(uv.y - 0.28));
              float tracery = max(max(vLine1, hLine1), hLine2);

              // Rose window at top
              vec2 roseUV = (uv - vec2(0.5, 0.78)) * 6.0;
              float rosePetal = 0.0;
              for(int p=0; p<6; p++){
                float a = float(p) * 3.14159 / 3.0;
                vec2 pd = roseUV - vec2(cos(a), sin(a)) * 0.7;
                rosePetal = max(rosePetal, 1.0 - smoothstep(0.0, 0.25, length(pd)));
              }
              float roseCenter = 1.0 - smoothstep(0.0, 0.22, length(roseUV));
              float roseLead = max(rosePetal, roseCenter);
              tracery = max(tracery, roseLead * step(0.65, uv.y));

              // Color variation across panels
              float colorVar = 0.8 + 0.2 * sin(uv.x * 12.0 + uv.y * 8.0 + float(${wi}) * 2.1);
              vec3 glassCol = color * colorVar;

              // Lead is near-black
              glassCol = mix(vec3(0.04, 0.03, 0.04), glassCol, 1.0 - tracery * 0.8);

              // Glow pulse
              float glow = 0.7 + 0.3 * sin(time * 0.5 + float(${wi}) * 1.2);

              gl_FragColor = vec4(glassCol * glow, shape * 0.75);
            }
          `,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        this.windowMats.push(glassMat);

        // Tall lancet window panel (1.5 wide × 4.5 tall)
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.5, 1, 1), glassMat);
        glass.position.set(x, 4.2, z);
        glass.rotation.y = ry;
        this.group.add(glass);

        // Stone window surround — thin frame
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.9, metalness: 0.05 });
        // Top arch of frame
        const frameGeo = new THREE.TorusGeometry(0.75, 0.07, 4, 12, Math.PI);
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(x, 6.5, z);
        frame.rotation.y = ry;
        this.group.add(frame);

        // ── LIGHT SHAFT — angled beam from window into nave ──────────────
        const shaftColor = color.clone();
        const shaftMat = new THREE.ShaderMaterial({
          uniforms: {
            color: { value: shaftColor },
            time:  { value: 0 },
          },
          vertexShader: `
            varying float vT; // 0=window end, 1=floor end
            varying vec2 vUv;
            void main(){
              vUv = uv;
              vT = uv.y; // along shaft length
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 color;
            uniform float time;
            varying float vT;
            varying vec2 vUv;
            void main(){
              // Fade from bright at window to dim at floor
              float fade = (1.0 - vT) * 0.22;
              // Dust motes
              float dust = 0.92 + 0.08 * sin(vT * 18.0 + time * 0.8) * sin(vUv.x * 12.0 + time * 0.4);
              float alpha = fade * dust;
              gl_FragColor = vec4(color * 1.4, alpha);
            }
          `,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        this.windowLights.push(shaftMat);

        // Shaft: a thin cone/wedge from window down to floor, very narrow
        // Use a flat plane but orient it vertically (like a curtain of light)
        // with a severe inward tilt toward the nave floor
        const shaftGeo = new THREE.PlaneGeometry(0.6, 6.5, 1, 8);
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        // Place midpoint between window and floor impact point
        shaft.position.set(x + side * 1.8, 1.5, z);
        // Face perpendicular to wall, then tilt steeply downward-inward
        shaft.rotation.y = ry;                      // face along nave
        shaft.rotation.z = side * Math.PI * 0.32;   // ~57° tilt inward toward floor
        this.group.add(shaft);

        // Strong colored point light inside wall — the primary illumination source
        const pl = new THREE.PointLight(lightColor, 2.5, 12);
        pl.position.set(x + side * 0.8, 4.5, z);
        this.group.add(pl);

        // Secondary floor spot — where shaft hits the floor
        const floorSpot = new THREE.PointLight(lightColor, 0.8, 5);
        floorSpot.position.set(x + side * 4, -1.5, z);
        this.group.add(floorSpot);
      });
    });
  }

  _buildAltar() {
    // Central altar — stone block with radiant golden light shaft above
    const stoneMat = makeDarkStoneMaterial();

    const altarBase = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1.2), stoneMat);
    altarBase.position.set(0, -1.55, -5);
    this.group.add(altarBase);

    const altarTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.4), makeMarbleMaterial());
    altarTop.position.set(0, -1.05, -5);
    this.group.add(altarTop);

    // Golden cross above altar
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xc8a030, emissive: 0xc8a030, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.7 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), crossMat);
    crossV.position.set(0, 0.1, -5);
    this.group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), crossMat);
    crossH.position.set(0, 0.5, -5);
    this.group.add(crossH);

    // Divine light shaft descending onto altar
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying float vY; void main(){ vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying float vY;
        void main(){
          float fade = smoothstep(7.0, 0.0, vY) * smoothstep(-2.5, 0.0, vY);
          float flicker = 0.8 + 0.2 * sin(time * 0.7);
          gl_FragColor = vec4(1.0, 0.88, 0.45, fade * 0.12 * flicker);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.altarShaftMat = shaftMat;

    const shaftGeo = new THREE.CylinderGeometry(0.3, 1.2, 9, 8, 1, true);
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.set(0, 2, -5);
    this.group.add(shaftMesh);

    // Strong altar light
    this.altarLight = new THREE.PointLight(0xffd080, 3.5, 12);
    this.altarLight.position.set(0, 1, -5);
    this.group.add(this.altarLight);
  }

  _buildChainOfBeing() {
    // Vertical spine of glowing nodes: minerals → plants → animals → humans → angels → God
    const LEVELS = [
      { label: 'Minerals', color: 0x888888, y: -1.5 },
      { label: 'Plants',   color: 0x448844, y:  0.0 },
      { label: 'Animals',  color: 0xc87040, y:  1.5 },
      { label: 'Humans',   color: 0xc8a96e, y:  3.0 },
      { label: 'Angels',   color: 0xa0c0ff, y:  4.8 },
      { label: 'God',      color: 0xffffff, y:  6.8 },
    ];

    this.chainNodes = [];
    LEVELS.forEach(({ color, y }, i) => {
      const geo = new THREE.OctahedronGeometry(i === 5 ? 0.28 : 0.14, 0);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: i === 5 ? 1.2 : 0.5,
        roughness: 0.2,
        metalness: 0.3,
      });
      const node = new THREE.Mesh(geo, mat);
      node.position.set(2.5, y, -2);
      this.group.add(node);
      this.chainNodes.push({ node, mat, baseEmissive: i === 5 ? 1.2 : 0.5 });

      const pl = new THREE.PointLight(color, i === 5 ? 1.2 : 0.4, 3);
      pl.position.copy(node.position);
      this.group.add(pl);
    });

    // Connecting line
    const pts = LEVELS.map(({ y }) => new THREE.Vector3(2.5, y, -2));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xc8a96e, transparent: true, opacity: 0.4 });
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));

    // Ascending particles along the chain
    const count = 120;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = 2.5 + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = Math.random() * 8 - 1.5;
      positions[i * 3 + 2] = -2 + (Math.random() - 0.5) * 0.2;
    }
    const chainGeo = new THREE.BufferGeometry();
    chainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.chainGeo = chainGeo;
    this.group.add(new THREE.Points(chainGeo, new THREE.PointsMaterial({
      color: 0xffd080,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })));
  }

  _buildIncense() {
    // Incense smoke rising from two censers near the altar
    const count = 300;
    const positions = new Float32Array(count * 3);
    const incenseSources = [[-1, -1.8, -5], [1, -1.8, -5]];
    for (let i = 0; i < count; i++) {
      const src = incenseSources[i % 2];
      positions[i * 3]     = src[0] + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = src[1] + Math.random() * 5;
      positions[i * 3 + 2] = src[2] + (Math.random() - 0.5) * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.incenseGeo = geo;
    this.incensePositions = positions;
    this.group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xd0ccc0,
      size: 0.06,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })));
  }

  _buildCandles() {
    // Rows of candles along the nave — warm amber glow
    this.candleLights = [];
    const candlePositions = [
      [-3.5, -4], [-3.5, 0], [-3.5, 4],
      [ 3.5, -4], [ 3.5, 0], [ 3.5, 4],
    ];
    candlePositions.forEach(([x, z], i) => {
      // Candle stick
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xf0e8c0, roughness: 0.9 })
      );
      stick.position.set(x, -1.75, z);
      this.group.add(stick);

      // Flame
      const flameMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, seed: { value: i * 1.7 } },
        vertexShader: `
          uniform float time; uniform float seed;
          varying float vY;
          void main() {
            vY = (position.y + 0.15) / 0.3;
            vec3 pos = position;
            float sway = sin(time * 5.0 + seed) * 0.015 * vY;
            pos.x += sway;
            pos.z += cos(time * 4.3 + seed) * 0.01 * vY;
            pos.x *= (1.0 - vY * 0.5);
            pos.z *= (1.0 - vY * 0.5);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying float vY;
          void main() {
            vec3 base = vec3(1.0, 0.6, 0.1);
            vec3 tip  = vec3(0.8, 0.1, 0.0);
            vec3 col  = mix(base, tip, vY);
            gl_FragColor = vec4(col, (1.0 - vY) * 0.9);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 5, 1, true), flameMat);
      flame.position.set(x, -1.35, z);
      this.group.add(flame);
      this.candleLights.push(flameMat);

      // Warm light
      const pl = new THREE.PointLight(0xff9030, 0.6 + Math.random() * 0.3, 4);
      pl.position.set(x, -1.3, z);
      this.group.add(pl);
    });
  }

  _buildPews() {
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x1e1008, roughness: 0.9, metalness: 0 });
    const pewRows = [-6, -4, -2, 0, 2, 4];
    [-3.2, 3.2].forEach(x => {
      pewRows.forEach(z => {
        // Bench seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.6), darkWood);
        seat.position.set(x, -1.62, z);
        this.group.add(seat);
        // Back rest — always on the side away from altar (positive z)
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.07), darkWood);
        back.position.set(x, -1.33, z + 0.27);
        this.group.add(back);
        // Two legs
        [-0.65, 0.65].forEach(lx => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.55), darkWood);
          leg.position.set(x + lx, -1.82, z);
          this.group.add(leg);
        });
      });
    });
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [0, 0.5, -5],
        title: 'The Five Ways',
        body: `<p>Aquinas's five arguments for the existence of God, drawn from Aristotle and refined into Christian theology:</p>
        <p><strong>1. Motion</strong>: Everything moved is moved by another; there must be an Unmoved Mover.<br>
        <strong>2. Causation</strong>: No thing causes itself; there must be a First Cause.<br>
        <strong>3. Contingency</strong>: Contingent things need not exist; something must exist necessarily.<br>
        <strong>4. Gradation</strong>: Things are more or less good, true, noble — there must be a maximum.<br>
        <strong>5. Teleology</strong>: Natural things act toward ends; something intelligent must direct them.</p>
        <p>These are not proofs from faith but from natural reason — Aquinas believed reason alone could demonstrate God's existence. Faith then takes us further, to what reason cannot reach.</p>`,
      },
      {
        position: [2.5, 3.5, -2],
        title: 'The Great Chain of Being',
        body: `<p>All of reality is arranged in a hierarchy of being, from the simplest minerals to God himself. Each level participates in being, goodness, and truth — but only partially. Only God is identical with his own existence (<em>esse</em>).</p>
        <p>Minerals have being. Plants add life. Animals add sensation. Humans add reason. Angels add pure intellect without matter. God is pure Being itself — <em>ipsum esse subsistens</em> — the act of existing subsisting in itself.</p>
        <p>This is not a prison but a gift: every creature receives existence as a participation in God's own being. To exist at all is to be loved into being by the source of existence.</p>`,
      },
      {
        position: [-3.5, 3.5, 0],
        title: 'Faith & Reason',
        body: `<p>Aquinas's great project was the synthesis of Aristotelian reason with Christian faith. Against those who said philosophy corrupts faith, and against those who said faith makes reason unnecessary, he insisted: the two are complementary wings of a single truth.</p>
        <p>Natural reason can discover that God exists, that God is one, that the soul is immortal, and that morality is grounded in nature. But reason cannot discover the Trinity, the Incarnation, or the Resurrection — these require revelation.</p>
        <p>There can be no genuine contradiction between faith and reason, because both come from God. If a philosophical argument seems to contradict a revealed truth, either the argument has a flaw or the theology is mistaken. Truth cannot contradict truth.</p>`,
      },
      {
        position: [0, -1.5, 0],
        title: 'Natural Law',
        body: `<p>Morality is not arbitrary — it is written into the rational structure of human nature. God's eternal law governs all of creation; natural law is our rational participation in that eternal law.</p>
        <p>The first principle of natural law: <em>good is to be done and pursued, evil is to be avoided</em>. From this, reason derives specific precepts: preserve life, seek truth, live in community, worship God.</p>
        <p>Natural law is universal — knowable by all human beings through reason, regardless of revelation. This is the foundation of human rights, international law, and the idea that some acts are intrinsically wrong regardless of circumstances or intentions.</p>`,
      },
      {
        position: [0, 5.5, -3],
        title: 'Essence & Existence',
        body: `<p>Aquinas's most original metaphysical insight: in every creature, there is a real distinction between <em>what it is</em> (essence) and <em>that it is</em> (existence). A unicorn has an essence — we can define it — but no existence. A horse has both.</p>
        <p>In God alone are essence and existence identical. God does not <em>have</em> existence; God <em>is</em> existence — <em>ipsum esse subsistens</em>. This is why God cannot not exist: his essence just is to be.</p>
        <p>Every creature, by contrast, receives existence as a gift. This is Aquinas's version of creation: not God shaping pre-existing matter, but God freely communicating existence to things that have no claim on it.</p>`,
      },
    ];
    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    if (this.skyMat)      this.skyMat.uniforms.time.value = t;
    if (this.ceilingMat)  this.ceilingMat.uniforms.time.value = t;
    if (this.altarShaftMat) this.altarShaftMat.uniforms.time.value = t;

    // Animate window glass and shafts
    this.windowLights.forEach(mat => { mat.uniforms.time.value = t; });
    this.windowMats.forEach(mat => { mat.uniforms.time.value = t; });

    // Altar light flicker
    if (this.altarLight) {
      this.altarLight.intensity = 3.0 + 0.6 * Math.sin(t * 1.1) + 0.3 * Math.sin(t * 2.7);
    }

    // Chain of Being — nodes pulse gently, ascending rhythm
    this.chainNodes.forEach(({ node, mat, baseEmissive }, i) => {
      node.rotation.y = t * 0.4 + i * 0.8;
      mat.emissiveIntensity = baseEmissive + 0.2 * Math.sin(t * 1.2 + i * 0.9);
    });

    // Chain particles ascend
    const pos = this.chainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += 0.008;
      if (pos.array[i * 3 + 1] > 6.8) pos.array[i * 3 + 1] = -1.5;
    }
    pos.needsUpdate = true;

    // Incense drifts upward with gentle sway
    const ip = this.incenseGeo.attributes.position;
    for (let i = 0; i < ip.count; i++) {
      ip.array[i * 3 + 1] += 0.004;
      ip.array[i * 3]     += Math.sin(t * 0.4 + i * 0.3) * 0.001;
      if (ip.array[i * 3 + 1] > 3.5) {
        const src = i % 2 === 0 ? -1 : 1;
        ip.array[i * 3]     = src + (Math.random() - 0.5) * 0.3;
        ip.array[i * 3 + 1] = -1.8;
        ip.array[i * 3 + 2] = -5 + (Math.random() - 0.5) * 0.3;
      }
    }
    ip.needsUpdate = true;

    // Candle flames flicker
    this.candleLights.forEach(mat => { mat.uniforms.time.value = t; });
  }
}
