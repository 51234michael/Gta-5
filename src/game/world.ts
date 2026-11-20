import * as THREE from 'three';
import {
  createAnamorphicStreakTexture,
  createAsphaltBumpTexture,
  createAsphaltTexture,
  createBillboardTexture,
  createCloudPuffTexture,
  createCrosswalkTexture,
  createDustParticleTexture,
  createGlowSpriteTexture,
  createGodRayTexture,
  createRunwayTexture,
  createSandTexture,
  createSidewalkBumpTexture,
  createSidewalkTexture,
  createSkyGradientTexture,
  createSkyscraperFacadeTexture,
  createWaterBumpTexture,
  createWaterTexture,
} from './textures';
import { WORLD_PROPERTIES } from './properties';
import { getStoreCounterPos, WALK_IN_STORES, WalkInStore } from './stores';
import { BuildingBox, InteractiveZone, MISSIONS, RampBox } from './types';

export const ROAD_COORDS = [-480, -360, -240, -120, 0, 120, 240, 360, 480];
export const ROAD_WIDTH = 18;

export interface WorldData {
  buildings: BuildingBox[];
  ramps: RampBox[];
  zones: InteractiveZone[];
  waterMesh: THREE.Mesh;
  oceanTexture: THREE.CanvasTexture;
  oceanBumpTexture: THREE.CanvasTexture;
  skyDome: THREE.Mesh;
  skyMat: THREE.MeshBasicMaterial;
  sunDisc: THREE.Mesh;
  sunHalo: THREE.Sprite;
  sunAnamorphicStreak: THREE.Sprite;
  godRayGroup: THREE.Group;
  godRayMat: THREE.MeshBasicMaterial;
  cloudGroup: THREE.Group;
  cloudMat: THREE.SpriteMaterial;
  dustPoints: THREE.Points;
  dustMat: THREE.PointsMaterial;
  zoneMeshes: Map<string, THREE.Group>;
  storeRoofs: Map<string, THREE.Object3D>;
}

export function getDistrictAt(x: number, z: number): string {
  if (z > 656) return 'Oceano Pacifico';
  if (z > 568) return 'Spiaggia di Vespucci';
  if (z > 495) return 'Lungomare Vespucci';
  if (z < -495) return 'Colline di Soliswood';
  if (x < -300 && z > 140) return 'Aeroporto di Los Solis';
  if (x < -300 && z <= 140) return 'Porto Industriale';
  if (x > 170 && x < 310 && z > -185 && z < -55) return 'Parco Centrale Solis';
  if (x > 300 && z < -180) return 'Stadio Solis';
  if (Math.abs(x) <= 130 && Math.abs(z) <= 130) return 'Centro Finanziario';
  if (x > 130 && z <= -55) return 'Vinewood Est';
  if (x < -130 && z < -130) return 'Rockford Hills';
  return 'Plaza del Sol';
}

function createCurvedPalmFrondGeometry(): THREE.BufferGeometry {
  const segs = 7;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = t * 4.2;
    const y = Math.sin(t * Math.PI * 0.72) * 0.72 - t * t * 1.15;
    const halfW = (1 - t * 0.88) * 0.56 * Math.sin(Math.min(1, t * 3.5) * Math.PI * 0.5 + 0.25);

    positions.push(-halfW, y, z);
    positions.push(0, y + 0.08 * (1 - t), z);
    positions.push(halfW, y, z);

    normals.push(-0.2, 1, 0, 0, 1, 0, 0.2, 1, 0);
  }

  for (let i = 0; i < segs; i++) {
    const row = i * 3;
    const next = (i + 1) * 3;
    indices.push(row, next, row + 1);
    indices.push(row + 1, next, next + 1);
    indices.push(row + 1, next + 1, row + 2);
    indices.push(row + 2, next + 1, next + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRoundedTowerGeometry(w: number, d: number, h: number, radius: number): THREE.ExtrudeGeometry {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const r = Math.min(radius, hw * 0.45, hd * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.3,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function buildLosSolisWorld(
  scene: THREE.Scene,
  maxAniso: number,
  enableShadows: boolean
): WorldData {
  const buildings: BuildingBox[] = [];
  const ramps: RampBox[] = [];
  const zones: InteractiveZone[] = [];
  const zoneMeshes = new Map<string, THREE.Group>();
  const storeRoofs = new Map<string, THREE.Object3D>();

  // 0. Atmospheric Sky Dome & 3D Sun/Moon Disc (expanded for 1400m metropolis)
  const skyMat = new THREE.MeshBasicMaterial({
    map: createSkyGradientTexture('sunset'),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), skyMat);
  scene.add(skyDome);

  const glowTex = createGlowSpriteTexture();
  const streakTex = createAnamorphicStreakTexture();
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(26, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
  );
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfdba74,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  sunHalo.scale.set(240, 240, 1);
  const sunAnamorphicStreak = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: streakTex,
      color: 0xffc875,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
  );
  sunAnamorphicStreak.scale.set(540, 72, 1);
  sunDisc.add(sunHalo, sunAnamorphicStreak);
  skyDome.add(sunDisc);

  // Volumetric Golden-Hour God Rays (low-angle sunbeams filtering through cumulus clouds)
  const godRayMat = new THREE.MeshBasicMaterial({
    map: createGodRayTexture(),
    color: 0xffc67c,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const godRayGroup = new THREE.Group();
  const rayConfigs: [number, number, number, number][] = [
    [-190, -85, -0.34, 150],
    [-85, -105, -0.18, 185],
    [15, -110, 0.04, 210],
    [120, -95, 0.22, 175],
    [225, -80, 0.36, 145],
  ];
  for (const [rx, ry, rz, rw] of rayConfigs) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(rw, 460), godRayMat);
    ray.position.set(rx, ry, 0);
    ray.rotation.z = rz;
    godRayGroup.add(ray);
  }
  skyDome.add(godRayGroup);

  // Volumetric 3D Cloud Coverage
  const cloudTex = createCloudPuffTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex,
    color: 0xffd7b0,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    fog: false,
  });
  const cloudGroup = new THREE.Group();
  for (let i = 0; i < 68; i++) {
    const ang = (i / 68) * Math.PI * 2 + (i % 3) * 0.14;
    const dist = 420 + (i % 5) * 145;
    const cy = 205 + (i % 7) * 24;
    const cloud = new THREE.Sprite(cloudMat);
    const w = 230 + (i % 4) * 75;
    const h = 72 + (i % 3) * 26;
    cloud.position.set(Math.cos(ang) * dist, cy, Math.sin(ang) * dist);
    cloud.scale.set(w, h, 1);
    cloudGroup.add(cloud);
  }
  skyDome.add(cloudGroup);

  // Atmospheric Smog & Golden-Hour Sunlit Dust Particles
  const dustCount = 420;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 220;
    dustPos[i * 3 + 1] = 0.6 + Math.random() * 28;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    map: createDustParticleTexture(),
    color: 0xfde68a,
    size: 0.72,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.frustumCulled = false;
  scene.add(dustPoints);

  // 1. Massive Base Terrain & City Ground Slab
  const sidewalkTex = createSidewalkTexture(maxAniso);
  const sidewalkBump = createSidewalkBumpTexture(maxAniso);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d36,
    roughness: 0.94,
    metalness: 0.02,
  });
  const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), groundMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.04;
  outerGround.receiveShadow = enableShadows;
  scene.add(outerGround);

  const citySlab = new THREE.Mesh(
    new THREE.PlaneGeometry(1240, 1200),
    new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      bumpMap: sidewalkBump,
      bumpScale: 0.035,
      roughness: 0.78,
      metalness: 0.06,
    })
  );
  citySlab.rotation.x = -Math.PI / 2;
  citySlab.position.set(0, 0.01, -10);
  citySlab.receiveShadow = enableShadows;
  scene.add(citySlab);

  // 2. Vespucci Beach, Shoreline Foam, Coastal Rocks, Lifeguard Tower, Pier & Ocean
  const sandTex = createSandTexture(maxAniso);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 92),
    new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.92 })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, 612);
  beach.receiveShadow = enableShadows;
  scene.add(beach);

  const foamStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 6.5),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.62 })
  );
  foamStrip.rotation.x = -Math.PI / 2;
  foamStrip.position.set(0, 0.03, 656);
  scene.add(foamStrip);

  const oceanTexture = createWaterTexture(maxAniso);
  const oceanBumpTexture = createWaterBumpTexture(maxAniso);
  const waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3600, 1000),
    new THREE.MeshPhysicalMaterial({
      map: oceanTexture,
      bumpMap: oceanBumpTexture,
      bumpScale: 0.24,
      color: 0x0284c7,
      roughness: 0.06,
      metalness: 0.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.45,
    })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, -0.32, 1150);
  scene.add(waterMesh);

  // Coastal Cliff Rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92, metalness: 0.04 });
  const rockCoords: [number, number, number][] = [
    [-590, 646, 8],
    [-565, 654, 5.5],
    [-310, 652, 4.2],
    [290, 652, 4.5],
    [560, 648, 7.5],
    [590, 642, 9.5],
  ];
  for (const [rx, rz, rs] of rockCoords) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 1), rockMat);
    rock.scale.set(1.4, 0.72, 1.1);
    rock.position.set(rx, rs * 0.25, rz);
    rock.rotation.set(rx * 0.1, rz * 0.2, 0.15);
    scene.add(rock);
  }

  // Beach Umbrellas & Curved-Roof Lifeguard Towers
  const umbrellaColors = [0xef4444, 0x3b82f6, 0xfacc15, 0x10b981, 0xf97316];
  for (let i = -11; i <= 11; i++) {
    if (i === 3 || i === 4) continue;
    const ux = i * 44 - 12;
    const uz = 602 + (Math.abs(i) % 2) * 18;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
    );
    pole.position.set(ux, 1.4, uz);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.36),
      new THREE.MeshStandardMaterial({
        color: umbrellaColors[Math.abs(i) % umbrellaColors.length],
        roughness: 0.6,
        side: THREE.DoubleSide,
      })
    );
    canopy.position.set(ux, 1.25, uz);
    canopy.castShadow = enableShadows;
    scene.add(pole, canopy);
  }

  for (const lx of [-135, 250]) {
    const lgTower = new THREE.Group();
    lgTower.position.set(lx, 0, 616);
    const woodPostMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.88 });
    for (const [px, pz] of [
      [-1.4, -1.4],
      [1.4, -1.4],
      [-1.4, 1.4],
      [1.4, 1.4],
    ]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.7, 8), woodPostMat);
      p.position.set(px, 1.35, pz);
      lgTower.add(p);
    }
    const lgCabin = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.4, 2.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.42 })
    );
    lgCabin.position.y = 3.7;
    const lgRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 1.35, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
    );
    lgRoof.position.y = 5.5;
    lgTower.add(lgCabin, lgRoof);
    scene.add(lgTower);
  }

  // Extended Wooden Vespucci Pier (x: 120, z: 615..730)
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.88 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 120), woodMat);
  pierDeck.position.set(120, 0.48, 670);
  pierDeck.receiveShadow = enableShadows;
  pierDeck.castShadow = enableShadows;
  scene.add(pierDeck);
  for (let pz = 618; pz <= 724; pz += 14) {
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.8, 10), woodMat);
    postL.position.set(113.8, -0.6, pz);
    const postR = postL.clone();
    postR.position.x = 126.2;
    scene.add(postL, postR);
  }
  const pierPavilion = new THREE.Mesh(
    new THREE.CylinderGeometry(5.8, 5.8, 4.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 })
  );
  pierPavilion.position.set(120, 2.95, 722);
  const pierDome = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 2.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 })
  );
  pierDome.position.set(120, 6.2, 722);
  scene.add(pierPavilion, pierDome);

  // 3. Expanded 9x9 Road Grid + Outer Perimeter Boulevards + Crosswalks
  const roadTexV = createAsphaltTexture(maxAniso);
  roadTexV.repeat.set(1, 66);
  const roadBumpV = createAsphaltBumpTexture(maxAniso, 66);
  const roadMatV = new THREE.MeshStandardMaterial({
    map: roadTexV,
    bumpMap: roadBumpV,
    bumpScale: 0.042,
    roughness: 0.46,
    metalness: 0.16,
    envMapIntensity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const roadTexH = createAsphaltTexture(maxAniso);
  roadTexH.repeat.set(1, 66);
  const roadBumpH = createAsphaltBumpTexture(maxAniso, 66);
  const roadMatH = new THREE.MeshStandardMaterial({
    map: roadTexH,
    bumpMap: roadBumpH,
    bumpScale: 0.042,
    roughness: 0.46,
    metalness: 0.16,
    envMapIntensity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const allX = [...ROAD_COORDS, -560, 560];
  const allZ = [...ROAD_COORDS, -560, 560];

  for (const x of allX) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 1140), roadMatV);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.04, 0);
    road.receiveShadow = enableShadows;
    scene.add(road);
  }

  for (const z of allZ) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 1140), roadMatH);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = Math.PI / 2;
    road.position.set(0, 0.045, z);
    road.receiveShadow = enableShadows;
    scene.add(road);
  }

  const crosswalkTex = createCrosswalkTexture(maxAniso);
  const crosswalkBump = createAsphaltBumpTexture(maxAniso, 1);
  const interMat = new THREE.MeshStandardMaterial({
    map: crosswalkTex,
    bumpMap: crosswalkBump,
    bumpScale: 0.038,
    roughness: 0.48,
    metalness: 0.14,
    envMapIntensity: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const rx of allX) {
    for (const rz of allZ) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH + 0.5, ROAD_WIDTH + 0.5), interMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(rx, 0.055, rz);
      patch.receiveShadow = enableShadows;
      scene.add(patch);
    }
  }

  // 4. Expanded Aeroporto Internazionale di Los Solis (South-West x: -420, z: 180..460)
  const runwayTex = createRunwayTexture(maxAniso);
  runwayTex.repeat.set(1, 10);
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 280),
    new THREE.MeshStandardMaterial({
      map: runwayTex,
      roughness: 0.74,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-420, 0.06, 320);
  runway.receiveShadow = enableShadows;
  scene.add(runway);

  // Control Tower + Curved Glass Terminal
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.25 });
  const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 34, 16), towerMat);
  towerShaft.position.set(-455, 17, 230);
  const towerCab = new THREE.Mesh(
    new THREE.CylinderGeometry(6.0, 4.4, 5.2, 16),
    new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, roughness: 0.1, metalness: 0.55, clearcoat: 1 })
  );
  towerCab.position.set(-455, 36.2, 230);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 1.9, 16), towerMat);
  towerRoof.position.set(-455, 39.8, 230);
  scene.add(towerShaft, towerCab, towerRoof);
  buildings.push({ minX: -459, maxX: -451, minZ: 226, maxZ: 234, height: 39 });

  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.42, metalness: 0.6 });
  const hangarArch = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 44, 18, 1, false, 0, Math.PI),
    hangarMat
  );
  hangarArch.rotation.z = Math.PI / 2;
  hangarArch.rotation.y = Math.PI / 2;
  hangarArch.position.set(-458, 0, 340);
  scene.add(hangarArch);
  buildings.push({ minX: -474, maxX: -442, minZ: 318, maxZ: 362, height: 16 });

  // 5. Expanded Parco Centrale Solis (x: 240, z: -120)
  const parkGrass = new THREE.Mesh(
    new THREE.PlaneGeometry(102, 102),
    new THREE.MeshStandardMaterial({ color: 0x2e6f35, roughness: 0.92 })
  );
  parkGrass.rotation.x = -Math.PI / 2;
  parkGrass.position.set(240, 0.03, -120);
  parkGrass.receiveShadow = enableShadows;
  scene.add(parkGrass);

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(20, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, roughness: 0.06, clearcoat: 1.0 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(240, 0.05, -120);
  scene.add(pond);

  const fountainBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.6, 1.4, 18),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
  );
  fountainBase.position.set(240, 0.7, -120);
  const fountainSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.5, 3.4, 14),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 })
  );
  fountainSpire.position.set(240, 2.4, -120);
  scene.add(fountainBase, fountainSpire);

  // 6. Stadio Solis (x: 360, z: -240)
  const stadiumWall = new THREE.Mesh(
    new THREE.CylinderGeometry(42, 46, 18, 28, 1, false),
    new THREE.MeshPhysicalMaterial({ color: 0xf1f5f9, roughness: 0.25, metalness: 0.35, clearcoat: 0.6 })
  );
  stadiumWall.position.set(360, 9, -240);
  stadiumWall.castShadow = enableShadows;
  const stadiumRim = new THREE.Mesh(
    new THREE.TorusGeometry(42, 2.2, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.65 })
  );
  stadiumRim.rotation.x = Math.PI / 2;
  stadiumRim.position.set(360, 18.2, -240);
  scene.add(stadiumWall, stadiumRim);
  buildings.push({ minX: 316, maxX: 404, minZ: -284, maxZ: -196, height: 18, label: 'Stadio Solis' });

  // 7. Northern & Perimeter Hills + Iconic "SOLISWOOD" Sign
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3b5c2e, roughness: 0.92 });
  const hillConfigs = [
    { x: -460, z: -720, r: 210, sy: 0.48 },
    { x: 0, z: -760, r: 270, sy: 0.56 },
    { x: 460, z: -720, r: 220, sy: 0.48 },
    { x: -780, z: -180, r: 240, sy: 0.44 },
    { x: 780, z: -120, r: 240, sy: 0.42 },
  ];
  for (const hc of hillConfigs) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hc.r, 22, 16), hillMat);
    hill.scale.set(1.3, hc.sy, 0.88);
    hill.position.set(hc.x, -8, hc.z);
    scene.add(hill);
  }

  const signGroup = new THREE.Group();
  signGroup.position.set(0, 46, -618);
  const signBoardTex = createBillboardTexture(maxAniso, 'SOLISWOOD', 'LOS SOLIS · METROPOLI', '#f8fafc', '#0f172a');
  const signBanner = new THREE.Mesh(
    new THREE.BoxGeometry(156, 24, 2.5),
    new THREE.MeshStandardMaterial({ map: signBoardTex, roughness: 0.35 })
  );
  signGroup.add(signBanner);
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
  for (let i = -6; i <= 6; i++) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 22, 8), strutMat);
    strut.position.set(i * 12, -16, -1.6);
    signGroup.add(strut);
  }
  scene.add(signGroup);

  // 8. Realistic Non-Blocky Skyscrapers & Urban Architecture across 9x9 Grid
  const facadeGlassBlue = createSkyscraperFacadeTexture(maxAniso, '#1e293b', '#38bdf8', '#fde68a', 8, 18);
  const facadeGlassGold = createSkyscraperFacadeTexture(maxAniso, '#27272a', '#64748b', '#fef08a', 8, 16);
  const facadeWarm = createSkyscraperFacadeTexture(maxAniso, '#7c5c46', '#1e293b', '#fed7aa', 6, 10);
  const facadeModern = createSkyscraperFacadeTexture(maxAniso, '#334155', '#0ea5e9', '#e0f2fe', 10, 20);

  const buildingMaterials = [
    new THREE.MeshPhysicalMaterial({
      map: facadeGlassBlue,
      roughness: 0.11,
      metalness: 0.76,
      clearcoat: 0.75,
      envMapIntensity: 1.4,
    }),
    new THREE.MeshPhysicalMaterial({
      map: facadeGlassGold,
      roughness: 0.14,
      metalness: 0.7,
      clearcoat: 0.65,
      envMapIntensity: 1.35,
    }),
    new THREE.MeshStandardMaterial({
      map: facadeWarm,
      roughness: 0.54,
      metalness: 0.16,
      envMapIntensity: 0.9,
    }),
    new THREE.MeshPhysicalMaterial({
      map: facadeModern,
      roughness: 0.09,
      metalness: 0.82,
      clearcoat: 0.85,
      envMapIntensity: 1.5,
    }),
  ];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72, metalness: 0.25 });
  const awningColors = [0xef4444, 0x0284c7, 0x10b981, 0xf59e0b];

  const addRealisticBuilding = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    matIdx: number,
    withHelipad = false,
    label?: string
  ) => {
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);

    const bMat = buildingMaterials[matIdx % buildingMaterials.length];
    const hash = Math.abs(Math.round(cx * 3 + cz * 7));
    const archType = hash % 4;

    if (archType === 0 && h > 36) {
      // Cylindrical Glass Skyscraper (zero cubes!)
      const rad = Math.min(w, d) * 0.48;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.94, rad, h, 20), bMat);
      body.position.y = h * 0.5;
      body.castShadow = enableShadows;
      body.receiveShadow = enableShadows;
      group.add(body);

      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(rad + 0.8, rad + 1.0, 4.0, 20),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.35 })
      );
      podium.position.y = 2.0;
      group.add(podium);

      const upperH = h * 0.22;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.66, rad * 0.76, upperH, 20), bMat);
      upper.position.y = h + upperH * 0.5;
      const neonRim = new THREE.Mesh(
        new THREE.TorusGeometry(rad * 0.72, 0.28, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.9 })
      );
      neonRim.rotation.x = Math.PI / 2;
      neonRim.position.y = h + upperH;
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.55, 11, 10),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 })
      );
      spire.position.y = h + upperH + 5.5;
      group.add(upper, neonRim, spire);
    } else if (archType === 1 && h > 28) {
      // Octagonal Art Deco Stepped Tower
      const rad = Math.min(w, d) * 0.52;
      const tier1H = h * 0.72;
      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.92, rad, tier1H, 8), bMat);
      tier1.position.y = tier1H * 0.5;
      tier1.rotation.y = Math.PI / 8;
      tier1.castShadow = enableShadows;
      tier1.receiveShadow = enableShadows;

      const tier2H = h * 0.34;
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.62, rad * 0.74, tier2H, 8), bMat);
      tier2.position.y = tier1H + tier2H * 0.5;
      tier2.rotation.y = Math.PI / 8;

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(rad * 0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        roofMat
      );
      dome.position.y = tier1H + tier2H;
      group.add(tier1, tier2, dome);
    } else {
      // Beveled Rounded-Corner Extruded Architecture
      const roundedGeo = createRoundedTowerGeometry(w, d, h, 3.2);
      const body = new THREE.Mesh(roundedGeo, bMat);
      body.castShadow = enableShadows;
      body.receiveShadow = enableShadows;
      group.add(body);

      const podiumGeo = createRoundedTowerGeometry(w + 1.0, d + 1.0, 3.8, 3.4);
      const podium = new THREE.Mesh(
        podiumGeo,
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.48, metalness: 0.3 })
      );
      group.add(podium);

      const awning = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.45, w * 0.52, 4, 8),
        new THREE.MeshStandardMaterial({
          color: awningColors[hash % awningColors.length],
          roughness: 0.45,
        })
      );
      awning.rotation.z = Math.PI / 2;
      awning.position.set(0, 3.7, d * 0.5 + 0.5);
      group.add(awning);

      if (h > 36) {
        const upperH = h * 0.22;
        const upperGeo = createRoundedTowerGeometry(w * 0.72, d * 0.72, upperH, 2.4);
        const upper = new THREE.Mesh(upperGeo, bMat);
        upper.position.y = h;
        group.add(upper);

        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.48, 9, 10),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
        );
        spire.position.y = h + upperH + 4.5;
        group.add(spire);
      }
    }

    if (withHelipad) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.2, 0.4, 24),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      pad.position.y = h + (h > 36 ? h * 0.22 : 0) + 0.8;
      group.add(pad);
    }

    scene.add(group);
    buildings.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      height: h,
      label,
    });
  };

  // 10x10 Block Centers inside the 9x9 road grid (-520..520)
  const blockCenters = [-520, -420, -300, -180, -60, 60, 180, 300, 420, 520];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      // Keep Aeroporto clear: x around -420, z >= 180
      if (bx === -420 && bz >= 180) continue;
      // Keep Parco Centrale clear: (240, -120) spans bx 180/300 around -120
      if ((bx === 180 || bx === 300) && (bz === -180 || bz === -60) && Math.hypot(bx - 240, bz + 120) < 95) continue;
      // Keep Stadio Solis clear: around (360, -240)
      if ((bx === 300 || bx === 420) && (bz === -300 || bz === -180) && Math.hypot(bx - 360, bz + 240) < 95) continue;
      // Keep Los Santos Golf Club clear: (-300, -300)
      if (bx === -300 && bz === -300) continue;
      // Keep Diamond Casino & Master Penthouse clear: (420, -300)
      if (bx === 420 && bz === -300) continue;

      const isDowntown = Math.abs(bx) <= 60 && Math.abs(bz) <= 60;
      const isPortoGarage = bx === -420 && bz === 60;
      const isOuter = Math.abs(bx) === 520 || Math.abs(bz) === 520;

      if (isDowntown) {
        const isMainTower = bx === -60 && bz === -60;
        addRealisticBuilding(bx - 19, bz - 18, 28, 28, isMainTower ? 86 : 58, 3, isMainTower);
        addRealisticBuilding(bx + 20, bz - 16, 26, 26, 48, 0);
        addRealisticBuilding(bx - 18, bz + 20, 26, 24, 44, 1);
        addRealisticBuilding(bx + 20, bz + 20, 25, 25, 54, 0);
      } else if (isPortoGarage) {
        addRealisticBuilding(bx - 20, bz - 18, 26, 22, 14, 2, false, 'Magazzino Porto');
        addRealisticBuilding(bx + 20, bz - 16, 24, 20, 13, 2);
      } else if (isOuter) {
        const h1 = 15 + ((Math.abs(bx * 5 + bz * 11)) % 22);
        addRealisticBuilding(bx, bz, 30, 26, h1, Math.abs(bx + bz) % 4);
      } else {
        const h1 = 18 + ((Math.abs(bx * 7 + bz * 13)) % 34);
        const h2 = 15 + ((Math.abs(bx * 11 + bz * 5)) % 24);
        addRealisticBuilding(bx - 18, bz - 17, 25, 25, h1, Math.abs(bx + bz) % 4);
        addRealisticBuilding(bx + 18, bz - 16, 24, 24, h2, Math.abs(bx + 1) % 4);
        addRealisticBuilding(bx - 17, bz + 18, 24, 23, h2 * 0.85, 2);
        addRealisticBuilding(bx + 18, bz + 18, 23, 24, h1 * 0.72, 1);
      }
    }
  }

  // Street Billboards
  const bb1Tex = createBillboardTexture(maxAniso, 'SPRUNK', 'ESSENZA DI LOS SOLIS', '#065f46', '#4ade80');
  const bb2Tex = createBillboardTexture(maxAniso, 'LSPD SOLIS', 'PROTEGGERE E SERVIRE', '#0f172a', '#38bdf8');
  const addBillboard = (x: number, z: number, rotY: number, tex: THREE.Texture) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 9.2, 10), roofMat);
    post.position.y = 4.6;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
    panel.position.y = 11.2;
    g.add(post, panel);
    scene.add(g);
  };
  addBillboard(-48, 540, 0.25, bb1Tex);
  addBillboard(82, -46, -Math.PI / 2, bb2Tex);

  // 9. Organic Curved Palm Trees (Custom curved tapered leaf geometry!) + Deciduous Park Trees
  const palmPositions: [number, number][] = [];
  for (let x = -540; x <= 540; x += 36) {
    palmPositions.push([x, 548]);
    palmPositions.push([x, 582]);
  }
  for (let z = -440; z <= 440; z += 56) {
    palmPositions.push([-108, z]);
    palmPositions.push([108, z]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.44, 9.0, 10);
  trunkGeo.translate(0, 4.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c583c, roughness: 0.9 });
  const palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);
  palmTrunks.castShadow = enableShadows;
  palmTrunks.receiveShadow = enableShadows;

  const frondGeo = createCurvedPalmFrondGeometry();
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x2e8b3c,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const frondsPerTree = 7;
  const palmFronds = new THREE.InstancedMesh(frondGeo, frondMat, palmPositions.length * frondsPerTree);
  palmFronds.castShadow = enableShadows;

  const dummy = new THREE.Object3D();
  const frondDummy = new THREE.Object3D();
  const tint = new THREE.Color();
  palmPositions.forEach(([px, pz], i) => {
    const scale = 0.9 + (i % 5) * 0.06;
    const tilt = ((i % 3) - 1) * 0.045;
    dummy.position.set(px, 0, pz);
    dummy.rotation.set(0, (i * 1.1) % Math.PI, tilt);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(i, dummy.matrix);

    for (let f = 0; f < frondsPerTree; f++) {
      const idx = i * frondsPerTree + f;
      frondDummy.position.set(px - tilt * 4.8, 8.8 * scale, pz);
      frondDummy.rotation.set(0.08, (f / frondsPerTree) * Math.PI * 2 + i * 0.5, 0);
      frondDummy.scale.set(scale, scale, scale);
      frondDummy.updateMatrix();
      palmFronds.setMatrixAt(idx, frondDummy.matrix);
      tint.setHSL(0.31 + (f % 3) * 0.015, 0.62, 0.34 + (i % 3) * 0.04);
      palmFronds.setColorAt(idx, tint);
    }
  });
  palmTrunks.instanceMatrix.needsUpdate = true;
  palmFronds.instanceMatrix.needsUpdate = true;
  if (palmFronds.instanceColor) palmFronds.instanceColor.needsUpdate = true;
  palmTrunks.computeBoundingSphere();
  palmFronds.computeBoundingSphere();
  scene.add(palmTrunks, palmFronds);

  // Lush Rounded Trees in Central Park & Northern Foothills
  const oakSpots: [number, number][] = [];
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2;
    oakSpots.push([240 + Math.cos(ang) * 34, -120 + Math.sin(ang) * 34]);
  }
  for (let x = -480; x <= 480; x += 65) {
    oakSpots.push([x, -582]);
  }
  const oakTrunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 4.2, 8);
  oakTrunkGeo.translate(0, 2.1, 0);
  const oakCanopyGeo = new THREE.SphereGeometry(2.6, 12, 10);
  oakCanopyGeo.translate(0, 5.1, 0);
  const oakTrunks = new THREE.InstancedMesh(oakTrunkGeo, trunkMat, oakSpots.length);
  const oakCanopies = new THREE.InstancedMesh(
    oakCanopyGeo,
    new THREE.MeshStandardMaterial({ color: 0x2d6a36, roughness: 0.78 }),
    oakSpots.length
  );
  oakSpots.forEach(([ox, oz], i) => {
    const sc = 0.85 + (i % 4) * 0.14;
    dummy.position.set(ox, 0, oz);
    dummy.rotation.set(0, i * 0.9, 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    oakTrunks.setMatrixAt(i, dummy.matrix);
    oakCanopies.setMatrixAt(i, dummy.matrix);
  });
  oakTrunks.instanceMatrix.needsUpdate = true;
  oakCanopies.instanceMatrix.needsUpdate = true;
  scene.add(oakTrunks, oakCanopies);

  // Street lamps across major avenues
  const lampPositions: [number, number][] = [];
  for (const rx of [-240, -120, 0, 120, 240]) {
    for (let z = -500; z <= 500; z += 75) {
      if (ROAD_COORDS.every((rc) => Math.abs(z - rc) > 14)) {
        lampPositions.push([rx + 10.2, z]);
      }
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 6.6, 8);
  poleGeo.translate(0, 3.3, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.32 });
  const lampPoles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);

  const bulbGeo = new THREE.CapsuleGeometry(0.12, 0.55, 4, 8);
  bulbGeo.rotateZ(Math.PI / 2);
  bulbGeo.translate(-0.32, 6.6, 0);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 1.35,
  });
  const lampBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);

  lampPositions.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 0, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    lampBulbs.setMatrixAt(i, dummy.matrix);
  });
  lampPoles.instanceMatrix.needsUpdate = true;
  lampBulbs.instanceMatrix.needsUpdate = true;
  lampPoles.computeBoundingSphere();
  lampBulbs.computeBoundingSphere();
  scene.add(lampPoles, lampBulbs);

  // 9b. Elevated Winding Highway Overpass ("Sopraelevata Los Solis") overlooking downtown
  const overpassCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-420, 9.5, -245),
    new THREE.Vector3(-220, 11.4, -275),
    new THREE.Vector3(0, 12.6, -240),
    new THREE.Vector3(220, 11.8, -285),
    new THREE.Vector3(440, 9.8, -255),
  ]);
  const overpassFlatCurve = new THREE.CatmullRomCurve3(
    overpassCurve.points.map((p) => new THREE.Vector3(p.x, (p.y - 11.0) / 0.16, p.z))
  );
  const overpassDeckGeo = new THREE.TubeGeometry(overpassFlatCurve, 56, 7.2, 6, false);
  overpassDeckGeo.scale(1, 0.16, 1);
  overpassDeckGeo.translate(0, 11.0, 0);
  const overpassDeckMat = new THREE.MeshStandardMaterial({
    color: 0x262b33,
    bumpMap: roadBumpH,
    bumpScale: 0.03,
    roughness: 0.58,
    metalness: 0.12,
  });
  const overpassMesh = new THREE.Mesh(overpassDeckGeo, overpassDeckMat);
  overpassMesh.castShadow = enableShadows;
  overpassMesh.receiveShadow = enableShadows;
  scene.add(overpassMesh);

  // Concrete overpass piers & guardrail trim
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  const overpassRailGeo = new THREE.TubeGeometry(overpassCurve, 56, 0.35, 6, false);
  const overpassRail = new THREE.Mesh(
    overpassRailGeo,
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72 })
  );
  overpassRail.position.y = 1.05;
  scene.add(overpassRail);
  for (let t = 0.06; t <= 0.94; t += 0.11) {
    const pt = overpassCurve.getPointAt(t);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, pt.y - 0.5, 12), pierMat);
    col.position.set(pt.x, (pt.y - 0.5) * 0.5, pt.z);
    col.castShadow = enableShadows;
    scene.add(col);
  }

  // 9c. Electrical Telephone Poles, Crossarms & Overhead Power Lines silhouetted against sunset
  const utilPolePositions: [number, number][] = [];
  for (let x = -520; x <= 520; x += 65) {
    utilPolePositions.push([x, -576]);
  }
  for (let z = -500; z <= 500; z += 85) {
    utilPolePositions.push([-574, z]);
    utilPolePositions.push([574, z]);
  }
  const utilPoleGeo = new THREE.CylinderGeometry(0.16, 0.24, 13.5, 8);
  utilPoleGeo.translate(0, 6.75, 0);
  const utilPoleMat = new THREE.MeshStandardMaterial({ color: 0x452d1d, roughness: 0.92 });
  const utilPoles = new THREE.InstancedMesh(utilPoleGeo, utilPoleMat, utilPolePositions.length);

  const crossArmGeo = new THREE.BoxGeometry(3.2, 0.18, 0.2);
  crossArmGeo.translate(0, 12.8, 0);
  const utilCrossArms = new THREE.InstancedMesh(crossArmGeo, utilPoleMat, utilPolePositions.length);

  utilPolePositions.forEach(([ux, uz], i) => {
    dummy.position.set(ux, 0, uz);
    dummy.rotation.set(0, Math.abs(ux) > 560 ? Math.PI / 2 : 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    utilPoles.setMatrixAt(i, dummy.matrix);
    utilCrossArms.setMatrixAt(i, dummy.matrix);
  });
  utilPoles.instanceMatrix.needsUpdate = true;
  utilCrossArms.instanceMatrix.needsUpdate = true;
  scene.add(utilPoles, utilCrossArms);

  // Overhead catenary power lines along northern Soliswood shoulder
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.72 });
  for (const offsetZ of [-1.2, 1.2]) {
    const wirePts: THREE.Vector3[] = [];
    for (let x = -520; x <= 520; x += 32.5) {
      const sag = x % 65 === 0 ? 0 : -0.75;
      wirePts.push(new THREE.Vector3(x, 12.8 + sag, -576 + offsetZ));
    }
    const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePts);
    scene.add(new THREE.Line(wireGeo, wireMat));
  }

  // 9d. Dry Roadside California Brush & Soliswood Highway Overlook Apron
  const overlookApron = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 26),
    new THREE.MeshStandardMaterial({
      map: roadTexH,
      bumpMap: roadBumpH,
      bumpScale: 0.04,
      roughness: 0.62,
      metalness: 0.08,
    })
  );
  overlookApron.rotation.x = -Math.PI / 2;
  overlookApron.position.set(-40, 0.035, -578);
  overlookApron.receiveShadow = enableShadows;
  scene.add(overlookApron);

  const brushSpots: [number, number][] = [];
  for (let x = -560; x <= 560; x += 26) {
    brushSpots.push([x + ((x * 7) % 11), -590 - Math.abs(x % 9)]);
    if (Math.abs(x) > 30) {
      brushSpots.push([x, 594]);
    }
  }
  const brushGeo = new THREE.DodecahedronGeometry(1.05, 1);
  brushGeo.scale(1.45, 0.72, 1.25);
  brushGeo.translate(0, 0.55, 0);
  const brushMat = new THREE.MeshStandardMaterial({ color: 0x6b6a3b, roughness: 0.94 });
  const brushMesh = new THREE.InstancedMesh(brushGeo, brushMat, brushSpots.length);
  brushSpots.forEach(([bx, bz], i) => {
    const sc = 0.75 + (i % 5) * 0.2;
    dummy.position.set(bx, 0, bz);
    dummy.rotation.set(0, i * 1.3, 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    brushMesh.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.16 + (i % 4) * 0.02, 0.34, 0.3 + (i % 3) * 0.05);
    brushMesh.setColorAt(i, tint);
  });
  brushMesh.instanceMatrix.needsUpdate = true;
  if (brushMesh.instanceColor) brushMesh.instanceColor.needsUpdate = true;
  scene.add(brushMesh);

  // 10. Stunt Ramps (Lungomare + Aeroporto + Midtown)
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.36, metalness: 0.38 });
  const rampLipMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.4,
  });
  const addRamp = (cx: number, cz: number, width: number, length: number, height: number, rotY: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0);
    shape.lineTo(length / 2, 0);
    shape.lineTo(length / 2, height);
    shape.quadraticCurveTo(0, height * 0.26, -length / 2, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, -width / 2);

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geo, rampMat);
    mesh.castShadow = enableShadows;
    mesh.receiveShadow = enableShadows;
    group.add(mesh);

    const lipGeo = new THREE.BoxGeometry(0.42, 0.16, width * 0.98);
    const lip = new THREE.Mesh(lipGeo, rampLipMat);
    lip.position.set(length / 2 - 0.18, height - 0.04, 0);
    group.add(lip);

    group.position.set(cx, 0.02, cz);
    group.rotation.y = rotY - Math.PI / 2;
    scene.add(group);

    ramps.push({
      cx,
      cz,
      width,
      length,
      height,
      dirX: Math.sin(rotY),
      dirZ: Math.cos(rotY),
    });
  };
  addRamp(0, 560, 7.5, 13, 3.6, Math.PI / 2);
  addRamp(-420, 430, 10, 15, 4.2, 0);
  addRamp(240, 120, 7.5, 12, 3.2, 0);

  // 10b. Signature GTA Online & Story Mode 3D Landmarks
  // A) Los Santos Golf Club (-300, -300)
  const golfFairway = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 96),
    new THREE.MeshStandardMaterial({ color: 0x3f8f3d, roughness: 0.9 })
  );
  golfFairway.rotation.x = -Math.PI / 2;
  golfFairway.position.set(-300, 0.03, -300);
  golfFairway.receiveShadow = enableShadows;
  const golfSand = new THREE.Mesh(
    new THREE.CircleGeometry(10, 20),
    new THREE.MeshStandardMaterial({ color: 0xe6d2a2, roughness: 0.95 })
  );
  golfSand.rotation.x = -Math.PI / 2;
  golfSand.position.set(-280, 0.04, -315);
  const golfClubhouse = new THREE.Mesh(
    createRoundedTowerGeometry(24, 16, 7.5, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
  );
  golfClubhouse.position.set(-322, 0, -280);
  const golfRoof = new THREE.Mesh(
    createRoundedTowerGeometry(25.5, 17.5, 1.4, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 })
  );
  golfRoof.position.set(-322, 7.5, -280);
  const golfFlagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc })
  );
  golfFlagPole.position.set(-284, 2.25, -295);
  scene.add(golfFairway, golfSand, golfClubhouse, golfRoof, golfFlagPole);
  buildings.push({ minX: -334, maxX: -310, minZ: -288, maxZ: -272, height: 8.5, label: 'Los Santos Golf Club' });

  // B) Diamond Casinò & Attico Principale (Master Penthouse) (420, -305)
  const casinoBase = new THREE.Mesh(
    createRoundedTowerGeometry(48, 34, 18, 3.8),
    new THREE.MeshPhysicalMaterial({ color: 0x1e1b4b, roughness: 0.2, metalness: 0.65, clearcoat: 0.85 })
  );
  casinoBase.position.set(420, 0, -305);
  casinoBase.castShadow = enableShadows;
  const penthouseCrown = new THREE.Mesh(
    createRoundedTowerGeometry(32, 22, 11, 3.0),
    new THREE.MeshPhysicalMaterial({ color: 0x312e81, roughness: 0.14, metalness: 0.78, clearcoat: 0.9 })
  );
  penthouseCrown.position.set(420, 18, -305);
  const casinoNeon = new THREE.Mesh(
    new THREE.TorusGeometry(24, 0.45, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xc084fc, emissiveIntensity: 1.3 })
  );
  casinoNeon.rotation.x = Math.PI / 2;
  casinoNeon.position.set(420, 18.2, -305);
  scene.add(casinoBase, penthouseCrown, casinoNeon);
  buildings.push({ minX: 396, maxX: 444, minZ: -322, maxZ: -288, height: 29, label: 'Diamond Casinò & Attico' });

  // C) Coastal Piers & Helipads (Puerto Del Sol, Sonar Collections, Vespucci Helipad, Higgins Helitours)
  for (const dockX of [-505, -265]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(11, 0.55, 58), woodMat);
    dock.position.set(dockX, 0.45, 668);
    scene.add(dock);
  }
  for (const [hx, hz] of [
    [-195, 615],
    [150, 618],
  ]) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(8.2, 8.6, 0.25, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 })
    );
    pad.position.set(hx, 0.14, hz);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 7.1, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hx, 0.28, hz);
    scene.add(pad, ring);
  }

  // D) Offshore Super Yacht Galaxy (265, 795) + Tender Jetty
  const yachtJetty = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.45, 132), woodMat);
  yachtJetty.position.set(265, 0.4, 710);
  scene.add(yachtJetty);
  const yachtGroup = new THREE.Group();
  yachtGroup.position.set(265, 0.2, 804);
  const yachtHull = new THREE.Mesh(
    createRoundedTowerGeometry(16, 48, 3.6, 5.5),
    new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.16, clearcoat: 0.9 })
  );
  const yachtStripe = new THREE.Mesh(
    createRoundedTowerGeometry(16.4, 46, 0.65, 5.4),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
  );
  yachtStripe.position.y = 2.6;
  const yachtDeck2 = new THREE.Mesh(
    createRoundedTowerGeometry(12.5, 32, 3.0, 4.0),
    new THREE.MeshPhysicalMaterial({ color: 0xf1f5f9, roughness: 0.2, clearcoat: 0.85 })
  );
  yachtDeck2.position.set(0, 3.6, -2);
  const yachtBridge = new THREE.Mesh(
    createRoundedTowerGeometry(9.5, 14, 2.8, 2.5),
    new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.6, clearcoat: 1 })
  );
  yachtBridge.position.set(0, 6.6, -4);
  const yachtPool = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.2, 5.0),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  yachtPool.position.set(0, 3.7, 17);
  const yachtHelipad = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 5.5, 0.22, 20),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
  );
  yachtHelipad.position.set(0, 3.72, -16);
  yachtGroup.add(yachtHull, yachtStripe, yachtDeck2, yachtBridge, yachtPool, yachtHelipad);
  scene.add(yachtGroup);

  // E) Offshore Sottomarino Kosatka (-145, 792) + Boarding Jetty
  const kosatkaJetty = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.45, 126), woodMat);
  kosatkaJetty.position.set(-145, 0.4, 708);
  scene.add(kosatkaJetty);
  const kosatkaGroup = new THREE.Group();
  kosatkaGroup.position.set(-145, 0.1, 795);
  const subHullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.48 });
  const subHull = new THREE.Mesh(new THREE.CapsuleGeometry(4.4, 38, 8, 16), subHullMat);
  subHull.rotation.x = Math.PI / 2;
  subHull.scale.set(1.15, 1.0, 0.72);
  subHull.position.y = 1.2;
  const subSail = new THREE.Mesh(createRoundedTowerGeometry(3.2, 9.5, 4.8, 1.3), subHullMat);
  subSail.position.set(0, 3.6, -4);
  const subBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e })
  );
  subBeacon.position.set(0, 8.6, -4);
  kosatkaGroup.add(subHull, subSail, subBeacon);
  scene.add(kosatkaGroup);

  // F) Northern Soliswood Landmarks: Bunker, Facility, Stilt House, Mansions, Sandy Shores & McKenzie Strip
  const bunkerHatch = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 8.0, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, metalness: 0.3 })
  );
  bunkerHatch.position.set(-450, 1.1, -592);
  const facilityDome = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
    new THREE.MeshPhysicalMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.65 })
  );
  facilityDome.position.set(-355, 0.1, -594);
  const stiltHouseDeck = new THREE.Mesh(
    createRoundedTowerGeometry(15, 11, 5.2, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
  );
  stiltHouseDeck.position.set(-140, 4.2, -592);
  const stiltPillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
  for (const sx of [-146, -134]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.4, 8), stiltPillarMat);
    p.position.set(sx, 2.2, -590);
    scene.add(p);
  }
  const sandyRunway = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b5c49, roughness: 0.94 })
  );
  sandyRunway.rotation.x = -Math.PI / 2;
  sandyRunway.position.set(430, 0.04, -592);
  const sandyHangar = new THREE.Mesh(
    new THREE.CylinderGeometry(7.5, 7.5, 22, 14, 1, false, 0, Math.PI),
    hangarMat
  );
  sandyHangar.rotation.z = Math.PI / 2;
  sandyHangar.position.set(340, 0, -596);
  scene.add(bunkerHatch, facilityDome, stiltHouseDeck, sandyRunway, sandyHangar);

  // G) Parked 3D Heavy Operational Vehicles (Avenger VTOL, COM, Terrorbyte, Brickade 6x6 Acid Lab)
  const addStaticHeavyOp = (x: number, z: number, color: number, accent: number, isPlane = false) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.45 });
    const trimMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.45 });
    if (isPlane) {
      const fuse = new THREE.Mesh(new THREE.CapsuleGeometry(2.1, 13, 6, 12), bodyMat);
      fuse.rotation.x = Math.PI / 2;
      fuse.position.y = 2.6;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.45, 3.2), bodyMat);
      wing.position.set(0, 3.5, -1);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.35, 2.2), bodyMat);
      tail.position.set(0, 3.1, 6.2);
      g.add(fuse, wing, tail);
    } else {
      const truck = new THREE.Mesh(createRoundedTowerGeometry(3.2, 10.2, 3.4, 0.6), bodyMat);
      truck.position.y = 0.7;
      const cab = new THREE.Mesh(createRoundedTowerGeometry(3.0, 3.1, 2.8, 0.5), bodyMat);
      cab.position.set(0, 0.7, -5.8);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.28, 9.4), trimMat);
      stripe.position.y = 2.4;
      g.add(truck, cab, stripe);
    }
    scene.add(g);
  };
  addStaticHeavyOp(-395, 405, 0x334155, 0x38bdf8, true); // Avenger
  addStaticHeavyOp(-356, 374, 0x1e293b, 0xf59e0b, false); // COM
  addStaticHeavyOp(-106, -24, 0x0f172a, 0x38bdf8, false); // Terrorbyte
  addStaticHeavyOp(236, 134, 0x3b0764, 0xa855f7, false); // Brickade 6x6 Acid Lab

  // 10c. Walk-In 3D Functioning Stores (Open Doorways + Real Interiors + Clerks + Cutaway Roofs)
  const storeWallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65, metalness: 0.08 });
  const storeExtMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.48, metalness: 0.28 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.42, metalness: 0.35 });
  const woodShelfMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.72 });

  const buildWalkInStore = (store: WalkInStore) => {
    const g = new THREE.Group();
    g.position.set(store.x, 0, store.z);
    // Local +Z is front doorway. Rotate to match store.facing ('S'=+Z, 'E'=+X, 'N'=-Z, 'W'=-X)
    const rotY =
      store.facing === 'S'
        ? 0
        : store.facing === 'E'
        ? Math.PI / 2
        : store.facing === 'N'
        ? Math.PI
        : -Math.PI / 2;
    g.rotation.y = rotY;

    const localW = store.facing === 'E' || store.facing === 'W' ? store.depth : store.width;
    const localD = store.facing === 'E' || store.facing === 'W' ? store.width : store.depth;
    const h = 4.9;
    const t = 0.45; // wall thickness
    const doorW = store.type === 'lsc' ? 6.0 : 3.8;

    // Checkered / Tiled Interior Floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: store.type === 'lsc' ? 0x334155 : store.type === 'clothing' ? 0xf8fafc : 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(localW - 0.2, localD - 0.2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.075;
    floor.receiveShadow = enableShadows;
    g.add(floor);

    // Subtle interior ambient glow strip on back wall
    const accentMat = new THREE.MeshStandardMaterial({
      color: store.accentHex,
      emissive: store.accentHex,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });

    // Helper to add a wall both visually and as a world-space AABB collision box
    const addWall = (lx: number, lz: number, ww: number, wd: number, wh: number, hy = wh * 0.5, mat = storeExtMat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), mat);
      m.position.set(lx, hy, lz);
      m.castShadow = enableShadows;
      m.receiveShadow = enableShadows;
      g.add(m);

      // Transform local box corners to world AABB (rotY is multiple of 90 deg)
      const cos = Math.round(Math.cos(rotY));
      const sin = Math.round(Math.sin(rotY));
      const wx = store.x + lx * cos + lz * sin;
      const wz = store.z - lx * sin + lz * cos;
      const worldW = Math.abs(cos) === 1 ? ww : wd;
      const worldD = Math.abs(cos) === 1 ? wd : ww;
      if (hy - wh * 0.5 < 2.2) {
        buildings.push({
          minX: wx - worldW * 0.5,
          maxX: wx + worldW * 0.5,
          minZ: wz - worldD * 0.5,
          maxZ: wz + worldD * 0.5,
          height: wh,
        });
      }
    };

    // Back wall, Left wall, Right wall
    addWall(0, -localD * 0.5 + t * 0.5, localW, t, h, h * 0.5, storeWallMat);
    addWall(-localW * 0.5 + t * 0.5, 0, t, localD, h, h * 0.5, storeExtMat);
    addWall(localW * 0.5 - t * 0.5, 0, t, localD, h, h * 0.5, storeExtMat);

    // Front flanking walls (leaving open doorway of width `doorW` at center!)
    const wingW = Math.max(1.2, (localW - doorW) * 0.5);
    addWall(-localW * 0.5 + wingW * 0.5, localD * 0.5 - t * 0.5, wingW, t, h, h * 0.5, storeExtMat);
    addWall(localW * 0.5 - wingW * 0.5, localD * 0.5 - t * 0.5, wingW, t, h, h * 0.5, storeExtMat);

    // Transom lintel & glowing storefront sign above open doorway
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, 1.3, t + 0.1), storeExtMat);
    lintel.position.set(0, h - 0.65, localD * 0.5 - t * 0.5);
    g.add(lintel);

    const signTex = createBillboardTexture(maxAniso, store.signText, store.district.toUpperCase(), '#090d16', store.brandColor);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(localW * 0.86, 1.45, 0.24),
      new THREE.MeshStandardMaterial({ map: signTex, emissive: store.accentHex, emissiveIntensity: 0.22, roughness: 0.3 })
    );
    signBoard.position.set(0, h + 0.6, localD * 0.5 + 0.05);
    g.add(signBoard);

    // Cutaway Roof (hidden automatically when player walks inside!)
    const roofGroup = new THREE.Group();
    const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(localW + 0.4, 0.35, localD + 0.4), storeExtMat);
    roofMesh.position.set(0, h + 0.18, 0);
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(localW + 0.5, 0.16, localD + 0.5), accentMat);
    roofTrim.position.set(0, h - 0.05, 0);
    roofGroup.add(roofMesh, roofTrim);
    g.add(roofGroup);
    storeRoofs.set(store.id, roofGroup);

    // Interior Counter + Cash Register + Clerk NPC behind counter
    const counterZ = -localD * 0.24;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(localW * 0.56, 1.05, 1.0), counterMat);
    counter.position.set(0, 0.525, counterZ);
    const reg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.42), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    reg.position.set(0.6, 1.22, counterZ);
    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(localW * 0.54, 0.1, 0.08), accentMat);
    neonStrip.position.set(0, 0.95, counterZ + 0.52);
    g.add(counter, reg, neonStrip);

    // Shopkeeper NPC standing behind counter
    const clerk = new THREE.Group();
    clerk.position.set(0, 0.08, counterZ - 0.95);
    const clerkBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.55, 6, 10),
      new THREE.MeshStandardMaterial({ color: store.accentHex, roughness: 0.65 })
    );
    clerkBody.position.y = 1.05;
    const clerkHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd79b74, roughness: 0.55 })
    );
    clerkHead.position.y = 1.62;
    clerk.add(clerkBody, clerkHead);
    g.add(clerk);

    // Store-specific 3D Interior Furniture
    if (store.type === 'supermarket' || store.type === 'dispensary') {
      const boxColors = store.type === 'dispensary' ? [0x16a34a, 0x4ade80, 0x15803d] : [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15];
      for (const sx of [-localW * 0.28, localW * 0.28]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.65, localD * 0.34), woodShelfMat);
        shelf.position.set(sx, 0.85, localD * 0.12);
        g.add(shelf);
        for (let b = 0; b < 3; b++) {
          const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.32, 0.45),
            new THREE.MeshStandardMaterial({ color: boxColors[b % boxColors.length], roughness: 0.45 })
          );
          item.position.set(sx, 1.82, localD * 0.02 + b * 0.85);
          g.add(item);
        }
      }
    } else if (store.type === 'ammu_store') {
      // Weapon display racks on back wall + armor stand
      for (let r = -2; r <= 2; r++) {
        const rack = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.18, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.25 })
        );
        rack.position.set(r * 1.4, 2.2 + (Math.abs(r) % 2) * 0.5, -localD * 0.46);
        g.add(rack);
      }
      const armorStand = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.7, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
      );
      armorStand.position.set(-localW * 0.32, 1.0, localD * 0.1);
      g.add(armorStand);
    } else if (store.type === 'clothing') {
      const rackColors = [0xec4899, 0x38bdf8, 0xfacc15, 0xe2e8f0];
      for (let i = 0; i < 4; i++) {
        const px = i < 2 ? -localW * 0.3 : localW * 0.3;
        const pz = (i % 2 === 0 ? -0.1 : 0.18) * localD;
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.35, 1.55, 10), counterMat);
        stand.position.set(px, 0.8, pz);
        const garment = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.46, 0.72, 12),
          new THREE.MeshStandardMaterial({ color: rackColors[i], roughness: 0.6 })
        );
        garment.position.set(px, 1.25, pz);
        g.add(stand, garment);
      }
    } else if (store.type === 'lsc') {
      // Yellow hydraulic lift posts & tool cabinet
      const liftMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.45 });
      for (const lx of [-2.4, 2.4]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), liftMat);
        post.position.set(lx, 1.6, 0.4);
        g.add(post);
      }
    } else if (store.type === 'barber') {
      const chair = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.55, 1.05, 12),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.35 })
      );
      chair.position.set(-localW * 0.25, 0.55, 0.8);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 1.4, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x38bdf8, emissiveIntensity: 0.4 })
      );
      pole.position.set(localW * 0.45, 2.1, localD * 0.52);
      g.add(chair, pole);
    }

    scene.add(g);
  };

  for (const store of WALK_IN_STORES) {
    buildWalkInStore(store);
  }

  // 11. Interactive Zones (Walk-In Store Counters + Hospital + Missions + All 58 Properties)
  const baseZones: InteractiveZone[] = [
    { id: 'hosp_1', type: 'hospital', name: 'Centro Medico Solis', x: 108, z: 108, radius: 4.8, color: '#22c55e' },
    ...WALK_IN_STORES.map((s) => {
      const c = getStoreCounterPos(s);
      return {
        id: `zone_${s.id}`,
        type: 'store' as const,
        name: s.name,
        x: c.x,
        z: c.z,
        radius: s.type === 'lsc' ? 5.2 : 4.2,
        storeId: s.id,
        color: s.brandColor,
      };
    }),
    ...MISSIONS.map((m) => ({
      id: `zone_${m.id}`,
      type: 'mission' as const,
      name: m.title,
      x: m.startX,
      z: m.startZ,
      radius: 4.5,
      missionId: m.id,
      color: '#eab308',
    })),
    ...WORLD_PROPERTIES.map((p) => ({
      id: `prop_${p.id}`,
      type: 'property' as const,
      name: p.name,
      x: p.x,
      z: p.z,
      radius: 4.2,
      propertyId: p.id,
      color: p.color,
    })),
  ];

  for (const z of baseZones) {
    zones.push(z);
    const marker = new THREE.Group();
    marker.position.set(z.x, 0.08, z.z);

    const isProperty = z.type === 'property';
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(z.radius * 0.55, z.radius * 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: z.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isProperty ? 0.62 : 0.78,
      })
    );
    ring.rotation.x = -Math.PI / 2;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(isProperty ? 0.25 : 0.45, isProperty ? 0.25 : 0.45, isProperty ? 4.2 : 7.5, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: z.color,
        transparent: true,
        opacity: isProperty ? 0.14 : 0.24,
        side: THREE.DoubleSide,
      })
    );
    beam.position.y = isProperty ? 2.1 : 3.75;

    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(isProperty ? 0.48 : 0.7, 0),
      new THREE.MeshStandardMaterial({ color: z.color, emissive: z.color, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    diamond.position.y = isProperty ? 1.85 : 2.4;
    diamond.name = 'beaconDiamond';

    marker.add(ring, beam, diamond);
    scene.add(marker);
    zoneMeshes.set(z.id, marker);
  }

  return {
    buildings,
    ramps,
    zones,
    waterMesh,
    oceanTexture,
    oceanBumpTexture,
    skyDome,
    skyMat,
    sunDisc,
    sunHalo,
    sunAnamorphicStreak,
    godRayGroup,
    godRayMat,
    cloudGroup,
    cloudMat,
    dustPoints,
    dustMat,
    zoneMeshes,
    storeRoofs,
  };
}
