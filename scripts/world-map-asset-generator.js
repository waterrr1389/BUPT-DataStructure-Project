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

function drawPolygon(buffer, width, points, color, trace) {
  trace.push({ type: "polygon", points: points.length });
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
        setPixel(buffer, width, x, y, fill);
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
  trace.push({ type: "grain", density: 0.018 });
  for (let offset = 0; offset < buffer.length; offset += 3) {
    if (rng() >= 0.018) {
      continue;
    }
    const delta = Math.floor(rng() * 17) - 8;
    buffer[offset] = clampByte(buffer[offset] + delta);
    buffer[offset + 1] = clampByte(buffer[offset + 1] + delta);
    buffer[offset + 2] = clampByte(buffer[offset + 2] + delta);
  }
}

function createBase(width, height, trace) {
  trace.push({ type: "base-gradient", width, height });
  const buffer = Buffer.alloc(width * height * 3);
  const top = hexToRgb("#d6c897");
  const bottom = hexToRgb("#bfa976");
  const cool = hexToRgb("#9cb6ad");

  for (let y = 0; y < height; y += 1) {
    const vertical = y / (height - 1);
    const rowColor = mixRgb(top, bottom, vertical);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const wave = (Math.sin(x * 0.0035 + y * 0.002) + 1) * 0.035;
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

  const waterShapes = [
    {
      color: "#6fa5b6",
      points: [[0, 640], [420, 620], [760, 700], [1110, 650], [1460, 720], [1840, 820], [2180, 860], [2470, 780], [2780, 700], [3180, 690], [4096, 760], [4096, 1130], [3380, 1070], [2980, 1120], [2600, 1110], [2250, 1010], [1860, 1080], [1510, 1010], [1160, 930], [760, 1040], [390, 950], [0, 980]],
    },
    {
      color: "#5d97aa",
      points: [[2920, 560], [4096, 610], [4096, 1810], [3560, 1710], [3330, 1490], [3090, 1530], [2860, 1320], [2760, 940]],
    },
    {
      color: "#77a9b7",
      points: [[2500, 1700], [4096, 1740], [4096, 3072], [2320, 3072], [2380, 2580], [2620, 2310], [2460, 2020]],
    },
    {
      color: "#8bb9c3",
      points: [[3040, 1260], [3460, 1180], [3740, 1320], [3630, 1570], [3240, 1540]],
    },
    {
      color: "#8bb9c3",
      points: [[2680, 1960], [3100, 1860], [3360, 2040], [3180, 2360], [2760, 2290]],
    },
    {
      color: "#8bb9c3",
      points: [[3400, 2200], [3850, 2120], [4096, 2360], [4096, 2730], [3550, 2640]],
    },
  ];

  const districts = [
    { color: "#c6b987", points: [[1420, 160], [2700, 190], [2890, 790], [1740, 890], [1400, 540]] },
    { color: "#b7c08c", points: [[560, 480], [1840, 520], [1990, 1330], [900, 1420], [540, 990]] },
    { color: "#b8a77b", points: [[170, 1040], [1270, 950], [1490, 2200], [270, 2460]] },
    { color: "#b9c28b", points: [[1570, 930], [2380, 910], [2520, 2410], [1680, 2370]] },
    { color: "#c3ae7d", points: [[2780, 650], [3870, 700], [3760, 1660], [2940, 1590], [2680, 1040]] },
    { color: "#cdb27e", points: [[2560, 1740], [3740, 1810], [3650, 2810], [2450, 2680]] },
  ];

  waterShapes.forEach((shape) => drawPolygon(buffer, width, shape.points, shape.color, trace));
  districts.forEach((shape) => {
    drawPolygon(buffer, width, shape.points, shape.color, trace);
    addSpeckles(buffer, width, shape.points, 120, ["#ffffff", "#52603e", "#7b633e"], trace, rng);
  });

  [
    [[650, 1310], [910, 1240], [1100, 1440], [1020, 1720], [720, 1770], [540, 1540]],
    [[1790, 1510], [2130, 1390], [2360, 1660], [2260, 2020], [1850, 2070], [1680, 1780]],
    [[2920, 2030], [3290, 1970], [3480, 2230], [3300, 2510], [2920, 2430]],
    [[1640, 310], [2050, 290], [2210, 560], [1880, 710], [1590, 540]],
  ].forEach((park) => {
    drawPolygon(buffer, width, park, "#7f985f", trace);
    addSpeckles(buffer, width, park, 55, ["#6e874f", "#91a96d", "#5f7747"], trace, rng);
  });

  const districtGridLines = [
    [[1500, 250], [2760, 850], -8, "#9b8a67"],
    [[630, 620], [1900, 1330], 10, "#8f8f72"],
    [[260, 1120], [1350, 2290], -12, "#937f61"],
    [[1710, 1010], [2420, 2290], 4, "#81906e"],
    [[2860, 780], [3740, 1540], 14, "#9a8060"],
    [[2600, 1860], [3640, 2670], 8, "#9d815a"],
  ];
  districtGridLines.forEach(([[x0, y0], [x1, y1], angle, color]) => {
    const skew = Math.tan((angle * Math.PI) / 180);
    for (let x = x0; x <= x1; x += 115) {
      drawLine(buffer, width, [[x, y0], [x + skew * (y1 - y0), y1]], color, 5, 0.44, trace);
    }
    for (let y = y0; y <= y1; y += 120) {
      drawLine(buffer, width, [[x0, y], [x1, y + skew * 90]], color, 4, 0.36, trace);
    }
  });

  const routes = [
    { color: "#e7d6a8", lineWidth: 28, points: [[780, 1700], [1680, 1180], [2050, 1580], [2580, 2040], [3050, 2200], [3320, 2360]] },
    { color: "#e7d6a8", lineWidth: 24, points: [[2120, 520], [2390, 930], [2050, 1580], [1860, 1870], [2190, 2060]] },
    { color: "#e7d6a8", lineWidth: 24, points: [[1360, 940], [1680, 1180], [2390, 930], [3200, 1120], [3440, 1310]] },
    { color: "#c3c0b6", lineWidth: 22, points: [[2050, 1580], [2590, 1360], [3200, 1120], [3010, 930]] },
    { color: "#6d6d70", lineWidth: 18, points: [[780, 1700], [1680, 1180], [1360, 940]] },
    { color: "#99b772", lineWidth: 16, points: [[2120, 520], [1360, 940], [1100, 820], [1560, 1110]] },
  ];
  routes.forEach((route) => {
    drawLine(buffer, width, route.points, route.color, route.lineWidth, 0.88, trace);
    drawLine(buffer, width, route.points, "#6f5f48", Math.max(3, Math.floor(route.lineWidth / 4)), 0.22, trace);
  });

  [
    [[1680, 1180], [1820, 1060], [1960, 1030], [2120, 1110]],
    [[2390, 930], [2520, 890], [2700, 930], [2870, 1030]],
  ].forEach((bridge) => {
    drawLine(buffer, width, bridge, "#d69a59", 34, 0.9, trace);
    drawLine(buffer, width, bridge, "#fff0c8", 16, 0.95, trace);
  });

  for (let y = 360; y < height; y += 260) {
    const points = [];
    for (let x = 0; x <= width + 120; x += 120) {
      points.push([x, y + Math.sin((x + y) * 0.004) * 22]);
    }
    trace.push({ type: "contour", points: points.length });
    drawLine(buffer, width, points, "#5c6950", 3, 0.14, trace);
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
