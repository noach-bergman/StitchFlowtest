import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode');
const niimLib = require('@mmote/niimbluelib');

const { PacketGenerator, LabelType } = niimLib;

const DOTS_PER_MM = 8;
const B1_PRINTHEAD_PIXELS = 384;
const MIN_LABEL_ROWS = 120;

const FONT_5X7 = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '#': [0x14, 0x7f, 0x14, 0x7f, 0x14],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  '/': [0x20, 0x10, 0x08, 0x04, 0x02],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '?': [0x02, 0x01, 0x59, 0x09, 0x06],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  'A': [0x7e, 0x11, 0x11, 0x11, 0x7e],
  'B': [0x7f, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3e, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7f, 0x41, 0x41, 0x22, 0x1c],
  'E': [0x7f, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7f, 0x09, 0x09, 0x09, 0x01],
  'G': [0x3e, 0x41, 0x49, 0x49, 0x7a],
  'H': [0x7f, 0x08, 0x08, 0x08, 0x7f],
  'I': [0x00, 0x41, 0x7f, 0x41, 0x00],
  'J': [0x20, 0x40, 0x41, 0x3f, 0x01],
  'K': [0x7f, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7f, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  'N': [0x7f, 0x04, 0x08, 0x10, 0x7f],
  'O': [0x3e, 0x41, 0x41, 0x41, 0x3e],
  'P': [0x7f, 0x09, 0x09, 0x09, 0x06],
  'Q': [0x3e, 0x41, 0x51, 0x21, 0x5e],
  'R': [0x7f, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7f, 0x01, 0x01],
  'U': [0x3f, 0x40, 0x40, 0x40, 0x3f],
  'V': [0x1f, 0x20, 0x40, 0x20, 0x1f],
  'W': [0x3f, 0x40, 0x38, 0x40, 0x3f],
  'X': [0x63, 0x14, 0x08, 0x14, 0x63],
  'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
  'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeAscii = (value, fallback = '-') => {
  const text = String(value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  return text || fallback;
};

const toDotWidth = (widthMm = 50) => {
  const raw = Math.max(24, Math.round(widthMm * DOTS_PER_MM));
  const rounded = raw - (raw % 8);
  return Math.min(B1_PRINTHEAD_PIXELS, Math.max(8, rounded));
};

const toDotHeight = (heightMm = 30) => Math.max(MIN_LABEL_ROWS, Math.round(heightMm * DOTS_PER_MM));

const createBitmap = (rows, cols) =>
  Array.from({ length: rows }, () => new Uint8Array(cols));

const setPixel = (bitmap, x, y) => {
  if (y < 0 || y >= bitmap.length || x < 0 || x >= bitmap[0].length) return;
  bitmap[y][x] = 1;
};

const fillRect = (bitmap, x, y, w, h) => {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      setPixel(bitmap, x + col, y + row);
    }
  }
};

const drawGlyph = (bitmap, x, y, glyph, scale = 1) => {
  for (let col = 0; col < glyph.length; col++) {
    const bits = glyph[col];
    for (let row = 0; row < 7; row++) {
      if (((bits >> row) & 1) === 1) {
        fillRect(bitmap, x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
};

const drawTextLine = (bitmap, x, y, text, scale = 2, maxWidth = Infinity) => {
  const spacing = scale;
  let cursorX = x;

  for (const rawChar of text) {
    const char = rawChar in FONT_5X7 ? rawChar : '?';
    const glyph = FONT_5X7[char] || FONT_5X7['?'];
    const glyphWidth = glyph.length * scale;

    if (cursorX + glyphWidth > x + maxWidth) {
      break;
    }

    drawGlyph(bitmap, cursorX, y, glyph, scale);
    cursorX += glyphWidth + spacing;
  }
};

const drawQrCode = (bitmap, content, labelCols, labelRows) => {
  const qr = QRCode.create(content, { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size;
  const quietModules = 2;

  const qrAreaWidth = Math.floor(labelCols * 0.46);
  const qrAreaHeight = labelRows - 16;
  const moduleScale = Math.max(1, Math.floor(Math.min(qrAreaWidth, qrAreaHeight) / (modules + quietModules * 2)));

  const qrPixelSize = (modules + quietModules * 2) * moduleScale;
  const startX = 8;
  const startY = Math.max(0, Math.floor((labelRows - qrPixelSize) / 2));

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.modules.get(col, row)) {
        fillRect(
          bitmap,
          startX + (col + quietModules) * moduleScale,
          startY + (row + quietModules) * moduleScale,
          moduleScale,
          moduleScale,
        );
      }
    }
  }

  return startX + qrPixelSize;
};

const buildBitmapRowsData = (bitmap) => {
  const rows = bitmap.length;
  const cols = bitmap[0].length;
  const rowsData = [];

  const samePixels = (a, b) => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  for (let row = 0; row < rows; row++) {
    const rowData = new Uint8Array(cols / 8);
    let blackPixelsCount = 0;

    for (let oct = 0; oct < cols / 8; oct++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (bitmap[row][oct * 8 + bit]) {
          value |= 1 << (7 - bit);
          blackPixelsCount++;
        }
      }
      rowData[oct] = value;
    }

    const dataType = blackPixelsCount === 0 ? 'void' : 'pixels';
    const current = {
      dataType,
      rowNumber: row,
      repeat: 1,
      blackPixelsCount,
      rowData: dataType === 'pixels' ? rowData : undefined,
    };

    if (rowsData.length === 0) {
      rowsData.push(current);
    } else {
      const prev = rowsData[rowsData.length - 1];
      const sameType = prev.dataType === current.dataType;
      const sameData = current.dataType === 'void' || samePixels(prev.rowData, current.rowData);

      if (sameType && sameData) {
        prev.repeat += 1;
      } else {
        rowsData.push(current);
      }
    }

    if (row % 200 === 199) {
      rowsData.push({
        dataType: 'check',
        rowNumber: row,
        repeat: 0,
        blackPixelsCount: 0,
      });
    }
  }

  return {
    cols,
    rows,
    rowsData,
  };
};

export const buildB1PrintPacketBytes = ({
  displayId,
  clientName,
  itemType,
  widthMm = 50,
  heightMm = 30,
  copies = 1,
}) => {
  const cols = toDotWidth(widthMm);
  const rows = toDotHeight(heightMm);
  const bitmap = createBitmap(rows, cols);

  const rightStartX = drawQrCode(bitmap, normalizeAscii(displayId, '0000'), cols, rows) + 10;
  const rightMaxWidth = cols - rightStartX - 8;

  drawTextLine(bitmap, rightStartX, 20, `#${normalizeAscii(displayId, '0000')}`, 3, rightMaxWidth);
  drawTextLine(bitmap, rightStartX, 98, normalizeAscii(clientName, 'CLIENT'), 2, rightMaxWidth);
  drawTextLine(bitmap, rightStartX, 136, normalizeAscii(itemType, 'ITEM'), 2, rightMaxWidth);

  const encodedImage = buildBitmapRowsData(bitmap);

  const packetObjects = [
    PacketGenerator.connect(),
    PacketGenerator.setDensity(3),
    PacketGenerator.setLabelType(LabelType.WithGaps),
    PacketGenerator.printStart7b(1),
    PacketGenerator.pageStart(),
    PacketGenerator.setPageSize6b(encodedImage.rows, encodedImage.cols, Math.max(1, copies | 0)),
    ...PacketGenerator.writeImageData(encodedImage, { printheadPixels: B1_PRINTHEAD_PIXELS }),
    PacketGenerator.pageEnd(),
    PacketGenerator.printEnd(),
  ];

  return packetObjects.map((packet) => Buffer.from(packet.toBytes()));
};

export const packetDelay = async () => {
  await sleep(14);
};
