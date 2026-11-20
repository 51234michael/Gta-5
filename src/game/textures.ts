import * as THREE from 'three';
import { TimeOfDay } from './types';

function finalizeColorTexture(canvas: HTMLCanvasElement, maxAniso: number, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTexture(canvas: HTMLCanvasElement, maxAniso: number, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

export function createSkyGradientTexture(tod: TimeOfDay): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (tod === 'morning') {
    grad.addColorStop(0.0, '#17378e');
    grad.addColorStop(0.38, '#3b82f6');
    grad.addColorStop(0.72, '#bae6fd');
    grad.addColorStop(1.0, '#fde68a');
  } else if (tod === 'day') {
    grad.addColorStop(0.0, '#034a85');
    grad.addColorStop(0.35, '#0284c7');
    grad.addColorStop(0.72, '#7dd3fc');
    grad.addColorStop(1.0, '#fef3c7');
  } else if (tod === 'sunset') {
    // Southern California late-afternoon golden hour (dusty plum-violet zenith -> warm coral -> glowing amber horizon)
    grad.addColorStop(0.0, '#1f1b38');
    grad.addColorStop(0.2, '#4c2c4f');
    grad.addColorStop(0.42, '#8c445c');
    grad.addColorStop(0.64, '#d96b38');
    grad.addColorStop(0.84, '#f5a642');
    grad.addColorStop(1.0, '#ffe49e');
  } else {
    grad.addColorStop(0.0, '#020617');
    grad.addColorStop(0.45, '#091128');
    grad.addColorStop(0.82, '#172554');
    grad.addColorStop(1.0, '#1e293b');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  if (tod === 'night') {
    for (let i = 0; i < 460; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 310;
      const r = Math.random() * 1.5 + 0.4;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 80; i++) {
      const cx = Math.random() * 1024;
      const cy = 65 + Math.random() * 230;
      const w = 85 + Math.random() * 175;
      const h = 12 + Math.random() * 24;
      ctx.fillStyle =
        tod === 'sunset'
          ? cy < 170
            ? 'rgba(130, 74, 102, 0.28)'
            : 'rgba(255, 206, 138, 0.26)'
          : 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createAsphaltTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3b3e42';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle dark rubber tire-wear channels
  const tireGrad1 = ctx.createLinearGradient(76, 0, 164, 0);
  tireGrad1.addColorStop(0, 'rgba(22,22,24,0)');
  tireGrad1.addColorStop(0.5, 'rgba(22,22,24,0.34)');
  tireGrad1.addColorStop(1, 'rgba(22,22,24,0)');
  ctx.fillStyle = tireGrad1;
  ctx.fillRect(76, 0, 88, 512);

  const tireGrad2 = ctx.createLinearGradient(348, 0, 436, 0);
  tireGrad2.addColorStop(0, 'rgba(22,22,24,0)');
  tireGrad2.addColorStop(0.5, 'rgba(22,22,24,0.34)');
  tireGrad2.addColorStop(1, 'rgba(22,22,24,0)');
  ctx.fillStyle = tireGrad2;
  ctx.fillRect(348, 0, 88, 512);

  // Realistic crushed granite & sun-bleached road aggregate
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 48 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgb(${v + 2},${v + 1},${v - 1})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Hairline tar-sealed road cracks
  ctx.strokeStyle = 'rgba(7, 9, 12, 0.55)';
  ctx.lineWidth = 1.2;
  for (let c = 0; c < 9; c++) {
    let cx = 30 + Math.random() * 450;
    let cy = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * 28;
      cy += 14 + Math.random() * 24;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.fillRect(10, 0, 6, 512);
  ctx.fillRect(496, 0, 6, 512);

  ctx.fillStyle = '#facc15';
  ctx.fillRect(247, 0, 5, 512);
  ctx.fillRect(260, 0, 5, 512);

  ctx.fillStyle = '#e2e8f0';
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(126, y + 10, 5, 34);
    ctx.fillRect(382, y + 10, 5, 34);
  }

  return finalizeColorTexture(canvas, maxAniso, 1, 1);
}

export function createAsphaltBumpTexture(maxAniso: number, repeatY = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 9000; i++) {
    const v = 88 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  // Smooth worn tire lanes slightly lower roughness bump
  ctx.fillStyle = 'rgba(110,110,110,0.28)';
  ctx.fillRect(40, 0, 36, 256);
  ctx.fillRect(180, 0, 36, 256);

  return finalizeDataTexture(canvas, maxAniso, 1, repeatY);
}

export function createRunwayTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252932';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const v = 30 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v},${v + 3})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(18, 0, 10, 512);
  ctx.fillRect(484, 0, 10, 512);

  for (let y = 16; y < 512; y += 96) {
    ctx.fillRect(244, y, 24, 56);
  }

  return finalizeColorTexture(canvas, maxAniso, 1, 5);
}

export function createCrosswalkTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3b3e42';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    const v = 46 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${v + 2},${v + 1},${v})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }

  ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
  for (let i = 28; i <= 220; i += 24) {
    ctx.fillRect(i, 8, 12, 26);
    ctx.fillRect(i, 222, 12, 26);
    ctx.fillRect(8, i, 26, 12);
    ctx.fillRect(222, i, 26, 12);
  }

  return finalizeColorTexture(canvas, maxAniso, 1, 1);
}

export function createSidewalkTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#6f757e';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  for (let i = 0; i < 2600; i++) {
    const v = 128 + Math.floor(Math.random() * 44);
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  return finalizeColorTexture(canvas, maxAniso, 92, 92);
}

export function createSidewalkBumpTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#383838';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  return finalizeDataTexture(canvas, maxAniso, 92, 92);
}

export function createSkyscraperFacadeTexture(
  maxAniso: number,
  baseHex: string,
  windowHex: string,
  litHex: string,
  cols = 8,
  rows = 16
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 1024);

  const padX = 10;
  const padY = 12;
  const cellW = 512 / cols;
  const cellH = 1024 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isGroundFloor = r === rows - 1;
      const lit = isGroundFloor ? Math.random() < 0.62 : Math.random() < 0.16;
      const x = c * cellW + padX * 0.5;
      const y = r * cellH + padY * 0.5;
      const w = cellW - padX;
      const h = cellH - padY;

      if (lit) {
        const wGrad = ctx.createLinearGradient(x, y, x, y + h);
        wGrad.addColorStop(0, litHex);
        wGrad.addColorStop(1, '#d99b52');
        ctx.fillStyle = wGrad;
      } else {
        const gGrad = ctx.createLinearGradient(x, y, x + w, y + h);
        gGrad.addColorStop(0, windowHex);
        gGrad.addColorStop(1, '#262f3d');
        ctx.fillStyle = gGrad;
      }
      ctx.fillRect(x, y, w, h);

      // Subtle late-afternoon sunset reflection sheen across architectural glass
      ctx.fillStyle = 'rgba(255, 224, 185, 0.16)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.54, y);
      ctx.lineTo(x + w * 0.2, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();

      // Mullion shadow ledge
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, y + h - 3, w, 3);
    }
  }

  return finalizeColorTexture(canvas, maxAniso, 1, 1);
}

export function createSandTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ebd7a7';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 6500; i++) {
    const shade = Math.random() > 0.5 ? '#d8be88' : '#f4e6c5';
    ctx.fillStyle = shade;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return finalizeColorTexture(canvas, maxAniso, 40, 8);
}

export function createWaterTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0369a1';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 280; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(186, 230, 253, 0.24)' : 'rgba(7, 89, 133, 0.32)';
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillRect(x, y, 42 + Math.random() * 64, 4);
  }
  return finalizeColorTexture(canvas, maxAniso, 42, 22);
}

export function createWaterBumpTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 320; i++) {
    const v = 90 + Math.floor(Math.random() * 110);
    ctx.fillStyle = `rgba(${v},${v},${v},0.42)`;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + Math.random() * 24, 3 + Math.random() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeDataTexture(canvas, maxAniso, 42, 22);
}

export function createCloudPuffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const lobes: [number, number, number, number][] = [
    [128, 72, 92, 34],
    [82, 74, 54, 28],
    [174, 76, 56, 28],
    [116, 48, 50, 32],
    [152, 54, 42, 26],
  ];
  for (const [lx, ly, rx, ry] of lobes) {
    const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, rx);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    grad.addColorStop(0.55, 'rgba(255, 248, 240, 0.34)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(1, ry / rx);
    ctx.translate(-lx, -ly);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createAnamorphicStreakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const hGrad = ctx.createLinearGradient(0, 64, 512, 64);
  hGrad.addColorStop(0, 'rgba(255, 190, 95, 0)');
  hGrad.addColorStop(0.28, 'rgba(255, 210, 125, 0.25)');
  hGrad.addColorStop(0.5, 'rgba(255, 248, 220, 0.96)');
  hGrad.addColorStop(0.72, 'rgba(255, 210, 125, 0.25)');
  hGrad.addColorStop(1, 'rgba(255, 190, 95, 0)');

  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 56, 512, 16);

  const cGrad = ctx.createRadialGradient(256, 64, 2, 256, 64, 62);
  cGrad.addColorStop(0, 'rgba(255, 252, 235, 0.95)');
  cGrad.addColorStop(0.45, 'rgba(255, 200, 110, 0.32)');
  cGrad.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = cGrad;
  ctx.fillRect(190, 0, 132, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createDustParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 240, 205, 0.95)');
  grad.addColorStop(0.45, 'rgba(255, 215, 150, 0.42)');
  grad.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createGodRayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const vGrad = ctx.createLinearGradient(0, 0, 0, 512);
  vGrad.addColorStop(0.0, 'rgba(255, 224, 160, 0.0)');
  vGrad.addColorStop(0.18, 'rgba(255, 214, 140, 0.48)');
  vGrad.addColorStop(0.65, 'rgba(255, 178, 92, 0.22)');
  vGrad.addColorStop(1.0, 'rgba(255, 150, 70, 0.0)');

  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 256, 512);

  // Soft lateral beam falloff so shafts have zero sharp edges
  const hGrad = ctx.createLinearGradient(0, 0, 256, 0);
  hGrad.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
  hGrad.addColorStop(0.28, 'rgba(0, 0, 0, 0)');
  hGrad.addColorStop(0.72, 'rgba(0, 0, 0, 0)');
  hGrad.addColorStop(1.0, 'rgba(0, 0, 0, 1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 256, 512);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createFlannelPlaidTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm weathered tan-olive & muted terracotta plaid (matches rural mechanic shirt)
  ctx.fillStyle = '#8b7765';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 256; i += 32) {
    ctx.fillStyle = 'rgba(54, 42, 38, 0.52)';
    ctx.fillRect(i, 0, 14, 256);
    ctx.fillRect(0, i, 256, 14);

    ctx.fillStyle = 'rgba(145, 72, 58, 0.34)';
    ctx.fillRect(i + 15, 0, 5, 256);
    ctx.fillRect(0, i + 15, 256, 5);

    ctx.fillStyle = 'rgba(232, 222, 206, 0.36)';
    ctx.fillRect(i + 23, 0, 4, 256);
    ctx.fillRect(0, i + 23, 256, 4);
  }

  for (let i = 0; i < 2800; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,245,230,0.09)' : 'rgba(15,10,8,0.1)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  return finalizeColorTexture(canvas, 4, 2, 2);
}

export function createBillboardTexture(
  maxAniso: number,
  title: string,
  subtitle: string,
  bg: string,
  accent: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 512, 20);
  ctx.fillRect(0, 236, 512, 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 110);

  ctx.fillStyle = accent;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(subtitle, 256, 178);

  return finalizeColorTexture(canvas, maxAniso, 1, 1);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createNameplateTexture(name: string, accentHex = '#38bdf8'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(9, 12, 18, 0.86)';
  ctx.beginPath();
  ctx.roundRect(8, 10, 240, 44, 12);
  ctx.fill();

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
