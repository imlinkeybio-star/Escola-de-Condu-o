import { ChatEnhancementMode } from './chat-types';

export interface EnhancementPresetConfig {
  mode: ChatEnhancementMode;
  denoiseStrength: number; // 0..1
  sharpenAmount: number; // 0..1.5
  contrastBoost: number; // 0..0.4
  saturationBoost: number; // 0..0.35
  exposureLift: number; // 0..0.2
}

export const ENHANCEMENT_PRESETS: Record<
  ChatEnhancementMode,
  EnhancementPresetConfig
> = {
  natural: {
    mode: 'natural',
    denoiseStrength: 0.15,
    sharpenAmount: 0.35,
    contrastBoost: 0.1,
    saturationBoost: 0.1,
    exposureLift: 0.04,
  },
  hd: {
    mode: 'hd',
    denoiseStrength: 0.25,
    sharpenAmount: 0.72,
    contrastBoost: 0.18,
    saturationBoost: 0.16,
    exposureLift: 0.07,
  },
  advanced: {
    mode: 'advanced',
    denoiseStrength: 0.42,
    sharpenAmount: 1.05,
    contrastBoost: 0.26,
    saturationBoost: 0.22,
    exposureLift: 0.1,
  },
};

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
}

/**
 * Pure pixel-buffer enhancement pipeline (testable in Node & browser):
 * 1) Edge-aware light spatial denoise (weighted 3x3 cross blend preserving high-delta edges)
 * 2) Shadow lift & adaptive S-curve contrast + vibrance boost
 * 3) Unsharp-mask crispness convolution
 */
export function enhanceImageDataBuffer(
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
  mode: ChatEnhancementMode
): Uint8ClampedArray {
  const cfg = ENHANCEMENT_PRESETS[mode] ?? ENHANCEMENT_PRESETS.natural;
  const totalPixels = width * height;
  const work = new Float32Array(totalPixels * 3);
  const out = new Uint8ClampedArray(sourcePixels.length);

  // Pass 1: Edge-preserving 3x3 denoise + exposure/contrast/vibrance lift
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r0 = sourcePixels[idx];
      const g0 = sourcePixels[idx + 1];
      const b0 = sourcePixels[idx + 2];

      let rSum = r0;
      let gSum = g0;
      let bSum = b0;
      let wSum = 1;

      if (cfg.denoiseStrength > 0 && x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const neighbors = [
          ((y - 1) * width + x) * 4,
          ((y + 1) * width + x) * 4,
          (y * width + (x - 1)) * 4,
          (y * width + (x + 1)) * 4,
        ];
        for (const nIdx of neighbors) {
          const nr = sourcePixels[nIdx];
          const ng = sourcePixels[nIdx + 1];
          const nb = sourcePixels[nIdx + 2];
          const diff = Math.abs(nr - r0) + Math.abs(ng - g0) + Math.abs(nb - b0);
          // Only blend similar tones so crisp edges stay sharp
          if (diff < 72) {
            const w = cfg.denoiseStrength * (1 - diff / 72) * 0.45;
            rSum += nr * w;
            gSum += ng * w;
            bSum += nb * w;
            wSum += w;
          }
        }
      }

      let r = rSum / wSum / 255;
      let g = gSum / wSum / 255;
      let b = bSum / wSum / 255;

      // Shadow recovery / gentle exposure lift
      if (cfg.exposureLift > 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const shadowWeight = Math.max(0, 1 - lum * 1.35);
        const lift = 1 + cfg.exposureLift * shadowWeight;
        r = Math.min(1, r * lift);
        g = Math.min(1, g * lift);
        b = Math.min(1, b * lift);
      }

      // S-curve contrast around midpoint 0.5
      if (cfg.contrastBoost > 0) {
        const factor = 1 + cfg.contrastBoost * 1.4;
        r = Math.min(1, Math.max(0, (r - 0.5) * factor + 0.5));
        g = Math.min(1, Math.max(0, (g - 0.5) * factor + 0.5));
        b = Math.min(1, Math.max(0, (b - 0.5) * factor + 0.5));
      }

      // Saturation / vibrance boost
      if (cfg.saturationBoost > 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const satFactor = 1 + cfg.saturationBoost;
        r = Math.min(1, Math.max(0, lum + (r - lum) * satFactor));
        g = Math.min(1, Math.max(0, lum + (g - lum) * satFactor));
        b = Math.min(1, Math.max(0, lum + (b - lum) * satFactor));
      }

      const wIdx = (y * width + x) * 3;
      work[wIdx] = r * 255;
      work[wIdx + 1] = g * 255;
      work[wIdx + 2] = b * 255;
    }
  }

  // Pass 2: Unsharp mask sharpening (preserves alpha)
  const sharp = cfg.sharpenAmount;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = (y * width + x) * 3;
      const oIdx = (y * width + x) * 4;

      if (sharp <= 0 || x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        out[oIdx] = clampByte(work[pIdx]);
        out[oIdx + 1] = clampByte(work[pIdx + 1]);
        out[oIdx + 2] = clampByte(work[pIdx + 2]);
        out[oIdx + 3] = sourcePixels[oIdx + 3];
        continue;
      }

      const up = ((y - 1) * width + x) * 3;
      const down = ((y + 1) * width + x) * 3;
      const left = (y * width + (x - 1)) * 3;
      const right = (y * width + (x + 1)) * 3;

      for (let c = 0; c < 3; c++) {
        const center = work[pIdx + c];
        const blur =
          (work[up + c] + work[down + c] + work[left + c] + work[right + c]) *
          0.25;
        const detail = center - blur;
        // Clamp micro-noise amplification
        const dampedDetail =
          Math.abs(detail) < 3 ? detail * 0.35 : detail;
        out[oIdx + c] = clampByte(center + dampedDetail * sharp);
      }
      out[oIdx + 3] = sourcePixels[oIdx + 3];
    }
  }

  return out;
}

/**
 * Browser Canvas runner for LIVE IMAGE ENHANCER.
 * Produces an enhanced Blob/File without modifying or replacing the original.
 */
export async function enhanceImageBlobInBrowser(
  sourceBlob: Blob,
  originalFileName: string,
  mode: ChatEnhancementMode
): Promise<{
  enhancedBlob: Blob;
  enhancedFile: File;
  objectUrl: string;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(sourceBlob);
  try {
    // Respect safe canvas dimensions (max 4096px edge) while keeping natural resolution whenever possible
    const maxEdge = 4096;
    const scale =
      Math.max(bitmap.width, bitmap.height) > maxEdge
        ? maxEdge / Math.max(bitmap.width, bitmap.height)
        : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Contexto gráfico 2D indisponível neste navegador.');
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const enhancedBytes = enhanceImageDataBuffer(
      imgData.data,
      width,
      height,
      mode
    );
    const nextImgData = new ImageData(
      new Uint8ClampedArray(enhancedBytes),
      width,
      height
    );
    ctx.putImageData(nextImgData, 0, 0);

    const enhancedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao codificar imagem melhorada.'));
        },
        'image/png',
        1.0
      );
    });

    const baseName = originalFileName.replace(/\.[^.]+$/, '') || 'imagem';
    const enhancedName = `${baseName}_live_enhanced_${mode}.png`;
    const enhancedFile = new File([enhancedBlob], enhancedName, {
      type: 'image/png',
    });
    const objectUrl = URL.createObjectURL(enhancedBlob);

    return {
      enhancedBlob,
      enhancedFile,
      objectUrl,
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}
