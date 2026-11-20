import * as THREE from 'three';
import { createFlannelPlaidTexture } from './textures';
import { VehicleSpec } from './types';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Mesh;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMesh: THREE.Group;
  muzzleFlash: THREE.Mesh;
  jacketMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  glassesGroup: THREE.Group;
  capGroup: THREE.Group;
  chainMesh: THREE.Mesh;
}

export interface VehicleRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  wheels: THREE.Group[];
  frontWheelPivots: THREE.Group[];
  driverGroup: THREE.Group;
  headlightBeams?: THREE.Group;
  sirenRed?: THREE.Mesh;
  sirenBlue?: THREE.Mesh;
  sirenRedGlow?: THREE.Sprite;
  sirenBlueGlow?: THREE.Sprite;
  taillightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshPhysicalMaterial;
}

// Shared organic Lathe torso geometry (tapered waist, natural chest, rounded shoulders)
function createSculptedTorsoGeo(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.21, 0.03),
    new THREE.Vector2(0.19, 0.18),
    new THREE.Vector2(0.22, 0.42),
    new THREE.Vector2(0.24, 0.56),
    new THREE.Vector2(0.15, 0.65),
    new THREE.Vector2(0.0, 0.66),
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.scale(1.12, 1.0, 0.72);
  return geo;
}

const SHARED_TORSO_GEO = createSculptedTorsoGeo();

let sharedFlannelTex: THREE.CanvasTexture | null = null;
function getSharedFlannelTex(): THREE.CanvasTexture {
  if (!sharedFlannelTex) {
    sharedFlannelTex = createFlannelPlaidTexture();
  }
  return sharedFlannelTex;
}

export function createCharacterRig(
  profile: {
    jacketColor: number;
    pantsColor: number;
    skinColor: number;
    hairColor: number;
    hasSunglasses?: boolean;
    hasCap?: boolean;
    capBackward?: boolean;
    hasChain?: boolean;
    duffelColor?: number;
    handDuffelColor?: number;
    outfitStyle?: 'suit' | 'tank' | 'flannel';
  },
  shadowTex: THREE.Texture,
  castShadow: boolean
): CharacterRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.52 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const isFlannel = profile.outfitStyle === 'flannel';
  const isTank = profile.outfitStyle === 'tank';
  const isSuit = profile.outfitStyle === 'suit';

  const jacketMat = isFlannel
    ? new THREE.MeshStandardMaterial({ map: getSharedFlannelTex(), roughness: 0.84, metalness: 0.04 })
    : new THREE.MeshStandardMaterial({ color: profile.jacketColor, roughness: isTank ? 0.72 : 0.58, metalness: 0.12 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: profile.pantsColor, roughness: 0.84, metalness: 0.04 });
  const skinMat = new THREE.MeshStandardMaterial({ color: profile.skinColor, roughness: 0.54, metalness: 0.02 });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: isFlannel ? 0x4a3222 : 0x16181d,
    roughness: isFlannel ? 0.72 : 0.42,
    metalness: isFlannel ? 0.08 : 0.25,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: profile.hairColor, roughness: 0.85, metalness: 0.04 });

  // Sculpted organic torso & pelvis (zero blocky boxes)
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), pantsMat);
  pelvis.scale.set(1.14, 0.62, 0.78);
  pelvis.position.y = 0.8;
  bodyPivot.add(pelvis);

  const torso = new THREE.Mesh(SHARED_TORSO_GEO, jacketMat);
  torso.position.y = 0.78;
  torso.castShadow = castShadow;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  if (isSuit) {
    // Open-collar white dress shirt V-insert under rumpled charcoal jacket
    const shirtInsert = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 })
    );
    shirtInsert.rotation.x = Math.PI;
    shirtInsert.scale.set(1.0, 1.0, 0.45);
    shirtInsert.position.set(0, 1.32, 0.13);
    bodyPivot.add(shirtInsert);
  }

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.036, 8, 16),
    new THREE.MeshStandardMaterial({
      color: isTank ? profile.skinColor : isFlannel ? 0x4a201b : 0xf1f5f9,
      roughness: 0.55,
    })
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.43;
  bodyPivot.add(collar);

  const chainMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.015, 8, 22),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.94, roughness: 0.16, envMapIntensity: 1.7 })
  );
  chainMesh.rotation.x = Math.PI / 2 + 0.22;
  chainMesh.position.set(0, 1.37, 0.04);
  chainMesh.visible = !!profile.hasChain;
  bodyPivot.add(chainMesh);

  if (profile.duffelColor !== undefined) {
    const duffelMat = new THREE.MeshStandardMaterial({ color: profile.duffelColor, roughness: 0.76, metalness: 0.08 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.65, metalness: 0.15 });
    const duffelBag = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 12), duffelMat);
    duffelBag.rotation.z = Math.PI / 2 - 0.18;
    duffelBag.rotation.y = 0.25;
    duffelBag.position.set(-0.24, 0.94, -0.14);
    duffelBag.castShadow = castShadow;

    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 20), strapMat);
    strap.rotation.y = Math.PI / 2 - 0.35;
    strap.rotation.x = 0.48;
    strap.scale.set(1.0, 1.28, 0.85);
    strap.position.set(-0.02, 1.15, 0.01);
    bodyPivot.add(duffelBag, strap);
  }

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.215, 0.22, 0.065, 16),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.36, metalness: 0.5 })
  );
  belt.scale.set(1.12, 1, 0.74);
  belt.position.y = 0.83;
  const buckle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.022, 10),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.88, roughness: 0.18 })
  );
  buckle.rotation.x = Math.PI / 2;
  buckle.position.set(0, 0.83, 0.165);
  bodyPivot.add(belt, buckle);

  // Smooth Capsule legs & rounded sneakers
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.78, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.26, 6, 12), pantsMat);
    thigh.position.y = -0.18;
    thigh.castShadow = castShadow;
    legPivot.add(thigh);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.28, 6, 12), pantsMat);
    calf.position.y = -0.49;
    calf.castShadow = castShadow;
    legPivot.add(calf);

    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.14, 6, 10), shoeMat);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.05, 1.0, 0.72);
    shoe.position.set(0, -0.71, 0.045);
    shoe.castShadow = castShadow;
    legPivot.add(shoe);

    return legPivot;
  };
  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);
  bodyPivot.add(leftLeg, rightLeg);

  // Smooth tapered anatomical arms (zero protruding ball-joints)
  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.34, 0);
    armPivot.rotation.z = xOffset < 0 ? -0.075 : 0.075;

    const upperMat = isTank ? skinMat : jacketMat;
    const lowerMat = isTank || isFlannel ? skinMat : jacketMat;

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), upperMat);
    shoulder.scale.set(0.86, 1.05, 0.88);
    armPivot.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.2, 6, 12), upperMat);
    upperArm.position.y = -0.15;
    upperArm.castShadow = castShadow;
    armPivot.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.2, 6, 12), lowerMat);
    forearm.position.y = -0.37;
    forearm.castShadow = castShadow;
    armPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), skinMat);
    hand.scale.set(0.85, 1.1, 0.85);
    hand.position.y = -0.52;
    armPivot.add(hand);

    return armPivot;
  };
  const leftArm = makeArm(-0.22);
  const rightArm = makeArm(0.22);
  bodyPivot.add(leftArm, rightArm);

  if (profile.handDuffelColor !== undefined) {
    const bagMat = new THREE.MeshStandardMaterial({ color: profile.handDuffelColor, roughness: 0.78, metalness: 0.08 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.65 });
    const bagGroup = new THREE.Group();
    bagGroup.position.set(-0.07, -0.68, 0.02);
    const bagBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.34, 6, 12), bagMat);
    bagBody.rotation.x = Math.PI / 2;
    bagBody.scale.set(0.82, 1.0, 0.95);
    bagBody.castShadow = castShadow;
    const bagHandle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 16, Math.PI), handleMat);
    bagHandle.rotation.y = Math.PI / 2;
    bagHandle.position.y = 0.12;
    bagGroup.add(bagBody, bagHandle);
    leftArm.add(bagGroup);
  }

  // Detailed beveled weapon + muzzle flash
  const weaponMesh = new THREE.Group();
  weaponMesh.position.set(0, -0.53, 0.12);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.24, metalness: 0.86 });
  const gunGrip = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.08, 4, 8), gunMat);
  gunGrip.rotation.x = 0.22;
  gunGrip.position.set(0, -0.02, 0.05);
  const gunSlide = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.24, 4, 8), gunMat);
  gunSlide.rotation.x = Math.PI / 2;
  gunSlide.position.set(0, 0.03, 0.16);
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.16, metalness: 0.94 })
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.03, 0.31);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 })
  );
  muzzleFlash.scale.set(0.85, 0.85, 1.6);
  muzzleFlash.position.set(0, 0.03, 0.48);
  muzzleFlash.visible = false;

  weaponMesh.add(gunGrip, gunSlide, gunBarrel, muzzleFlash);
  weaponMesh.visible = false;
  rightArm.add(weaponMesh);

  // Sculpted head with rounded nose bridge, hair cap, curved visor/glasses
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.46, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.082, 0.13, 12), skinMat);
  neck.position.y = 0.03;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 14), skinMat);
  head.scale.set(0.9, 1.07, 0.98);
  head.position.y = 0.19;
  head.castShadow = castShadow;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMat);
  nose.scale.set(0.8, 1.1, 1.3);
  nose.position.set(0, 0.18, 0.155);
  headGroup.add(neck, head, nose);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
  hair.scale.set(0.92, 1.04, 1.0);
  hair.position.y = 0.21;
  headGroup.add(hair);

  // Subtle natural eyes, brows, and jaw definition so faces read realistically close-up
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.2 });
  const browMat = new THREE.MeshStandardMaterial({ color: profile.hairColor, roughness: 0.85 });
  for (const sx of [-0.048, 0.048]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), eyeMat);
    eye.position.set(sx, 0.205, 0.145);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.012, 0.018), browMat);
    brow.position.set(sx, 0.228, 0.146);
    brow.rotation.z = sx < 0 ? 0.08 : -0.08;
    headGroup.add(eye, brow);
  }
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.009, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x7c493b, roughness: 0.65 })
  );
  mouth.position.set(0, 0.125, 0.148);
  headGroup.add(mouth);

  const glassesGroup = new THREE.Group();
  const glassesMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.06, metalness: 0.92 });
  const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 12), glassesMat);
  lensL.rotation.x = Math.PI / 2;
  lensL.position.set(-0.055, 0.2, 0.15);
  const lensR = lensL.clone();
  lensR.position.x = 0.055;
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), glassesMat);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.21, 0.155);
  glassesGroup.add(lensL, lensR, bridge);
  glassesGroup.visible = !!profile.hasSunglasses;
  headGroup.add(glassesGroup);

  const capGroup = new THREE.Group();
  const capColor = profile.jacketColor === 0x1d4ed8 ? 0x1e3a8a : profile.capBackward ? 0x18181b : 0x166534;
  const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.62 });
  const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.176, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
  capCrown.position.y = 0.22;
  const capBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.18, 0.025, 16, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
    capMat
  );
  if (profile.capBackward) {
    capBrim.rotation.y = Math.PI;
    capBrim.position.set(0, 0.225, -0.06);
  } else {
    capBrim.position.set(0, 0.225, 0.06);
  }
  capGroup.add(capCrown, capBrim);
  capGroup.visible = !!profile.hasCap;
  headGroup.add(capGroup);

  bodyPivot.add(headGroup);

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMesh,
    muzzleFlash,
    jacketMat,
    pantsMat,
    hairMat,
    glassesGroup,
    capGroup,
    chainMesh,
  };
}

function buildSeatedDriver(isPolice: boolean): THREE.Group {
  const driver = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1d4ed8 : 0x334155,
    roughness: 0.65,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.56 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.26, 6, 12), shirtMat);
  torso.scale.set(1.15, 1, 0.75);
  torso.position.y = 0.23;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.138, 12, 10), skinMat);
  head.scale.set(0.92, 1.06, 0.96);
  head.position.y = 0.56;
  driver.add(torso, head);

  if (isPolice) {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.148, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
    cap.position.y = 0.59;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.02, 12, 1, false, -1.1, 2.2), capMat);
    brim.position.set(0, 0.6, 0.05);
    const badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.015, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
    );
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0.65, 0.14);
    driver.add(cap, brim, badge);
  }
  return driver;
}

export function createVehicleRig(
  spec: VehicleSpec,
  shadowTex: THREE.Texture,
  glowTex: THREE.Texture,
  castShadow: boolean
): VehicleRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 1.5, spec.length * 1.3),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.58 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.028;
  root.add(shadow);

  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const bodyMat = spec.isMatte
    ? new THREE.MeshPhysicalMaterial({
        color: spec.primaryColor,
        metalness: 0.22,
        roughness: 0.72,
        clearcoat: 0.08,
        clearcoatRoughness: 0.48,
        envMapIntensity: 0.9,
      })
    : new THREE.MeshPhysicalMaterial({
        color: spec.primaryColor,
        metalness: 0.84,
        roughness: 0.13,
        clearcoat: 1.0,
        clearcoatRoughness: 0.035,
        envMapIntensity: 1.65,
      });

  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.secondaryColor,
    roughness: 0.34,
    metalness: 0.68,
    envMapIntensity: 1.2,
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.84,
    metalness: 0.1,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070d18,
    roughness: 0.04,
    metalness: 0.42,
    transparent: true,
    opacity: 0.78,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.9,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.75,
    roughness: 0.12,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.85,
    roughness: 0.16,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf4f4f5,
    metalness: 0.98,
    roughness: 0.08,
    envMapIntensity: 1.8,
  });

  const wheels: THREE.Group[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const driverGroup = buildSeatedDriver(spec.type === 'police');

  // Ground headlight pool beams
  const headlightBeams = new THREE.Group();
  const beamGeo = new THREE.PlaneGeometry(spec.width * 1.15, 9.0);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(0, 0.04, spec.length * 0.5 + 4.5);
  const beamMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xfef9c3,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  headlightBeams.add(new THREE.Mesh(beamGeo, beamMat));
  chassisGroup.add(headlightBeams);

  if (spec.type === 'moto') {
    // Sculpted sports motorcycle (curved fairing, tank, tubular frame, curved seat)
    const frameCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.42, -0.78),
      new THREE.Vector3(0, 0.62, -0.2),
      new THREE.Vector3(0, 0.72, 0.48),
      new THREE.Vector3(0, 0.44, 0.8),
    ]);
    const frameTube = new THREE.Mesh(new THREE.TubeGeometry(frameCurve, 18, 0.065, 8, false), trimMat);
    frameTube.castShadow = castShadow;
    chassisGroup.add(frameTube);

    const fairing = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.65, 6, 12), bodyMat);
    fairing.rotation.x = Math.PI / 2 - 0.24;
    fairing.scale.set(0.95, 1.0, 0.85);
    fairing.position.set(0, 0.68, 0.42);
    fairing.castShadow = castShadow;
    chassisGroup.add(fairing);

    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), bodyMat);
    tank.scale.set(0.86, 0.68, 1.45);
    tank.position.set(0, 0.82, 0.16);
    chassisGroup.add(tank);

    const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.45, 6, 10), trimMat);
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(1.0, 1.0, 0.52);
    seat.position.set(0, 0.78, -0.34);
    chassisGroup.add(seat);

    const windshield = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI, 0, Math.PI * 0.55),
      glassMat
    );
    windshield.position.set(0, 0.9, 0.65);
    chassisGroup.add(windshield);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.76, 10), chromeMat);
    fork.position.set(0, 0.64, 0.74);
    fork.rotation.x = -0.35;
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 10), chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.98, 0.62);
    chassisGroup.add(fork, handlebar);

    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), headlightMat);
    headlight.scale.set(1.1, 0.85, 0.65);
    headlight.position.set(0, 0.79, 0.84);
    const taillight = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), taillightMat);
    taillight.rotation.z = Math.PI / 2;
    taillight.position.set(0, 0.74, -0.92);
    chassisGroup.add(headlight, taillight);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.72, 10), chromeMat);
    exhaust.rotation.x = Math.PI / 2 - 0.14;
    exhaust.position.set(0.17, 0.44, -0.45);
    chassisGroup.add(exhaust);

    driverGroup.position.set(0, 0.78, -0.16);
    driverGroup.visible = false;
    chassisGroup.add(driverGroup);

    const makeMotoWheel = (zPos: number, isFront: boolean) => {
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.34, zPos);
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.095, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.86 })
      );
      tire.rotation.y = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.13, 14), chromeMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(tire, rim);
      pivot.add(wheel);
      root.add(pivot);
      wheels.push(wheel);
      if (isFront) frontWheelPivots.push(pivot);
    };
    makeMotoWheel(0.82, true);
    makeMotoWheel(-0.78, false);

    return {
      root,
      chassisGroup,
      wheels,
      frontWheelPivots,
      driverGroup,
      headlightBeams,
      taillightMat,
      headlightMat,
      bodyMat,
    };
  }

  // Sculpted Aerodynamic 4-Wheel Car Silhouette (Sloped front hood + flush cabin + rear deck)
  const lowerH = spec.type === 'suv' ? 0.56 : 0.44;
  const lowerY = spec.type === 'suv' ? 0.64 : 0.47;
  const halfL = spec.length * 0.5;
  const isFastback = spec.type === 'supercar';
  const noseHeight = isFastback ? lowerH * 0.58 : spec.type === 'suv' ? lowerH * 0.88 : lowerH * 0.74;

  // Profile in (x, y) where +x rotates to +Z (front) via rotateY(-PI / 2)
  const bodyProfile = new THREE.Shape();
  bodyProfile.moveTo(-halfL + 0.08, 0.04);
  bodyProfile.lineTo(halfL - 0.12, 0.04);
  bodyProfile.quadraticCurveTo(halfL + 0.06, 0.08, halfL, noseHeight);
  bodyProfile.quadraticCurveTo(halfL * 0.62, lowerH * 0.96, halfL * 0.34, lowerH);
  bodyProfile.lineTo(-halfL * 0.86, lowerH * 0.98);
  bodyProfile.quadraticCurveTo(-halfL - 0.02, lowerH * 0.88, -halfL, lowerH * 0.25);
  bodyProfile.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(bodyProfile, {
    depth: spec.width - 0.14,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 12,
  });
  bodyGeo.translate(0, 0, -(spec.width - 0.14) * 0.5);
  bodyGeo.rotateY(-Math.PI / 2);

  const lowerBody = new THREE.Mesh(bodyGeo, bodyMat);
  lowerBody.position.y = lowerY - lowerH * 0.5;
  lowerBody.castShadow = castShadow;
  lowerBody.receiveShadow = true;
  chassisGroup.add(lowerBody);

  // Curved aerodynamic bumper / chrome bumper on classic muscle cars
  const bumperMat = spec.type === 'muscle' ? chromeMat : trimMat;
  const bumperF = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, spec.width * 0.86, 4, 10), bumperMat);
  bumperF.rotation.z = Math.PI / 2;
  bumperF.position.set(0, lowerY - lowerH * 0.34, halfL + 0.02);
  const bumperR = bumperF.clone();
  bumperR.position.z = -halfL - 0.02;
  chassisGroup.add(bumperF, bumperR);

  // Front radiator grille
  const grille = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.085, spec.width * 0.58, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.78, roughness: 0.24 })
  );
  grille.rotation.z = Math.PI / 2;
  grille.position.set(0, lowerY - 0.03, halfL + 0.02);
  chassisGroup.add(grille);

  // Integrated Cabin Greenhouse (sleek lowered GT roofline + dark tinted glass)
  const cabinLen = spec.type === 'suv' ? spec.length * 0.58 : spec.length * 0.5;
  const cabinH = spec.type === 'suv' ? 0.48 : 0.36;
  const cabinY = lowerY + lowerH * 0.44;
  const cabinZ = isFastback ? -0.18 : -0.12;

  // 1. Dark tinted glass core (windshield, side windows, rear glass)
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-cabinLen * 0.5, 0);
  glassShape.lineTo(cabinLen * 0.48, 0);
  glassShape.lineTo(cabinLen * 0.16, cabinH - 0.04);
  glassShape.lineTo(-cabinLen * 0.28, cabinH - 0.04);
  glassShape.closePath();

  const cabinGlassGeo = new THREE.ExtrudeGeometry(glassShape, {
    depth: spec.width * 0.72,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  cabinGlassGeo.translate(0, 0, -(spec.width * 0.72) * 0.5);
  cabinGlassGeo.rotateY(-Math.PI / 2);

  const cabinGlass = new THREE.Mesh(cabinGlassGeo, glassMat);
  cabinGlass.position.set(0, cabinY, cabinZ);
  chassisGroup.add(cabinGlass);

  // 2. Painted structural roof & A/C-pillar frame seated flush over the greenhouse
  const roofMat =
    spec.type === 'police'
      ? new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.2, clearcoat: 0.9 })
      : bodyMat;

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-cabinLen * 0.34, cabinH - 0.05);
  roofShape.lineTo(cabinLen * 0.21, cabinH - 0.05);
  roofShape.quadraticCurveTo(cabinLen * 0.16, cabinH + 0.04, cabinLen * 0.1, cabinH + 0.04);
  roofShape.lineTo(-cabinLen * 0.24, cabinH + 0.04);
  roofShape.quadraticCurveTo(-cabinLen * 0.31, cabinH + 0.04, -cabinLen * 0.34, cabinH - 0.05);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: spec.width * 0.72,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -(spec.width * 0.72) * 0.5);
  roofGeo.rotateY(-Math.PI / 2);

  const roofPanel = new THREE.Mesh(roofGeo, roofMat);
  roofPanel.position.set(0, cabinY, cabinZ);
  roofPanel.castShadow = castShadow;
  chassisGroup.add(roofPanel);

  // Subtle A-pillar & C-pillar structural ribs connecting roof flush to lower body
  const makePillar = (px: number, pzTop: number, pzBot: number) => {
    const pCurve = new THREE.LineCurve3(
      new THREE.Vector3(px, cabinY + 0.01, cabinZ + pzBot),
      new THREE.Vector3(px * 0.92, cabinY + cabinH - 0.03, cabinZ + pzTop)
    );
    return new THREE.Mesh(new THREE.TubeGeometry(pCurve, 4, 0.032, 6, false), roofMat);
  };
  const pilX = spec.width * 0.37;
  chassisGroup.add(
    makePillar(-pilX, cabinLen * 0.16, cabinLen * 0.46),
    makePillar(pilX, cabinLen * 0.16, cabinLen * 0.46),
    makePillar(-pilX, -cabinLen * 0.28, -cabinLen * 0.48),
    makePillar(pilX, -cabinLen * 0.28, -cabinLen * 0.48)
  );

  // Interior dashboard & steering wheel
  const dash = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, spec.width * 0.54, 4, 8), interiorMat);
  dash.rotation.z = Math.PI / 2;
  dash.position.set(0, lowerY + lowerH * 0.35, cabinZ + cabinLen * 0.24);
  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 16), trimMat);
  steerWheel.position.set(-0.34, lowerY + lowerH * 0.5, cabinZ + cabinLen * 0.12);
  steerWheel.rotation.x = 0.45;
  chassisGroup.add(dash, steerWheel);

  driverGroup.position.set(-0.34, lowerY + 0.04, cabinZ - 0.06);
  driverGroup.visible = false;
  chassisGroup.add(driverGroup);

  // Aerodynamic wing mirrors
  const mirrorGeo = new THREE.SphereGeometry(0.068, 10, 8);
  mirrorGeo.scale(1.4, 0.72, 0.88);
  const mirrorL = new THREE.Mesh(mirrorGeo, roofMat);
  mirrorL.position.set(-spec.width * 0.5, lowerY + lowerH * 0.5, cabinZ + cabinLen * 0.26);
  const mirrorR = mirrorL.clone();
  mirrorR.position.x = spec.width * 0.5;
  chassisGroup.add(mirrorL, mirrorR);

  if (spec.type === 'police') {
    const doorMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.16,
      metalness: 0.2,
      clearcoat: 0.9,
    });
    const doorBand = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width + 0.02, lowerH * 0.76, spec.length * 0.36),
      doorMat
    );
    doorBand.position.set(0, lowerY, -0.05);
    chassisGroup.add(doorBand);

    // Tubular steel push-bar mounted cleanly on front bumper
    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-spec.width * 0.26, lowerY - 0.12, halfL + 0.1),
      new THREE.Vector3(-spec.width * 0.24, lowerY + 0.14, halfL + 0.1),
      new THREE.Vector3(spec.width * 0.24, lowerY + 0.14, halfL + 0.1),
      new THREE.Vector3(spec.width * 0.26, lowerY - 0.12, halfL + 0.1),
    ]);
    const pushBar = new THREE.Mesh(new THREE.TubeGeometry(barCurve, 14, 0.036, 8, false), trimMat);
    chassisGroup.add(pushBar);
  }

  if (spec.type === 'supercar') {
    // Grounded rear airfoil spoiler mounted cleanly onto trunk deck
    const spoilerGroup = new THREE.Group();
    spoilerGroup.position.set(0, lowerY + lowerH * 0.48, -halfL + 0.26);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.86, 0.045, 0.24), trimMat);
    wingBlade.position.y = 0.22;
    wingBlade.rotation.x = -0.08;
    const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.28), trimMat);
    endplateL.position.set(-spec.width * 0.43, 0.21, 0);
    const endplateR = endplateL.clone();
    endplateR.position.x = spec.width * 0.43;
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.12), trimMat);
    strutL.position.set(-0.46, 0.11, 0);
    const strutR = strutL.clone();
    strutR.position.x = 0.46;
    spoilerGroup.add(wingBlade, endplateL, endplateR, strutL, strutR);
    chassisGroup.add(spoilerGroup);
  } else if (spec.type === 'muscle') {
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.11, 0.82), trimMat);
    hoodScoop.position.set(0, lowerY + lowerH * 0.5 + 0.04, spec.length * 0.2);
    chassisGroup.add(hoodScoop);
  }

  // Sculpted headlights (quad round headlamps on classic muscle, sleek LEDs on sports/police)
  if (spec.type === 'muscle') {
    const roundHL = new THREE.CylinderGeometry(0.068, 0.068, 0.05, 14);
    roundHL.rotateX(Math.PI / 2);
    for (const hx of [-spec.width * 0.36, -spec.width * 0.24, spec.width * 0.24, spec.width * 0.36]) {
      const lamp = new THREE.Mesh(roundHL, headlightMat);
      lamp.position.set(hx, lowerY + 0.02, halfL + 0.02);
      chassisGroup.add(lamp);
    }
  } else {
    const hlGeo = new THREE.CapsuleGeometry(0.05, 0.24, 4, 10);
    hlGeo.rotateZ(Math.PI / 2);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(-spec.width * 0.34, lowerY + 0.03, halfL + 0.01);
    const hlR = hlL.clone();
    hlR.position.x = spec.width * 0.34;
    chassisGroup.add(hlL, hlR);
  }

  const tlGeo = new THREE.CapsuleGeometry(0.05, 0.3, 4, 10);
  tlGeo.rotateZ(Math.PI / 2);
  const tlL = new THREE.Mesh(tlGeo, taillightMat);
  tlL.position.set(-spec.width * 0.32, lowerY + 0.06, -halfL - 0.01);
  const tlR = tlL.clone();
  tlR.position.x = spec.width * 0.32;
  chassisGroup.add(tlL, tlR);

  const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.22, 12), chromeMat);
  exhaustL.rotation.x = Math.PI / 2;
  exhaustL.position.set(-0.46, lowerY - lowerH * 0.34, -spec.length * 0.51);
  const exhaustR = exhaustL.clone();
  exhaustR.position.x = 0.46;
  chassisGroup.add(exhaustL, exhaustR);

  let sirenRed: THREE.Mesh | undefined;
  let sirenBlue: THREE.Mesh | undefined;
  let sirenRedGlow: THREE.Sprite | undefined;
  let sirenBlueGlow: THREE.Sprite | undefined;
  if (spec.hasSiren) {
    const barBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.92, 4, 8), trimMat);
    barBase.rotation.z = Math.PI / 2;
    barBase.position.set(0, cabinY + cabinH + 0.06, cabinZ);
    sirenRed = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.32, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.2 })
    );
    sirenRed.rotation.z = Math.PI / 2;
    sirenRed.position.set(-0.25, cabinY + cabinH + 0.1, cabinZ);
    sirenBlue = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.32, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.2 })
    );
    sirenBlue.rotation.z = Math.PI / 2;
    sirenBlue.position.set(0.25, cabinY + cabinH + 0.1, cabinZ);

    sirenRedGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xef4444, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sirenRedGlow.scale.set(2.8, 2.8, 1);
    sirenRedGlow.position.copy(sirenRed.position);

    sirenBlueGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0x3b82f6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sirenBlueGlow.scale.set(2.8, 2.8, 1);
    sirenBlueGlow.position.copy(sirenBlue.position);

    chassisGroup.add(barBase, sirenRed, sirenBlue, sirenRedGlow, sirenBlueGlow);
  }

  // Realistic Torus Tires + 5-Spoke Alloy Wheels + Center Hub
  const wheelRadius = spec.type === 'suv' ? 0.42 : 0.34;
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.86, metalness: 0.06 });

  const makeWheel = (x: number, z: number, isFront: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, wheelRadius, z);
    const wheel = new THREE.Group();

    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius * 0.72, wheelRadius * 0.28, 12, 24),
      tireMat
    );
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = castShadow;

    const rimBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.58, wheelRadius * 0.58, 0.2, 18),
      chromeMat
    );
    rimBarrel.rotation.z = Math.PI / 2;

    const hubCap = new THREE.Mesh(
      new THREE.SphereGeometry(wheelRadius * 0.22, 10, 8),
      trimMat
    );
    hubCap.scale.set(0.45, 1, 1);
    hubCap.position.x = x > 0 ? 0.1 : -0.1;

    wheel.add(tire, rimBarrel, hubCap);
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.025, wheelRadius * 0.92, 6),
        chromeMat
      );
      spoke.rotation.x = (s / 5) * Math.PI;
      spoke.position.x = x > 0 ? 0.08 : -0.08;
      wheel.add(spoke);
    }

    pivot.add(wheel);
    root.add(pivot);
    wheels.push(wheel);
    if (isFront) frontWheelPivots.push(pivot);
  };

  const wx = spec.width * 0.48;
  const wzF = spec.length * 0.31;
  const wzR = -spec.length * 0.31;
  makeWheel(-wx, wzF, true);
  makeWheel(wx, wzF, true);
  makeWheel(-wx, wzR, false);
  makeWheel(wx, wzR, false);

  return {
    root,
    chassisGroup,
    wheels,
    frontWheelPivots,
    driverGroup,
    headlightBeams,
    sirenRed,
    sirenBlue,
    sirenRedGlow,
    sirenBlueGlow,
    taillightMat,
    headlightMat,
    bodyMat,
  };
}
