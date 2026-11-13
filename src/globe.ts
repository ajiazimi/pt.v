import * as THREE from 'three';

/**
 * Procedural Interactive 3D Violet Dot-Matrix Globe for Vier Ventures Hero Background
 * Implemented with Three.js according to Three.js design & performance directives:
 * - 3-12 Part Composite Procedural Models (Core, Dot Matrix, Rings, Fresnel Halo, Satellite, Arcs)
 * - Zero external 404 dependencies (100% procedural textures, landmass sampling, and materials)
 * - Software WebGL guard & 60fps pacing
 * - Smooth exponential damping on mouse tilt and continuous rotation
 */

export function initHeroGlobe() {
  const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const container = canvas.parentElement || document.body;

  // 1. Detect software WebGL to adapt performance gracefully
  const isSoftwareGl = (() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  })();

  // 2. Setup WebGL Renderer
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('WebGL initialization failed, falling back to video background', err);
    document.getElementById('hero-globe-skeleton')?.classList.add('is-loaded');
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

  function updateSize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // 3. Scene and Camera Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  // Position camera so the globe crowns directly beneath the hero text
  camera.position.set(0, 0.45, 4.4);
  camera.lookAt(0, -0.2, 0);

  updateSize();
  window.addEventListener('resize', updateSize);

  // 4. Lighting Rig
  const ambientLight = new THREE.AmbientLight(0x0e0922, 1.4);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xa78bfa, 0x05040a, 1.8);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xe0e7ff, 2.4);
  keyLight.position.set(4, 5, 4);
  scene.add(keyLight);

  const violetRimLight = new THREE.DirectionalLight(0x8b5cf6, 3.2);
  violetRimLight.position.set(-4, -2, -3);
  scene.add(violetRimLight);

  // Master group for Earth and all its orbiting systems
  const masterGroup = new THREE.Group();
  scene.add(masterGroup);

  // Tilting globe group (Earth axial tilt: ~23.4 degrees)
  const globeGroup = new THREE.Group();
  globeGroup.rotation.z = THREE.MathUtils.degToRad(-15);
  globeGroup.rotation.x = THREE.MathUtils.degToRad(12);
  globeGroup.position.set(0, -0.25, 0);
  masterGroup.add(globeGroup);

  const GLOBE_RADIUS = 1.56;

  // 5. Generate Procedural Circular Glow Particle Texture (Zero 404s)
  function createParticleTexture(size = 64) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    const ctx = pCanvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(216, 180, 254, 0.95)');
    grad.addColorStop(0.6, 'rgba(168, 85, 247, 0.5)');
    grad.addColorStop(0.9, 'rgba(126, 34, 206, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(pCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const particleTex = createParticleTexture();

  // 6. PART 1: Dark Core Planet Sphere
  const coreGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.992, 48, 48);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x05040d,
    roughness: 0.85,
    metalness: 0.2,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  globeGroup.add(coreMesh);

  // 7. PART 2: Procedural Earth Landmass Dot-Matrix
  // Sample a high-fidelity 2D world map drawn onto an offscreen canvas
  function generateWorldMapPoints() {
    const mapW = 400;
    const mapH = 200;
    const mCanvas = document.createElement('canvas');
    mCanvas.width = mapW;
    mCanvas.height = mapH;
    const mCtx = mCanvas.getContext('2d')!;

    // Black ocean background
    mCtx.fillStyle = '#000000';
    mCtx.fillRect(0, 0, mapW, mapH);

    // White landmasses
    mCtx.fillStyle = '#ffffff';

    // Helper to draw continent approximations
    function drawBlob(cx: number, cy: number, rx: number, ry: number, rot = 0) {
      mCtx.save();
      mCtx.translate(cx, cy);
      mCtx.rotate(rot);
      mCtx.beginPath();
      mCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      mCtx.fill();
      mCtx.restore();
    }

    // North America
    drawBlob(95, 52, 38, 26, -0.2);
    drawBlob(60, 40, 25, 18, -0.4); // Alaska
    drawBlob(130, 32, 22, 16, 0.3);  // Greenland
    drawBlob(88, 85, 16, 22, 0.4);  // Central America

    // South America
    drawBlob(130, 130, 24, 38, 0.25);
    drawBlob(138, 120, 20, 24, 0);

    // Europe
    drawBlob(205, 50, 18, 14, 0.1);
    drawBlob(222, 42, 22, 15, 0.3); // Scandinavia
    drawBlob(190, 48, 8, 12, -0.3); // UK

    // Africa
    drawBlob(212, 110, 28, 38, 0.1);
    drawBlob(235, 145, 10, 18, 0.2); // Madagascar

    // Eurasia / Russia / China
    drawBlob(280, 48, 55, 24, 0.1);
    drawBlob(320, 52, 42, 22, -0.15);
    drawBlob(255, 80, 30, 22, 0.2); // Middle East & South Asia
    drawBlob(290, 88, 26, 22, 0.1); // India
    drawBlob(330, 82, 34, 25, 0);   // East Asia
    drawBlob(356, 75, 8, 22, 0.5);  // Japan

    // Southeast Asia & Indonesia (Dense and prominent)
    drawBlob(335, 110, 16, 12, 0.3); // Indochina
    drawBlob(340, 126, 24, 8, -0.1); // Sumatra & Java
    drawBlob(362, 124, 18, 12, 0.2); // Borneo & Sulawesi
    drawBlob(375, 128, 18, 10, 0.1); // Papua

    // Australia & New Zealand
    drawBlob(358, 155, 30, 22, 0.1);
    drawBlob(392, 168, 8, 14, 0.5);

    // Read pixel data to place 3D points
    const imgData = mCtx.getImageData(0, 0, mapW, mapH).data;

    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    const scales: number[] = [];

    // Dense grid sampling on sphere surface
    const rows = 120;
    const cols = 240;

    const baseViolet = new THREE.Color(0xa78bfa);
    const brightViolet = new THREE.Color(0xd8b4fe);
    const cyanAccent = new THREE.Color(0x60a5fa);
    const indAccent = new THREE.Color(0x38bdf8);

    for (let r = 0; r < rows; r++) {
      const phi = (r / rows) * Math.PI; // 0 to PI
      const y = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      // Pixel Y corresponding to latitude
      const py = Math.floor((r / rows) * mapH);

      // Distribute points proportionally to circumference
      const pointsInRow = Math.max(1, Math.floor(cols * sinPhi));

      for (let c = 0; c < pointsInRow; c++) {
        const theta = (c / pointsInRow) * (Math.PI * 2); // 0 to 2PI
        const px = Math.floor((c / pointsInRow) * mapW);

        const pIdx = (py * mapW + px) * 4;
        const brightness = imgData[pIdx]; // 0 or 255

        if (brightness > 100) {
          // Point is on land!
          const rOffset = GLOBE_RADIUS * 1.004;
          const x = rOffset * sinPhi * Math.cos(theta);
          const z = rOffset * sinPhi * Math.sin(theta);

          positions.push(x, y * rOffset, z);
          phases.push(Math.random() * Math.PI * 2);
          speeds.push(1.6 + Math.random() * 2.6);

          // Check if near Indonesia (lat ~ -5 to +5 deg, lon ~ 95 to 140 deg)
          const isIndonesia = px >= 330 && px <= 380 && py >= 118 && py <= 138;

          if (isIndonesia) {
            colors.push(indAccent.r, indAccent.g, indAccent.b);
            sizes.push(1.35);
            scales.push(1.35);
          } else if (Math.random() < 0.22) {
            colors.push(brightViolet.r, brightViolet.g, brightViolet.b);
            sizes.push(1.15);
            scales.push(1.15);
          } else if (Math.random() < 0.1) {
            colors.push(cyanAccent.r, cyanAccent.g, cyanAccent.b);
            sizes.push(1.0);
            scales.push(1.0);
          } else {
            colors.push(baseViolet.r, baseViolet.g, baseViolet.b);
            sizes.push(0.9);
            scales.push(0.9);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
    geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1));
    return geo;
  }

  // Shimmering particle shaders for continents and Earth surface
  const shimmerVertexShader = `
    attribute float aPhase;
    attribute float aSpeed;
    attribute float aScale;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uTime;

    void main() {
      vColor = color;
      // Multi-harmonic shimmering glow calculation
      float wave = sin(uTime * aSpeed + aPhase);
      float shimmer = 0.5 + 0.5 * wave;
      float sparkle = pow(shimmer, 3.0); // periodic diamond sparkle
      vAlpha = 0.5 + 0.5 * shimmer;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float baseSize = 46.0;
      gl_PointSize = (baseSize * aScale + sparkle * 24.0) * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const shimmerFragmentShader = `
    uniform sampler2D uTexture;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec4 tex = texture2D(uTexture, gl_PointCoord);
      if (tex.a < 0.05) discard;
      // Core luminescence brightening for subtle premium shimmer
      vec3 glowColor = vColor + vec3(0.25, 0.18, 0.38) * (vAlpha * 0.65);
      gl_FragColor = vec4(glowColor, vAlpha * tex.a);
    }
  `;

  const shimmerDotMat = new THREE.ShaderMaterial({
    vertexShader: shimmerVertexShader,
    fragmentShader: shimmerFragmentShader,
    uniforms: {
      uTexture: { value: particleTex },
      uTime: { value: 0.0 },
    },
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const dotGeo = generateWorldMapPoints();
  const dotPoints = new THREE.Points(dotGeo, shimmerDotMat);
  globeGroup.add(dotPoints);

  // Dedicated Floating Shimmering Surface Corona Layer
  function createSurfaceShimmerLayer(count = 420) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const scales = new Float32Array(count);

    const palette = [
      new THREE.Color(0xd8b4fe), // light violet
      new THREE.Color(0xa78bfa), // deep violet
      new THREE.Color(0x38bdf8), // electric cyan
      new THREE.Color(0xffffff), // diamond sparkle
    ];

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = GLOBE_RADIUS * (1.012 + Math.random() * 0.018);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 1.8 + Math.random() * 3.0;
      scales[i] = 0.65 + Math.random() * 0.75;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: shimmerVertexShader,
      fragmentShader: shimmerFragmentShader,
      uniforms: {
        uTexture: { value: particleTex },
        uTime: { value: 0.0 },
      },
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geo, mat);
  }

  const surfaceShimmerPoints = createSurfaceShimmerLayer(420);
  globeGroup.add(surfaceShimmerPoints);

  // 8. PART 3: Geodesic Wireframe Lattice Rings
  const ringsGroup = new THREE.Group();
  const ringMat = new THREE.LineBasicMaterial({
    color: 0x7c3aed,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
  });

  // Latitude rings
  const latAngles = [-50, -25, 0, 25, 50];
  latAngles.forEach((deg) => {
    const rad = THREE.MathUtils.degToRad(deg);
    const r = GLOBE_RADIUS * Math.cos(rad);
    const y = GLOBE_RADIUS * Math.sin(rad);
    const ringGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(ringGeo, ringMat);
    ringsGroup.add(line);
  });

  // Meridian longitude lines
  for (let m = 0; m < 12; m++) {
    const a = (m / 12) * Math.PI;
    const ringGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(
        Math.sin(theta) * GLOBE_RADIUS * Math.cos(a),
        Math.cos(theta) * GLOBE_RADIUS,
        Math.sin(theta) * GLOBE_RADIUS * Math.sin(a)
      );
    }
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(ringGeo, ringMat);
    ringsGroup.add(line);
  }
  globeGroup.add(ringsGroup);

  // 9. PART 4: Glowing Atmospheric Fresnel Rim Glow (Custom Shader)
  const fresnelVertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fresnelFragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 uColor;
    uniform float uIntensity;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = 1.0 - max(0.0, dot(viewDir, vNormal));
      float factor = pow(fresnel, 3.4) * uIntensity;
      gl_FragColor = vec4(uColor, factor);
    }
  `;

  const atmosphereMat = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(0xa855f7) },
      uIntensity: { value: 1.85 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const atmosphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.02, 48, 48),
    atmosphereMat
  );
  globeGroup.add(atmosphereMesh);

  // Outer breathing aura
  const outerHaloMat = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec3 viewDir = normalize(-vPosition);
        float fresnel = 1.0 - max(0.0, dot(viewDir, vNormal));
        float factor = pow(fresnel, 5.0) * 0.9;
        gl_FragColor = vec4(0.72, 0.45, 1.0, factor);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const outerHaloMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.14, 48, 48),
    outerHaloMat
  );
  globeGroup.add(outerHaloMesh);

  // 10. PART 5: Orbital Ring with Pulsing Travelling Light Packets
  const orbitCurve = new THREE.EllipseCurve(0, 0, 2.15, 2.15, 0, 2 * Math.PI, false, 0);
  const orbitPts = orbitCurve.getPoints(90);
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(
    orbitPts.map((p) => new THREE.Vector3(p.x, 0, p.y))
  );
  const orbitMat = new THREE.LineBasicMaterial({
    color: 0x9333ea,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
  });
  const orbitLine = new THREE.Line(orbitGeo, orbitMat);
  orbitLine.rotation.x = THREE.MathUtils.degToRad(35);
  orbitLine.rotation.y = THREE.MathUtils.degToRad(-15);
  masterGroup.add(orbitLine);

  // Travelling Data Packets on Orbit
  const packetCount = 6;
  const packetGeo = new THREE.BufferGeometry();
  const packetPos = new Float32Array(packetCount * 3);
  packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
  const packetMat = new THREE.PointsMaterial({
    size: 0.08,
    map: particleTex,
    color: 0x38bdf8,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const packetPoints = new THREE.Points(packetGeo, packetMat);
  orbitLine.add(packetPoints);

  // 11. PART 6: Orbiting Communications Satellite (Composite 4-Part THREE.Group)
  const satellite = new THREE.Group();
  // Satellite Body
  const satBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
  );
  satellite.add(satBody);

  // Left & Right Solar Panels
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    metalness: 0.95,
    roughness: 0.1,
  });
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.01), panelMat);
  leftPanel.position.x = -0.12;
  satellite.add(leftPanel);

  const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.01), panelMat);
  rightPanel.position.x = 0.12;
  satellite.add(rightPanel);

  // Communications LED Beacon
  const satBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  satBeacon.position.y = 0.045;
  satellite.add(satBeacon);

  orbitLine.add(satellite);

  // 12. PART 7: Jakarta Hub Pulse & Global Infrastructure Curved Network Arcs
  const jakartaPos = new THREE.Vector3();
  // Jakarta ~ lat -6.2 deg, lon ~ 106.8 deg
  const jLat = THREE.MathUtils.degToRad(-6.2);
  const jLon = THREE.MathUtils.degToRad(106.8);
  jakartaPos.x = GLOBE_RADIUS * Math.cos(jLat) * Math.sin(jLon);
  jakartaPos.y = GLOBE_RADIUS * Math.sin(jLat);
  jakartaPos.z = GLOBE_RADIUS * Math.cos(jLat) * Math.cos(jLon);

  // Pulse ring marker on Jakarta
  const pulseRingGeo = new THREE.RingGeometry(0.03, 0.045, 24);
  const pulseRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
  pulseRing.position.copy(jakartaPos.clone().multiplyScalar(1.008));
  pulseRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), jakartaPos.clone().normalize());
  globeGroup.add(pulseRing);

  // Global Hubs connection arcs (Jakarta to Singapore, Tokyo, Frankfurt)
  const targetHubs = [
    { lat: 1.35, lon: 103.8 }, // Singapore
    { lat: 35.67, lon: 139.65 }, // Tokyo
    { lat: 50.11, lon: 8.68 }, // Frankfurt
  ];

  targetHubs.forEach((hub) => {
    const hLat = THREE.MathUtils.degToRad(hub.lat);
    const hLon = THREE.MathUtils.degToRad(hub.lon);
    const hubPos = new THREE.Vector3(
      GLOBE_RADIUS * Math.cos(hLat) * Math.sin(hLon),
      GLOBE_RADIUS * Math.sin(hLat),
      GLOBE_RADIUS * Math.cos(hLat) * Math.cos(hLon)
    );

    // Quadratic Bezier Arc lifted off Earth surface
    const midPoint = jakartaPos.clone().add(hubPos).multiplyScalar(0.5);
    const distance = jakartaPos.distanceTo(hubPos);
    midPoint.normalize().multiplyScalar(GLOBE_RADIUS + distance * 0.35);

    const arcCurve = new THREE.QuadraticBezierCurve3(jakartaPos, midPoint, hubPos);
    const arcPts = arcCurve.getPoints(36);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    globeGroup.add(arcLine);
  });

  // 13. PART 8: Ambient Twinkling Deep-Space Starfield
  const starCount = isSoftwareGl ? 350 : 800;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  const starColorPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xd8b4fe),
    new THREE.Color(0xa78bfa),
    new THREE.Color(0x93c5fd),
  ];

  for (let s = 0; s < starCount; s++) {
    const sRadius = 14 + Math.random() * 22;
    const sTheta = Math.random() * Math.PI * 2;
    const sPhi = Math.acos(Math.random() * 2 - 1);

    starPositions[s * 3] = sRadius * Math.sin(sPhi) * Math.cos(sTheta);
    starPositions[s * 3 + 1] = sRadius * Math.sin(sPhi) * Math.sin(sTheta);
    starPositions[s * 3 + 2] = sRadius * Math.cos(sPhi);

    const sc = starColorPalette[Math.floor(Math.random() * starColorPalette.length)];
    starColors[s * 3] = sc.r;
    starColors[s * 3 + 1] = sc.g;
    starColors[s * 3 + 2] = sc.b;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.12,
    map: particleTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // 14. Smooth Damped Mouse Parallax
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;

  function onPointerMove(e: MouseEvent | TouchEvent) {
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const ndcX = (clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(clientY / window.innerHeight) * 2 + 1;

    targetTiltY = ndcX * 0.18; // subtle left-right parallax
    targetTiltX = ndcY * 0.12; // subtle up-down parallax
  }

  window.addEventListener('mousemove', onPointerMove, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });

  // 15. Animation Loop with Software-WebGL Guard & Damped Kinematics
  let frameId = 0;
  let lastTime = performance.now();
  const orbitRadius = 2.15;

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Continuous globe rotation (matching original video: smooth right-to-left)
    globeGroup.rotation.y += dt * 0.16;

    // Orbiting satellite travel
    const satProgress = (now * 0.00018) % 1;
    const satAngle = satProgress * Math.PI * 2;
    satellite.position.set(Math.cos(satAngle) * orbitRadius, 0, Math.sin(satAngle) * orbitRadius);
    satellite.rotation.y = -satAngle + Math.PI / 2;

    // Update travelling packets along orbit
    const posArr = packetGeo.attributes.position.array as Float32Array;
    for (let p = 0; p < packetCount; p++) {
      const pAngle = (satAngle + (p / packetCount) * Math.PI * 2) % (Math.PI * 2);
      posArr[p * 3] = Math.cos(pAngle) * orbitRadius;
      posArr[p * 3 + 1] = 0;
      posArr[p * 3 + 2] = Math.sin(pAngle) * orbitRadius;
    }
    packetGeo.attributes.position.needsUpdate = true;

    // Jakarta marker pulse animation
    const pulseScale = 1 + Math.sin(now * 0.004) * 0.35;
    pulseRing.scale.set(pulseScale, pulseScale, 1);
    pulseRingMat.opacity = 0.5 + Math.cos(now * 0.004) * 0.4;

    // Subtle atmospheric breathing aura
    atmosphereMat.uniforms.uIntensity.value = 1.7 + Math.sin(now * 0.002) * 0.25;

    // Surface Shimmering Particle Glow Animation
    shimmerDotMat.uniforms.uTime.value = now * 0.0018;
    (surfaceShimmerPoints.material as THREE.ShaderMaterial).uniforms.uTime.value = now * 0.0024;

    // Smooth exponential damping on mouse parallax
    const dampFactor = 1 - Math.exp(-4.5 * dt);
    currentTiltX += (targetTiltX - currentTiltX) * dampFactor;
    currentTiltY += (targetTiltY - currentTiltY) * dampFactor;
    masterGroup.rotation.x = currentTiltX;
    masterGroup.rotation.y = currentTiltY;

    // Subtle star drift
    stars.rotation.y += dt * 0.015;

    renderer.render(scene, camera);

    if (isSoftwareGl) {
      // Software WebGL pacing as specified in threejs skill
      frameId = window.setTimeout(tick, 33);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  // Kick off animation loop
  tick();

  // Fade out skeleton & video poster once WebGL canvas is rendering active frames
  setTimeout(() => {
    canvas.classList.add('is-ready');
    document.getElementById('hero-globe-skeleton')?.classList.add('is-loaded');
    const videos = document.querySelectorAll('.bg-video');
    videos.forEach((v) => {
      (v as HTMLElement).style.opacity = '0.05';
    });
  }, 350);

  // Cleanup handler if needed
  return () => {
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);
    window.removeEventListener('resize', updateSize);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('touchmove', onPointerMove);
    renderer.dispose();
  };
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroGlobe);
} else {
  initHeroGlobe();
}
