import type { BarcodeType } from "expo-camera";

/**
 * Symbologies the scanner listens for: the common 1D and 2D formats used on
 * product and serial stickers. Only the barcode inside the on-screen frame
 * is accepted (see scanFrame.ts), so listening broadly doesn't cause wrong
 * reads — it means a sticker's second barcode isn't missed for being a
 * format we weren't listening for.
 */
export const SCAN_BARCODE_TYPES: BarcodeType[] = [
  "code128",
  "code39",
  "code93",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "itf14",
  "codabar",
  "qr",
  "datamatrix",
  "pdf417",
  "aztec",
];
