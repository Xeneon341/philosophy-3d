import * as THREE from 'three';

// ── Reusable procedural material builders ─────────────────────────────────────

const NOISE_GLSL = `
  float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
  float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
  float noise3(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm3(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){v+=a*noise3(p);p*=2.1;a*=0.5;} return v; }
  float noise2(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x), mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x), f.y); }
  float fbm2(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){v+=a*noise2(p);p*=2.1;a*=0.5;} return v; }
`;

// Dark cave stone — rocky surface with veins and depth variation
export function makeCaveStoneMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = vWorldPos * 0.6;
        float n  = fbm3(p);
        float n2 = fbm3(p * 2.5 + 3.7);
        float vein = smoothstep(0.48, 0.52, fbm3(p * 5.0));

        vec3 dark   = vec3(0.06, 0.04, 0.03);
        vec3 mid    = vec3(0.12, 0.09, 0.07);
        vec3 veinCol= vec3(0.22, 0.16, 0.12);

        vec3 col = mix(dark, mid, n);
        col = mix(col, veinCol, vein * 0.5);
        col += vec3(0.04, 0.03, 0.02) * n2;

        // Cheap diffuse from scene fire direction
        vec3 lightDir = normalize(vec3(-1.0, 0.5, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.4 + 0.1;
        col *= diff + 0.6;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Aged marble — pale with grey veins and staining
export function makeMarbleMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = vWorldPos * 1.2;
        float n    = fbm3(p);
        float vein = abs(sin(p.x * 6.0 + fbm3(p * 3.0) * 4.0));
        float stain= fbm3(p * 0.8 + 5.0);
        float crack= smoothstep(0.0, 0.05, abs(fbm3(p * 8.0) - 0.5));

        vec3 white  = vec3(0.82, 0.79, 0.74);
        vec3 grey   = vec3(0.55, 0.52, 0.48);
        vec3 stainC = vec3(0.45, 0.38, 0.28);
        vec3 crackC = vec3(0.20, 0.18, 0.15);

        vec3 col = mix(white, grey, vein * 0.6 + n * 0.2);
        col = mix(col, stainC, stain * 0.35);
        col = mix(col, crackC, (1.0 - crack) * 0.4);

        vec3 sunDir = normalize(vec3(0.2, 1.0, 0.5));
        float diff = max(dot(vNormal, sunDir), 0.0) * 0.6 + 0.3;
        col *= diff;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Ash/charred earth — for Nietzsche ground
export function makeAshGroundMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec2 p = vWorldPos.xz * 0.35;
        float n  = fbm2(p);
        float n2 = fbm2(p * 3.0 + 2.1);
        float crack = smoothstep(0.0, 0.04, abs(fbm2(p * 6.0) - 0.5));

        vec3 ash    = vec3(0.14, 0.11, 0.09);
        vec3 dark   = vec3(0.06, 0.04, 0.03);
        vec3 ember  = vec3(0.35, 0.12, 0.02); // faint ember glow in cracks
        vec3 crackC = vec3(0.28, 0.08, 0.01);

        vec3 col = mix(dark, ash, n);
        col += vec3(0.05, 0.02, 0.0) * n2;
        col = mix(col, crackC, (1.0 - crack) * 0.5);
        col += ember * (1.0 - crack) * 0.15;

        vec3 lightDir = normalize(vec3(0.0, 1.0, 0.0));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.4;
        col *= diff;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Dark polished stone — for Kant cathedral floor and columns
export function makeDarkStoneMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = vWorldPos * 0.8;
        float n = fbm3(p);
        float vein = abs(sin(p.x * 4.0 + p.z * 3.0 + fbm3(p * 2.0) * 3.0)) * 0.5;
        float polish = smoothstep(0.0, 0.08, abs(fbm3(p * 6.0) - 0.5));

        vec3 base  = vec3(0.08, 0.08, 0.12);
        vec3 light = vec3(0.14, 0.14, 0.22);
        vec3 veinC = vec3(0.22, 0.20, 0.35);

        vec3 col = mix(base, light, n * 0.6);
        col = mix(col, veinC, vein * 0.4);
        col *= (0.7 + polish * 0.3);

        vec3 lightDir = normalize(vec3(0.0, 1.0, 0.3));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.3;
        col *= diff;

        // Polished specular highlight
        vec3 view = normalize(cameraPosition - vWorldPos);
        float spec = pow(max(dot(reflect(-lightDir, vNormal), view), 0.0), 32.0) * 0.25 * polish;
        col += vec3(0.5, 0.5, 0.8) * spec;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Dark volcanic ground — for Hegel and other dark floors
export function makeVolcanicGroundMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec2 p = vWorldPos.xz * 0.25;
        float n  = fbm2(p);
        float n2 = fbm2(p * 4.0 + 7.3);
        float crack = smoothstep(0.0, 0.05, abs(fbm2(p * 8.0) - 0.5));
        float glow  = smoothstep(0.0, 0.03, abs(fbm2(p * 12.0) - 0.5));

        vec3 dark   = vec3(0.04, 0.02, 0.06);
        vec3 mid    = vec3(0.08, 0.05, 0.10);
        vec3 amber  = vec3(0.30, 0.10, 0.0);

        vec3 col = mix(dark, mid, n * 0.7 + n2 * 0.3);
        col = mix(col, amber, (1.0 - crack) * 0.35);
        col = mix(col, vec3(0.6, 0.25, 0.0), (1.0 - glow) * 0.2);

        vec3 lightDir = normalize(vec3(0.0, 1.0, 0.0));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.4;
        col *= diff;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Mossy coastal rock — for Hume islands
export function makeIslandRockMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = vWorldPos * 1.5;
        float n  = fbm3(p);
        float n2 = fbm3(p * 3.0 + 5.1);
        float moss = smoothstep(0.4, 0.6, fbm3(p * 2.0 + vec3(0, 3, 0)));
        // Top faces are mossy; sides are rocky
        float topness = clamp(vNormal.y * 2.0, 0.0, 1.0);

        vec3 rock  = vec3(0.20, 0.16, 0.12);
        vec3 dark  = vec3(0.10, 0.08, 0.06);
        vec3 mossC = vec3(0.10, 0.22, 0.06);
        vec3 wetC  = vec3(0.07, 0.13, 0.08);

        vec3 col = mix(dark, rock, n);
        col += vec3(0.03, 0.02, 0.01) * n2;
        col = mix(col, mossC, moss * topness * 0.8);
        col = mix(col, wetC, (1.0 - topness) * 0.3);

        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.25;
        col *= diff;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Dark wood planks — for Descartes study
export function makeWoodMaterial() {
  return new THREE.ShaderMaterial({
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
      ${NOISE_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = vWorldPos;
        // Wood grain rings
        float rings = sin((p.x * 8.0 + fbm3(p * 1.5) * 6.0)) * 0.5 + 0.5;
        float grain  = noise3(vec3(p.x * 20.0, p.y * 2.0, p.z * 20.0));

        vec3 light = vec3(0.42, 0.26, 0.10);
        vec3 dark2  = vec3(0.20, 0.11, 0.04);
        vec3 col = mix(dark2, light, rings * 0.7 + grain * 0.3);

        vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
        float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.4;
        col *= diff;
        // Slight sheen
        vec3 view = normalize(cameraPosition - vWorldPos);
        float spec = pow(max(dot(reflect(-lightDir, vNormal), view), 0.0), 16.0) * 0.15;
        col += vec3(spec);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
