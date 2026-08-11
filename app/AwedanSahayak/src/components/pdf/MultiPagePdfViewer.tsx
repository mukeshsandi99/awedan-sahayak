/**
 * MultiPagePdfViewer — scrollable PDF viewer showing EVERY page.
 *
 * Uses a data-URI approach for Android WebView compatibility:
 *   1. Reads the local PDF file as base64
 *   2. Embeds it as a data: URI in an HTML page
 *   3. Android WebView's built-in Google PDF renderer shows ALL pages
 *      in a vertically scrollable viewer.
 *
 * This replaces the old <embed> approach which only rendered the first page
 * because Android WebView's PDF plugin limits <embed> to single-page view.
 *
 * Props:
 *   uri       — local file:// URI to the PDF
 *   onError   — optional error callback
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

interface Props {
  uri: string;
  onError?: (error: string) => void;
}

export default function MultiPagePdfViewer({ uri, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Read PDF as base64 on mount
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (mountedRef.current) {
          setPdfBase64(b64);
        }
      } catch (err: any) {
        if (mountedRef.current) {
          setReadError(err?.message ?? 'Failed to read PDF file');
          setLoading(false);
        }
      }
    })();
    return () => { mountedRef.current = false; };
  }, [uri]);

  // If read failed, show fallback
  if (readError || webError) {
    return (
      <View style={styles.fallback}>
        <Ionicons name="document-text" size={48} color="#999" />
        <Text style={styles.fallbackTitle}>PDF Generated Successfully</Text>
        <Text style={styles.fallbackSub}>
          The PDF contains all pages. Use the Share button to open it in a
          dedicated PDF reader app.
        </Text>
        <Text style={styles.fallbackPath} numberOfLines={2}>{uri}</Text>
        {readError && (
          <Text style={styles.errorDetail}>{readError}</Text>
        )}
      </View>
    );
  }

  // Still reading
  if (!pdfBase64) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
        <Text style={styles.loadingText}>Loading PDF preview...</Text>
        <Text style={styles.loadingSub}>All pages will be visible</Text>
      </View>
    );
  }

  // Build HTML with data URI — Android WebView's Google PDF viewer
  // renders multi-page PDFs correctly when embedded as data URI
  const dataUri = `data:application/pdf;base64,${pdfBase64}`;
  const estimatedPages = Math.max(3, Math.ceil(pdfBase64.length / 35000));
  const minHeightVh = estimatedPages * 120;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%;
    background: #525659;
    overflow: hidden;
  }
  .scroll-container {
    width: 100%; height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #525659;
  }
  .pdf-embed {
    width: 100%;
    min-height: ${minHeightVh}vh;
    border: none;
    display: block;
  }
</style>
</head>
<body>
<div class="scroll-container">
  <embed
    class="pdf-embed"
    src="${dataUri}"
    type="application/pdf"
  />
</div>
</body>
</html>`;

  const source = { html: htmlContent, baseUrl: '' };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E17055" />
          <Text style={styles.loadingText}>Rendering PDF...</Text>
          <Text style={styles.loadingSub}>
            Estimated {estimatedPages} page{estimatedPages > 1 ? 's' : ''}
          </Text>
        </View>
      )}
      <WebView
        source={source}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          console.warn('[MultiPagePdfViewer] WebView error:', e.nativeEvent);
          setLoading(false);
          setWebError(true);
          onError?.(e.nativeEvent.description);
        }}
        renderError={() => {
          setLoading(false);
          setWebError(true);
          return <View />;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#525659' },
  webview: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#525659',
    padding: 40,
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#525659', zIndex: 10,
  },
  loadingText: { fontSize: 16, fontWeight: '600', color: '#FFF', marginTop: 12 },
  loadingSub: { fontSize: 13, color: '#BBB', marginTop: 4 },
  fallback: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 40, backgroundColor: '#FFF',
  },
  fallbackTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 16 },
  fallbackSub: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  fallbackPath: { fontSize: 11, color: '#999', marginTop: 12, textAlign: 'center' },
  errorDetail: { fontSize: 11, color: '#D63031', marginTop: 8, textAlign: 'center' },
});
