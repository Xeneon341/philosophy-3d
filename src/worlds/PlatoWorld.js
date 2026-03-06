import * as THREE from 'three';
import { BaseWorld } from './BaseWorld.js';

// Layout (all Y values relative to world origin at floor level y=0):
//   z=+6  : cave entrance — open, bright golden light streams in
//   z=+4  : Forms floating at y=3.5–5 inside the cave, bathed by entrance light
//   z=+2  : fire pits (y=0, flames rise to y~1)
//   z= 0  : prisoners seated, facing -z (toward shadow wall)
//   z=-4  : shadow wall (back of cave)
//   The cave slopes upward toward entrance: entrance floor at y=+1.5, back at y=0

export class PlatoWorld extends BaseWorld {
  _build() {
    this._caveMat = this._makeCaveMaterial();

    this._buildCaveShell();
    this._buildEntrance();
    this._buildStaircase();
    this._buildFirePits();
    this._buildPrisoners();
    this._buildRaisedWay();    // parapet + puppet masters + fire behind them
    this._buildShadowWall();
    this._buildShadowPuppets();
    this._buildForms();
    this._buildParticleAscent();
    this._buildHotspots();

    // ── DRAMATIC CAVE LIGHTING ────────────────────────────────────────────────
    // The cave is DARK. Only two light sources: fire (orange, behind prisoners)
    // and the entrance (cold white-gold, flooding in from outside).
    // Everything else is deep shadow.

    // Near-zero ambient — the cave is oppressively dark
    const ambient = new THREE.AmbientLight(0x060508, 1.0);

    // Fire lights — up the slope at z=+4, behind the parapet
    this.fireLight  = new THREE.PointLight(0xff5500, 3.5, 10);
    this.fireLight.position.set(-2.0, 2.5, 4.0);
    this.fireLight2 = new THREE.PointLight(0xff3800, 3.0, 10);
    this.fireLight2.position.set( 2.0, 2.5, 4.0);

    // Wide dim fire bounce
    const fireBounce = new THREE.PointLight(0x3a0e00, 1.2, 14);
    fireBounce.position.set(0, 2.0, 2.5);

    // Entrance ambient — warm wash from the staircase opening
    this.entranceLight = new THREE.PointLight(0xffd870, 1.0, 9);
    this.entranceLight.position.set(3.3, 2.5, 4.5);

    // Cool fill from entrance direction — very faint, lets you see prisoner faces
    const entranceFill = new THREE.DirectionalLight(0xffe8a0, 0.15);
    entranceFill.position.set(0, 4, 10);

    // Forms glow — cool blue rational light from outside, very faint
    const formsGlow = new THREE.PointLight(0x6080b0, 0.6, 12);
    formsGlow.position.set(0, 6, 8);

    this.group.add(
      ambient,
      this.fireLight, this.fireLight2, fireBounce,
      this.entranceLight, entranceFill,
      formsGlow
    );
  }

  // ── RICH CAVE MATERIAL ────────────────────────────────────────────────────
  // Deep FBM noise with cracks, wet patches, fire-glow gradient, soot near ceiling
  _makeCaveMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal   = normalize(normalMatrix * normal);
          vUv       = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;

        // ── noise helpers ──────────────────────────────────────────────────
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

        float noise3(vec3 p){
          vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(
            mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y),
            f.z);
        }
        float fbm(vec3 p){
          float v=0.0, a=0.5;
          v+=a*noise3(p); p*=2.1; a*=0.5;
          v+=a*noise3(p); p*=2.1; a*=0.5;
          v+=a*noise3(p); p*=2.1; a*=0.5;
          return v;
        }

        // ── crack pattern ──────────────────────────────────────────────────
        float cracks(vec3 p){
          // sharp ridges = cracks in the rock
          float f1 = fbm(p * 2.3 + 1.7);
          float f2 = fbm(p * 4.1 + 3.3);
          return smoothstep(0.48, 0.52, f1) * smoothstep(0.46, 0.50, f2);
        }

        void main() {
          vec3 p = vWorldPos;

          // ── base rock colour ───────────────────────────────────────────
          float n1 = fbm(p * 0.35);
          float n2 = fbm(p * 0.9 + 5.1);
          float n3 = fbm(p * 2.2 + 11.3);

          // Dark cave palette: near-black base, cool grey-brown mid, subtle warm highlights
          vec3 cDark  = vec3(0.030, 0.022, 0.018);
          vec3 cMid   = vec3(0.072, 0.058, 0.048);
          vec3 cLight = vec3(0.115, 0.092, 0.075);
          vec3 cOchre = vec3(0.140, 0.108, 0.072);

          vec3 col = cDark;
          col = mix(col, cMid,   smoothstep(0.3, 0.6, n1));
          col = mix(col, cLight, smoothstep(0.55, 0.75, n2) * 0.5);
          col = mix(col, cOchre, smoothstep(0.65, 0.80, n3) * 0.3);

          // ── cracks — darker than base ──────────────────────────────────
          float cr = cracks(p);
          col = mix(col, vec3(0.015, 0.010, 0.008), cr * 0.7);

          // ── wet glistening patches — slight blue-grey sheen ────────────
          float wet = smoothstep(0.6, 0.75, fbm(p * 1.1 + 7.7));
          col = mix(col, vec3(0.06, 0.07, 0.09), wet * 0.4);
          // Specular highlight on wet areas
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float spec = pow(max(dot(reflect(-normalize(vec3(0,1,0.5)), vNormal), viewDir), 0.0), 24.0);
          col += vec3(0.08, 0.09, 0.12) * spec * wet;

          // ── soot near ceiling — gets darker going up ───────────────────
          float soot = smoothstep(2.5, 5.5, vWorldPos.y) * 0.6;
          col = mix(col, vec3(0.012, 0.010, 0.010), soot);

          // ── fire glow gradient ─────────────────────────────────────────
          // Subtle warm tint near fire pit area — the point lights do the real work
          float fireDist = length(vec2(vWorldPos.z - 2.0, vWorldPos.y - 0.5));
          float fireGlow = smoothstep(5.0, 1.0, fireDist) * 0.10;
          col += vec3(fireGlow * 0.8, fireGlow * 0.18, 0.0);

          // ── entrance brightening — very subtle cool tint toward +z ─────
          float entrancePull = smoothstep(-2.0, 6.0, vWorldPos.z) * 0.06;
          col += vec3(entrancePull * 0.5, entrancePull * 0.48, entrancePull * 0.38);

          // ── surface normal lighting (cheap diffuse) ────────────────────
          float diff = max(dot(vNormal, normalize(vec3(0.2, 0.5, 0.8))), 0.0) * 0.15 + 0.85;
          col *= diff;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }

  _buildCaveShell() {
    // All cave geometry in one method so the layout is clear
    //
    // Coordinate system:
    //   Origin (0,0,0) = center of cave at floor level
    //   +Z = entrance direction (bright, open)
    //   -Z = shadow wall (dark, back)
    //   Y  = up
    //
    // The floor tilts: entrance end (+z=6) is y=+1.5 higher than back (-z=5)
    // giving a natural slope upward toward the light — the ascent out of the cave.

    // ── FLOOR ─────────────────────────────────────────────────────────────────
    // Use BufferGeometry directly so we control world-space XZ layout and Y height
    const FW = 12, FD = 14, FSEGS_X = 20, FSEGS_Z = 24;
    const floorVerts = [];
    const floorIndices = [];
    const floorNormals = [];
    const floorUVs = [];
    for (let iz = 0; iz <= FSEGS_Z; iz++) {
      for (let ix = 0; ix <= FSEGS_X; ix++) {
        const wx = (ix / FSEGS_X - 0.5) * FW;
        const wz = (iz / FSEGS_Z - 0.5) * FD; // -7 at back, +7 at front
        // Slope: front of cave (wz > 0) is higher — entrance is elevated
        const slope = wz * 0.13;
        const rough = (Math.random() - 0.5) * 0.1;
        floorVerts.push(wx, slope + rough, wz);
        floorNormals.push(0, 1, 0);
        floorUVs.push(ix / FSEGS_X, iz / FSEGS_Z);
      }
    }
    for (let iz = 0; iz < FSEGS_Z; iz++) {
      for (let ix = 0; ix < FSEGS_X; ix++) {
        const a = iz * (FSEGS_X + 1) + ix;
        const b = a + 1;
        const c = a + (FSEGS_X + 1);
        const d = c + 1;
        floorIndices.push(a, c, b, b, c, d);
      }
    }
    const floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorVerts, 3));
    floorGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(floorNormals, 3));
    floorGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(floorUVs, 2));
    floorGeo.setIndex(floorIndices);
    floorGeo.computeVertexNormals();
    this.group.add(new THREE.Mesh(floorGeo, this._caveMat));

    // ── SIDE WALLS — subdivided and vertex-displaced for organic look ──────────
    // Build walls with noise-displaced vertices so the surface feels carved
    const WALL_SEGS_W = 10, WALL_SEGS_H = 8;
    const wallSeed = (x, y, z) => Math.sin(x * 12.9 + y * 7.3 + z * 4.1) * 0.5 + 0.5;

    [-5.5, 5.5].forEach((wx, side) => {
      const wallGeo = new THREE.PlaneGeometry(16, 8, WALL_SEGS_W, WALL_SEGS_H);
      const wPos = wallGeo.attributes.position;
      for (let i = 0; i < wPos.count; i++) {
        const px = wPos.getX(i), py = wPos.getY(i);
        const n = wallSeed(px * 0.4, py * 0.4, side * 3.1)
                * wallSeed(px * 1.1, py * 0.9, side) * 0.5;
        wPos.setZ(i, (n - 0.15) * 0.6);
      }
      wallGeo.computeVertexNormals();
      const wall = new THREE.Mesh(wallGeo, this._caveMat);
      // Use a clone of the material with DoubleSide so the staircase opening
      // doesn't show the back face as a black void
      wall.material = this._caveMat.clone();
      wall.material.side = THREE.DoubleSide;
      wall.position.set(wx, 3.5, 0);
      wall.rotation.y = side === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(wall);
    });

    // ── CEILING ───────────────────────────────────────────────────────────────
    // Arch with extra subdivisions so the cave material renders richly
    const archGeo = new THREE.CylinderGeometry(5, 5, 16, 18, 4, true, 0, Math.PI);
    // Displace arch vertices inward randomly for organic cave ceiling
    const aPos = archGeo.attributes.position;
    for (let i = 0; i < aPos.count; i++) {
      const ax = aPos.getX(i), ay = aPos.getY(i), az = aPos.getZ(i);
      const bump = wallSeed(ax * 0.5, ay * 0.3, az * 0.4) * 0.4;
      const len = Math.sqrt(ax * ax + az * az);
      if (len > 0.01) {
        aPos.setX(i, ax + (ax / len) * bump);
        aPos.setZ(i, az + (az / len) * bump);
      }
    }
    archGeo.computeVertexNormals();
    const arch = new THREE.Mesh(archGeo, this._caveMat);
    arch.position.set(0, 5, 0);
    arch.rotation.x = Math.PI / 2;
    this.group.add(arch);

    // ── BACK WALL — tall, clearly visible, slightly irregular ─────────────────
    const bwGeo = new THREE.PlaneGeometry(13, 12, 6, 6);
    const bwPos = bwGeo.attributes.position;
    for (let i = 0; i < bwPos.count; i++) {
      const bx = bwPos.getX(i), by = bwPos.getY(i);
      bwPos.setZ(i, (wallSeed(bx * 0.5, by * 0.4, 9.1) - 0.2) * 0.5);
    }
    bwGeo.computeVertexNormals();
    const bw = new THREE.Mesh(bwGeo, this._caveMat);
    bw.position.set(0, 4.0, -5.5);
    this.group.add(bw);

    // ── CAVE END CAP — close the top/back of the cave tunnel ──────────────────
    // Small flat disc just to close the ceiling gap at the back — not a dome
    const capGeo = new THREE.CircleGeometry(5.0, 12);
    const cap = new THREE.Mesh(capGeo, this._caveMat);
    cap.position.set(0, 5.0, -7.5);
    cap.rotation.x = Math.PI / 2; // flat, horizontal, capping the top
    this.group.add(cap);

    // ── FRONT WALL — cave entrance face with staircase opening ────────────────
    // Three panels forming the front wall at z=+6, with a gap on the right
    // for the staircase opening (x=2.2 to 5.5, y=0 to 4.5)
    const fwMat = this._caveMat;
    // Left panel: x=-5.5 to x=+2.0
    const fwLeft = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 8, 4, 4), fwMat);
    fwLeft.position.set(-1.75, 3.0, 6.2);
    fwLeft.rotation.y = Math.PI;
    this.group.add(fwLeft);
    // Right panel: x=+5.5 to x=+4.8 (just the far right edge beyond stairs)
    // Above opening: x=+2.0 to +5.5, y=4.5 to 8
    const fwAbove = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5, 3, 3), fwMat);
    fwAbove.position.set(3.75, 6.25, 6.2);
    fwAbove.rotation.y = Math.PI;
    this.group.add(fwAbove);

    // ── ROCK OUTCROPPINGS from walls ──────────────────────────────────────────
    // Irregular lumpy protrusions along the walls at various heights
    const rockDefs = [
      // [x, y, z, scale, rotY] — kept well away from shadow wall area (z > -2)
      [-5.0, 1.0,  1.5, 0.7, 0.5],
      [-5.3, 0.2,  3.5, 0.6, 0.2],
      [ 5.0, 0.6,  0.5, 0.7,-0.4],
      [ 5.1, 0.1,  3.8, 0.5,-0.2],
      [-3.0, 0.0,  4.5, 0.4, 0.6],
      [ 3.5, 0.0,  4.2, 0.45,-0.5],
    ];
    rockDefs.forEach(([x, y, z, s, ry]) => {
      const geo = new THREE.IcosahedronGeometry(s, 2);
      // Stretch slightly toward wall to look embedded
      const rPos = geo.attributes.position;
      for (let i = 0; i < rPos.count; i++) {
        rPos.setX(i, rPos.getX(i) * 1.4);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this._caveMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.rotation.z = (Math.random() - 0.5) * 0.4;
      this.group.add(mesh);
    });

    // ── FLOOR BOULDERS ────────────────────────────────────────────────────────
    const boulderDefs = [
      // Keep boulders away from shadow wall — only near sides and entrance
      [4.7, 0.3, -1.5, 0.50], [-4, 0.3, 0.8, 0.45], [4.4, 0.2, 2.0, 0.38],
      [-3.4, 0.2, 3.8, 0.32], [3.7, 0.15, 4.2, 0.28],
    ];
    boulderDefs.forEach(([x, y, z, s]) => {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 2), this._caveMat);
      r.position.set(x, y, z);
      r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * 0.5);
      this.group.add(r);
    });

    // ── STALACTITES — denser, varied ──────────────────────────────────────────
    const stalDefs = [
      // [x, z, radius, height]
      [-2.5, -1.0, 0.14, 0.85], [ 2.2, -0.5, 0.11, 0.65], [ 0.0, -2.0, 0.17, 1.10],
      [-4.0, -1.5, 0.12, 0.75], [ 3.5, -1.0, 0.10, 0.58], [ 1.0, -2.2, 0.13, 0.78],
      [ 0.5, -1.2, 0.09, 0.52], [-3.0,  0.5, 0.08, 0.45],
      [ 3.0,  1.5, 0.10, 0.60], [-1.0,  2.0, 0.12, 0.70], [ 1.8,  0.0, 0.09, 0.50],
      [-0.5,  1.0, 0.07, 0.38], [ 4.0,  2.0, 0.09, 0.55], [-4.0,  2.5, 0.08, 0.48],
    ];
    stalDefs.forEach(([x, z, r, h]) => {
      const g = new THREE.ConeGeometry(r, h, 5);
      const s = new THREE.Mesh(g, this._caveMat);
      s.position.set(x, 4.9 - h / 2, z);
      s.rotation.x = Math.PI;
      s.rotation.z = (Math.random() - 0.5) * 0.25;
      this.group.add(s);
    });

    // ── STALAGMITES rising from floor ─────────────────────────────────────────
    const stagDefs = [
      [-4.2, 0,  2.5, 0.12, 0.65], [4.0, 0,  3.2, 0.08, 0.42],
    ];
    stagDefs.forEach(([x, y, z, r, h]) => {
      const g = new THREE.ConeGeometry(r, h, 5);
      const s = new THREE.Mesh(g, this._caveMat);
      s.position.set(x, y + h / 2, z);
      s.rotation.z = (Math.random() - 0.5) * 0.15;
      this.group.add(s);
    });
  }

  _buildEntrance() {
    // The cave mouth — pure light, no geometry disc
    // Let the bloom pass create the natural glow halo

    // Bright emissive disc at cave mouth — bloom spreads it into a natural halo
    // Use a radial gradient shader so the centre is white-hot and edges fall off
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float alpha = smoothstep(1.0, 0.0, r);
          float shimmer = 0.96 + 0.04 * sin(time * 1.5 + r * 4.0);
          vec3 col = mix(vec3(1.0, 1.0, 0.95), vec3(1.0, 0.90, 0.60), r * 0.8) * shimmer;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    // Staircase top: x≈3.3+1.1=4.4 centre, y≈3.5, z≈6.0
    // The glow disc faces into the cave (rotated to face -z direction)
    const STAIR_TOP_X = 3.3; // centre of staircase width
    const STAIR_TOP_Y = 3.6;
    const STAIR_TOP_Z = 6.0;

    const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), glowMat);
    glowMesh.position.set(STAIR_TOP_X, STAIR_TOP_Y, STAIR_TOP_Z);
    glowMesh.rotation.y = Math.PI; // face into the cave
    this.group.add(glowMesh);
    this.entranceMat = glowMat;

    // Faint light shaft angling down from entrance into cave
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying float vH; void main(){ vH=(position.y+3.5)/7.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time; varying float vH;
        void main(){
          float dust = 0.85 + 0.15 * sin(time * 0.7 + vH * 8.0);
          float alpha = vH * vH * 0.018 * dust;
          gl_FragColor = vec4(1.0, 0.92, 0.65, alpha);
        }
      `,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 10, 1, true), shaftMat);
    shaft.position.set(STAIR_TOP_X, STAIR_TOP_Y - 1.5, STAIR_TOP_Z - 2.0);
    shaft.rotation.x = 0.5;
    this.group.add(shaft);
    this.mouthShaftMat = shaftMat;

    // Main entrance point light — at the top of the staircase opening
    this.mouthLight = new THREE.PointLight(0xfff8d0, 2.2, 10);
    this.mouthLight.position.set(STAIR_TOP_X, STAIR_TOP_Y, STAIR_TOP_Z);
    this.group.add(this.mouthLight);

    // Softer fill light spilling down the staircase
    const innerGlow = new THREE.PointLight(0xffe8a0, 1.0, 8);
    innerGlow.position.set(STAIR_TOP_X, STAIR_TOP_Y - 1.0, STAIR_TOP_Z - 2.0);
    this.group.add(innerGlow);
  }

  _buildFirePits() {
    this.flamePits = [];
    // Fire pits at z=+4, well behind the prisoners, higher up the slope
    [[-2.2, 0.8, 4.0], [2.2, 0.8, 4.0]].forEach(([x, y, z], idx) => {
      // Tall stone pillar pedestal — clearly a tripod stand
      const pillarMat = this._caveMat;

      // Three legs of the brazier tripod
      for (let leg = 0; leg < 3; leg++) {
        const legAngle = (leg / 3) * Math.PI * 2;
        const legGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.7, 5);
        const legMesh = new THREE.Mesh(legGeo, pillarMat);
        legMesh.position.set(
          x + Math.cos(legAngle) * 0.22,
          y + 0.35,
          z + Math.sin(legAngle) * 0.22
        );
        legMesh.rotation.z = Math.cos(legAngle) * 0.25;
        legMesh.rotation.x = Math.sin(legAngle) * 0.25;
        this.group.add(legMesh);
      }

      // Bowl — a hemisphere/dish shape
      const bowlGeo = new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const bowlMat = new THREE.MeshStandardMaterial({
        color: 0x1a0a03, roughness: 0.7, metalness: 0.65,
        emissive: 0x4a1200, emissiveIntensity: 0.5
      });
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.set(x, y + 0.72, z);
      bowl.rotation.x = Math.PI; // open side up
      this.group.add(bowl);

      // Fuel/coal base inside bowl
      const coal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.06, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a0800, emissive: 0x8a2200, emissiveIntensity: 0.8, roughness: 1 })
      );
      coal.position.set(x, y + 0.74, z);
      this.group.add(coal);

      // Animated flame — two layered cones for depth
      const flameMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, seed: { value: idx * 4.1 } },
        vertexShader: `
          uniform float time; uniform float seed;
          varying float vHeight;
          void main() {
            vHeight = uv.y;
            vec3 pos = position;
            float taper = 1.0 - vHeight * 0.7;
            pos.x = pos.x * taper + sin(time * 7.0 + seed + vHeight * 3.0) * 0.07 * vHeight;
            pos.z = pos.z * taper + cos(time * 5.7 + seed + vHeight * 2.0) * 0.05 * vHeight;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying float vHeight;
          void main() {
            vec3 core  = vec3(1.0, 0.95, 0.5);
            vec3 mid   = vec3(1.0, 0.4, 0.02);
            vec3 tip   = vec3(0.6, 0.05, 0.0);
            float t = vHeight;
            vec3 col = t < 0.4 ? mix(core, mid, t / 0.4) : mix(mid, tip, (t - 0.4) / 0.6);
            float alpha = (1.0 - vHeight) * 0.95;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });

      // Outer flame
      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 8, 4, true), flameMat);
      outerFlame.position.set(x, y + 0.85, z);
      this.group.add(outerFlame);

      // Inner brighter flame
      const innerFlameMat = flameMat.clone();
      innerFlameMat.uniforms = { time: { value: 0 }, seed: { value: idx * 4.1 + 1.5 } };
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 7, 3, true), innerFlameMat);
      innerFlame.position.set(x, y + 0.82, z);
      this.group.add(innerFlame);

      this.flamePits.push(flameMat, innerFlameMat);

      // Ember glow at base
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.9, depthWrite: false })
      );
      ember.position.set(x, y + 0.78, z);
      this.group.add(ember);
    });
  }

  _buildPrisoners() {
    // Three prisoners seated at z=0, facing -z (toward shadow wall)
    // Visible but dark — lit from behind by fire, dim fill from front
    // Color: dark brown-grey, NOT pitch black — so they read as figures
    const prisonerMat = new THREE.MeshStandardMaterial({
      color: 0x2a1e18,      // dark warm brown, not pure black
      roughness: 0.9,
      metalness: 0.0,
      emissive: 0x0a0604,
      emissiveIntensity: 0.3,
    });
    const chainMat = new THREE.MeshStandardMaterial({
      color: 0x4a3820, roughness: 0.7, metalness: 0.8
    });

    const prisonerDefs = [
      { x: -2.0, z: 0 },
      { x:  0.0, z: 0.2 },
      { x:  2.0, z: 0 },
    ];

    prisonerDefs.forEach(({ x, z }) => {
      const g = new THREE.Group();
      // Prisoners face toward -z (shadow wall)
      g.rotation.y = Math.PI;

      // Seated body — torso upright
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.6, 7), prisonerMat);
      torso.position.set(0, 0.7, 0);
      g.add(torso);

      // Head — slightly bowed forward
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 7), prisonerMat);
      head.position.set(0, 1.2, 0.08);
      g.add(head);

      // Upper arms (outstretched horizontally — chained)
      const armGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.5, 5);
      const lArm = new THREE.Mesh(armGeo, prisonerMat);
      lArm.rotation.z = Math.PI / 2;
      lArm.position.set(-0.38, 0.9, 0);
      g.add(lArm);
      const rArm = lArm.clone();
      rArm.position.set(0.38, 0.9, 0);
      g.add(rArm);

      // Seated legs (bent forward)
      const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 5);
      const lLeg = new THREE.Mesh(legGeo, prisonerMat);
      lLeg.rotation.x = Math.PI / 2;
      lLeg.position.set(-0.15, 0.3, 0.25);
      g.add(lLeg);
      const rLeg = lLeg.clone();
      rLeg.position.set(0.15, 0.3, 0.25);
      g.add(rLeg);

      // Chain — runs between arm ends
      for (let j = -3; j <= 3; j++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 4, 6), chainMat);
        link.position.set(j * 0.13, 0.9, 0);
        link.rotation.x = Math.PI / 2;
        g.add(link);
      }

      // Neck collar
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 10), chainMat);
      collar.position.set(0, 1.05, 0);
      collar.rotation.x = Math.PI / 2;
      g.add(collar);

      g.position.set(x, 0, z);
      this.group.add(g);
    });
  }

  _buildRaisedWay() {
    // The raised way described in the Republic:
    // "Along this wall, after the manner of puppet-showmen, there are other men
    //  carrying all sorts of vessels and statues, and figures of animals made of
    //  wood and stone and various materials, which appear over the wall."
    //
    // A low stone parapet runs across the cave at z=+1.2 (between prisoners at z=0
    // and the fire pits at z=+2.2). Puppet masters walk behind it.

    // ── PARAPET — low stone wall across the full cave width ───────────────────
    const parapetMat = this._caveMat;

    // Main parapet wall — 10 units wide, 0.9 high, 0.35 thick — at z=+3.2
    const parapetGeo = new THREE.BoxGeometry(10, 0.9, 0.35, 8, 3, 2);
    // Slightly roughen the top edge
    const ppPos = parapetGeo.attributes.position;
    for (let i = 0; i < ppPos.count; i++) {
      if (ppPos.getY(i) > 0.3) {
        ppPos.setY(i, ppPos.getY(i) + (Math.random() - 0.5) * 0.06);
      }
    }
    parapetGeo.computeVertexNormals();
    const parapet = new THREE.Mesh(parapetGeo, parapetMat);
    parapet.position.set(0, 1.3, 3.2);
    this.group.add(parapet);

    // Parapet base/plinth — slightly wider
    const plinthGeo = new THREE.BoxGeometry(10.4, 0.18, 0.5);
    const plinth = new THREE.Mesh(plinthGeo, parapetMat);
    plinth.position.set(0, 0.94, 3.18);
    this.group.add(plinth);

    // ── PUPPET MASTERS — silhouetted figures behind the parapet ───────────────
    // Dark, visible-but-shadowy: slightly lighter than pure black so they read
    const puppeteerMat = new THREE.MeshStandardMaterial({
      color: 0x1a1210,
      roughness: 1.0,
      metalness: 0.0,
      emissive: 0x0d0804,
      emissiveIntensity: 0.5,
    });

    this.puppetMasters = [];

    const puppeteerDefs = [
      { x: -3.2, walkPhase: 0.0,    walkDir:  1 }, // walks right
      { x:  0.2, walkPhase: Math.PI, walkDir: -1 }, // walks left
      { x:  3.0, walkPhase: 1.5,    walkDir:  1 }, // walks right
    ];

    puppeteerDefs.forEach(({ x, walkPhase, walkDir }, objIdx) => {
      const g = new THREE.Group();

      // Body — upright, walking
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.7, 7), puppeteerMat);
      torso.position.y = 1.55;
      g.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 7), puppeteerMat);
      head.position.y = 2.1;
      g.add(head);

      // Arms — one raised holding the puppet pole
      const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.48, 5);

      // Raised arm (holding pole aloft)
      const raisedArm = new THREE.Mesh(armGeo, puppeteerMat);
      raisedArm.rotation.z = -0.8; // angled up
      raisedArm.position.set(0.28, 1.85, 0);
      g.add(raisedArm);

      // Lower arm at side
      const lowArm = new THREE.Mesh(armGeo, puppeteerMat);
      lowArm.rotation.z = 0.3;
      lowArm.position.set(-0.28, 1.65, 0);
      g.add(lowArm);

      // Legs — striding pose
      const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 5);
      const legF = new THREE.Mesh(legGeo, puppeteerMat);
      legF.rotation.x = 0.3;
      legF.position.set(0.12, 1.0, 0.15);
      g.add(legF);
      const legB = new THREE.Mesh(legGeo, puppeteerMat);
      legB.rotation.x = -0.3;
      legB.position.set(-0.12, 1.0, -0.15);
      g.add(legB);

      // ── PUPPET POLE + OBJECT held aloft ────────────────────────────────
      // Thin vertical pole rising above the parapet
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9, metalness: 0.1 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 5), poleMat);
      pole.position.set(0.38, 2.5, 0);
      g.add(pole);

      // Puppet object on top of pole — each a different silhouette shape
      const objMat = new THREE.MeshBasicMaterial({ color: 0x0a0706 });

      let puppetObj;
      if (objIdx === 0) {
        // Horse silhouette — elongated box + head
        const horse = new THREE.Group();
        horse.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.12), objMat));
        const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.10), objMat);
        hHead.position.set(0.28, 0.22, 0);
        horse.add(hHead);
        puppetObj = horse;
      } else if (objIdx === 1) {
        // Human figure silhouette
        const fig = new THREE.Group();
        fig.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.08), objMat));
        const fHead = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 5), objMat);
        fHead.position.y = 0.28;
        fig.add(fHead);
        // Arms spread
        const fArm = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.06, 0.06), objMat);
        fArm.position.y = 0.10;
        fig.add(fArm);
        puppetObj = fig;
      } else {
        // Vase / vessel silhouette
        const vase = new THREE.Group();
        vase.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 7), objMat));
        const vTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), objMat);
        vTop.position.y = 0.22;
        vase.add(vTop);
        puppetObj = vase;
      }

      puppetObj.position.set(0.38, 3.2, 0);
      g.add(puppetObj);

      // Legs bottom out at local y=0.7, walkway is at world y=1.75 → offset = 1.05
      g.position.set(x, 1.05, 3.8);
      g.rotation.y = walkDir > 0 ? 0 : Math.PI;

      this.group.add(g);
      this.puppetMasters.push({ group: g, baseX: x, walkPhase, walkDir, puppetObj });
    });

    // ── FIRE behind the parapet — between parapet and entrance ────────────────
    // This is the "great fire" of the allegory, burning behind the puppet masters
    // The fire pits built in _buildFirePits are positioned here, but we add extra
    // glow at the walkway level

    // Walkway path — raised stone platform behind the parapet
    const pathGeo = new THREE.PlaneGeometry(10.5, 2.5, 8, 4);
    const pathPos = pathGeo.attributes.position;
    for (let i = 0; i < pathPos.count; i++) {
      pathPos.setZ(i, (Math.random() - 0.5) * 0.06);
    }
    pathGeo.computeVertexNormals();
    const path = new THREE.Mesh(pathGeo, this._caveMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 1.75, 4.5); // raised platform behind parapet, up the slope
    this.group.add(path);
  }

  _buildStaircase() {
    // Stone staircase rising from z=+1 (near prisoners) up to z=+6 (cave mouth)
    // Runs along the right side of the cave (x ≈ +2.5 to +4)
    // Each step: rise 0.28, run 0.55 along Z
    const stepMat = this._caveMat;
    const STEPS = 12;
    const startZ = 1.0;
    const startY = 0.1;
    const stepRise = 0.28;
    const stepRun  = 0.42;
    const stepW    = 2.2;  // width of each step (spans x = 2.2 to 4.4)
    const startX   = 2.2;

    for (let i = 0; i < STEPS; i++) {
      const z = startZ + i * stepRun;
      const y = startY + i * stepRise;

      // Tread — flat horizontal surface
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(stepW, 0.08, stepRun + 0.04),
        stepMat
      );
      tread.position.set(startX + stepW / 2, y + 0.04, z + stepRun / 2);
      this.group.add(tread);

      // Riser — vertical face
      const riser = new THREE.Mesh(
        new THREE.BoxGeometry(stepW, stepRise, 0.07),
        stepMat
      );
      riser.position.set(startX + stepW / 2, y + stepRise / 2, z);
      this.group.add(riser);
    }

    // Side wall / balustrade along the staircase
    const railGeo = new THREE.BoxGeometry(0.12, 0.55, STEPS * stepRun + 0.5);
    const rail = new THREE.Mesh(railGeo, stepMat);
    rail.position.set(startX + 0.06, startY + (STEPS * stepRise) / 2 + 0.28, startZ + (STEPS * stepRun) / 2);
    this.group.add(rail);
  }

  _buildShadowWall() {
    // The shadow wall is the back cave wall itself — a flat smooth stone surface
    // Use a dark soot-stained shader that catches the fire glow from behind
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
        float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        void main() {
          // Stone texture with soot stains
          float n = noise(vWorldPos.xy * 1.2) * 0.5 + noise(vWorldPos.xy * 3.5) * 0.3 + noise(vWorldPos.xy * 8.0) * 0.2;
          vec3 stone = mix(vec3(0.06, 0.04, 0.03), vec3(0.15, 0.11, 0.09), n);
          // Fire glow gradient — bottom of wall gets warm glow from fires below
          float fireGlow = smoothstep(1.5, -2.5, vWorldPos.y) * 0.15;
          stone += vec3(fireGlow * 1.0, fireGlow * 0.35, 0.0);
          gl_FragColor = vec4(stone, 1.0);
        }
      `,
      side: THREE.FrontSide,
    });
    // Shadow wall at z=-4, covers the lower back of the cave — taller and wider
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8, 4, 4), wallMat);
    wall.position.set(0, 2.5, -4.0);
    this.group.add(wall);
  }

  _buildShadowPuppets() {
    // Narrative shadow shapes cast on the back wall — human, animal, vessel
    this.shadowMeshes = [];

    // Build shapes using ExtrudeGeometry / ShapeGeometry for more interesting silhouettes

    // Human figure — built from a Shape
    const figureShape = new THREE.Shape();
    figureShape.moveTo(0, 0); figureShape.lineTo(0.1, 0.5);   // leg
    figureShape.lineTo(0.05, 0.9); figureShape.lineTo(0.18, 0.9); // body
    figureShape.lineTo(0.22, 1.3); figureShape.lineTo(0.14, 1.3); // neck/shoulder
    figureShape.lineTo(0.12, 1.6); figureShape.bezierCurveTo(0.28, 1.65, 0.28, 1.35, 0.12, 1.35); // head circle approx
    figureShape.lineTo(-0.12, 1.35); figureShape.bezierCurveTo(-0.28, 1.35, -0.28, 1.65, -0.12, 1.6);
    figureShape.lineTo(-0.14, 1.3); figureShape.lineTo(-0.22, 1.3);
    figureShape.lineTo(-0.18, 0.9); figureShape.lineTo(-0.05, 0.9);
    figureShape.lineTo(-0.1, 0.5); figureShape.lineTo(0, 0);

    // Horse/animal silhouette — simpler polygon
    const horsePoints = [
      new THREE.Vector2(-0.7,0), new THREE.Vector2(-0.5,0.2),
      new THREE.Vector2(-0.2,0.55), new THREE.Vector2(0.1,0.65),
      new THREE.Vector2(0.4,0.7), new THREE.Vector2(0.7,0.5),
      new THREE.Vector2(0.7,0.2), new THREE.Vector2(0.55,0),
      new THREE.Vector2(0.45,0.35), new THREE.Vector2(0.3,0),
      new THREE.Vector2(0.1,0), new THREE.Vector2(0.0,0.3),
      new THREE.Vector2(-0.15,0), new THREE.Vector2(-0.3,0),
      new THREE.Vector2(-0.28,0.3), new THREE.Vector2(-0.45,0),
    ];
    const horseShape = new THREE.Shape(horsePoints);

    // Torch / vessel
    const torchShape = new THREE.Shape();
    torchShape.moveTo(-0.08, 0); torchShape.lineTo(-0.12, 0.5);
    torchShape.lineTo(-0.18, 0.7); torchShape.lineTo(0, 0.85);
    torchShape.lineTo(0.18, 0.7); torchShape.lineTo(0.12, 0.5);
    torchShape.lineTo(0.08, 0);

    const shapeDefs = [
      { shape: figureShape, x: -2.5, y: -0.5, scale: 0.9 },
      { shape: horseShape,  x:  0.2, y: -0.3, scale: 1.0 },
      { shape: torchShape,  x:  2.8, y: -0.6, scale: 0.85 },
    ];

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050203,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    shapeDefs.forEach(({ shape, x, y, scale }) => {
      const geo = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geo, shadowMat);
      mesh.position.set(x, y + 1.5, -3.92); // just in front of shadow wall at z=-4.0
      mesh.scale.setScalar(scale);
      this.group.add(mesh);
      this.shadowMeshes.push({ mesh, baseX: x, baseY: y + 1.5 });
    });
  }

  _buildForms() {
    // Small, precise Platonic solids — the transcendent Forms glimpsed beyond the cave
    // Kept small so they read as distant, perfect, unreachable
    this.forms = [];
    const FORM_DEFS = [
      { geo: new THREE.TetrahedronGeometry(0.30, 0),  color: 0xffee60, emissive: 0xd08000 },
      { geo: new THREE.OctahedronGeometry(0.28, 0),   color: 0xe8f4ff, emissive: 0x6090d0 },
      { geo: new THREE.IcosahedronGeometry(0.32, 0),  color: 0xd0ffe8, emissive: 0x30b060 },
      { geo: new THREE.DodecahedronGeometry(0.26, 0), color: 0xffe8b0, emissive: 0xb07020 },
    ];

    // Forms float INSIDE the cave, above and in front of the entrance light (z≈5–6, y≈3–5)
    // Bathed by the golden light flooding in — they appear as ideal archetypes hovering
    // just within reach before the ascent, above the fire and parapet area
    const formPositions = [
      [-1.0, 4.2, 4.5],
      [ 1.2, 5.0, 5.0],
      [ 0.0, 3.5, 4.0],
      [ 2.0, 4.0, 3.5],
    ];

    FORM_DEFS.forEach(({ geo, color, emissive }, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color, emissive, emissiveIntensity: 1.8,
        transparent: true, opacity: 0.92,
        roughness: 0.02, metalness: 0.05,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...formPositions[i]);
      this.group.add(mesh);
      this.forms.push(mesh);

      // Wireframe edges — crisp, precise
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
      ));
    });
  }

  _buildParticleAscent() {
    // Particles rise from fire level, converge toward the Forms, then escape toward cave mouth
    const count = 500;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Start near the fire pits at z=+2, y=0 — they rise and drift back toward Forms
      positions[i * 3]     = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4 + 1;
      speeds[i] = 0.004 + Math.random() * 0.006;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeo = geo;
    this.particleSpeeds = speeds;
    this.particlePhases = phases;

    const mat = new THREE.PointsMaterial({
      color: 0xffe890,
      size: 0.03,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  _buildHotspots() {
    const hotspots = [
      {
        position: [1.2, 5.5, 4.5],
        title: 'The Theory of Forms',
        body: `<p>Plato's most radical claim: the physical world is not the real world. Behind every imperfect particular — every beautiful face, every just act — stands a perfect, eternal, unchanging <em>Form</em>.</p>
        <p>The Forms are not mental constructs but objective realities, more real than anything we can touch. The Form of Beauty is more real than any beautiful object; the Form of Justice more real than any just law.</p>
        <p>Knowledge, for Plato, means grasping the Forms through reason — not through the senses, which only ever give us opinion about a shadow-world.</p>`,
      },
      {
        position: [0, 3.5, -3.5],
        title: 'The Allegory of the Cave',
        body: `<p>Imagine prisoners chained in a cave since birth, facing a wall. Behind them, a fire casts shadows of objects onto the wall — and these shadows are the only reality they know.</p>
        <p>Philosophy is the painful process of turning around, walking toward the fire, emerging into sunlight, and finally seeing the Sun itself — the Form of the Good, source of all truth and being.</p>
        <p>Most people, Plato warns, would prefer to return to the cave. The philosopher who returns to describe what he saw will be mocked — or killed, as Socrates was.</p>`,
      },
      {
        position: [0, 2.5, 3.8],
        title: 'The Raised Way & Puppet Masters',
        body: `<p>Behind the prisoners, and in front of the great fire, there is a raised path — like the stage in a puppet theatre. Along it, men carry all manner of objects: figures of animals, vessels, statues of people — holding them above the parapet.</p>
        <p>The fire behind them casts the shadows of these objects onto the wall before the prisoners. The prisoners never see the objects themselves, only the shadows. They never see the men carrying them.</p>
        <p>Even the puppet masters are not fully free — they too are inside the cave, acting out their roles without knowing the Forms above. Only the philosopher who ascends past the fire, past the parapet, and out through the entrance reaches true knowledge.</p>`,
      },
      {
        position: [0, 1.2, 0.2],
        title: 'The Prisoners',
        body: `<p>The prisoners have been chained since birth, necks fixed, able only to see the wall before them. They know nothing of the fire behind them, or the objects whose shadows they watch.</p>
        <p>They name the shadows. They predict their sequence. They prize whoever guesses best. This is their wisdom — and it is entirely about illusions.</p>
        <p>Plato's prisoners are not stupid. They are us. All of us mistake appearance for reality until something forces us to turn.</p>`,
      },
      {
        position: [-4, 2, 0],
        title: 'The Divided Line',
        body: `<p>Plato divides all reality and knowledge into four levels, like a line split in two, then each half split again:</p>
        <p><strong>Images</strong> (shadows, reflections) → <strong>Visible Things</strong> (physical objects) → <strong>Mathematical Objects</strong> (numbers, geometric forms) → <strong>The Forms</strong> (the highest realities, grasped by pure intellect).</p>
        <p>Corresponding modes of mind: <em>Imagination → Belief → Thought → Understanding</em>. Philosophy is the ascent from bottom to top.</p>`,
      },
      {
        position: [3.3, 7.5, 7.0],
        title: 'The Cave Mouth — The Form of the Good',
        body: `<p>The philosopher who escapes the cave emerges into blinding sunlight. At first, she can only look at shadows on the ground, then at reflections, then at night objects — until at last she can look at the Sun itself.</p>
        <p>The Sun is Plato's image for the Form of the Good — the highest Form, source of all being and all truth. Just as the Sun illuminates all visible things, the Good makes all other Forms knowable.</p>
        <p>\"In the knowable realm,\" Plato writes, \"the Form of the Good is the last thing to be seen, and it is reached only with difficulty.\"</p>`,
      },
    ];

    hotspots.forEach(h => this.hotspots.add(h.position, h));
  }

  _update(t) {
    // Rotate and pulse Forms
    const formBaseY = [4.2, 5.0, 3.5, 4.0];
    this.forms.forEach((form, i) => {
      form.rotation.x = t * 0.22 + i * 0.9;
      form.rotation.y = t * 0.35 + i * 0.7;
      form.position.y = formBaseY[i] + Math.sin(t * 0.42 + i * 1.1) * 0.15;
      form.material.emissiveIntensity = 1.6 + 0.4 * Math.sin(t * 1.1 + i);
    });

    // Fire flicker — rapid, organic
    this.fireLight.intensity  = 3.5 + Math.sin(t * 7.3) * 0.9 + Math.sin(t * 17.1) * 0.4;
    this.fireLight2.intensity = 3.0 + Math.sin(t * 8.7 + 1.1) * 0.8 + Math.sin(t * 13.3) * 0.35;
    if (this.flamePits) this.flamePits.forEach(m => { m.uniforms.time.value = t; });

    // Update cave material time (for any animated effects)
    if (this._caveMat) this._caveMat.uniforms.time.value = t;

    // Entrance light — gentle breath
    if (this.entranceLight) this.entranceLight.intensity = 1.1 + 0.15 * Math.sin(t * 0.18);
    if (this.entranceMat) this.entranceMat.uniforms.time.value = t;
    if (this.mouthShaftMat) this.mouthShaftMat.uniforms.time.value = t;

    // Puppet masters — pace back and forth behind the parapet
    if (this.puppetMasters) {
      this.puppetMasters.forEach(({ group, baseX, walkPhase, walkDir, puppetObj }, i) => {
        const walkX = baseX + Math.sin(t * 0.5 + walkPhase) * 1.8;
        group.position.x = walkX;
        // Face direction of travel
        const vel = Math.cos(t * 0.5 + walkPhase);
        group.rotation.y = vel > 0 ? 0 : Math.PI;
        // Bob up/down while walking — preserve walkway base height
        group.position.y = 1.05 + Math.abs(Math.sin(t * 1.0 + walkPhase)) * 0.04;
        // Puppet object sways slightly
        if (puppetObj) {
          puppetObj.rotation.z = Math.sin(t * 0.9 + walkPhase) * 0.08;
        }
      });
    }

    // Particles rise from fire, drift toward -z (Forms/shadow wall)
    const pos = this.particleGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] += this.particleSpeeds[i];
      const y = pos.array[i * 3 + 1];

      // As particles rise, they drift toward the back of the cave
      if (y > 1.5) {
        pos.array[i * 3 + 2] -= this.particleSpeeds[i] * 0.4;
      }

      if (y > 5.5 || pos.array[i * 3 + 2] < -4.5) {
        pos.array[i * 3 + 1] = 0.2;
        pos.array[i * 3]     = (Math.random() - 0.5) * 3.5;
        pos.array[i * 3 + 2] = 1.5 + Math.random() * 1.0; // start near fire
      }
    }
    pos.needsUpdate = true;

    // Shadow puppets sway
    this.shadowMeshes.forEach(({ mesh, baseX, baseY }, i) => {
      mesh.position.x = baseX + Math.sin(t * 0.55 + i * 1.5) * 0.2;
      mesh.position.y = baseY + Math.sin(t * 0.38 + i * 0.9) * 0.05;
      mesh.rotation.z = Math.sin(t * 0.28 + i) * 0.06;
    });
  }
}
