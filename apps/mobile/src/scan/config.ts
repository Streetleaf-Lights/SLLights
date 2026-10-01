import type { BarcodeType } from "expo-camera";

/**
 * Symbologies the scanner looks for. Fewer types = faster, fewer false
 * reads. ASSUMPTION: pole tags are QR or Code 128/39 (Data Matrix kept for
 * small engraved tags). Trim this once the real tag format is confirmed.
 */
export const SCAN_BARCODE_TYPES: BarcodeType[] = ["qr", "code128", "code39", "datamatrix"];
