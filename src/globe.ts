import * as THREE from 'three';

/**
 * Performance-Efficient WebGL 3D Dot-Matrix Globe for Vier Ventures Hero Background
 * Optimized for minimal initial page load & runtime GPU/CPU overhead:
 * - Dynamic code-split loading (deferred until hero is active & visible)
 * - Merged BufferGeometries: 1 draw call for all 17 lattice rings, 1 for all network arcs, 1 for all dots+corona
 * - Combined Core + Atmospheric Fresnel shader (zero PBR multi-light shader compilation stalls)
 * - Adaptive vertex density & compact 256x128 procedural landmass sampling
 * - Automatic render-loop pause via IntersectionObserver, branch router state, and Page Visibility API
 * - Software WebGL fenceSync pacing (afterDraw) & reduced-motion single-frame mode
 * - Zero external network/404 asset dependencies
 */

export function initHeroGlobe(): (() => void) | undefined {
  const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement | null;
  if (!canvas || canvas.dataset.vvGlobeInit === '1') return;
  canvas.dataset.vvGlobeInit = '1';

  const container = canvas.parentElement || document.body;
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Lightweight Software WebGL probe (used only for rendering cost & loop pacing)
  const isSoftwareGl = (() => {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
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

  // 2. Setup WebGL Renderer with lean buffer settings
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isSoftwareGl,
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('WebGL initialization failed, activating fallback', err);
    document.getElementById('hero-globe-skeleton')?.classList.add('is-loaded');
    window.dispatchEvent(new Event('vv:webgl-fallback'));
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));

  // Track resources for clean disposal
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  // 3. Scene & Camera Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.45, 4.4);
  camera.lookAt(0, -0.2, 0);

  function updateSize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  updateSize();
  window.addEventListener('resize', updateSize, { passive: true });

  // Lightweight ResizeObserver on hero container
  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSize())
      : null;
  resizeObserver?.observe(container);

  // 4. Lightweight Lighting Rig (for satellite mesh only; core & dots use fast custom shaders)
  const hemiLight = new THREE.HemisphereLight(0xa78bfa, 0x05040a, 1.6);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xe0e7ff, 2.0);
  keyLight.position.set(4, 5, 4);
  scene.add(keyLight);

  // Master group & tilted Earth group
  const masterGroup = new THREE.Group();
  scene.add(masterGroup);

  const globeGroup = new THREE.Group();
  globeGroup.rotation.z = THREE.MathUtils.degToRad(-15);
  globeGroup.rotation.x = THREE.MathUtils.degToRad(12);
  globeGroup.position.set(0, -0.25, 0);
  masterGroup.add(globeGroup);

  const GLOBE_RADIUS = 1.56;

  // 5. Compact 32x32 Procedural Radial Glow Texture (Zero 404s, tiny VRAM footprint)
  function createParticleTexture(size = 32) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    const ctx = pCanvas.getContext('2d')!;
    const half = size / 2;

    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(216, 180, 254, 0.92)');
    grad.addColorStop(0.62, 'rgba(168, 85, 247, 0.45)');
    grad.addColorStop(0.92, 'rgba(126, 34, 206, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(pCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    return texture;
  }
  const particleTex = createParticleTexture(32);

  // 6. PART 1: Combined Core Planet + Atmospheric Fresnel Rim Shader (1 Draw Call instead of 2)
  const coreGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.996, 36, 28);
  geometries.push(coreGeo);

  const coreAtmosphereMat = new THREE.ShaderMaterial({
    uniforms: {
      uRimColor: { value: new THREE.Color(0xa855f7) },
      uIntensity: { value: 1.55 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vPosView;
      void main() {
        vNormalView = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vPosView = mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uRimColor;
      uniform float uIntensity;
      varying vec3 vNormalView;
      varying vec3 vPosView;
      void main() {
        vec3 viewDir = normalize(-vPosView);
        float ndotv = max(0.0, dot(viewDir, vNormalView));
        float fresnel = pow(1.0 - ndotv, 3.2) * uIntensity;
        // Deep obsidian globe core with subtle violet directional sheen + Fresnel edge glow
        float sheen = max(0.0, dot(vNormalView, normalize(vec3(0.55, 0.7, 0.6)))) * 0.08;
        vec3 baseColor = vec3(0.02, 0.015, 0.055) + vec3(0.18, 0.10, 0.36) * sheen;
        vec3 finalColor = baseColor + uRimColor * fresnel;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
  materials.push(coreAtmosphereMat);

  const coreMesh = new THREE.Mesh(coreGeo, coreAtmosphereMat);
  globeGroup.add(coreMesh);

  // Subtle Outer Breathing Halo (1 lightweight BackSide sphere)
  const outerHaloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.13, 32, 22);
  geometries.push(outerHaloGeo);

  const outerHaloMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vPosView;
      void main() {
        vNormalView = normalize(normalMatrix * normal);
        vPosView = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormalView;
      varying vec3 vPosView;
      void main() {
        vec3 viewDir = normalize(-vPosView);
        float fresnel = 1.0 - max(0.0, dot(viewDir, vNormalView));
        float factor = pow(fresnel, 5.2) * 0.85;
        gl_FragColor = vec4(0.72, 0.45, 1.0, factor);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  materials.push(outerHaloMat);

  const outerHaloMesh = new THREE.Mesh(outerHaloGeo, outerHaloMat);
  globeGroup.add(outerHaloMesh);

  // 7. PART 2: Unified Landmass Dot-Matrix + Floating Surface Corona (1 Draw Call, Compact 256x128 Map)
  function generateUnifiedGlobeDots(): THREE.BufferGeometry {
    const mapW = 256;
    const mapH = 128;
    const mCanvas = document.createElement('canvas');
    mCanvas.width = mapW;
    mCanvas.height = mapH;
    const mCtx = mCanvas.getContext('2d')!;

    mCtx.fillStyle = '#000000';
    mCtx.fillRect(0, 0, mapW, mapH);
    mCtx.fillStyle = '#ffffff';

    const scaleX = mapW / 400;
    const scaleY = mapH / 200;

    function drawBlob(cx: number, cy: number, rx: number, ry: number, rot = 0) {
      mCtx.save();
      mCtx.translate(cx * scaleX, cy * scaleY);
      mCtx.rotate(rot);
      mCtx.beginPath();
      mCtx.ellipse(0, 0, rx * scaleX, ry * scaleY, 0, 0, Math.PI * 2);
      mCtx.fill();
      mCtx.restore();
    }

    // North America
    drawBlob(95, 52, 38, 26, -0.2);
    drawBlob(60, 40, 25, 18, -0.4);
    drawBlob(130, 32, 22, 16, 0.3);
    drawBlob(88, 85, 16, 22, 0.4);
    // South America
    drawBlob(130, 130, 24, 38, 0.25);
    drawBlob(138, 120, 20, 24, 0);
    // Europe
    drawBlob(205, 50, 18, 14, 0.1);
    drawBlob(222, 42, 22, 15, 0.3);
    drawBlob(190, 48, 8, 12, -0.3);
    // Africa
    drawBlob(212, 110, 28, 38, 0.1);
    drawBlob(235, 145, 10, 18, 0.2);
    // Eurasia / Asia
    drawBlob(280, 48, 55, 24, 0.1);
    drawBlob(320, 52, 42, 22, -0.15);
    drawBlob(255, 80, 30, 22, 0.2);
    drawBlob(290, 88, 26, 22, 0.1);
    drawBlob(330, 82, 34, 25, 0);
    drawBlob(356, 75, 8, 22, 0.5);
    // Southeast Asia & Indonesia
    drawBlob(335, 110, 16, 12, 0.3);
    drawBlob(340, 126, 24, 8, -0.1);
    drawBlob(362, 124, 18, 12, 0.2);
    drawBlob(375, 128, 18, 10, 0.1);
    // Australia & New Zealand
    drawBlob(358, 155, 30, 22, 0.1);
    drawBlob(392, 168, 8, 14, 0.5);

    const imgData = mCtx.getImageData(0, 0, mapW, mapH).data;

    // Adaptive density: crisp dot clarity with ~45% fewer vertices
    const rows = 90;
    const cols = 180;
    const coronaCount = 260;

    const baseViolet = new THREE.Color(0xa78bfa);
    const brightViolet = new THREE.Color(0xd8b4fe);
    const cyanAccent = new THREE.Color(0x60a5fa);
    const indAccent = new THREE.Color(0x38bdf8);
    const whiteSparkle = new THREE.Color(0xffffff);

    const coronaPalette = [brightViolet, baseViolet, indAccent, whiteSparkle];

    // Pre-pass count? Pushing directly into flat arrays for landmass + appending corona typed slice
    const positions: number[] = [];
    const colors: number[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    const scales: number[] = [];

    const landRadius = GLOBE_RADIUS * 1.005;

    for (let r = 0; r < rows; r++) {
      const phi = (r / rows) * Math.PI;
      const y = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const py = Math.floor((r / rows) * mapH);
      const pointsInRow = Math.max(1, Math.floor(cols * sinPhi));

      for (let c = 0; c < pointsInRow; c++) {
        const theta = (c / pointsInRow) * Math.PI * 2;
        const px = Math.floor((c / pointsInRow) * mapW);
        const pIdx = (py * mapW + px) * 4;

        if (imgData[pIdx] > 100) {
          positions.push(
            landRadius * sinPhi * Math.cos(theta),
            y * landRadius,
            landRadius * sinPhi * Math.sin(theta)
          );
          phases.push(Math.random() * Math.PI * 2);
          speeds.push(1.6 + Math.random() * 2.4);

          const isIndonesia = px >= 211 && px <= 244 && py >= 75 && py <= 89;
          if (isIndonesia) {
            colors.push(indAccent.r, indAccent.g, indAccent.b);
            scales.push(1.55);
          } else {
            const roll = Math.random();
            if (roll < 0.22) {
              colors.push(brightViolet.r, brightViolet.g, brightViolet.b);
              scales.push(1.3);
            } else if (roll < 0.32) {
              colors.push(cyanAccent.r, cyanAccent.g, cyanAccent.b);
              scales.push(1.15);
            } else {
              colors.push(baseViolet.r, baseViolet.g, baseViolet.b);
              scales.push(1.02);
            }
          }
        }
      }
    }

    // Append floating surface corona particles into the SAME BufferGeometry (1 draw call total!)
    for (let i = 0; i < coronaCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = GLOBE_RADIUS * (1.014 + Math.random() * 0.018);

      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );

      const cc = coronaPalette[Math.floor(Math.random() * coronaPalette.length)];
      colors.push(cc.r, cc.g, cc.b);
      phases.push(Math.random() * Math.PI * 2);
      speeds.push(1.8 + Math.random() * 2.8);
      scales.push(0.75 + Math.random() * 0.8);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
    geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1));
    geometries.push(geo);
    return geo;
  }

  const shimmerDotMat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: particleTex },
      uTime: { value: 0.0 },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aScale;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;

      void main() {
        vColor = color;
        float wave = sin(uTime * aSpeed + aPhase);
        float shimmer = 0.5 + 0.5 * wave;
        float sparkle = pow(shimmer, 3.0);
        vAlpha = 0.52 + 0.48 * shimmer;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (48.0 * aScale + sparkle * 22.0) * (1.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        if (tex.a < 0.05) discard;
        vec3 glowColor = vColor + vec3(0.24, 0.17, 0.36) * (vAlpha * 0.65);
        gl_FragColor = vec4(glowColor, vAlpha * tex.a);
      }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(shimmerDotMat);

  const dotGeo = generateUnifiedGlobeDots();
  const dotPoints = new THREE.Points(dotGeo, shimmerDotMat);
  globeGroup.add(dotPoints);

  // 8. PART 3: Merged Geodesic Wireframe Lattice (17 separate Lines -> 1 Single LineSegments Draw Call)
  function createMergedLattice(): THREE.LineSegments {
    const segPts: number[] = [];
    const latAngles = [-50, -25, 0, 25, 50];
    const latSegments = 48;

    for (let li = 0; li < latAngles.length; li++) {
      const rad = THREE.MathUtils.degToRad(latAngles[li]);
      const r = GLOBE_RADIUS * Math.cos(rad);
      const y = GLOBE_RADIUS * Math.sin(rad);
      for (let i = 0; i < latSegments; i++) {
        const a0 = (i / latSegments) * Math.PI * 2;
        const a1 = ((i + 1) / latSegments) * Math.PI * 2;
        segPts.push(
          Math.cos(a0) * r,
          y,
          Math.sin(a0) * r,
          Math.cos(a1) * r,
          y,
          Math.sin(a1) * r
        );
      }
    }

    const lonSegments = 48;
    for (let m = 0; m < 12; m++) {
      const a = (m / 12) * Math.PI;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      for (let i = 0; i < lonSegments; i++) {
        const t0 = (i / lonSegments) * Math.PI * 2;
        const t1 = ((i + 1) / lonSegments) * Math.PI * 2;
        segPts.push(
          Math.sin(t0) * GLOBE_RADIUS * cosA,
          Math.cos(t0) * GLOBE_RADIUS,
          Math.sin(t0) * GLOBE_RADIUS * sinA,
          Math.sin(t1) * GLOBE_RADIUS * cosA,
          Math.cos(t1) * GLOBE_RADIUS,
          Math.sin(t1) * GLOBE_RADIUS * sinA
        );
      }
    }

    const latticeGeo = new THREE.BufferGeometry();
    latticeGeo.setAttribute('position', new THREE.Float32BufferAttribute(segPts, 3));
    geometries.push(latticeGeo);

    const latticeMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(latticeMat);

    return new THREE.LineSegments(latticeGeo, latticeMat);
  }
  globeGroup.add(createMergedLattice());

  // 9. PART 4: Orbital Ring & Traveling Data Packets
  const orbitRadius = 2.15;
  const orbitCurve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, Math.PI * 2, false, 0);
  const orbitPts = orbitCurve.getPoints(72);
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(
    orbitPts.map((p) => new THREE.Vector3(p.x, 0, p.y))
  );
  geometries.push(orbitGeo);

  const orbitMat = new THREE.LineBasicMaterial({
    color: 0x9333ea,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(orbitMat);

  const orbitLine = new THREE.Line(orbitGeo, orbitMat);
  orbitLine.rotation.x = THREE.MathUtils.degToRad(35);
  orbitLine.rotation.y = THREE.MathUtils.degToRad(-15);
  masterGroup.add(orbitLine);

  const packetCount = 6;
  const packetGeo = new THREE.BufferGeometry();
  const packetPos = new Float32Array(packetCount * 3);
  packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
  geometries.push(packetGeo);

  const packetMat = new THREE.PointsMaterial({
    size: 0.085,
    map: particleTex,
    color: 0x38bdf8,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(packetMat);

  const packetPoints = new THREE.Points(packetGeo, packetMat);
  orbitLine.add(packetPoints);

  // 10. PART 5: Composite 4-Part Communications Satellite (Lightweight Lambert Shading)
  const satellite = new THREE.Group();
  const satBodyGeo = new THREE.BoxGeometry(0.07, 0.07, 0.1);
  const satBodyMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const satPanelGeo = new THREE.BoxGeometry(0.16, 0.04, 0.01);
  const satPanelMat = new THREE.MeshLambertMaterial({ color: 0x2563eb });
  const satBeaconGeo = new THREE.SphereGeometry(0.018, 10, 10);
  const satBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  geometries.push(satBodyGeo, satPanelGeo, satBeaconGeo);
  materials.push(satBodyMat, satPanelMat, satBeaconMat);

  const satBody = new THREE.Mesh(satBodyGeo, satBodyMat);
  const leftPanel = new THREE.Mesh(satPanelGeo, satPanelMat);
  leftPanel.position.x = -0.12;
  const rightPanel = new THREE.Mesh(satPanelGeo, satPanelMat);
  rightPanel.position.x = 0.12;
  const satBeacon = new THREE.Mesh(satBeaconGeo, satBeaconMat);
  satBeacon.position.y = 0.045;

  satellite.add(satBody, leftPanel, rightPanel, satBeacon);
  orbitLine.add(satellite);

  // 11. PART 6: Jakarta Hub Pulse & Merged GPU-Animated Network Arcs (1 Draw Call)
  const jLat = THREE.MathUtils.degToRad(-6.2);
  const jLon = THREE.MathUtils.degToRad(106.8);
  const jakartaPos = new THREE.Vector3(
    GLOBE_RADIUS * Math.cos(jLat) * Math.sin(jLon),
    GLOBE_RADIUS * Math.sin(jLat),
    GLOBE_RADIUS * Math.cos(jLat) * Math.cos(jLon)
  );

  const pulseRingGeo = new THREE.RingGeometry(0.03, 0.046, 20);
  geometries.push(pulseRingGeo);
  const pulseRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(pulseRingMat);

  const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
  pulseRing.position.copy(jakartaPos).multiplyScalar(1.008);
  const _unitZ = new THREE.Vector3(0, 0, 1);
  const _jakartaDir = jakartaPos.clone().normalize();
  pulseRing.quaternion.setFromUnitVectors(_unitZ, _jakartaDir);
  globeGroup.add(pulseRing);

  // Merge all global network arcs into 1 LineSegments with GPU traveling pulse shader
  const targetHubs = [
    { lat: 1.35, lon: 103.8, offset: 0.0 },
    { lat: 35.67, lon: 139.65, offset: 0.33 },
    { lat: 50.11, lon: 8.68, offset: 0.66 },
  ];

  const arcSegPositions: number[] = [];
  const arcSegProgress: number[] = [];
  const arcSteps = 32;

  targetHubs.forEach((hub) => {
    const hLat = THREE.MathUtils.degToRad(hub.lat);
    const hLon = THREE.MathUtils.degToRad(hub.lon);
    const hubPos = new THREE.Vector3(
      GLOBE_RADIUS * Math.cos(hLat) * Math.sin(hLon),
      GLOBE_RADIUS * Math.sin(hLat),
      GLOBE_RADIUS * Math.cos(hLat) * Math.cos(hLon)
    );
    const midPoint = jakartaPos.clone().add(hubPos).multiplyScalar(0.5);
    const distance = jakartaPos.distanceTo(hubPos);
    midPoint.normalize().multiplyScalar(GLOBE_RADIUS + distance * 0.35);

    const curve = new THREE.QuadraticBezierCurve3(jakartaPos, midPoint, hubPos);
    const pts = curve.getPoints(arcSteps);
    for (let i = 0; i < arcSteps; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      arcSegPositions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      arcSegProgress.push(i / arcSteps + hub.offset, (i + 1) / arcSteps + hub.offset);
    }
  });

  const mergedArcGeo = new THREE.BufferGeometry();
  mergedArcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcSegPositions, 3));
  mergedArcGeo.setAttribute('aProgress', new THREE.Float32BufferAttribute(arcSegProgress, 1));
  geometries.push(mergedArcGeo);

  const arcShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(0x60a5fa) },
      uPulseColor: { value: new THREE.Color(0x38bdf8) },
    },
    vertexShader: `
      attribute float aProgress;
      varying float vProgress;
      void main() {
        vProgress = aProgress;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uPulseColor;
      varying float vProgress;
      void main() {
        float flow = fract(vProgress - uTime * 0.45);
        float pulse = smoothstep(0.75, 1.0, flow);
        vec3 col = mix(uBaseColor, uPulseColor, pulse);
        float alpha = 0.32 + pulse * 0.68;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(arcShaderMat);

  const networkArcs = new THREE.LineSegments(mergedArcGeo, arcShaderMat);
  globeGroup.add(networkArcs);

  // 12. PART 7: Ambient Deep-Space Starfield
  const starCount = isSoftwareGl ? 280 : 550;
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
  geometries.push(starGeo);

  const starMat = new THREE.PointsMaterial({
    size: 0.13,
    map: particleTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(starMat);

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Pre-warm shaders on hardware GPUs so first frame has zero hitch
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // 13. Smooth Damped Mouse Parallax
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
    targetTiltY = ndcX * 0.16;
    targetTiltX = ndcY * 0.1;
  }

  if (!reducedMotion) {
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
  }

  // 14. Visibility & Branch-Aware Lifecycle (Pause GPU completely offscreen or in other branches)
  let isHeroInViewport = true;
  let isBranchHomeActive =
    document.getElementById('branch-home')?.classList.contains('is-active') ?? true;
  let isPageVisible = !document.hidden;
  let frameId = 0;
  let isRunning = false;
  let lastTime = performance.now();

  const heroSection = document.getElementById('home');
  const heroObserver =
    typeof IntersectionObserver !== 'undefined' && heroSection
      ? new IntersectionObserver(
          (entries) => {
            isHeroInViewport = entries[0]?.isIntersecting ?? true;
            syncAnimationState();
          },
          { threshold: 0.02 }
        )
      : null;
  if (heroSection && heroObserver) {
    heroObserver.observe(heroSection);
  }

  function onBranchActivated(e: Event) {
    const detail = (e as CustomEvent<{ branch?: string }>).detail;
    isBranchHomeActive = !detail?.branch || detail.branch === 'home';
    if (isBranchHomeActive) updateSize();
    syncAnimationState();
  }
  window.addEventListener('vv:branch-activated', onBranchActivated);

  function onVisibilityChange() {
    isPageVisible = !document.hidden;
    syncAnimationState();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Software-WebGL GPU completion sync (per Three.js performance guidelines)
  function afterDraw(cb: () => void) {
    try {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        if (sync) {
          const poll = () => {
            if (!isRunning) {
              gl.deleteSync(sync);
              return;
            }
            const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 6);
            } else {
              gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 6);
          return;
        }
      }
    } catch {
      // Fallback below if WebGL2 sync not supported
    }
    frameId = window.setTimeout(cb, 80);
  }

  function renderFrame(now: number, dt: number) {
    globeGroup.rotation.y += dt * 0.16;

    const satAngle = ((now * 0.00018) % 1) * Math.PI * 2;
    satellite.position.set(Math.cos(satAngle) * orbitRadius, 0, Math.sin(satAngle) * orbitRadius);
    satellite.rotation.y = -satAngle + Math.PI / 2;

    const posArr = packetGeo.attributes.position.array as Float32Array;
    for (let p = 0; p < packetCount; p++) {
      const pAngle = satAngle + (p / packetCount) * Math.PI * 2;
      posArr[p * 3] = Math.cos(pAngle) * orbitRadius;
      posArr[p * 3 + 1] = 0;
      posArr[p * 3 + 2] = Math.sin(pAngle) * orbitRadius;
    }
    packetGeo.attributes.position.needsUpdate = true;

    const pulseScale = 1 + Math.sin(now * 0.004) * 0.35;
    pulseRing.scale.set(pulseScale, pulseScale, 1);
    pulseRingMat.opacity = 0.5 + Math.cos(now * 0.004) * 0.4;

    coreAtmosphereMat.uniforms.uIntensity.value = 1.48 + Math.sin(now * 0.002) * 0.22;
    shimmerDotMat.uniforms.uTime.value = now * 0.0018;
    arcShaderMat.uniforms.uTime.value = now * 0.001;

    const dampFactor = 1 - Math.exp(-4.5 * dt);
    currentTiltX += (targetTiltX - currentTiltX) * dampFactor;
    currentTiltY += (targetTiltY - currentTiltY) * dampFactor;
    masterGroup.rotation.x = currentTiltX;
    masterGroup.rotation.y = currentTiltY;

    stars.rotation.y += dt * 0.015;

    renderer.render(scene, camera);
  }

  function tick() {
    if (!isRunning) return;
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    renderFrame(now, dt);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  function syncAnimationState() {
    if (reducedMotion) return;
    const shouldRun = isHeroInViewport && isBranchHomeActive && isPageVisible;
    if (shouldRun && !isRunning) {
      isRunning = true;
      lastTime = performance.now();
      tick();
    } else if (!shouldRun && isRunning) {
      isRunning = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    }
  }

  // Render initial frame immediately & reveal canvas cleanly
  if (reducedMotion) {
    renderFrame(performance.now(), 0);
  } else {
    syncAnimationState();
  }

  requestAnimationFrame(() => {
    canvas.classList.add('is-ready');
    document.getElementById('hero-globe-skeleton')?.classList.add('is-loaded');
  });

  // Cleanup handler
  return () => {
    isRunning = false;
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);
    heroObserver?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', updateSize);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('vv:branch-activated', onBranchActivated);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    renderer.dispose();
  };
}
