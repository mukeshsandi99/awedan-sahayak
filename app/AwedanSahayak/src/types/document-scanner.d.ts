declare module '@dariyd/react-native-document-scanner' {
  export interface ImageObject {
    uri: string;
    width?: number;
    height?: number;
    base64?: string;
    exif?: any;
  }

  export interface ScanOptions {
    quality?: number;
    includeBase64?: boolean;
    includeExif?: boolean;
    includeLocationExif?: boolean;
  }

  export interface ScanResult {
    error?: boolean;
    errorMessage?: string;
    didCancel?: boolean;
    images?: ImageObject[];
  }

  export function launchScanner(options?: ScanOptions): Promise<ScanResult>;
}
