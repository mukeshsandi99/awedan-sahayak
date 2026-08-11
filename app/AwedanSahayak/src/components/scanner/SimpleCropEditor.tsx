/**
 * SimpleCropEditor — rectangular crop overlay.
 * Display coords during drag. Converts to image pixels only on Apply.
 * Uses useMemo for stable PanResponder instances.
 */
import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';

export interface CropRect { left: number; top: number; right: number; bottom: number; }

interface Props {
  imageLayout: { offsetX: number; offsetY: number; displayWidth: number; displayHeight: number; naturalWidth: number; naturalHeight: number };
  cropRect: CropRect;
  onCropChange: (r: CropRect) => void;
}

const TOUCH = 52;
const HS = 22;
const MIN_CROP = 40;
const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;

export default function SimpleCropEditor({ imageLayout, cropRect, onCropChange }: Props) {
  const { offsetX: ix, offsetY: iy, displayWidth: iw, displayHeight: ih } = imageLayout;
  const startRef = useRef<{ edge: string; r: CropRect } | null>(null);
  const crRef = useRef(cropRect);
  crRef.current = cropRect;
  const ilRef = useRef(imageLayout);
  ilRef.current = imageLayout;

  const makePan = (edge: string) => useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      startRef.current = { edge, r: { ...crRef.current } };
    },
    onPanResponderMove: (_, gs) => {
      if (!startRef.current) return;
      const s = startRef.current;
      const L = ilRef.current;
      const r = { ...s.r };

      if (edge === 'tl') {
        r.left = clamp(s.r.left + gs.dx, L.offsetX, Math.min(s.r.right - MIN_CROP, L.offsetX + L.displayWidth));
        r.top = clamp(s.r.top + gs.dy, L.offsetY, Math.min(s.r.bottom - MIN_CROP, L.offsetY + L.displayHeight));
      } else if (edge === 'tr') {
        r.right = clamp(s.r.right + gs.dx, Math.max(s.r.left + MIN_CROP, L.offsetX), L.offsetX + L.displayWidth);
        r.top = clamp(s.r.top + gs.dy, L.offsetY, Math.min(s.r.bottom - MIN_CROP, L.offsetY + L.displayHeight));
      } else if (edge === 'bl') {
        r.left = clamp(s.r.left + gs.dx, L.offsetX, Math.min(s.r.right - MIN_CROP, L.offsetX + L.displayWidth));
        r.bottom = clamp(s.r.bottom + gs.dy, Math.max(s.r.top + MIN_CROP, L.offsetY), L.offsetY + L.displayHeight);
      } else if (edge === 'br') {
        r.right = clamp(s.r.right + gs.dx, Math.max(s.r.left + MIN_CROP, L.offsetX), L.offsetX + L.displayWidth);
        r.bottom = clamp(s.r.bottom + gs.dy, Math.max(s.r.top + MIN_CROP, L.offsetY), L.offsetY + L.displayHeight);
      }
      onCropChange(r);
    },
    onPanResponderRelease: () => { startRef.current = null; },
  }), [edge]); // stable — edge never changes

  const tlPan = makePan('tl');
  const trPan = makePan('tr');
  const blPan = makePan('bl');
  const brPan = makePan('br');

  const { left, top, right, bottom } = cropRect;

  return (
    <View style={S.overlay} pointerEvents="box-none">
      <View style={S.dim} pointerEvents="none" />
      <View style={[S.box, { left, top, width: right - left, height: bottom - top }]} pointerEvents="none" />
      {[
        { k: 'tl', p: tlPan, x: left, y: top },
        { k: 'tr', p: trPan, x: right, y: top },
        { k: 'bl', p: blPan, x: left, y: bottom },
        { k: 'br', p: brPan, x: right, y: bottom },
      ].map(h => (
        <View key={h.k} {...h.p.panHandlers} style={[S.handle, { left: h.x - TOUCH/2, top: h.y - TOUCH/2 }]}>
          <View style={S.dot} />
        </View>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  dim: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#E17055', backgroundColor: 'transparent' },
  handle: { position: 'absolute', width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  dot: { width: HS, height: HS, borderRadius: HS/2, backgroundColor: '#E17055', borderWidth: 2, borderColor: '#FFF' },
});
