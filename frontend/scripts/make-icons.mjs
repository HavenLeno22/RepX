/**
 * Rasterises the RepX app icon into the PNGs a PWA install needs.
 *
 * Written against Node's built-in zlib rather than pulling in sharp or canvas:
 * the icon is a rounded rectangle and a six-point bolt, which is not worth a
 * native image dependency that has to compile on every machine and every CI
 * runner. Everything here is arithmetic and one deflate call.
 *
 *   node scripts/make-icons.mjs
 *
 * Geometry is kept in the same 512-unit space as public/icons/icon.svg so the
 * vector and the rasters cannot drift apart.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/icons');

/* --------------------------------------------------------------- colour -- */

const PAGE = [0x07, 0x08, 0x0c];
const PLATE_TOP = [0x1c, 0x20, 0x29];
const PLATE_BOTTOM = [0x12, 0x14, 0x1b];
const LIME = [0xb6, 0xff, 0x3b];

/** The bolt, in 512-space, matching the `d` attribute in icon.svg. */
const BOLT = [
  [292, 96],
  [168, 280],
  [240, 280],
  [220, 416],
  [344, 232],
  [272, 232],
];

const lerp = (a, b, t) => a + (b - a) * t;

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Signed distance to a rounded rectangle — negative inside. */
function roundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.hypot(dx, dy);
  if (x >= left + radius && x <= right - radius) return (y < top || y > bottom) ? 1 : -1;
  if (y >= top + radius && y <= bottom - radius) return (x < left || x > right) ? 1 : -1;
  return distance - radius;
}

/**
 * Samples one pixel.
 *
 * 3×3 supersampling rather than a real anti-aliasing pass: nine samples is
 * enough to keep the corner radius and the bolt's diagonals from looking
 * stepped at 192px, and the whole image is under half a megapixel.
 */
function sample(px, py, size, inset) {
  const scale = 512 / size;
  let r = 0;
  let g = 0;
  let b = 0;
  const STEPS = 3;

  for (let sy = 0; sy < STEPS; sy++) {
    for (let sx = 0; sx < STEPS; sx++) {
      // Map back into 512-space, undoing the maskable inset.
      const ux = ((px + (sx + 0.5) / STEPS) * scale - inset) / (1 - (inset * 2) / 512);
      const uy = ((py + (sy + 0.5) / STEPS) * scale - inset) / (1 - (inset * 2) / 512);

      let colour = PAGE;
      if (roundedRect(ux, uy, 16, 16, 496, 496, 98) < 0) {
        const t = Math.max(0, Math.min(1, (uy - 16) / 480));
        colour = [
          lerp(PLATE_TOP[0], PLATE_BOTTOM[0], t),
          lerp(PLATE_TOP[1], PLATE_BOTTOM[1], t),
          lerp(PLATE_TOP[2], PLATE_BOTTOM[2], t),
        ];
      }
      if (insidePolygon(ux, uy, BOLT)) colour = LIME;

      r += colour[0];
      g += colour[1];
      b += colour[2];
    }
  }

  const n = STEPS * STEPS;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/* ------------------------------------------------------------------ png -- */

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  // Each scanline is prefixed with its filter byte; 0 means "none", which keeps
  // the encoder trivial and costs a few kilobytes deflate mostly wins back.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      raw[offset++] = pixels[i];
      raw[offset++] = pixels[i + 1];
      raw[offset++] = pixels[i + 2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(size, { inset = 0 } = {}) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = sample(x, y, size, inset);
      const i = (y * size + x) * 3;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['apple-touch-icon.png', 180, {}],
  // Maskable icons get cropped to whatever shape the launcher likes, so the
  // artwork is inset into the guaranteed-safe centre 80%.
  ['maskable-512.png', 512, { inset: 52 }],
];

for (const [name, size, options] of targets) {
  const png = render(size, options);
  writeFileSync(resolve(OUT, name), png);
  console.log(`${name.padEnd(22)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
