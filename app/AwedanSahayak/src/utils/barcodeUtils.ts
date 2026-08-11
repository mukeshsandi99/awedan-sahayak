/**
 * Barcode utilities — type detection, dangerous URI blocking.
 */

/** Detect barcode format from scanned raw value. */
export function detectBarcodeType(value: string): string {
  if (/^https?:\/\//i.test(value)) return 'url';
  if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(value)) return 'upi';
  if (/^[6-9]\d{9}$/.test(value.replace(/[\s\-+]/g, ''))) return 'phone';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
  if (/^WIFI:/i.test(value)) return 'wifi';
  if (/^\d{12,13}$/.test(value)) return 'ean13';
  if (/^\d{7,8}$/.test(value)) return 'ean8';
  return 'text';
}

/** Block dangerous URI schemes. Returns true if blocked. */
export function isDangerousUri(value: string): boolean {
  const blocked = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
  const lower = value.toLowerCase().trim();
  return blocked.some((s) => lower.startsWith(s));
}

/** Get a human-readable label for a barcode type. */
export function barcodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    url: 'URL लिंक', upi: 'UPI ID', phone: 'फ़ोन नंबर',
    email: 'ईमेल', wifi: 'Wi-Fi', text: 'टेक्स्ट',
    qr: 'QR कोड', code128: 'Code 128', code39: 'Code 39',
    ean13: 'EAN-13', ean8: 'EAN-8', upc_a: 'UPC-A',
    pdf417: 'PDF417', aztec: 'Aztec', data_matrix: 'Data Matrix',
  };
  return labels[type] ?? type.toUpperCase();
}

/** Map expo-camera barcode type to our label. */
export function mapExpoBarcodeType(expType: string): string {
  const map: Record<string, string> = {
    qr: 'qr', code128: 'code128', code39: 'code39',
    ean13: 'ean13', ean8: 'ean8', upc_e: 'upc_a',
    pdf417: 'pdf417', aztec: 'aztec', datamatrix: 'data_matrix',
  };
  return map[expType] ?? expType;
}
