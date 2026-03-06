// ── Starfield ────────────────────────────────────────────────────────────────

export const starVertexShader = `
  attribute float size;
  attribute float brightness;
  attribute vec3 color;
  varying float vBrightness;
  varying vec3 vColor;
  uniform float time;

  void main() {
    vBrightness = brightness;
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Independent flicker per star using multiple sine harmonics
    float id = position.x * 13.7 + position.y * 7.3 + position.z * 5.1;
    float flicker = 1.0
      + 0.12 * sin(time * 1.8 + id)
      + 0.06 * sin(time * 3.7 + id * 2.1)
      + 0.04 * sin(time * 7.1 + id * 0.3);
    gl_PointSize = size * flicker * (280.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const starFragmentShader = `
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    // Soft core + diffraction spike cross
    float core  = smoothstep(0.5, 0.0, dist);
    float spike = (1.0 - smoothstep(0.0, 0.5, abs(uv.x))) * (1.0 - smoothstep(0.0, 0.08, abs(uv.y)));
    spike      += (1.0 - smoothstep(0.0, 0.5, abs(uv.y))) * (1.0 - smoothstep(0.0, 0.08, abs(uv.x)));
    float alpha = clamp(core + spike * 0.25, 0.0, 1.0) * vBrightness;
    gl_FragColor = vec4(vColor * (0.9 + core * 0.1), alpha);
  }
`;

// ── Philosopher node ─────────────────────────────────────────────────────────

export const nodeVertexShader = `
  uniform float time;
  uniform float hovered;
  uniform int surfaceStyle;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec2 vUv;
  varying float vNoise;

  float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p.zxy, p.yxz + 19.19);
    return fract(p.x * p.y * p.z);
  }
  float smoothNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i),           hash(i+vec3(1,0,0)),f.x),
          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y),
      f.z);
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vLocalPos = position;

    float n  = smoothNoise(position * 3.0 + time * 0.15);
    float n2 = smoothNoise(position * 7.0 - time * 0.09);
    vNoise = n * 0.6 + n2 * 0.4;

    float pulse = 1.0 + 0.03 * sin(time * 2.1) + hovered * 0.06 * sin(time * 5.0);
    float disp  = 0.04 * (vNoise - 0.5);
    vec3 pos = (position + normal * disp) * pulse;
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const nodeFragmentShader = `
  uniform vec3 color;
  uniform float time;
  uniform float hovered;
  uniform int surfaceStyle;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec2 vUv;
  varying float vNoise;

  float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
    vec3 norm = normalize(vLocalPos);

    // ── Per-style surface pattern ──────────────────────────────────────────
    float pattern = 0.5;

    if (surfaceStyle == 0) {
      // Banded: latitude stripes
      float lat = norm.y;
      pattern = sin(lat * 10.0 + time * 0.2 + vNoise * 3.0) * 0.5 + 0.5;

    } else if (surfaceStyle == 1) {
      // Swirl: animated turbulence
      float s = sin(norm.x * 8.0 + norm.y * 5.0 + time * 0.4 + vNoise * 4.0);
      float s2 = sin(norm.z * 6.0 - norm.y * 7.0 - time * 0.3 + vNoise * 3.0);
      pattern = (s + s2) * 0.25 + 0.5;

    } else if (surfaceStyle == 2) {
      // Grid: crisp latlong lines
      float gx = step(0.88, abs(sin(norm.x * 12.0)));
      float gy = step(0.88, abs(sin(norm.y * 12.0)));
      float gz = step(0.88, abs(sin(norm.z * 12.0)));
      pattern = 0.3 + clamp(gx + gy + gz, 0.0, 1.0) * 0.6;

    } else if (surfaceStyle == 3) {
      // Crystal: faceted gem look — sharp noise cells
      vec3 cell = floor(norm * 5.0);
      float c = hash2(cell.xy + cell.z * 7.3);
      pattern = 0.3 + c * 0.7;

    } else {
      // Patchy (4): irregular blotchy continents
      float p1 = smoothstep(0.45, 0.55, vNoise);
      float p2 = smoothstep(0.35, 0.65, sin(norm.y * 4.0 + time * 0.1) * 0.5 + 0.5);
      pattern = mix(0.2, 0.8, p1 * p2);
    }

    // Core colour driven by pattern
    vec3 col = color * (0.2 + pattern * 0.25);

    // Bright rim / atmosphere glow
    col += color * rim * (1.5 + 0.4 * sin(time * 1.2));

    // Hover highlight
    col += color * hovered * (0.6 + 0.3 * sin(time * 4.0));

    // Inner glow pulse
    float glow = 0.3 + 0.2 * sin(time * 1.8);
    col += color * glow * (1.0 - rim) * 0.35;

    float alpha = 0.75 + rim * 0.25;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Influence line (animated dash) ───────────────────────────────────────────

export const lineVertexShader = `
  attribute float lineProgress;
  varying float vProgress;
  void main() {
    vProgress = lineProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const lineFragmentShader = `
  uniform float time;
  uniform vec3 color;
  varying float vProgress;

  void main() {
    // Travelling pulse along the line
    float pulse = mod(vProgress - time * 0.12, 1.0);
    float bright = smoothstep(0.0, 0.06, pulse) * smoothstep(0.18, 0.06, pulse);
    float base = 0.08 + 0.04 * sin(vProgress * 20.0 + time);
    float alpha = base + bright * 0.6;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Nebula cloud (procedural) ─────────────────────────────────────────────────

export const nebulaVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const nebulaFragmentShader = `
  uniform float time;
  uniform vec3 color;
  uniform float opacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x),
               mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise2(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float d = length(uv);
    float n = fbm(uv * 3.0 + time * 0.03);
    float alpha = (1.0 - smoothstep(0.2, 0.5, d)) * n * opacity;
    gl_FragColor = vec4(color, alpha);
  }
`;
