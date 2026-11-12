// Lecture et écriture de PNG sans dépendance (zlib de Node), pour les outils d'interface.
// Lecture : RGBA 8 bits, ou à palette (1, 2, 4 ou 8 bits, transparence tRNS comprise).
// Écriture : toujours en RGBA 8 bits. Image = { width, height, data } (data : RGBA, 4 octets/pixel).
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

/** Annule le filtre PNG d'une ligne (`bpp` : octets par pixel, au moins 1). */
function unfilter(filter, line, previous, bpp) {
  const out = Buffer.alloc(line.length);
  for (let x = 0; x < line.length; x++) {
    const a = x >= bpp ? out[x - bpp] : 0;
    const b = previous ? previous[x] : 0;
    const c = x >= bpp && previous ? previous[x - bpp] : 0;
    let v = line[x];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    out[x] = v & 255;
  }
  return out;
}

export function readPng(file) {
  const buf = readFileSync(file);
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette = null;
  let alphas = null;
  const idat = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) throw new Error(`${file} : PNG entrelacé non géré`);
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') alphas = body;
    else if (type === 'IDAT') idat.push(body);
    pos += 12 + length;
  }
  const rgba = colorType === 6 && depth === 8;
  const indexed = colorType === 3 && palette !== null;
  if (!rgba && !indexed) throw new Error(`${file} : format PNG non géré`);
  const bitsPerPixel = rgba ? 32 : depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel / 8);
  const raw = inflateSync(Buffer.concat(idat));
  const data = Buffer.alloc(width * height * 4);
  let previous = null;
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const line = unfilter(raw[start], raw.subarray(start + 1, start + 1 + stride), previous, bpp);
    previous = line;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (rgba) {
        line.copy(data, o, x * 4, x * 4 + 4);
        continue;
      }
      // Pixel à palette : `depth` bits par pixel, bits de poids fort en premier.
      const bit = x * depth;
      const index = (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      data[o] = palette[index * 3];
      data[o + 1] = palette[index * 3 + 1];
      data[o + 2] = palette[index * 3 + 2];
      data[o + 3] = alphas && index < alphas.length ? alphas[index] : 255;
    }
  }
  return { width, height, data };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([head, typed, crc]);
}

export function writePng(file, { width, height, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits par canal, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

export function crop(image, [x0, y0, w, h]) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * image.width + x0) * 4;
    image.data.copy(data, y * w * 4, from, from + w * 4);
  }
  return { width: w, height: h, data };
}
