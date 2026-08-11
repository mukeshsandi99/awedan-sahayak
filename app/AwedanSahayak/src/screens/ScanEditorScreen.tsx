/**
 * ScanEditorScreen — Professional document scanner editor.
 *
 * Tools: Crop, Rotate, Filters, Adjustments, Multi-page manager.
 * Supports undo/redo history. OCR and PDF use edited images.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Platform, ActivityIndicator, Dimensions, StatusBar,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import SimpleCropEditor from '../components/scanner/SimpleCropEditor';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import * as FileSystem from 'expo-file-system/legacy';
import {
  applyFilter, rotateImage, cropImage, saveEditedImage, applyPerspective, applyAdjustments,
  FILTERS, DEFAULT_ADJUSTMENTS,
} from '../services/imageEditor';
import type { FilterName, AdjustmentValues, CropRect } from '../services/imageEditor';
import {
  computeImageLayout, screenToImage, imageToScreen,
  getImageDimensions, fullPageCorners,
} from '../services/coordinateMapper';
import type { Point, ImageLayout } from '../services/coordinateMapper';

type Props = NativeStackScreenProps<HomeStackParamList, 'ScanEditor'>;

interface PageEntry {
  uri: string;
  originalUri: string;
  filter: FilterName;
  rotation: number;
  adjustments: AdjustmentValues;
  history: string[];
  historyIdx: number;
}

type ToolMode = 'none' | 'perspective' | 'filter' | 'adjust' | 'pages' | 'crop';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMG_AREA_W = SCREEN_W - 16;
const IMG_AREA_H = SCREEN_H * 0.55;

export default function ScanEditorScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const imageUris: string[] = (route.params as any)?.imageUris ?? [];
  const editorSessionId: string = (route.params as any)?.sessionId ?? `editor-${Date.now()}`;
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [toolMode, setToolMode] = useState<ToolMode>('none');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('Scanned Document');

  // Perspective editor state — corners in original-image coordinates (source of truth)
  const [perspActive, setPerspActive] = useState(false);
  const [corners, setCorners] = useState<{ topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point }>({
    topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomRight: { x: 1, y: 1 }, bottomLeft: { x: 0, y: 1 },
  });
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<string | null>(null);
  const [cropActive, setCropActive] = useState(false);
  const [cropRect, setCropRect] = useState<{left:number;top:number;right:number;bottom:number}|null>(null);
  // Measured viewport for accurate image layout (replaces hardcoded IMG_AREA_W/H)
  const [viewportW, setViewportW] = useState(IMG_AREA_W);
  const [viewportH, setViewportH] = useState(IMG_AREA_H);
  // Page swipe gesture (only when crop is NOT active)
  const swipeRef = useRef<{ sx: number } | null>(null);
  const pageSwipePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) * 0.6,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2,
    onPanResponderGrant: (_, gs) => { swipeRef.current = { sx: gs.dx }; },
    onPanResponderRelease: (_, gs) => {
      const dx = gs.dx - (swipeRef.current?.sx || 0);
      swipeRef.current = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(gs.dy) * 1.5 && pages.length > 1 && toolMode === 'none') {
        if (dx < 0 && activePage < pages.length - 1) setActivePage(p => p + 1);
        else if (dx > 0 && activePage > 0) setActivePage(p => p - 1);
      }
    },
  }), [toolMode, activePage, pages.length]);

  // Per-page crop rectangles (keyed by page index)
  const cropRectsRef = useRef<Record<number, {left:number;top:number;right:number;bottom:number}>>({});

  useEffect(() => {
    const initial: PageEntry[] = imageUris.map(uri => ({
      uri,
      originalUri: uri,
      filter: 'original' as FilterName,
      rotation: 0,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      history: [uri],
      historyIdx: 0,
    }));
    setPages(initial);
    // Load first image dimensions
    if (imageUris.length > 0) {
      getImageDimensions(imageUris[0]).then(dims => {
        if (dims) {
          const layout = computeImageLayout(dims.width, dims.height, viewportW, viewportH, 0);
          setImageLayout(layout);
          setCorners(fullPageCorners(layout));
          const r = {left:layout.offsetX,top:layout.offsetY,right:layout.offsetX+layout.displayWidth,bottom:layout.offsetY+layout.displayHeight};
          setCropRect(r);
          cropRectsRef.current = {0: r};
        }
      });
    }
  }, [imageUris]);

  // Reload imageLayout when activePage changes — CRITICAL for multi-page crop
  useEffect(() => {
    const uri = pages[activePage]?.uri;
    if (!uri) return;
    getImageDimensions(uri).then(dims => {
      if (!dims) return;
      const layout = computeImageLayout(dims.width, dims.height, viewportW, viewportH, 0);
      setImageLayout(layout);
      // Always use fresh full bounds — display coords are viewport-specific
      const r = {left:layout.offsetX,top:layout.offsetY,right:layout.offsetX+layout.displayWidth,bottom:layout.offsetY+layout.displayHeight};
      setCropRect(r);
      cropRectsRef.current[activePage] = r;
    });
  }, [activePage, pages]);

  // ── History helpers ──────────────────────────────────────────────
  const pushHistory = useCallback((pageIdx: number, newUri: string) => {
    setPages(prev => {
      const next = [...prev];
      const p = { ...next[pageIdx] };
      p.history = [...p.history.slice(0, p.historyIdx + 1), newUri];
      p.historyIdx = p.history.length - 1;
      p.uri = newUri;
      next[pageIdx] = p;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPages(prev => {
      const next = [...prev];
      const p = { ...next[activePage] };
      if (p.historyIdx > 0) {
        p.historyIdx--;
        p.uri = p.history[p.historyIdx];
        next[activePage] = p;
      }
      return next;
    });
  }, [activePage]);

  const redo = useCallback(() => {
    setPages(prev => {
      const next = [...prev];
      const p = { ...next[activePage] };
      if (p.historyIdx < p.history.length - 1) {
        p.historyIdx++;
        p.uri = p.history[p.historyIdx + 1];
        next[activePage] = p;
      }
      return next;
    });
  }, [activePage]);

  // ── Operations ───────────────────────────────────────────────────
  const doRotate = useCallback(async (deg: 90 | 180 | 270) => {
    setBusy(true);
    try {
      // Physical rotation via ImageManipulator — replaces image data
      const result = await ImageManipulator.manipulateAsync(
        pages[activePage].uri,
        [{ rotate: deg }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );
      const newUri = result.uri;
      setPages(prev => {
        const next = [...prev];
        // rotation set to 0 because image data is already rotated — no CSS double-transform
        next[activePage] = { ...next[activePage], rotation: 0, uri: newUri };
        return next;
      });
      pushHistory(activePage, newUri);
      // Reload dimensions after rotation (width/height may swap)
      getImageDimensions(newUri).then(dims => {
        if (dims) {
          const layout = computeImageLayout(dims.width, dims.height, viewportW, viewportH, 0);
          setImageLayout(layout);
          const r = {left:layout.offsetX,top:layout.offsetY,right:layout.offsetX+layout.displayWidth,bottom:layout.offsetY+layout.displayHeight};
          setCropRect(r);
          cropRectsRef.current[activePage] = r;
        }
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Rotation failed');
    } finally {
      setBusy(false);
    }
  }, [pages, activePage, viewportW, viewportH, pushHistory]);

  const doFilter = useCallback(async (filterName: FilterName) => {
    if (filterName === pages[activePage].filter) return;
    setBusy(true);
    try {
      const newUri = await applyFilter(pages[activePage].originalUri, filterName);
      setPages(prev => {
        const next = [...prev];
        next[activePage] = { ...next[activePage], filter: filterName, uri: newUri };
        return next;
      });
      pushHistory(activePage, newUri);
      setToolMode('none');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Filter failed');
    } finally {
      setBusy(false);
    }
  }, [pages, activePage, pushHistory]);


  // Convert display cropRect to image pixels and apply with strict bounds
  const doCrop = useCallback(async () => {
    if (!cropRect || !imageLayout) return; setBusy(true);
    try {
      const { offsetX, offsetY, displayWidth, displayHeight, naturalWidth, naturalHeight } = imageLayout;
      const scaleX = naturalWidth / displayWidth;
      const scaleY = naturalHeight / displayHeight;
      // Clamp to source image bounds BEFORE rounding
      let ox = Math.max(0, (cropRect.left - offsetX) * scaleX);
      let oy = Math.max(0, (cropRect.top - offsetY) * scaleY);
      let cw = (cropRect.right - cropRect.left) * scaleX;
      let ch = (cropRect.bottom - cropRect.top) * scaleY;
      // Ensure crop stays within source image
      if (ox + cw > naturalWidth) cw = naturalWidth - ox;
      if (oy + ch > naturalHeight) ch = naturalHeight - oy;
      // Floor origin, ceil size to avoid gaps
      const fx = Math.floor(ox);
      const fy = Math.floor(oy);
      const fw = Math.ceil(cw);
      const fh = Math.ceil(ch);
      // Final assertion
      if (fx < 0 || fy < 0 || fw <= 0 || fh <= 0 || fx + fw > naturalWidth || fy + fh > naturalHeight) {
        Alert.alert('Crop Error', `Invalid bounds: img=${naturalWidth}x${naturalHeight} crop=${fx},${fy} ${fw}x${fh}`);
        setBusy(false); return;
      }
      if(fw<=10||fh<=10){Alert.alert('Crop too small');setBusy(false);return;}
      const result=await ImageManipulator.manipulateAsync(pages[activePage].originalUri,[{crop:{originX:fx,originY:fy,width:fw,height:fh}}],{compress:0.9,format:ImageManipulator.SaveFormat.JPEG});
      setPages(p=>{const n=[...p];n[activePage]={...n[activePage],uri:result.uri,filter:'original' as FilterName};return n;});
      pushHistory(activePage,result.uri);setCropActive(false);setToolMode('none');
      getImageDimensions(result.uri).then(dims=>{if(dims){const l=computeImageLayout(dims.width,dims.height,IMG_AREA_W,IMG_AREA_H,0);setImageLayout(l);const r={left:l.offsetX,top:l.offsetY,right:l.offsetX+l.displayWidth,bottom:l.offsetY+l.displayHeight};setCropRect(r);cropRectsRef.current[activePage]=r;}});
    }catch(e:any){Alert.alert('Crop Error',e?.message||'Crop failed');}finally{setBusy(false);}
  },[pages,activePage,cropRect,imageLayout,editorSessionId,pushHistory]);

  const doPerspective = useCallback(async () => {
    setBusy(true);
    try {
      const newUri = await applyPerspective(
        pages[activePage].originalUri,
        { topLeft: corners.topLeft, topRight: corners.topRight, bottomRight: corners.bottomRight, bottomLeft: corners.bottomLeft },
        editorSessionId,
      );
      setPages(prev => {
        const next = [...prev];
        next[activePage] = { ...next[activePage], uri: newUri, filter: 'original' as FilterName };
        return next;
      });
      pushHistory(activePage, newUri);
      setPerspActive(false);
      setToolMode('none');
      // Reload layout for the new corrected image
      getImageDimensions(newUri).then(dims => {
        if (dims) {
          const layout = computeImageLayout(dims.width, dims.height, viewportW, viewportH, 0);
          setImageLayout(layout);
          setCorners(fullPageCorners(layout));setCropRect({left:layout.offsetX,top:layout.offsetY,right:layout.offsetX+layout.displayWidth,bottom:layout.offsetY+layout.displayHeight});
        }
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Perspective correction failed');
    } finally {
      setBusy(false);
    }
  }, [pages, activePage, corners, pushHistory, editorSessionId]);

  const resetCorners = useCallback(() => {
    if (imageLayout) setCorners(fullPageCorners(imageLayout));
  }, [imageLayout]);

  // Debounced adjustment application
  const adjustTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doApplyAdjustments = useCallback(async (adj: AdjustmentValues) => {
    // Debounce: wait 400ms after last slider change
    if (adjustTimer.current) clearTimeout(adjustTimer.current);
    adjustTimer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const newUri = await applyAdjustments(pages[activePage].originalUri, adj);
        if (newUri) {
          setPages(prev => {
            const next = [...prev];
            next[activePage] = { ...next[activePage], uri: newUri, adjustments: { ...adj } };
            return next;
          });
          pushHistory(activePage, newUri);
        }
      } catch (e: any) {
        console.warn('Adjustment failed:', e?.message);
      } finally {
        setBusy(false);
      }
    }, 400);
  }, [pages, activePage, pushHistory]);

  const resetAdjustments = useCallback(() => {
    const def = { ...DEFAULT_ADJUSTMENTS };
    setPages(prev => {
      const next = [...prev];
      next[activePage] = { ...next[activePage], adjustments: def };
      return next;
    });
    doApplyAdjustments(def);
  }, [activePage, doApplyAdjustments]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (adjustTimer.current) clearTimeout(adjustTimer.current); }, []);

  const doSaveAndExit = useCallback(async () => {
    setBusy(true);
    try {
      const editedUris: string[] = [];
      for (const page of pages) {
        const saved = await saveEditedImage(page.uri, page.originalUri, editorSessionId);
        editedUris.push(saved);
      }
      // Navigate back with edited images and session ID
      navigation.navigate('DocumentScanner', { mode: 'scan', editedImages: editedUris, sessionId: editorSessionId } as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }, [pages, navigation, editorSessionId]);

  // ── Page operations ──────────────────────────────────────────────
  const addPage = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const deletePage = useCallback((idx: number) => {
    if (pages.length <= 1) { Alert.alert('Error', 'Need at least 1 page.'); return; }
    Alert.alert('Delete page?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setPages(prev => prev.filter((_, i) => i !== idx));
          if (activePage >= idx && activePage > 0) setActivePage(a => a - 1);
        },
      },
    ]);
  }, [pages.length, activePage]);

  const dupPage = useCallback((idx: number) => {
    setPages(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, { ...prev[idx] });
      return next;
    });
  }, []);

  const reorderPages = useCallback((from: number, to: number) => {
    setPages(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    if (activePage === from) setActivePage(to);
  }, [activePage]);

  // ── Render ───────────────────────────────────────────────────────
  const currentPage = pages[activePage];
  if (!currentPage) {
    return <View style={S.ct}><ActivityIndicator size="large" color="#E17055"/></View>;
  }

  return (
    <View style={[S.ct, { paddingBottom: insets.bottom }]}>
      {/* Busy overlay */}
      {busy && <View style={S.bo}><ActivityIndicator size="large" color="#E17055"/></View>}

      {/* === TOP TOOLBAR === */}
      <View style={[S.ttb, { paddingTop: insets.top > 0 ? insets.top : 30 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.tbtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E"/>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
          {pages.length > 1 && (
            <TouchableOpacity onPress={() => setActivePage(p => Math.max(0, p - 1))} disabled={activePage <= 0} style={S.tbtn}>
              <Ionicons name="chevron-back" size={18} color={activePage > 0 ? '#1A1A2E' : '#CCC'} />
            </TouchableOpacity>
          )}
          <Text style={S.tt} numberOfLines={1}>{title || 'Scanned Document'} {pages.length > 1 ? `${activePage + 1}/${pages.length}` : ''}</Text>
          {pages.length > 1 && (
            <TouchableOpacity onPress={() => setActivePage(p => Math.min(pages.length - 1, p + 1))} disabled={activePage >= pages.length - 1} style={S.tbtn}>
              <Ionicons name="chevron-forward" size={18} color={activePage < pages.length - 1 ? '#1A1A2E' : '#CCC'} />
            </TouchableOpacity>
          )}
        </View>
        <View style={S.tbtns}>
          <TouchableOpacity onPress={undo} style={S.tbtn} disabled={!(pages[activePage]?.historyIdx > 0)}>
            <Ionicons name="arrow-undo" size={20} color={pages[activePage]?.historyIdx > 0 ? '#1A1A2E' : '#CCC'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={redo} style={S.tbtn} disabled={!(pages[activePage] && pages[activePage].historyIdx < pages[activePage].history.length - 1)}>
            <Ionicons name="arrow-redo" size={20} color={(pages[activePage] && pages[activePage].historyIdx < pages[activePage].history.length - 1) ? '#1A1A2E' : '#CCC'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={doSaveAndExit} style={S.tbtnsave}>
            <Ionicons name="checkmark" size={20} color="#27AE60"/>
            <Text style={S.tbst}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* === IMAGE AREA === */}
      <View style={S.ia}
        onLayout={e => { const {width,height}=e.nativeEvent.layout; setViewportW(width); setViewportH(height); }}
        {...(toolMode !== 'crop' ? pageSwipePan.panHandlers : {})}
      >
        {imageLayout ? (
          <Image
            source={{ uri: currentPage.uri }}
            style={{
              position: 'absolute',
              left: imageLayout.offsetX,
              top: imageLayout.offsetY,
              width: imageLayout.displayWidth,
              height: imageLayout.displayHeight,
            }}
            resizeMode="stretch"
          />
        ) : (
          <Image source={{ uri: currentPage.uri }} style={S.im} resizeMode="contain" />
        )}
        {toolMode === 'crop' && cropActive && imageLayout && cropRect && (
          <SimpleCropEditor imageLayout={imageLayout} cropRect={cropRect} onCropChange={setCropRect} />
        )}
        {toolMode === 'perspective' && perspActive && imageLayout && (
          <PerspectiveEditor
            corners={corners}
            imageLayout={imageLayout}
            rotation={currentPage.rotation}
            draggingCorner={draggingCorner}
            onCornersChange={setCorners}
            onDragStart={setDraggingCorner}
            onDragEnd={() => setDraggingCorner(null)}
          />
        )}
      </View>

      {/* === TOOL PANELS === */}
      {toolMode === 'filter' && <FilterPanel active={currentPage.filter} onSelect={doFilter} onClose={() => setToolMode('none')} />}
      {toolMode === 'adjust' && (
        <AdjustPanel
          values={currentPage.adjustments}
          onChange={(v) => setPages(prev => { const n = [...prev]; n[activePage] = { ...n[activePage], adjustments: v }; return n; })}
          onApply={doApplyAdjustments}
          onReset={resetAdjustments}
          onClose={() => setToolMode('none')}
        />
      )}
      {toolMode === 'pages' && (
        <PagesPanel
          pages={pages} activePage={activePage}
          onSelect={setActivePage} onDelete={deletePage} onDuplicate={dupPage}
          onReorder={reorderPages} onClose={() => setToolMode('none')}
        />
      )}

      {/* === CROP TOOLBAR === */}
      {toolMode === 'crop' && (
        <View style={[S.cropBar,{paddingBottom:10}]}>
          <TouchableOpacity style={S.cropBtn} onPress={()=>{if(imageLayout){const r={left:imageLayout.offsetX,top:imageLayout.offsetY,right:imageLayout.offsetX+imageLayout.displayWidth,bottom:imageLayout.offsetY+imageLayout.displayHeight};setCropRect(r);cropRectsRef.current[activePage]=r;}}}><Ionicons name="expand-outline" size={18} color="#FFF"/><Text style={S.cropBt}>Full Page</Text></TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn,S.cropApply]} onPress={doCrop}><Ionicons name="checkmark" size={18} color="#FFF"/><Text style={S.cropBt}>Apply</Text></TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn,{backgroundColor:'#999'}]} onPress={()=>{setToolMode('none');setCropActive(false);}}><Ionicons name="close" size={18} color="#FFF"/><Text style={S.cropBt}>Cancel</Text></TouchableOpacity>
        </View>
      )}
      {/* === PERSPECTIVE TOOLBAR === */}
      {toolMode === 'perspective' && (
        <View style={[S.cropBar, { paddingBottom: (insets.bottom > 0 ? insets.bottom : 10) }]}>
          <TouchableOpacity style={S.cropBtn} onPress={() => setPerspActive(!perspActive)}>
            <Ionicons name="scan-outline" size={18} color="#FFF"/><Text style={S.cropBt}>{perspActive ? 'Lock' : 'Edit Corners'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.cropBtn} onPress={resetCorners}>
            <Ionicons name="refresh-outline" size={18} color="#FFF"/><Text style={S.cropBt}>Full Page</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn, S.cropApply]} onPress={doPerspective}>
            <Ionicons name="checkmark" size={18} color="#FFF"/><Text style={S.cropBt}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* === BOTTOM TOOLBAR === */}
      {toolMode === 'none' && (
        <View style={[S.btb, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
          <ToolBtn icon="crop-outline" label="Crop" onPress={() => { setToolMode('crop'); setCropActive(true); if(imageLayout) { const r={left:imageLayout.offsetX,top:imageLayout.offsetY,right:imageLayout.offsetX+imageLayout.displayWidth,bottom:imageLayout.offsetY+imageLayout.displayHeight}; setCropRect(r); cropRectsRef.current[activePage]=r; } }} />
          <ToolBtn icon="refresh-outline" label="Rotate" onPress={() => {
            Alert.alert('Rotate', 'Select rotation', [
              { text: '90°', onPress: () => doRotate(90) },
              { text: '180°', onPress: () => doRotate(180) },
              { text: '270°', onPress: () => doRotate(270) },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }} />
          <ToolBtn icon="color-filter-outline" label="Filters" onPress={() => setToolMode('filter')} />
          <ToolBtn icon="options-outline" label="Adjust" onPress={() => setToolMode('adjust')} />
          <ToolBtn icon="copy-outline" label="Pages" onPress={() => setToolMode('pages')} />
          <ToolBtn icon="checkmark-circle-outline" label="Done" onPress={doSaveAndExit} highlighted />
        </View>
      )}

      {/* Page navigation dots */}
      {pages.length > 1 && toolMode === 'none' && (
        <View style={S.pnd}>
          {pages.map((_, i) => (
            <View key={i} style={[S.pndot, i === activePage && S.pndota]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function ToolBtn({ icon, label, onPress, highlighted }: {
  icon: string; label: string; onPress: () => void; highlighted?: boolean;
}) {
  return (
    <TouchableOpacity style={S.tb} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={20} color={highlighted ? '#FFF' : '#555'} />
      <Text style={[S.tbl, highlighted && S.tblh]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Draws a connecting line between two screen points using a rotated View. */
function EdgeLine({ from, to }: { from: Point; to: Point }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  if (length < 1) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - 1,
        width: length,
        height: 2,
        backgroundColor: '#E17055',
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function PerspectiveEditor({ corners, imageLayout, rotation, draggingCorner, onCornersChange, onDragStart, onDragEnd }: {
  corners: { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point };
  imageLayout: ImageLayout;
  rotation: number;
  draggingCorner: string | null;
  onCornersChange: (c: { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point }) => void;
  onDragStart: (key: string) => void;
  onDragEnd: () => void;
}) {
  const handleSize = 32;
  const touchRef = useRef<{ key: string; fingerX: number; fingerY: number } | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const lastDist = useRef<number>(0);

  const toScreen = (p: Point) => imageToScreen(p.x, p.y, imageLayout, rotation);

  const pts = {
    topLeft: toScreen(corners.topLeft),
    topRight: toScreen(corners.topRight),
    bottomRight: toScreen(corners.bottomRight),
    bottomLeft: toScreen(corners.bottomLeft),
  };

  const getCornerStyle = (key: string, pt: Point) => ({
    position: 'absolute' as const,
    left: pt.x - handleSize / 2,
    top: pt.y - handleSize / 2,
    width: handleSize,
    height: handleSize,
    borderRadius: handleSize / 2,
    backgroundColor: draggingCorner === key ? '#FFF' : '#E17055',
    borderWidth: 2.5,
    borderColor: '#FFF',
    zIndex: 20,
  });

  const handleGrant = (key: string, e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    touchRef.current = { key, fingerX: pageX, fingerY: pageY };
    setMagnifierPos({ x: pageX, y: pageY - 80 });
    onDragStart(key);
  };

  const handleMove = (e: any) => {
    if (!touchRef.current) return;
    const { pageX, pageY } = e.nativeEvent;
    touchRef.current.fingerX = pageX;
    touchRef.current.fingerY = pageY;
    setMagnifierPos({ x: pageX, y: pageY - 80 });

    // Convert screen touch to image coordinates
    const imgPt = screenToImage(pageX, pageY, imageLayout, rotation);

    // Edge snapping: snap to image boundary within 15px margin
    const SNAP = 15;
    if (imgPt.x < SNAP) imgPt.x = 0;
    else if (imgPt.x > imageLayout.naturalWidth - SNAP) imgPt.x = imageLayout.naturalWidth;
    if (imgPt.y < SNAP) imgPt.y = 0;
    else if (imgPt.y > imageLayout.naturalHeight - SNAP) imgPt.y = imageLayout.naturalHeight;

    // Clamp to image bounds
    imgPt.x = Math.max(0, Math.min(imgPt.x, imageLayout.naturalWidth));
    imgPt.y = Math.max(0, Math.min(imgPt.y, imageLayout.naturalHeight));
    onCornersChange({ ...corners, [touchRef.current.key]: imgPt });
  };

  const handleRelease = () => {
    touchRef.current = null;
    setMagnifierPos(null);
    onDragEnd();
  };

  // Pinch-to-zoom gesture tracking via multi-touch
  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches && touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      lastDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMoveGlobal = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches && touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist.current > 0) {
        const delta = dist / lastDist.current;
        setZoomScale(prev => Math.max(1, Math.min(3, prev * delta)));
      }
      lastDist.current = dist;
    }
  };

  const cornerKeys: (keyof typeof corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

  return (
    <View
      style={[S.peo, { width: IMG_AREA_W, height: IMG_AREA_H }]}
      pointerEvents="box-none"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderStart={handleTouchStart}
      onResponderMove={handleTouchMoveGlobal}
    >
      {/* Semi-transparent shading */}
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} pointerEvents="none" />

      {/* Edge lines */}
      <EdgeLine from={pts.topLeft} to={pts.topRight} />
      <EdgeLine from={pts.topRight} to={pts.bottomRight} />
      <EdgeLine from={pts.bottomRight} to={pts.bottomLeft} />
      <EdgeLine from={pts.bottomLeft} to={pts.topLeft} />

      {/* Draggable corner handles with zoom applied */}
      {cornerKeys.map(key => (
        <View key={key}
          style={[getCornerStyle(key, pts[key]), { transform: [{ scale: zoomScale }] }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => handleGrant(key, e)}
          onResponderMove={handleMove}
          onResponderRelease={handleRelease}
        />
      ))}

      {/* Magnifier — shows zoomed preview near finger during drag */}
      {magnifierPos && draggingCorner && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: magnifierPos.x - 40,
            top: magnifierPos.y - 40,
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 3,
            borderColor: '#E17055',
            backgroundColor: '#FFF',
            overflow: 'hidden',
            zIndex: 100,
            elevation: 10,
          }}
        >
          {/* Crosshair */}
          <View style={{
            position: 'absolute', left: 38, top: 0, width: 4, height: 80,
            backgroundColor: 'rgba(225,112,85,0.3)', zIndex: 2,
          }} />
          <View style={{
            position: 'absolute', left: 0, top: 38, width: 80, height: 4,
            backgroundColor: 'rgba(225,112,85,0.3)', zIndex: 2,
          }} />
          {/* Corner label */}
          <View style={{
            position: 'absolute', bottom: 2, left: 0, right: 0,
            alignItems: 'center', zIndex: 3,
          }}>
            <Text style={{
              fontSize: 8, color: '#E17055', fontWeight: '700',
              backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 3,
            }}>
              {draggingCorner === 'topLeft' ? 'TL' : draggingCorner === 'topRight' ? 'TR' : draggingCorner === 'bottomRight' ? 'BR' : 'BL'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function FilterPanel({ active, onSelect, onClose }: {
  active: FilterName; onSelect: (f: FilterName) => void; onClose: () => void;
}) {
  const filterKeys = (Object.keys(FILTERS) as FilterName[]).filter(k => k !== 'blackWhite');
  return (
    <View style={S.fp}>
      <View style={S.fph}>
        <Text style={S.fpt}>Filters</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#555" /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.fpl}>
        {filterKeys.map(k => {
          const f = FILTERS[k];
          const isActive = active === k;
          return (
            <TouchableOpacity key={k} style={[S.fi, isActive && S.fia]} onPress={() => onSelect(k)}>
              <View style={[S.fib, isActive && S.fiba]}>
                <Ionicons name={k === 'original' ? 'image-outline' : k === 'bw' ? 'contrast' : 'color-filter-outline'} size={24} color={isActive ? '#FFF' : '#555'} />
              </View>
              <Text style={[S.fit, isActive && S.fita]}>{f.label}</Text>
              <Text style={[S.fis, isActive && S.fisa]}>{f.labelHi}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SliderRow({ icon, label, value, min, max, paramKey, values, onChange, onApply }: {
  icon: string; label: string; value: number; min: number; max: number;
  paramKey: keyof AdjustmentValues; values: AdjustmentValues;
  onChange: (v: AdjustmentValues) => void; onApply: (v: AdjustmentValues) => void;
}) {
  const sliderRef = useRef<View>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const handleTouch = useCallback((e: any) => {
    if (!sliderRef.current) return;
    sliderRef.current.measure((_x: number, _y: number, w: number, _h: number, px: number, _py: number) => {
      const touchX = e.nativeEvent.pageX - px;
      const ratio = Math.max(0, Math.min(1, touchX / w));
      const newVal = Math.round((min + ratio * (max - min)) * 10) / 10;
      const updated = { ...values, [paramKey]: newVal };
      onChange(updated);
      onApply(updated);
    });
  }, [min, max, paramKey, values, onChange, onApply]);

  return (
    <View style={S.sr}>
      <View style={S.srh}>
        <Ionicons name={icon as any} size={16} color="#555" />
        <Text style={S.srl}>{label}</Text>
        <Text style={S.srv}>{value.toFixed(1)}</Text>
      </View>
      <View
        ref={sliderRef}
        style={S.stk}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        <View style={[S.stf, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function AdjustPanel({ values, onChange, onApply, onReset, onClose }: {
  values: AdjustmentValues; onChange: (v: AdjustmentValues) => void;
  onApply: (v: AdjustmentValues) => void; onReset: () => void; onClose: () => void;
}) {
  const sliders: { key: keyof AdjustmentValues; label: string; icon: string }[] = [
    { key: 'brightness', label: 'Brightness', icon: 'sunny-outline' },
    { key: 'contrast', label: 'Contrast', icon: 'contrast-outline' },
    { key: 'sharpness', label: 'Sharpness', icon: 'sparkles-outline' },
    { key: 'saturation', label: 'Saturation', icon: 'color-palette-outline' },
    { key: 'warmth', label: 'Warmth', icon: 'thermometer-outline' },
    { key: 'shadows', label: 'Shadows', icon: 'moon-outline' },
    { key: 'highlights', label: 'Highlights', icon: 'flashlight-outline' },
    { key: 'whitening', label: 'Bg Whitening', icon: 'document-outline' },
    { key: 'denoise', label: 'NR / Denoise', icon: 'filter-outline' },
  ];

  return (
    <View style={S.fp}>
      <View style={S.fph}>
        <Text style={S.fpt}>Adjustments</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#555" /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
        {sliders.map(s => (
          <SliderRow
            key={s.key}
            icon={s.icon}
            label={s.label}
            value={values[s.key]}
            min={s.key === 'sharpness' || s.key === 'whitening' || s.key === 'denoise' ? 0 : -1}
            max={1}
            paramKey={s.key}
            values={values}
            onChange={onChange}
            onApply={onApply}
          />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 8 }}>
        <TouchableOpacity style={S.adjReset} onPress={onReset}>
          <Ionicons name="refresh-outline" size={16} color="#E17055" />
          <Text style={S.adjRt}>Reset All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.adjReset, { backgroundColor: '#E17055', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8 }]} onPress={() => onApply(values)}>
          <Ionicons name="checkmark" size={16} color="#FFF" />
          <Text style={[S.adjRt, { color: '#FFF' }]}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PagesPanel({ pages, activePage, onSelect, onDelete, onDuplicate, onReorder, onClose }: {
  pages: PageEntry[]; activePage: number;
  onSelect: (i: number) => void; onDelete: (i: number) => void;
  onDuplicate: (i: number) => void; onReorder: (f: number, t: number) => void;
  onClose: () => void;
}) {
  return (
    <View style={S.fp}>
      <View style={S.fph}>
        <Text style={S.fpt}>Pages ({pages.length})</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#555" /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled={true} contentContainerStyle={S.ppl}>
        {pages.map((p, i) => (
          <View key={i} style={[S.ppi, i === activePage && S.ppia]}>
            <TouchableOpacity onPress={() => onSelect(i)}>
              <Image source={{ uri: p.uri }} style={S.ppt} />
            </TouchableOpacity>
            <Text style={S.ppn}>{i + 1}</Text>
            <View style={S.ppa}>
              <TouchableOpacity onPress={() => onDuplicate(i)}>
                <Ionicons name="copy-outline" size={14} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(i)}>
                <Ionicons name="trash-outline" size={14} color="#D63031" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const S = StyleSheet.create({
  ct: { flex: 1, backgroundColor: '#1A1A2E' },
  bo: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26,26,46,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  // Top toolbar
  ttb: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#F8F8F8' },
  tbtn: { padding: 8 },
  tt: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  tbtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tbtnsave: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F8E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  tbst: { fontSize: 13, fontWeight: '600', color: '#27AE60' },
  // Image area
  ia: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D2D44' },
  im: { width: '100%', height: '100%', resizeMode: 'contain' },
  // Bottom toolbar
  btb: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 10, backgroundColor: '#F8F8F8', borderTopWidth: 1, borderTopColor: '#E8E8E8' },
  tb: { alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  tbl: { fontSize: 11, color: '#555', fontWeight: '500' },
  tblh: { color: '#E17055' },
  // Perspective editor
  peo: { position: 'absolute', left: 0, top: 0 },
  // Perspective toolbar
  cropBar: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 10, paddingBottom: 10, backgroundColor: '#2D2D44' },
  cropBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  cropApply: { backgroundColor: '#E17055' },
  cropBt: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  // Filter panel
  fp: { backgroundColor: '#F8F8F8', paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E8E8E8' },
  fph: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  fpt: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  fpl: { paddingHorizontal: 12, gap: 10 },
  fi: { alignItems: 'center', width: 72, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF' },
  fia: { backgroundColor: '#E17055' },
  fib: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  fiba: { backgroundColor: 'rgba(255,255,255,0.3)' },
  fit: { fontSize: 11, fontWeight: '600', color: '#1A1A2E', textAlign: 'center' },
  fita: { color: '#FFF' },
  fis: { fontSize: 9, color: '#999', textAlign: 'center' },
  fisa: { color: 'rgba(255,255,255,0.8)' },
  // Adjust panel
  sr: { paddingHorizontal: 16, paddingVertical: 6 },
  srh: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  srl: { fontSize: 12, fontWeight: '500', color: '#555', flex: 1 },
  srv: { fontSize: 11, color: '#999', width: 30, textAlign: 'right' },
  stk: { height: 4, backgroundColor: '#E8E8E8', borderRadius: 2 },
  stf: { height: 4, backgroundColor: '#E17055', borderRadius: 2 },
  adjReset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8 },
  adjRt: { fontSize: 13, color: '#E17055', fontWeight: '600' },
  // Pages panel
  ppl: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  ppi: { alignItems: 'center', borderRadius: 8, borderWidth: 2, borderColor: 'transparent', padding: 4, backgroundColor: '#FFF' },
  ppia: { borderColor: '#E17055' },
  ppt: { width: 60, height: 80, borderRadius: 4, backgroundColor: '#F0F0F0' },
  ppn: { fontSize: 10, fontWeight: '700', color: '#555', marginTop: 2 },
  ppa: { flexDirection: 'row', gap: 8, marginTop: 4 },
  // Page dots
  pnd: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 4, backgroundColor: '#F8F8F8' },
  pndot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },
  pndota: { backgroundColor: '#E17055', width: 16 },
});
