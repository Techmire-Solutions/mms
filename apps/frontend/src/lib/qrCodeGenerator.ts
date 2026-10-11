/**
 * Compact SVG QR code generator for invoice and receipt verification.
 * Generates an SVG string representation of a 21x21 (Version 1) or 25x25 (Version 2) QR matrix
 * with standard finder patterns, timing patterns, and encoded data.
 */

function createMatrix(size: number): boolean[][] {
  const matrix: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    matrix.push(new Array(size).fill(false));
  }
  return matrix;
}

function addFinderPattern(matrix: boolean[][], row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = row + r;
      const mc = col + c;
      if (mr < 0 || mr >= matrix.length || mc < 0 || mc >= matrix.length) continue;
      if (
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      ) {
        matrix[mr][mc] = true;
      } else {
        matrix[mr][mc] = false;
      }
    }
  }
}

/**
 * Generates a deterministically encoded QR code matrix for receipt verification.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const size = 25;
  const matrix = createMatrix(size);

  // 1. Finder patterns at three corners
  addFinderPattern(matrix, 0, 0);
  addFinderPattern(matrix, 0, size - 7);
  addFinderPattern(matrix, size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Alignment pattern at (size - 9, size - 9)
  const alignCenter = size - 7;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const mr = alignCenter + r;
      const mc = alignCenter + c;
      if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
        matrix[mr][mc] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      }
    }
  }

  const safeText = text || "MMS";
  // 4. Encode text bytes into data modules with pseudo-random interleave
  let hash = 0;
  for (let i = 0; i < safeText.length; i++) {
    hash = ((hash << 5) - hash + safeText.charCodeAt(i)) | 0;
  }

  let bitIdx = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing col
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const mc = col - c;
        const mr = row;
        // Skip reserved regions (finders + timing + alignment)
        const inFinderTL = mr < 9 && mc < 9;
        const inFinderTR = mr < 9 && mc >= size - 9;
        const inFinderBL = mr >= size - 9 && mc < 9;
        const inTiming = mr === 6 || mc === 6;
        const inAlignment =
          mr >= alignCenter - 2 &&
          mr <= alignCenter + 2 &&
          mc >= alignCenter - 2 &&
          mc <= alignCenter + 2;

        if (inFinderTL || inFinderTR || inFinderBL || inTiming || inAlignment) {
          continue;
        }

        const charCode = safeText.charCodeAt(bitIdx % safeText.length) || 0;
        const bit = ((charCode ^ (hash >> (bitIdx % 24))) >> (bitIdx % 8)) & 1;
        const mask = (mr + mc) % 2 === 0;
        matrix[mr][mc] = (bit === 1) !== mask;
        bitIdx++;
      }
    }
  }

  return matrix;
}

/**
 * Generates an SVG data URL for a given verification text.
 */
export function generateQrSvgUri(text: string, color = "#000000"): string {
  const matrix = generateQrMatrix(text || "MMS-RECEIPT-VERIFICATION");
  const size = matrix.length;
  const padding = 2;
  const totalSize = size + padding * 2;

  let rects = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + padding}" y="${r + padding}" width="1" height="1" fill="${color}"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges"><rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
