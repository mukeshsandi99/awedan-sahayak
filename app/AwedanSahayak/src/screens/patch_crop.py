import re

with open('ScanEditorScreen.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add ImageManipulator import
c = c.replace(
    "import { useSafeAreaInsets } from 'react-native-safe-area-context';",
    "import { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport * as ImageManipulator from 'expo-image-manipulator';"
)

# 2. Add PanResponder to RN imports
c = c.replace(
    "Image, Alert, Platform, ActivityIndicator, Dimensions, StatusBar,",
    "Image, Alert, Platform, ActivityIndicator, Dimensions, StatusBar,\n  PanResponder,"
)

# 3. Change ToolMode
c = c.replace("type ToolMode = 'none' | 'perspective' | 'filter' | 'adjust' | 'pages';",
               "type ToolMode = 'none' | 'crop' | 'filter' | 'adjust' | 'pages';")

# 4. Replace perspective state with crop state
old_state = "  // Perspective editor state"
idx = c.find(old_state)
if idx >= 0:
    end_idx = c.find("  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null);", idx)
    end_idx2 = c.find("  const [draggingCorner, setDraggingCorner] = useState<string | null>(null);", idx)
    block_end = max(end_idx, end_idx2) + 100
    new_state = """  // Simple crop state
  const [cropActive, setCropActive] = useState(false);
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);"""
    # Find the end of the state block
    semi = c.find(";", end_idx2)
    c = c[:idx] + new_state + c[semi+1:]

# 5. Replace setCorners calls
c = c.replace("setCorners(fullPageCorners(layout));", "setCropRect({ x: 0, y: 0, w: layout.naturalWidth, h: layout.naturalHeight });")

# 6. Replace doPerspective with doCrop
old_fn_start = c.find("  const doPerspective = useCallback(async () => {")
old_fn_end = c.find("  }, [pages, activePage, corners, editorSessionId, pushHistory]);", old_fn_start)
if old_fn_start >= 0 and old_fn_end >= 0:
    new_fn = """  const doCrop = useCallback(async () => {
    if (!cropRect || !imageLayout) return;
    setBusy(true);
    try {
      const cx = Math.max(0, Math.round(cropRect.x));
      const cy = Math.max(0, Math.round(cropRect.y));
      const cw = Math.min(Math.round(cropRect.w), imageLayout.naturalWidth - cx);
      const ch = Math.min(Math.round(cropRect.h), imageLayout.naturalHeight - cy);
      if (cw <= 10 || ch <= 10) { Alert.alert('Crop too small'); setBusy(false); return; }
      const result = await ImageManipulator.manipulateAsync(
        pages[activePage].originalUri,
        [{ crop: { originX: cx, originY: cy, width: cw, height: ch } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPages(prev => { const n = [...prev]; n[activePage] = { ...n[activePage], uri: result.uri, filter: 'original' as FilterName }; return n; });
      pushHistory(activePage, result.uri);
      setCropActive(false); setToolMode('none');
      getImageDimensions(result.uri).then(dims => { if (dims) { const l = computeImageLayout(dims.width, dims.height, IMG_AREA_W, IMG_AREA_H, 0); setImageLayout(l); setCropRect({ x: 0, y: 0, w: l.naturalWidth, h: l.naturalHeight }); } });
    } catch (e: any) { Alert.alert('Crop Error', e.message || 'Crop failed'); }
    finally { setBusy(false); }
  }, [pages, activePage, cropRect, imageLayout, editorSessionId, pushHistory]);"""
    c = c[:old_fn_start] + new_fn + c[old_fn_end + len("  }, [pages, activePage, corners, editorSessionId, pushHistory]);"):]

# 7. Replace toolbar
old_tb = """      {/* === PERSPECTIVE TOOLBAR === */}
      {toolMode === 'perspective' && (
        <View style={S.bb}>
          <TouchableOpacity style={S.cropBtn} onPress={() => setPerspActive(!perspActive)}>
            <Ionicons name="scan-outline" size={18} color="#FFF"/><Text style={S.cropBt}>{perspActive ? 'Lock' : 'Edit Corners'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn, S.cropApply]} onPress={doPerspective}>
            <Ionicons name="checkmark" size={18} color="#FFF"/><Text style={S.cropBt}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn, { backgroundColor: '#999' }]} onPress={() => { setToolMode('none'); setPerspActive(false); }}>
            <Ionicons name="close" size={18} color="#FFF"/><Text style={S.cropBt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}"""
new_tb = """      {/* === CROP TOOLBAR === */}
      {toolMode === 'crop' && (
        <View style={S.bb}>
          <TouchableOpacity style={S.cropBtn} onPress={() => { if (imageLayout) setCropRect({ x: 0, y: 0, w: imageLayout.naturalWidth, h: imageLayout.naturalHeight }); }}>
            <Ionicons name="expand-outline" size={18} color="#FFF"/><Text style={S.cropBt}>Full Page</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn, S.cropApply]} onPress={doCrop}>
            <Ionicons name="checkmark" size={18} color="#FFF"/><Text style={S.cropBt}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.cropBtn, { backgroundColor: '#999' }]} onPress={() => { setToolMode('none'); setCropActive(false); }}>
            <Ionicons name="close" size={18} color="#FFF"/><Text style={S.cropBt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}"""
c = c.replace(old_tb, new_tb)

# 8. Replace ToolBtn
c = c.replace(
    "<ToolBtn icon=\"scan-outline\" label=\"Perspective\" onPress={() => { setToolMode('perspective'); setPerspActive(true); }} />",
    "<ToolBtn icon=\"crop-outline\" label=\"Crop\" onPress={() => { setToolMode('crop'); setCropActive(true); }} />"
)

# 9. Replace PerspectiveEditor render in image area
old_render = """        {toolMode === 'perspective' && perspActive && imageLayout && (
          <PerspectiveEditor
            corners={corners}
            imageLayout={imageLayout}
            rotation={currentPage.rotation}
            draggingCorner={draggingCorner}
            onCornersChange={setCorners}
            onDragStart={setDraggingCorner}
            onDragEnd={() => setDraggingCorner(null)}
          />
        )}"""
new_render = """        {toolMode === 'crop' && cropActive && imageLayout && cropRect && (
          <SimpleCropOverlay
            imageLayout={imageLayout}
            cropRect={cropRect}
            onCropChange={setCropRect}
          />
        )}"""
c = c.replace(old_render, new_render)

# 10. Remove PerspectiveEditor + EdgeLine function block
m = re.search(r'\n// ── Edge line helper.*', c)
if m:
    end_m = re.search(r'\nfunction ToolBtn\(', c[m.start():])
    if end_m:
        c = c[:m.start()] + '\n' + c[m.start() + end_m.start():]

# 11. Add SimpleCropOverlay before ToolBtn
crop_overlay = """
// Simple rectangular crop overlay
function SimpleCropOverlay({ imageLayout, cropRect, onCropChange }: {
  imageLayout: any; cropRect: { x: number; y: number; w: number; h: number }; onCropChange: (r: { x: number; y: number; w: number; h: number }) => void;
}) {
  const { offsetX, offsetY, displayWidth, displayHeight, naturalWidth, naturalHeight } = imageLayout;
  const startRef = React.useRef<{ edge: string; rx: number; ry: number; rw: number; rh: number } | null>(null);
  const dl = offsetX + (cropRect.x / naturalWidth) * displayWidth;
  const dt = offsetY + (cropRect.y / naturalHeight) * displayHeight;
  const dw = (cropRect.w / naturalWidth) * displayWidth;
  const dh = (cropRect.h / naturalHeight) * displayHeight;
  const HS = 36;
  const makeEP = (edge: string) => React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startRef.current = { edge, rx: cropRect.x, ry: cropRect.y, rw: cropRect.w, rh: cropRect.h }; },
    onPanResponderMove: (_, gs) => { if (!startRef.current) return; const s = startRef.current;
      const dx = (gs.dx / displayWidth) * naturalWidth, dy = (gs.dy / displayHeight) * naturalHeight;
      let nx = s.rx, ny = s.ry, nw = s.rw, nh = s.rh;
      if (edge.includes('l')) { nx = Math.max(0, s.rx + dx); nw = s.rw + s.rx - nx; }
      if (edge.includes('r')) nw = Math.max(10, Math.min(naturalWidth - nx, s.rw + dx));
      if (edge.includes('t')) { ny = Math.max(0, s.ry + dy); nh = s.rh + s.ry - ny; }
      if (edge.includes('b')) nh = Math.max(10, Math.min(naturalHeight - ny, s.rh + dy));
      onCropChange({ x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) }); },
    onPanResponderRelease: () => { startRef.current = null; },
  }), [edge, cropRect, imageLayout, onCropChange]);
  return React.createElement(View, { style: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, pointerEvents: 'box-none' },
    React.createElement(View, { style: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }, pointerEvents: 'none' }),
    React.createElement(View, { style: { position: 'absolute', left: dl, top: dt, width: dw, height: dh, borderWidth: 2, borderColor: '#E17055', backgroundColor: 'transparent' }, pointerEvents: 'none' }),
    ...[{ e: 'l', x: dl, y: dt + dh/2 }, { e: 'r', x: dl + dw, y: dt + dh/2 }, { e: 't', x: dl + dw/2, y: dt }, { e: 'b', x: dl + dw/2, y: dt + dh }].map(h =>
      React.createElement(View, { key: h.e, ...makeEP(h.e).panHandlers, style: { position: 'absolute', left: h.x - HS/2, top: h.y - HS/2, width: HS, height: HS, backgroundColor: 'rgba(225,112,85,0.3)', borderRadius: 4, borderWidth: 1, borderColor: '#E17055' } })
    )
  );
}
"""
insert_pos = c.find('function ToolBtn(')
c = c[:insert_pos] + crop_overlay + '\n' + c[insert_pos:]

with open('ScanEditorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('All edits applied successfully')
