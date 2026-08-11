/**
 * DocumentScannerScreen -- CamScanner-like document scanner using
 * Google ML Kit Document Scanner (Android) / VisionKit (iOS).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, Share, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import {
  isNativeScannerAvailable,
  launchNativeScanner,
} from '../services/documentScanner';
import type { ScanResult } from '../services/documentScanner';
import { scanDocument, cleanupOcr } from '../services/apiClient';
import { multiPassOcr } from '../services/ocrPreprocessor';
import { addLockerDocument } from '../database/db';
import {
  generateScannedPdf, sharePdf,
  QUALITY_OPTIONS, estimatePdfImageSize,
} from '../services/pdf';
import type { QualityMode } from '../services/pdf';

type Props = NativeStackScreenProps<HomeStackParamList, 'DocumentScanner'>;
type Phase = 'idle' | 'review';

interface PageData {
  uri: string; ocrText: string; ocrDone: boolean; rotation: number;
}

type DocClassification =
  'PAN Card' | 'Aadhaar Card' | 'Voter ID' | 'Driving Licence'
  | 'Passport' | 'Bank Passbook' | 'Marksheet' | 'Caste Certificate'
  | 'Income Certificate' | 'Residence Certificate' | 'Land Registry'
  | 'Khatiyan' | 'Rent Receipt' | 'FIR' | 'Court Order'
  | 'Medical Report' | 'Other';

function classifyDocument(text: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (/[A-Z]{5}[0-9]{4}[A-Z]/.test(t) && /Income Tax|PAN/i.test(t))
    return { type: 'PAN Card' as DocClassification, cat: 'Identity', title: 'PAN Card' };
  if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(t) && /Aadhaar|UIDAI/i.test(t))
    return { type: 'Aadhaar Card' as DocClassification, cat: 'Identity', title: 'Aadhaar Card' };
  if (/Driving Licen[cs]e|DL No|RTO/i.test(t))
    return { type: 'Driving Licence' as DocClassification, cat: 'Identity', title: 'Driving Licence' };
  if (/Passport/i.test(t) && /[A-Z][0-9]{7}/.test(t))
    return { type: 'Passport' as DocClassification, cat: 'Identity', title: 'Passport' };
  if (/Bank|IFSC|Passbook/i.test(t))
    return { type: 'Bank Passbook' as DocClassification, cat: 'Bank', title: 'Bank Passbook' };
  if (/Marks?.Sheet|University|CGPA/i.test(t))
    return { type: 'Marksheet' as DocClassification, cat: 'Education', title: 'Marksheet' };
  if (/Caste|OBC|[SE]WS|Category/i.test(t))
    return { type: 'Caste Certificate' as DocClassification, cat: 'Income', title: 'Caste Certificate' };
  if (/Income Certificate|Annual Income/i.test(t))
    return { type: 'Income Certificate' as DocClassification, cat: 'Income', title: 'Income Certificate' };
  if (/Residence|Domicile/i.test(t))
    return { type: 'Residence Certificate' as DocClassification, cat: 'Identity', title: 'Residence Certificate' };
  if (/Registry|Sale Deed|Mutation/i.test(t))
    return { type: 'Land Registry' as DocClassification, cat: 'Land', title: 'Land Registry' };
  if (/Khatiyan|RoR|Jamabandi/i.test(t))
    return { type: 'Khatiyan' as DocClassification, cat: 'Land', title: 'Khatiyan' };
  if (/Rent|Receipt|Landlord|Tenant/i.test(t))
    return { type: 'Rent Receipt' as DocClassification, cat: 'Income', title: 'Rent Receipt' };
  if (/FIR|IPC|CrPC|Section \d{2,4}/i.test(t))
    return { type: 'FIR' as DocClassification, cat: 'Police', title: 'FIR' };
  if (/Court|Order|Judgment|Writ|Petition/i.test(t))
    return { type: 'Court Order' as DocClassification, cat: 'Court', title: 'Court Order' };
  if (/Medical|Hospital|Doctor|Prescription/i.test(t))
    return { type: 'Medical Report' as DocClassification, cat: 'Medical', title: 'Medical Report' };
  return { type: 'Other' as DocClassification, cat: 'Other', title: 'Scanned Document' };
}

const DIR = FileSystem.documentDirectory + 'digital-locker/scans/';
async function ensureDir() { await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }); }

function generateSessionId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function copyPerm(uri: string, sessionId: string): Promise<string> {
  await ensureDir();
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = DIR + `scan-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

// Per-PDF metadata for session verification
interface PdfMeta {
  sessionId: string;
  pageRevision: number;
  pdfUri: string;
}

export default function DocumentScannerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [pages, setPages] = useState<PageData[]>([]);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<'document'|'text'>('document');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [cls, setCls] = useState<ReturnType<typeof classifyDocument>|null>(null);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('Other');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUri, setPdfUri] = useState<string|null>(null);
  const [pdfName, setPdfName] = useState('');
  const [lockerBusy, setLockerBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced');
  const [qualitySheet, setQualitySheet] = useState(false);
  const [estSize, setEstSize] = useState<number>(0);
  const [finalSize, setFinalSize] = useState<number>(0);
  const nativeOk = isNativeScannerAvailable();

  // ── Session & revision tracking ────────────────────────────────────
  const [sessionId, setSessionId] = useState<string>('');
  const [pageRevision, setPageRevision] = useState(0);
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);

  // Refs for async callbacks to read current values without stale closures
  const pagesRef = useRef(pages);
  const sessionIdRef = useRef(sessionId);
  const pageRevisionRef = useRef(pageRevision);
  const pdfMetaRef = useRef(pdfMeta);

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { pageRevisionRef.current = pageRevision; }, [pageRevision]);
  useEffect(() => { pdfMetaRef.current = pdfMeta; }, [pdfMeta]);

  // Initialize a new session
  const newSession = useCallback(() => {
    const sid = generateSessionId();
    setSessionId(sid);
    sessionIdRef.current = sid;
    setPages([]);
    setIdx(0);
    setPhase('idle');
    setPdfUri(null);
    setPdfMeta(null);
    setPdfName('');
    setSaved(false);
    setCls(null);
    setTitle('');
    setCat('Other');
    setOcrBusy(false);
    setOcrFailed(false);
    setPageRevision(0);
    pageRevisionRef.current = 0;
    setQualitySheet(false);
  }, []);

  // Increment page revision (invalidates any existing PDF)
  const bumpRevision = useCallback(() => {
    setPageRevision(prev => {
      const next = prev + 1;
      pageRevisionRef.current = next;
      return next;
    });
    // Invalidate PDF when pages change
    setPdfUri(null);
    setPdfMeta(null);
    setPdfName('');
  }, []);

  const [ocrFailed, setOcrFailed] = useState(false);

  const runOcr = useCallback(async (list: PageData[], start: number, ownerSessionId: string) => {
    setOcrBusy(true);
    setOcrFailed(false);

    // Quick health check before running OCR
    let serverAvailable = true;
    try {
      const healthB64 = await FileSystem.readAsStringAsync(list[0]?.uri || '', {
        encoding: FileSystem.EncodingType.Base64, length: 1024, position: 0,
      }).catch(() => '');
      if (healthB64) {
        const healthCheck = await scanDocument(healthB64.substring(0, 100));
        if (!healthCheck.ok && healthCheck.status === 0) {
          serverAvailable = false;
        }
      }
    } catch { serverAvailable = false; }

    if (!serverAvailable) {
      setOcrBusy(false);
      setOcrFailed(true);
      return;
    }

    for (let i = start; i < list.length; i++) {
      // Verify session still active before processing each page
      if (sessionIdRef.current !== ownerSessionId) {
        console.log(`[OCR] Session changed (${ownerSessionId} → ${sessionIdRef.current}), discarding stale results`);
        break;
      }
      try {
        const b64 = await FileSystem.readAsStringAsync(list[i].uri, { encoding: FileSystem.EncodingType.Base64 });
        const r = await scanDocument(b64);
        let ocrText = '';
        let ocrConfidence = 0;

        if (r.ok && r.data?.rawText) {
          ocrText = r.data.rawText;
          if (i === 0) {
            const c = classifyDocument(ocrText);
            // Only apply classification if session hasn't changed
            if (sessionIdRef.current === ownerSessionId) {
              setCls(c); setTitle(c.title); setCat(c.cat);
            }
          }

          const isRegistry = /Registry|Sale Deed|Land|रजिस्ट्री|बैनामा|खतियान|Khatiyan|Jamabandi/i.test(ocrText);
          if (isRegistry && ocrText.length < 500) {
            const mpResult = await multiPassOcr(list[i].uri);
            if (mpResult && mpResult.overallConfidence > 0.4) {
              ocrText = mpResult.cleanedText;
              ocrConfidence = mpResult.overallConfidence;
              if (i === 0 && sessionIdRef.current === ownerSessionId) {
                const c2 = classifyDocument(ocrText);
                setCls(c2); setTitle(c2.title); setCat(c2.cat);
              }
            }
          }
        } else if (!r.ok && r.status === 0) {
          setOcrFailed(true);
        }

        // Only update pages if session hasn't changed
        if (sessionIdRef.current === ownerSessionId) {
          setPages(p => { const n = [...p]; if (n[i]) n[i] = {...n[i], ocrText, ocrDone: true}; return n; });
        }
      } catch (e: any) {
        if (sessionIdRef.current === ownerSessionId) {
          setPages(p => { const n = [...p]; if (n[i]) n[i] = {...n[i], ocrDone: true}; return n; });
        }
      }
    }
    if (sessionIdRef.current === ownerSessionId) {
      setOcrBusy(false);
    }
  }, []);

  const process = useCallback(async (r: ScanResult) => {
    if (r.didCancel) return;
    if (r.error) { Alert.alert('Error', r.errorMessage||'Scanner error'); return; }
    const imgs = r.images??[];
    if (!imgs.length) { Alert.alert('No pages'); return; }
    // Start a fresh session
    const sid = generateSessionId();
    setSessionId(sid);
    sessionIdRef.current = sid;
    // Route to professional editor first
    const uris = imgs.map(img => img.uri);
    navigation.navigate('ScanEditor', { imageUris: uris, sessionId: sid } as any);
  }, [navigation]);

  const scan = useCallback(async () => {
    const r = await launchNativeScanner({quality:0.9,includeBase64:false});
    if(r) await process(r);
  }, [process]);

  // Handle return from ScanEditor — session-aware with race protection
  const handleEditorReturn = useCallback(async (editedUris: string[]) => {
    if (!editedUris?.length) return;
    // Always create a fresh session for returned edits
    const sid = generateSessionId();
    setSessionId(sid);
    sessionIdRef.current = sid;
    // Reset all document state atomically
    setPages([]);
    setIdx(0);
    setPdfUri(null);
    setPdfMeta(null);
    setPdfName('');
    setSaved(false);
    setCls(null);
    setTitle('');
    setCat('Other');
    setPageRevision(0);
    pageRevisionRef.current = 0;
    setQualitySheet(false);

    const np: PageData[] = [];
    for (const uri of editedUris) {
      try { np.push({ uri: await copyPerm(uri, sid), ocrText: '', ocrDone: false, rotation: 0 }); }
      catch { np.push({ uri, ocrText: '', ocrDone: false, rotation: 0 }); }
    }

    // Guard: only apply if session hasn't been superseded
    if (sessionIdRef.current !== sid) {
      console.log(`[EditorReturn] Session superseded (${sid}), discarding`);
      return;
    }

    setPages(np);
    setPhase('review');
    runOcr(np, 0, sid);
  }, [runOcr]);

  // Receive edited images back from ScanEditor (must be after handleEditorReturn definition)
  React.useEffect(() => {
    const edited = (route.params as any)?.editedImages as string[] | undefined;
    if (edited?.length) {
      handleEditorReturn(edited);
      // Clear the param so we don't reprocess on re-render
      navigation.setParams({ editedImages: undefined } as any);
    }
  }, [(route.params as any)?.editedImages]);

  const camera = useCallback(async () => {
    const s = await ImagePicker.requestCameraPermissionsAsync(); if (s.status!=='granted') { Alert.alert('Permission','Camera permission required.'); return; }
    const r = await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:0.9,allowsEditing:false});
    if (r.canceled||!r.assets?.[0]) return;
    const sid = generateSessionId();
    setSessionId(sid);
    sessionIdRef.current = sid;
    navigation.navigate('ScanEditor', { imageUris: [r.assets[0].uri], sessionId: sid } as any);
  }, [navigation]);
  const gallery = useCallback(async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) { Alert.alert('Permission','Gallery permission required.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,quality:0.9});
    if (r.canceled||!r.assets?.length) return;
    const sid = generateSessionId();
    setSessionId(sid);
    sessionIdRef.current = sid;
    navigation.navigate('ScanEditor', { imageUris: r.assets.map(a => a.uri), sessionId: sid } as any);
  }, [navigation]);
  const addPage = useCallback(async () => {
    if (nativeOk) {
      const r = await launchNativeScanner({quality:0.9,includeBase64:false});
      if(!r||r.didCancel||r.error||!r.images?.length) return;
      // Route new pages through editor with existing pages
      navigation.navigate('ScanEditor', { imageUris: [...pages.map(p => p.uri), ...r.images.map(img => img.uri)], sessionId } as any);
    } else camera();
  }, [nativeOk, pages, sessionId, navigation, camera]);
  const rotate = useCallback((i:number,d:'left'|'right') => {
    setPages(p => { const n=[...p]; const delta=d==='left'?-90:90; n[i]={...n[i],rotation:((n[i].rotation+delta+360)%360)}; return n; });
    bumpRevision();
  }, [bumpRevision]);
  const del = useCallback((i:number) => {
    if(pages.length<=1){Alert.alert('कोई पृष्ठ नहीं','कम से कम 1 पृष्ठ आवश्यक है।\n\nNeed at least 1 page.');return;}
    Alert.alert('हटाएं? / Delete?','',[{text:'रद्द करें / Cancel',style:'cancel'},{text:'हटाएं / Delete',style:'destructive',onPress:()=>{
      setPages(p=>{const n=p.filter((_,x)=>x!==i);FileSystem.deleteAsync(p[i].uri,{idempotent:true}).catch(()=>{});return n;});
      if(idx>=i&&idx>0)setIdx(c=>c-1);
      bumpRevision();
    }}]);
  },[pages.length,idx,bumpRevision]);
  const rescan = useCallback(() => { newSession(); }, [newSession]);
  const aiClean = useCallback(async () => {
    const t=pages[idx]?.ocrText; if(!t?.trim()||aiBusy)return;
    const ownerSid = sessionIdRef.current;
    setAiBusy(true);
    try {
      const r=await cleanupOcr(t);
      if(r.ok&&r.data?.cleanedText && sessionIdRef.current === ownerSid){
        setPages(p=>{const n=[...p];n[idx]={...n[idx],ocrText:r.data!.cleanedText};return n;});
        Alert.alert('Done','AI cleaned OCR.');
      }
    }catch(e:any){Alert.alert('Error',e?.message||'Failed');}finally{
      if(sessionIdRef.current === ownerSid) setAiBusy(false);
    }
  }, [pages,idx,aiBusy]);
  const openQualitySheet = useCallback(async () => {
    if (pages.length === 0) { Alert.alert('कोई पृष्ठ नहीं', 'पीडीएफ बनाने के लिए पहले दस्तावेज़ स्कैन करें।\n\nScan a document first.'); return; }
    const est = await estimatePdfImageSize(pages.map(p => p.uri), qualityMode);
    setEstSize(est);
    setQualitySheet(true);
  }, [pages, qualityMode]);

  const genPdf = useCallback(async (mode: QualityMode) => {
    if (pdfBusy) return;
    if (pages.length === 0) { Alert.alert('कोई पृष्ठ नहीं', 'पीडीएफ बनाने के लिए पहले दस्तावेज़ स्कैन करें।\n\nNo pages to generate PDF.'); return; }

    // Verify all page URIs exist before generating
    for (let i = 0; i < pages.length; i++) {
      const info = await FileSystem.getInfoAsync(pages[i].uri);
      if (!info.exists) {
        Alert.alert('फ़ाइल गुम', `पृष्ठ ${i+1} की फ़ाइल नहीं मिली। कृपया दोबारा स्कैन करें।\n\nPage ${i+1} file missing. Please rescan.`);
        return;
      }
    }

    const ownerSid = sessionIdRef.current;
    const rev = pageRevisionRef.current;
    setQualitySheet(false);
    setPdfBusy(true);
    try {
      const r = await generateScannedPdf({
        imageUris: pages.map(p => p.uri),
        title: title || 'Document',
        qualityMode: mode,
        sessionId: ownerSid,
      });

      // Guard: only apply if session hasn't changed and pages haven't been modified
      if (sessionIdRef.current !== ownerSid) {
        console.log(`[PDF] Session changed, discarding generated PDF`);
        return;
      }
      if (pageRevisionRef.current !== rev) {
        console.log(`[PDF] Pages modified during generation (rev ${rev} → ${pageRevisionRef.current}), discarding`);
        return;
      }

      setPdfUri(r.uri);
      setPdfName(r.filename);
      setFinalSize(r.sizeBytes);
      setQualityMode(mode);
      setPdfMeta({ sessionId: ownerSid, pageRevision: rev, pdfUri: r.uri });
    } catch (e: any) {
      if (sessionIdRef.current === ownerSid) {
        Alert.alert('Error', e?.message || 'PDF failed');
      }
    } finally {
      if (sessionIdRef.current === ownerSid) {
        setPdfBusy(false);
      }
    }
  }, [pdfBusy, pages, title]);

  const share = useCallback(async () => {
    const currentSid = sessionIdRef.current;
    const currentRev = pageRevisionRef.current;
    const currentPages = pagesRef.current;
    const currentPdfUri = pdfMetaRef.current?.pdfUri || pdfUri;
    const currentPdfMeta = pdfMetaRef.current;

    // Guard: must have pages
    if (currentPages.length === 0) {
      Alert.alert('कोई पृष्ठ नहीं', 'साझा करने के लिए पहले दस्तावेज़ स्कैन करें।\n\nNo document to share.');
      return;
    }

    // If we have a PDF, verify it belongs to the current session and revision
    if (currentPdfUri && currentPdfMeta) {
      if (currentPdfMeta.sessionId !== currentSid) {
        console.log(`[Share] PDF belongs to session ${currentPdfMeta.sessionId}, current is ${currentSid} — regenerating`);
        // PDF is stale — clear it and fall through to the "no PDF" case
        setPdfUri(null);
        setPdfMeta(null);
        Alert.alert('PDF पुरानी हो गई', 'कृपया नई PDF बनाएं।\n\nThe PDF is from a previous document. Please generate a new PDF.');
        return;
      }
      if (currentPdfMeta.pageRevision !== currentRev) {
        console.log(`[Share] PDF revision ${currentPdfMeta.pageRevision} ≠ current ${currentRev} — regenerating`);
        setPdfUri(null);
        setPdfMeta(null);
        Alert.alert('PDF पुरानी हो गई', 'पृष्ठ बदल गए हैं। कृपया नई PDF बनाएं।\n\nPages have changed. Please generate a new PDF.');
        return;
      }

      // PDF is valid — verify file still exists
      const pdfInfo = await FileSystem.getInfoAsync(currentPdfUri);
      if (!pdfInfo.exists) {
        setPdfUri(null);
        setPdfMeta(null);
        Alert.alert('PDF गुम', 'PDF फ़ाइल नहीं मिली। कृपया नई PDF बनाएं।\n\nPDF file missing. Please regenerate.');
        return;
      }

      try { await sharePdf(currentPdfUri, pdfName); } catch {}
    } else if (currentPages.length === 1) {
      // Single page — verify URI exists
      const info = await FileSystem.getInfoAsync(currentPages[0].uri);
      if (!info.exists) {
        Alert.alert('फ़ाइल गुम', 'इमेज फ़ाइल नहीं मिली। कृपया दोबारा स्कैन करें।\n\nImage file missing. Please rescan.');
        return;
      }
      try { await Share.share({url: currentPages[0].uri}); } catch {}
    } else {
      Alert.alert('PDF बनाएं', 'पहले PDF बनाएं।\n\nGenerate PDF first.');
    }
  }, [pdfUri, pdfName, pdfMeta]);

  const save = useCallback(async () => {
    if(lockerBusy)return;
    if(pages.length===0){Alert.alert('कोई पृष्ठ नहीं','सेव करने के लिए कोई दस्तावेज़ नहीं है।\n\nNo document to save.');return;}

    const ownerSid = sessionIdRef.current;
    setLockerBusy(true);
    try {
      const fu = pages.length>1?(pdfUri||pages[0].uri):pages[0].uri;
      // Verify file URI exists
      const fuInfo = await FileSystem.getInfoAsync(fu);
      if (!fuInfo.exists) {
        Alert.alert('फ़ाइल गुम', 'सेव की जाने वाली फ़ाइल नहीं मिली।\n\nFile to save not found.');
        return;
      }
      const ocr = pages.map((p,i)=>'--- Page '+(i+1)+' ---\n'+p.ocrText).join('\n\n');
      const uris = JSON.stringify(pages.map(p=>p.uri));
      const notes = (ocr+'\n\n[PAGES:'+pages.length+']\n[URIS:'+uris+']').substring(0,5000);
      await addLockerDocument({title:title.trim()||'Scanned Document',category:cat as any,notes,file_uri:fu,tags:'scanned,'+cat+','+(cls?.type||'document')});
      if (sessionIdRef.current === ownerSid) {
        setSaved(true);
        Alert.alert('सेव हो गया','डिजिटल लॉकर में सेव हो गया।\n\nSaved to Digital Locker.');
      }
    } catch(e:any){
      if(sessionIdRef.current === ownerSid) {
        Alert.alert('Error',e?.message||'Save failed');
      }
    }finally{
      if(sessionIdRef.current === ownerSid) setLockerBusy(false);
    }
  }, [lockerBusy,pages,pdfUri,title,cat,cls]);

  if (phase==='idle') return (
    <View style={S.ct}><ScrollView contentContainerStyle={S.idle}>
      <View style={[S.icc,{backgroundColor:'#F0EDFF'}]}><Ionicons name="documents-outline" size={48} color="#6C5CE7"/></View>
      <Text style={S.it}>दस्तावेज़ स्कैन करें</Text><Text style={S.is}>Scan Document with ML Kit</Text>
      {!nativeOk && <View style={S.fsb}><Ionicons name="warning-outline" size={22} color="#E17055"/><Text style={S.fst}>उन्नत दस्तावेज़ स्कैनर इस बिल्ड में उपलब्ध नहीं है।{'\n'}आप कैमरा या गैलरी का उपयोग कर सकते हैं।{'\n\n'}Advanced scanner not available.</Text></View>}
      <View style={S.ic}><Ionicons name="bulb-outline" size={22} color="#F39C12"/><Text style={S.ict}>Place document on flat surface in good light.{'\n'}Auto edge detection & perspective correction.</Text></View>
      {nativeOk && <TouchableOpacity style={S.sb} onPress={scan} activeOpacity={0.7}><Ionicons name="scan-outline" size={24} color="#FFF"/><Text style={S.sbt}>दस्तावेज़ स्कैन करें</Text></TouchableOpacity>}
      <TouchableOpacity style={S.gb} onPress={gallery} activeOpacity={0.7}><Ionicons name="images-outline" size={24} color="#6C5CE7"/><Text style={S.gbt}>गैलरी से चुनें</Text></TouchableOpacity>
      <TouchableOpacity style={S.cb} onPress={camera} activeOpacity={0.7}><Ionicons name="camera-outline" size={24} color="#0984E3"/><Text style={S.cbt}>कैमरा से फोटो लें</Text></TouchableOpacity>
    </ScrollView></View>
  );

  const cp = pages[idx];
  return (
    <View style={[S.ct, { paddingTop: insets.top }]}>
      {ocrBusy && <View style={S.ob}><ActivityIndicator size="small" color="#E17055"/><Text style={S.obt}>OCR... ({pages.filter(p=>p.ocrDone).length}/{pages.length})</Text></View>}
      {ocrFailed && !ocrBusy && <View style={[S.ob, { backgroundColor: '#FFF0ED', borderBottomColor: '#F5D0C0' }]}>
        <Ionicons name="cloud-offline-outline" size={18} color="#E17055"/>
        <Text style={[S.obt,{flex:1}]}>OCR सेवा अभी उपलब्ध नहीं है। कृपया कुछ देर बाद पुनः प्रयास करें।</Text>
        <TouchableOpacity style={{backgroundColor:'#E17055',paddingHorizontal:12,paddingVertical:6,borderRadius:6}} onPress={() => runOcr(pages, 0, sessionIdRef.current)}>
          <Text style={{color:'#FFF',fontSize:12,fontWeight:'600'}}>पुनः प्रयास करें</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{backgroundColor:'#FFF',paddingHorizontal:10,paddingVertical:6,borderRadius:6,borderWidth:1,borderColor:'#E17055'}} onPress={() => setOcrFailed(false)}>
          <Text style={{color:'#E17055',fontSize:12,fontWeight:'600'}}>बिना OCR जारी रखें</Text>
        </TouchableOpacity>
      </View>}
      {cls && cls.type!=='Other' && <View style={S.clb}><Ionicons name="sparkles" size={16} color="#6C5CE7"/><Text style={S.clt}>Detected: {cls.type}</Text></View>}
      <View style={S.tb}>
        <TouchableOpacity style={[S.t,tab==='document'&&S.to]} onPress={()=>setTab('document')}><Ionicons name="document-outline" size={16} color={tab==='document'?'#E17055':'#999'}/><Text style={[S.tt,tab==='document'&&S.tto]}>दस्तावेज़</Text></TouchableOpacity>
        <TouchableOpacity style={[S.t,tab==='text'&&S.to]} onPress={()=>setTab('text')}><Ionicons name="text-outline" size={16} color={tab==='text'?'#E17055':'#999'}/><Text style={[S.tt,tab==='text'&&S.tto]}>निकाला गया टेक्स्ट</Text></TouchableOpacity>
      </View>
      <ScrollView style={S.scrollArea} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
      {tab==='document' && <View style={S.dtc}>
        {/* Page thumbnail strip for quick navigation */}
        {pages.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.thumbStrip} contentContainerStyle={S.thumbStripContent}>
            {pages.map((p, i) => (
              <TouchableOpacity key={i} style={[S.thumb, idx===i && S.thumbActive]} onPress={() => setIdx(i)}>
                <Image source={{uri: p.uri}} style={S.thumbImg} resizeMode="cover"/>
                <Text style={[S.thumbLabel, idx===i && S.thumbLabelActive]}>{i+1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={S.dp}>{cp ? <Image source={{uri:cp.uri}} style={[S.di,{transform:[{rotate:cp.rotation+'deg'}]}]} resizeMode="contain"/> : <View style={S.ni}><Ionicons name="image-outline" size={48} color="#CCC"/><Text style={S.nit}>No page</Text></View>}</View>
        {pages.length>1 && <View style={S.pn}><TouchableOpacity onPress={()=>setIdx(c=>Math.max(0,c-1))} disabled={idx<=0}><Ionicons name="chevron-back" size={24} color={idx>0?'#E17055':'#CCC'}/></TouchableOpacity><Text style={S.pc}>Page {idx+1}/{pages.length}</Text><TouchableOpacity onPress={()=>setIdx(c=>Math.min(pages.length-1,c+1))} disabled={idx>=pages.length-1}><Ionicons name="chevron-forward" size={24} color={idx<pages.length-1?'#E17055':'#CCC'}/></TouchableOpacity></View>}
        <View style={S.pa}><View style={S.par}><TouchableOpacity style={S.pab} onPress={()=>rotate(idx,'left')}><Ionicons name="refresh-outline" size={18} color="#555" style={{transform:[{scaleX:-1}]}}/><Text style={S.pat}>Rotate Left</Text></TouchableOpacity><TouchableOpacity style={S.pab} onPress={()=>rotate(idx,'right')}><Ionicons name="refresh-outline" size={18} color="#555"/><Text style={S.pat}>Rotate Right</Text></TouchableOpacity><TouchableOpacity style={S.pab} onPress={()=>del(idx)}><Ionicons name="trash-outline" size={18} color="#D63031"/><Text style={[S.pat,{color:'#D63031'}]}>Delete</Text></TouchableOpacity></View>
        <View style={S.par}><TouchableOpacity style={S.pab} onPress={addPage}><Ionicons name="add-circle-outline" size={18} color="#27AE60"/><Text style={[S.pat,{color:'#27AE60'}]}>Add Page</Text></TouchableOpacity><TouchableOpacity style={S.pab} onPress={rescan}><Ionicons name="scan-outline" size={18} color="#0984E3"/><Text style={[S.pat,{color:'#0984E3'}]}>Rescan</Text></TouchableOpacity></View></View>
        <Text style={S.pn2}>Document stored locally on your phone.</Text>
      </View>}
      {tab==='text' && cp && <View style={S.ttc}>
        <TextInput style={S.oti} value={cp.ocrText} onChangeText={t=>setPages(p=>{const n=[...p];n[idx]={...n[idx],ocrText:t};return n;})} multiline textAlignVertical="top" placeholder={cp.ocrDone?'No text found.':'OCR running...'} placeholderTextColor="#CCC"/>
        <View style={S.ta}><TouchableOpacity style={S.tab2} onPress={()=>Alert.alert('Copied','Text copied.')}><Ionicons name="copy-outline" size={16} color="#E17055"/><Text style={S.tal}>Copy</Text></TouchableOpacity>
        <TouchableOpacity style={[S.tab2,aiBusy&&S.dis]} onPress={aiClean} disabled={aiBusy}>{aiBusy?<ActivityIndicator size="small" color="#6C5CE7"/>:<><Ionicons name="sparkles-outline" size={16} color="#6C5CE7"/><Text style={[S.tal,{color:'#6C5CE7'}]}>AI Cleanup</Text></>}</TouchableOpacity></View>
      </View>}
      </ScrollView>
      {/* PDF Processing overlay */}
      {pdfBusy && <View style={S.pbo}><ActivityIndicator size="large" color="#E17055"/><Text style={S.pbot}>PDF तैयार हो रही है…</Text></View>}
      {/* PDF Result banner */}
      {pdfUri && !pdfBusy && <View style={S.pbr}>
        <Ionicons name="checkmark-circle" size={22} color="#27AE60"/>
        <View style={S.pbrt}>
          <Text style={S.pbrh}>PDF तैयार</Text>
          <Text style={S.pbrd}>{`पृष्ठ: ${pages.length}  •  गुणवत्ता: ${QUALITY_OPTIONS[qualityMode].label}  •  आकार: ${finalSize > 1024 * 1024 ? (finalSize / (1024 * 1024)).toFixed(1) + ' MB' : (finalSize / 1024).toFixed(0) + ' KB'}`}</Text>
        </View>
      </View>}
      {/* Quality selector modal */}
      {qualitySheet && <View style={S.qo}><TouchableOpacity style={S.qobg} onPress={() => setQualitySheet(false)} activeOpacity={1} /><View style={[S.qs, { paddingBottom: (insets.bottom > 0 ? insets.bottom + 8 : 20) }]}>
        <Text style={S.qst}>PDF गुणवत्ता / PDF Quality</Text>
        {(['small', 'balanced', 'high', 'original'] as QualityMode[]).map(m => (
          <TouchableOpacity key={m} style={[S.qr, qualityMode === m && S.qra]} onPress={() => { setQualityMode(m); estimatePdfImageSize(pages.map(p => p.uri), m).then(setEstSize); }}>
            <View style={S.qri}>
              <Text style={[S.qrl, qualityMode === m && S.qrla]}>{QUALITY_OPTIONS[m].label} <Text style={S.qrl2}>({QUALITY_OPTIONS[m].labelHi})</Text></Text>
              <Text style={S.qrd}>{m === 'small' ? 'WhatsApp व कम स्टोरेज के लिए' : m === 'balanced' ? 'डिफ़ॉल्ट — संतुलित गुणवत्ता' : m === 'high' ? 'सर्वोत्तम पठनीयता' : 'कोई रीकम्प्रेशन नहीं — बड़ी फ़ाइल'}</Text>
            </View>
            <Ionicons name={qualityMode === m ? 'radio-button-on' : 'radio-button-off'} size={22} color={qualityMode === m ? '#E17055' : '#CCC'} />
          </TouchableOpacity>
        ))}
        <Text style={S.qsi}>~{(estSize / 1024).toFixed(0)} KB अनुमानित • {pages.length} पृष्ठ</Text>
        <View style={S.qsa}>
          <TouchableOpacity style={S.qsb1} onPress={() => setQualitySheet(false)}><Text style={S.qsbt1}>रद्द करें</Text></TouchableOpacity>
          <TouchableOpacity style={S.qsb2} onPress={() => genPdf(qualityMode)}><Ionicons name="document-outline" size={16} color="#FFF"/><Text style={S.qsbt2}>PDF बनाएं</Text></TouchableOpacity>
        </View>
      </View></View>}
      <View style={[S.bb, { paddingBottom: (insets.bottom > 0 ? insets.bottom : 12) }]}>
        <TextInput style={S.li} value={title} onChangeText={setTitle} placeholder="Document name..." placeholderTextColor="#CCC"/>
        <View style={S.ar}><TouchableOpacity style={[S.ab,S.al,(lockerBusy||saved||pages.length===0)&&S.dis]} onPress={save} disabled={lockerBusy||saved||pages.length===0}>{lockerBusy?<ActivityIndicator size="small" color="#FFF"/>:saved?<><Ionicons name="checkmark-circle" size={16} color="#FFF"/><Text style={S.at}>Saved</Text></>:<><Ionicons name="cloud-upload-outline" size={16} color="#FFF"/><Text style={S.at}>Save to Locker</Text></>}</TouchableOpacity>
        <TouchableOpacity style={[S.ab,S.ap,(pdfBusy||pages.length===0)&&S.dis]} onPress={openQualitySheet} disabled={pdfBusy||pages.length===0}>{pdfBusy?<ActivityIndicator size="small" color="#FFF"/>:<><Ionicons name="document-outline" size={16} color="#FFF"/><Text style={S.at}>PDF बनाएं</Text></>}</TouchableOpacity></View>
        <View style={S.ar}><TouchableOpacity style={[S.ab,S.as,pages.length===0&&S.dis]} onPress={share} disabled={pages.length===0}><Ionicons name="share-social-outline" size={16} color="#FFF"/><Text style={S.at}>Share</Text></TouchableOpacity>
        <TouchableOpacity style={[S.ab,S.au]} onPress={()=>navigation.navigate('HomeMain')}><Ionicons name="create-outline" size={16} color="#FFF"/><Text style={S.at}>Use in Application</Text></TouchableOpacity></View>
        {pages.length === 0 && <Text style={S.emptyWarn}>⚠️ कोई पृष्ठ नहीं — कृपया दस्तावेज़ स्कैन करें</Text>}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  ct:{flex:1,backgroundColor:'#FFF8F0'},
  scrollArea:{flex:1},
  scrollContent:{paddingBottom:8},
  thumbStrip:{maxHeight:72,marginHorizontal:12,marginTop:8},
  thumbStripContent:{flexDirection:'row',gap:6,paddingRight:12},
  thumb:{width:48,height:60,borderRadius:6,borderWidth:2,borderColor:'#E0E0E0',overflow:'hidden',alignItems:'center',justifyContent:'center'},
  thumbActive:{borderColor:'#E17055',borderWidth:2.5},
  thumbImg:{width:'100%',height:'100%'},
  thumbLabel:{position:'absolute',bottom:2,right:4,fontSize:9,fontWeight:'700',color:'#FFF',backgroundColor:'rgba(0,0,0,0.5)',paddingHorizontal:4,borderRadius:3},
  thumbLabelActive:{backgroundColor:'#E17055'},
  idle:{padding:24,alignItems:'center',paddingBottom:60},
  icc:{width:96,height:96,borderRadius:48,alignItems:'center',justifyContent:'center',marginBottom:20},
  it:{fontSize:22,fontWeight:'700',color:'#1A1A2E',textAlign:'center'},
  is:{fontSize:14,color:'#999',marginTop:4,marginBottom:24},
  ic:{flexDirection:'row',backgroundColor:'#FFF',borderRadius:12,padding:16,marginBottom:16,gap:12,alignItems:'flex-start',alignSelf:'stretch'},
  ict:{flex:1,fontSize:14,color:'#555',lineHeight:22},
  fsb:{flexDirection:'row',backgroundColor:'#FFF0ED',borderRadius:12,padding:16,marginBottom:16,gap:12,alignItems:'flex-start',borderWidth:1,borderColor:'#F5D0C0',alignSelf:'stretch'},
  fst:{flex:1,fontSize:13,color:'#C0392B',lineHeight:20},
  sb:{flexDirection:'row',backgroundColor:'#6C5CE7',paddingVertical:16,paddingHorizontal:32,borderRadius:14,alignItems:'center',justifyContent:'center',gap:10,marginTop:4,alignSelf:'stretch'},
  sbt:{fontSize:17,fontWeight:'700',color:'#FFF'},
  gb:{flexDirection:'row',backgroundColor:'#FFF',paddingVertical:14,paddingHorizontal:32,borderRadius:14,alignItems:'center',justifyContent:'center',gap:10,borderWidth:1.5,borderColor:'#6C5CE7',marginTop:12,alignSelf:'stretch'},
  gbt:{fontSize:16,fontWeight:'600',color:'#6C5CE7'},
  cb:{flexDirection:'row',backgroundColor:'#FFF',paddingVertical:14,paddingHorizontal:32,borderRadius:14,alignItems:'center',justifyContent:'center',gap:10,borderWidth:1.5,borderColor:'#0984E3',marginTop:12,alignSelf:'stretch'},
  cbt:{fontSize:16,fontWeight:'600',color:'#0984E3'},
  ob:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#FFF0ED',paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F5E0D8'},
  obt:{fontSize:13,color:'#E17055',fontWeight:'500'},
  clb:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#F0EDFF',paddingHorizontal:16,paddingVertical:8},
  clt:{fontSize:13,color:'#6C5CE7',fontWeight:'600'},
  tb:{flexDirection:'row',backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#F0E8E0'},
  t:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:12},
  to:{borderBottomWidth:2,borderBottomColor:'#E17055'},
  tt:{fontSize:13,color:'#999',fontWeight:'500'},
  tto:{color:'#E17055',fontWeight:'600'},
  dtc:{flex:1},
  dp:{flex:1,backgroundColor:'#F5F5F5',marginHorizontal:12,marginTop:10,borderRadius:12,alignItems:'center',justifyContent:'center',overflow:'hidden',minHeight:300},
  di:{width:'100%',height:'100%'},
  ni:{alignItems:'center',gap:12},
  nit:{fontSize:14,color:'#CCC'},
  pn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:20,paddingVertical:12},
  pc:{fontSize:15,fontWeight:'600',color:'#555'},
  pa:{paddingHorizontal:12,gap:8},
  par:{flexDirection:'row',gap:8},
  pab:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:'#FFF',borderRadius:8,paddingVertical:10,borderWidth:1,borderColor:'#E8E8E8'},
  pat:{fontSize:12,color:'#555',fontWeight:'500'},
  pn2:{fontSize:10,color:'#AAA',textAlign:'center',paddingVertical:8},
  ttc:{flex:1,padding:12},
  oti:{flex:1,backgroundColor:'#FFF',borderRadius:12,padding:16,fontSize:16,lineHeight:28,color:'#1A1A2E',textAlignVertical:'top',minHeight:300},
  ta:{flexDirection:'row',gap:10,marginTop:10},
  tab2:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FFF',borderRadius:8,paddingHorizontal:16,paddingVertical:10,borderWidth:1,borderColor:'#E8E8E8'},
  tal:{fontSize:13,color:'#E17055',fontWeight:'500'},
  bb:{paddingHorizontal:12,paddingVertical:10,backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#F0E8E0',gap:8},
  li:{backgroundColor:'#F8F8F8',borderRadius:8,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:'#1A1A2E',borderWidth:1,borderColor:'#E8E8E8'},
  ar:{flexDirection:'row',gap:8},
  ab:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:11,borderRadius:10,gap:6},
  dis:{opacity:0.4},
  at:{fontSize:12,fontWeight:'600',color:'#FFF'},
  al:{backgroundColor:'#27AE60',flex:1.5},
  ap:{backgroundColor:'#E17055'},
  as:{backgroundColor:'#0984E3'},
  au:{backgroundColor:'#6C5CE7',flex:1.5},
  // Quality selector modal
  qo:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:100},
  qobg:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.4)'},
  qs:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFF',borderTopLeftRadius:20,borderTopRightRadius:20,paddingHorizontal:20,paddingTop:20,maxHeight:'80%'},
  qst:{fontSize:17,fontWeight:'700',color:'#1A1A2E',marginBottom:16,textAlign:'center'},
  qr:{flexDirection:'row',alignItems:'center',paddingVertical:14,paddingHorizontal:12,borderRadius:10,gap:12,marginBottom:6},
  qra:{backgroundColor:'#FFF0ED',borderWidth:1,borderColor:'#F5D0C0'},
  qri:{flex:1},
  qrl:{fontSize:15,fontWeight:'600',color:'#1A1A2E'},
  qrla:{color:'#E17055'},
  qrl2:{fontSize:13,fontWeight:'400',color:'#999'},
  qrd:{fontSize:12,color:'#999',marginTop:2},
  qsi:{fontSize:12,color:'#AAA',textAlign:'center',marginTop:8,marginBottom:12},
  qsa:{flexDirection:'row',gap:10,marginTop:4},
  qsb1:{flex:1,alignItems:'center',paddingVertical:12,borderRadius:10,borderWidth:1,borderColor:'#E0E0E0'},
  qsbt1:{fontSize:14,fontWeight:'600',color:'#555'},
  qsb2:{flex:2,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:12,borderRadius:10,backgroundColor:'#E17055',gap:8},
  qsbt2:{fontSize:14,fontWeight:'700',color:'#FFF'},
  // PDF result + processing
  pbo:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(255,248,240,0.95)',alignItems:'center',justifyContent:'center',zIndex:99,gap:16},
  pbot:{fontSize:16,fontWeight:'600',color:'#E17055',marginTop:4},
  pbr:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#E8F8E8',marginHorizontal:12,marginBottom:4,paddingHorizontal:14,paddingVertical:10,borderRadius:10},
  pbrt:{flex:1},
  pbrh:{fontSize:14,fontWeight:'700',color:'#1A1A2E'},
  pbrd:{fontSize:11,color:'#555',marginTop:1},
  emptyWarn:{fontSize:11,color:'#E17055',textAlign:'center',paddingVertical:2,fontWeight:'500'},
});
