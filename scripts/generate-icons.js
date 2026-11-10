import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function createPNG(size, isMaskable = false) {
  const width = size;
  const height = size;
  const scanlines = [];

  const cx = width / 2;
  const cy = height / 2;
  const circleRadius = width * 0.46;
  const starRadius = width * 0.32;

  // Colors
  const rose = [217, 165, 174, 255]; // #D9A5AE
  const cream = [251, 246, 243, 255]; // #FBF6F3
  const white = [255, 253, 251, 255]; // #FFFDFB

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      const inCircle = isMaskable || dist <= circleRadius;

      if (inCircle) {
        // Base rose
        r = rose[0];
        g = rose[1];
        b = rose[2];
        a = 255;

        // Astroid / 4-point sparkle equation: (|dx|/R)^0.5 + (|dy|/R)^0.5 <= 1
        const nx = Math.abs(dx) / starRadius;
        const ny = Math.abs(dy) / starRadius;
        const starVal = Math.sqrt(nx) + Math.sqrt(ny);

        if (dist <= width * 0.04) {
          // Inner center light
          r = white[0];
          g = white[1];
          b = white[2];
        } else if (starVal <= 1.0) {
          // Four-point sparkle
          r = cream[0];
          g = cream[1];
          b = cream[2];
        }
      } else if (!isMaskable) {
        // Transparent outside circle
        r = 0; g = 0; b = 0; a = 0;
      }

      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    scanlines.push(row);
  }

  const rawData = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPNG(512, false));
fs.writeFileSync(path.join(outDir, 'icon-512-maskable.png'), createPNG(512, true));
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPNG(192, false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPNG(180, false));

console.log('App icons generated successfully in public/');
