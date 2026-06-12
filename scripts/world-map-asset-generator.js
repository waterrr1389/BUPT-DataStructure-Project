#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const WORLD_MAP_ASSET_CONTRACT = {
  assetPath: "public/assets/world-map/atlas-boston-inspired-v1.png",
  height: 3072,
  seed: 4217,
  textCommandsAllowed: false,
  allowedTraceTypes: ["base-gradient", "polygon", "ellipse", "line", "speckle", "contour", "grain"],
  forbiddenTraceTypes: ["text", "label", "font", "glyph", "caption", "marker-label"],
  width: 4096,
};

function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hexToRgb(value) {
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function mixRgb(a, b, amount) {
  const inverse = 1 - amount;
  return [
    Math.round(a[0] * inverse + b[0] * amount),
    Math.round(a[1] * inverse + b[1] * amount),
    Math.round(a[2] * inverse + b[2] * amount),
  ];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function setPixel(buffer, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= WORLD_MAP_ASSET_CONTRACT.height) {
    return;
  }
  const offset = (y * width + x) * 3;
  buffer[offset] = color[0];
  buffer[offset + 1] = color[1];
  buffer[offset + 2] = color[2];
}

function blendPixel(buffer, width, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= WORLD_MAP_ASSET_CONTRACT.height) {
    return;
  }
  const offset = (y * width + x) * 3;
  const inverse = 1 - alpha;
  buffer[offset] = clampByte(buffer[offset] * inverse + color[0] * alpha);
  buffer[offset + 1] = clampByte(buffer[offset + 1] * inverse + color[1] * alpha);
  buffer[offset + 2] = clampByte(buffer[offset + 2] * inverse + color[2] * alpha);
}

function drawPolygon(buffer, width, points, color, trace, alpha = 1) {
  trace.push({ type: "polygon", alpha, points: points.length });
  const fill = hexToRgb(color);
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(WORLD_MAP_ASSET_CONTRACT.height - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const y1 = current[1];
      const y2 = next[1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const ratio = (y - y1) / (y2 - y1);
        intersections.push(current[0] + ratio * (next[0] - current[0]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const startX = Math.max(0, Math.ceil(intersections[index]));
      const endX = Math.min(width - 1, Math.floor(intersections[index + 1]));
      for (let x = startX; x <= endX; x += 1) {
        if (alpha >= 1) {
          setPixel(buffer, width, x, y, fill);
        } else {
          blendPixel(buffer, width, x, y, fill, alpha);
        }
      }
    }
  }
}

function drawEllipse(buffer, width, cx, cy, rx, ry, color, alpha, trace) {
  trace.push({ type: "ellipse", alpha, rx, ry });
  const fill = hexToRgb(color);
  const minX = Math.max(0, Math.floor(cx - rx));
  const maxX = Math.min(width - 1, Math.ceil(cx + rx));
  const minY = Math.max(0, Math.floor(cy - ry));
  const maxY = Math.min(WORLD_MAP_ASSET_CONTRACT.height - 1, Math.ceil(cy + ry));
  const rxSquared = rx * rx;
  const rySquared = ry * ry;

  for (let y = minY; y <= maxY; y += 1) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      if ((dx * dx) / rxSquared + (dy * dy) / rySquared <= 1) {
        blendPixel(buffer, width, x, y, fill, alpha);
      }
    }
  }
}

function drawLine(buffer, width, points, color, lineWidth, alpha, trace) {
  trace.push({ type: "line", points: points.length, width: lineWidth });
  const fill = hexToRgb(color);
  const radius = lineWidth / 2;
  const radiusSquared = radius * radius;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2) + radius));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius));
    const maxY = Math.min(WORLD_MAP_ASSET_CONTRACT.height - 1, Math.ceil(Math.max(y1, y2) + radius));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy || 1;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const ratio = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
        const px = x1 + ratio * dx;
        const py = y1 + ratio * dy;
        const distanceSquared = (x - px) * (x - px) + (y - py) * (y - py);
        if (distanceSquared <= radiusSquared) {
          blendPixel(buffer, width, x, y, fill, alpha);
        }
      }
    }
  }
}

function addSpeckles(buffer, width, polygon, count, colors, trace, rng) {
  trace.push({ type: "speckle", count });
  const minX = Math.floor(Math.min(...polygon.map((point) => point[0])));
  const maxX = Math.ceil(Math.max(...polygon.map((point) => point[0])));
  const minY = Math.floor(Math.min(...polygon.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...polygon.map((point) => point[1])));

  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(minX + rng() * (maxX - minX));
    const y = Math.floor(minY + rng() * (maxY - minY));
    const rx = 8 + Math.floor(rng() * 26);
    const ry = 6 + Math.floor(rng() * 22);
    const color = colors[Math.floor(rng() * colors.length)];
    drawEllipse(buffer, width, x, y, rx, ry, color, 0.15 + rng() * 0.12, trace);
  }
}

function addGrain(buffer, width, height, trace, rng) {
  trace.push({ type: "grain", density: 0.006 });
  for (let offset = 0; offset < buffer.length; offset += 3) {
    if (rng() >= 0.006) {
      continue;
    }
    const delta = Math.floor(rng() * 9) - 4;
    buffer[offset] = clampByte(buffer[offset] + delta);
    buffer[offset + 1] = clampByte(buffer[offset + 1] + delta);
    buffer[offset + 2] = clampByte(buffer[offset + 2] + delta);
  }
}

function createBase(width, height, trace) {
  trace.push({ type: "base-gradient", width, height });
  const buffer = Buffer.alloc(width * height * 3);
  const top = hexToRgb("#f7fbf8");
  const bottom = hexToRgb("#edf6ef");
  const cool = hexToRgb("#e9f6fb");

  for (let y = 0; y < height; y += 1) {
    const vertical = y / (height - 1);
    const rowColor = mixRgb(top, bottom, vertical);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const wave = (Math.sin(x * 0.0018 + y * 0.0014) + 1) * 0.018;
      const color = mixRgb(rowColor, cool, wave);
      buffer[offset] = color[0];
      buffer[offset + 1] = color[1];
      buffer[offset + 2] = color[2];
    }
  }
  return buffer;
}

function writeUInt32(buffer, offset, value) {
  buffer[offset] = (value >>> 24) & 0xff;
  buffer[offset + 1] = (value >>> 16) & 0xff;
  buffer[offset + 2] = (value >>> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrcTable();

function crc32(content) {
  let crc = 0xffffffff;
  for (let index = 0; index < content.length; index += 1) {
    crc = CRC_TABLE[(crc ^ content[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  writeUInt32(chunk, 0, data.length);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  const crcContent = Buffer.concat([typeBuffer, data]);
  writeUInt32(chunk, 8 + data.length, crc32(crcContent));
  return chunk;
}

function encodePng(width, height, pixels) {
  const rowLength = width * 3;
  const raw = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (rowLength + 1);
    raw[rawOffset] = 0;
    pixels.copy(raw, rawOffset + 1, y * rowLength, (y + 1) * rowLength);
  }

  const ihdr = Buffer.alloc(13);
  writeUInt32(ihdr, 0, width);
  writeUInt32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createWorldMapPng() {
  const { width, height, seed } = WORLD_MAP_ASSET_CONTRACT;
  const rng = createRng(seed);
  const trace = [];
  const buffer = createBase(width, height, trace);

  const landBands = [
    {
      alpha: 0.42,
      color: "#f3efe4",
      points: [[1300, 110], [2770, 150], [2950, 820], [1780, 910], [1370, 570]],
    },
    {
      alpha: 0.38,
      color: "#edf5e7",
      points: [[390, 420], [1790, 490], [2030, 1320], [820, 1440], [380, 960]],
    },
    {
      alpha: 0.36,
      color: "#f1eadc",
      points: [[60, 1040], [1340, 930], [1580, 2180], [210, 2420]],
    },
    {
      alpha: 0.34,
      color: "#eef4e9",
      points: [[1600, 930], [2410, 900], [2550, 2390], [1700, 2360]],
    },
    {
      alpha: 0.36,
      color: "#f4eadc",
      points: [[2780, 650], [3920, 690], [3820, 1630], [2960, 1570], [2670, 1030]],
    },
    {
      alpha: 0.34,
      color: "#f1eee1",
      points: [[2540, 1730], [3780, 1830], [3670, 2830], [2450, 2690]],
    },
  ];

  landBands.forEach((shape) => {
    drawPolygon(buffer, width, shape.points, shape.color, trace, shape.alpha);
  });

  const waterShapes = [
    {
      alpha: 0.9,
      color: "#cfeaf0",
      points: [[0, 650], [420, 625], [780, 705], [1120, 650], [1480, 730], [1840, 830], [2180, 865], [2480, 785], [2790, 700], [3200, 700], [4096, 760], [4096, 1110], [3400, 1075], [2990, 1125], [2600, 1115], [2250, 1020], [1870, 1085], [1510, 1020], [1160, 940], [760, 1040], [390, 960], [0, 980]],
    },
    {
      alpha: 0.88,
      color: "#bfdfe8",
      points: [[2920, 560], [4096, 610], [4096, 1780], [3560, 1700], [3330, 1490], [3090, 1530], [2860, 1320], [2760, 940]],
    },
    {
      alpha: 0.86,
      color: "#c7e7ef",
      points: [[2500, 1710], [4096, 1740], [4096, 3072], [2320, 3072], [2380, 2580], [2620, 2310], [2460, 2020]],
    },
    {
      alpha: 0.54,
      color: "#e0f3f6",
      points: [[3040, 1260], [3460, 1180], [3740, 1320], [3630, 1570], [3240, 1540]],
    },
    {
      alpha: 0.5,
      color: "#e0f3f6",
      points: [[2680, 1960], [3100, 1860], [3360, 2040], [3180, 2360], [2760, 2290]],
    },
    {
      alpha: 0.48,
      color: "#e0f3f6",
      points: [[3400, 2200], [3850, 2120], [4096, 2360], [4096, 2730], [3550, 2640]],
    },
  ];

  [
    [[650, 1310], [910, 1240], [1100, 1440], [1020, 1720], [720, 1770], [540, 1540]],
    [[1780, 1500], [2130, 1390], [2360, 1660], [2260, 2020], [1850, 2070], [1680, 1780]],
    [[2920, 2030], [3290, 1970], [3480, 2230], [3300, 2510], [2920, 2430]],
    [[1640, 310], [2050, 290], [2210, 560], [1880, 710], [1590, 540]],
  ].forEach((park) => {
    drawPolygon(buffer, width, park, "#a9d29c", trace, 0.68);
  });

  waterShapes.forEach((shape) => {
    drawPolygon(buffer, width, shape.points, shape.color, trace, shape.alpha);
    drawLine(buffer, width, shape.points.concat([shape.points[0]]), "#ffffff", 16, 0.48, trace);
    drawLine(buffer, width, shape.points.concat([shape.points[0]]), "#8abfcc", 4, 0.18, trace);
  });

  [
    [[1380, 220], [2800, 760], -8, "#c8d0c6"],
    [[520, 590], [1880, 1300], 10, "#cbd8c7"],
    [[250, 1110], [1370, 2240], -12, "#d6d0c5"],
    [[1720, 1000], [2420, 2260], 4, "#cbd8c8"],
    [[2860, 780], [3760, 1520], 13, "#d2d0c5"],
    [[2600, 1880], [3640, 2680], 8, "#d0d8d2"],
  ].forEach(([[x0, y0], [x1, y1], angle, color]) => {
    const skew = Math.tan((angle * Math.PI) / 180);
    for (let x = x0; x <= x1; x += 260) {
      drawLine(buffer, width, [[x, y0], [x + skew * (y1 - y0), y1]], color, 3, 0.11, trace);
    }
    for (let y = y0; y <= y1; y += 260) {
      drawLine(buffer, width, [[x0, y], [x1, y + skew * 80]], color, 2, 0.1, trace);
    }
  });

  [
    [[1680, 1180], [1820, 1060], [1960, 1030], [2120, 1110]],
    [[2390, 930], [2520, 890], [2700, 930], [2870, 1030]],
  ].forEach((causeway) => {
    drawLine(buffer, width, causeway, "#f6ead5", 22, 0.42, trace);
    drawLine(buffer, width, causeway, "#d8a165", 4, 0.24, trace);
  });

  for (let y = 360; y < height; y += 360) {
    const points = [];
    for (let x = 0; x <= width + 160; x += 160) {
      points.push([x, y + Math.sin((x + y) * 0.0035) * 16]);
    }
    trace.push({ type: "contour", points: points.length });
    drawLine(buffer, width, points, "#9bb7b5", 2, 0.06, trace);
  }

  addGrain(buffer, width, height, trace, rng);

  return {
    buffer: encodePng(width, height, buffer),
    trace,
  };
}

function main() {
  const outputPath = path.join(__dirname, "..", WORLD_MAP_ASSET_CONTRACT.assetPath);
  const generated = createWorldMapPng();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generated.buffer);
  process.stdout.write(`${outputPath}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  WORLD_MAP_ASSET_CONTRACT,
  createWorldMapPng,
};
