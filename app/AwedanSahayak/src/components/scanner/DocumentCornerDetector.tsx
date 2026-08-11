/**
 * DocumentCornerDetector — edge detection + manual corner adjustment.
 *
 * Flow:
 *   1. Auto-detect document corners via WebView canvas edge-detection.
 *   2. Show draggable corner handles for manual adjustment.
 *   3. Returns final 4-corner coordinates relative to the image.
 *
 * Corner order: topLeft, topRight, bottomRight, bottomLeft
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, Dimensions, TouchableOpacity,
  ActivityIndicator, PanResponder, GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

// ── Types ───────────────────────────────────────────────────────────────

export interface Corners {
  topLeft:     { x: number; y: number };
  topRight:    { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft:  { x: number; y: number };
}

interface Props {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCornersDetected?: (corners: Corners) => void;
  onConfirm: (corners: Corners) => void;
  onCancel: () => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const HANDLE_SIZE = 32;

// ── Component ───────────────────────────────────────────────────────────

export default function DocumentCornerDetector({
  imageUri, imageWidth, imageHeight,
  onCornersDetected, onConfirm, onCancel,
}: Props) {
  const displayW = SCREEN_W - 32;
  const scale = displayW / imageWidth;
  const displayH = imageHeight * scale;

  // Default corners: 15% inset from edges
  const marginX = imageWidth * 0.08;
  const marginY = imageHeight * 0.08;
  const [corners, setCorners] = useState<Corners>({
    topLeft:     { x: marginX, y: marginY },
    topRight:    { x: imageWidth - marginX, y: marginY },
    bottomRight: { x: imageWidth - marginX, y: imageHeight - marginY },
    bottomLeft:  { x: marginX, y: imageHeight - marginY },
  });
  const [autoDetected, setAutoDetected] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [activeCorner, setActiveCorner] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const detectionDone = useRef(false);

  // Convert image coords → display coords
  const toDisplay = useCallback((pt: { x: number; y: number }) => ({
    x: pt.x * scale,
    y: pt.y * scale,
  }), [scale]);

  // Handle WebView message with detected corners
  const handleWebMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'corners' && data.corners && !detectionDone.current) {
        detectionDone.current = true;
        const c = data.corners;
        const detected: Corners = {
          topLeft:     { x: c[0][0], y: c[0][1] },
          topRight:    { x: c[1][0], y: c[1][1] },
          bottomRight: { x: c[2][0], y: c[2][1] },
          bottomLeft:  { x: c[3][0], y: c[3][1] },
        };
        setCorners(detected);
        setAutoDetected(true);
        setDetecting(false);
        onCornersDetected?.(detected);
      }
      if (data.type === 'no_document') {
        setDetecting(false);
      }
    } catch {}
  }, [onCornersDetected]);

  // Auto-detect HTML/JS (runs in WebView)
  const detectHtml = `
<!DOCTYPE html><html><head><meta name="viewport" content="width=${imageWidth},initial-scale=1">
<style>body{margin:0;background:#000;}canvas{display:block;}</style></head><body>
<canvas id="c" width="${imageWidth}" height="${imageHeight}"></canvas>
<img id="img" src="${imageUri}" style="display:none"
  onload="detectDocument()" onerror="noDoc()" />
<script>
const img = document.getElementById('img');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function noDoc() {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'no_document'}));
}

function detectDocument() {
  try {
    ctx.drawImage(img, 0, 0, ${imageWidth}, ${imageHeight});
    const imageData = ctx.getImageData(0, 0, ${imageWidth}, ${imageHeight});
    const gray = new Uint8Array(${imageWidth} * ${imageHeight});

    // 1. Convert to grayscale
    for (let i = 0; i < gray.length; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // 2. Simple adaptive threshold: compare each pixel to local mean
    const w = ${imageWidth}, h = ${imageHeight};
    const binary = new Uint8Array(w * h);
    const windowSize = Math.max(8, Math.floor(Math.min(w, h) / 60));
    for (let y = windowSize; y < h - windowSize; y++) {
      for (let x = windowSize; x < w - windowSize; x++) {
        let sum = 0, count = 0;
        for (let dy = -windowSize; dy <= windowSize; dy++) {
          for (let dx = -windowSize; dx <= windowSize; dx++) {
            sum += gray[(y + dy) * w + (x + dx)];
            count++;
          }
        }
        const mean = sum / count;
        binary[y * w + x] = gray[y * w + x] < mean - 10 ? 0 : 255;
      }
    }

    // 3. Find extreme dark pixels in each quadrant
    const qW = Math.floor(w / 2), qH = Math.floor(h / 2);
    let tl = null, tr = null, br = null, bl = null;
    let tlBest = Infinity, trBest = Infinity, brBest = Infinity, blBest = Infinity;

    for (let y = 8; y < h - 8; y++) {
      for (let x = 8; x < w - 8; x++) {
        if (binary[y * w + x] !== 0) continue;
        const distTL = x + y;
        const distTR = (w - x) + y;
        const distBR = (w - x) + (h - y);
        const distBL = x + (h - y);

        if (x < qW && y < qH && distTL < tlBest) { tlBest = distTL; tl = [x, y]; }
        if (x > qW && y < qH && distTR < trBest) { trBest = distTR; tr = [x, y]; }
        if (x > qW && y > qH && distBR < brBest) { brBest = distBR; br = [x, y]; }
        if (x < qW && y > qH && distBL < blBest) { blBest = distBL; bl = [x, y]; }
      }
    }

    // 4. If all 4 corners found with reasonable spread, use them
    const margin = Math.floor(Math.min(w, h) * 0.05);
    if (tl && tr && br && bl) {
      // Ensure corners aren't too close to each other
      const spread = Math.abs(tl[0] - tr[0]) + Math.abs(tl[1] - bl[1]);
      if (spread > Math.min(w, h) * 0.5) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'corners',
          corners: [tl, tr, br, bl]
        }));
        return;
      }
    }

    // Fallback: default inset corners
    const m = Math.floor(Math.min(w, h) * 0.08);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'corners',
      corners: [[m, m], [w - m, m], [w - m, h - m], [m, h - m]]
    }));
  } catch(e) { noDoc(); }
}
</script></body></html>`;

  // ── Corner drag handler ─────────────────────────────────────────────

  const makePanResponder = (cornerKey: keyof Corners) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setActiveCorner(cornerKey),
      onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        setCorners((prev) => {
          const disp = toDisplay(prev[cornerKey]);
          const newX = Math.max(0, Math.min(imageWidth, (disp.x + gs.dx) / scale));
          const newY = Math.max(0, Math.min(imageHeight, (disp.y + gs.dy) / scale));
          return { ...prev, [cornerKey]: { x: newX, y: newY } };
        });
      },
      onPanResponderRelease: () => setActiveCorner(null),
    });

  const panResponders = {
    topLeft: useRef(makePanResponder('topLeft')).current,
    topRight: useRef(makePanResponder('topRight')).current,
    bottomRight: useRef(makePanResponder('bottomRight')).current,
    bottomLeft: useRef(makePanResponder('bottomLeft')).current,
  };

  // ── Render corner handle ────────────────────────────────────────────

  const renderCorner = (key: keyof Corners, color: string) => {
    const disp = toDisplay(corners[key]);
    const isActive = activeCorner === key;
    return (
      <View
        key={key}
        style={[
          styles.corner,
          {
            left: disp.x - HANDLE_SIZE / 2,
            top: disp.y - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            backgroundColor: isActive ? '#FF6B35' : color,
            borderWidth: isActive ? 3 : 2,
            borderColor: '#FFF',
            zIndex: isActive ? 10 : 5,
          },
        ]}
        {...panResponders[key].panHandlers}
      >
        <View style={styles.cornerInner} />
      </View>
    );
  };

  // ── Render connecting lines ─────────────────────────────────────────

  const renderLines = () => {
    const pts: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft', 'topLeft'];
    return pts.slice(0, -1).map((key, i) => {
      const a = toDisplay(corners[key]);
      const b = toDisplay(corners[pts[i + 1]]);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return (
        <View
          key={`line-${i}`}
          style={[
            styles.line,
            {
              left: a.x + dx / 2 - len / 2,
              top: a.y + dy / 2 - 1,
              width: len,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            },
          ]}
        />
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Hidden WebView for edge detection */}
      {detecting && (
        <View style={styles.detectOverlay}>
          <WebView
            ref={webViewRef}
            source={{ html: detectHtml }}
            style={styles.detectWebview}
            onMessage={handleWebMessage}
            javaScriptEnabled={true}
            originWhitelist={['*']}
            scalesPageToFit={false}
          />
          <ActivityIndicator size="large" color="#E17055" style={styles.spinner} />
          <Text style={styles.detectText}>Detecting document edges...</Text>
        </View>
      )}

      {/* Image preview with corner overlay */}
      <View style={[styles.imageContainer, { width: displayW, height: displayH }]}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: displayW, height: displayH }}
          resizeMode="contain"
        />
        {!detecting && (
          <>
            {renderLines()}
            {renderCorner('topLeft', '#FF4444')}
            {renderCorner('topRight', '#44BB44')}
            {renderCorner('bottomRight', '#4488FF')}
            {renderCorner('bottomLeft', '#FFAA00')}
          </>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            {autoDetected ? '✓ Auto-detected — drag corners to adjust' : 'Drag corners to frame the document'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.confirmBtn, detecting && styles.confirmBtnDisabled]}
          onPress={() => onConfirm(corners)}
          disabled={detecting}
        >
          <Text style={styles.confirmText}>Crop & Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  detectOverlay: {
    position: 'absolute', top: 60, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  detectWebview: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  spinner: { marginTop: 20 },
  detectText: { color: '#FFF', fontSize: 14, marginTop: 12, fontWeight: '600' },
  imageContainer: {
    alignSelf: 'center', marginTop: 20,
    borderRadius: 4, overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    borderRadius: HANDLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cornerInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF',
  },
  line: {
    position: 'absolute', height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  cancelBtn: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#666',
  },
  cancelText: { color: '#CCC', fontSize: 14, fontWeight: '600' },
  legend: { flex: 1, paddingHorizontal: 12 },
  legendText: { color: '#AAA', fontSize: 11, textAlign: 'center' },
  confirmBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 8, backgroundColor: '#E17055',
  },
  confirmBtnDisabled: { backgroundColor: '#666' },
  confirmText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
