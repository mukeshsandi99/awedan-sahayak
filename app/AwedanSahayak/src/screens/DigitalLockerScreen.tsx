/**
 * DigitalLockerScreen — Local document library.
 * Add, search, filter, and delete government documents securely.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { LockerDocument, DocCategory } from '../types/database';
import { getAllLockerDocuments, addLockerDocument, deleteLockerDocument, getLockerStats } from '../database/db';

type Props = NativeStackScreenProps<HomeStackParamList, 'DigitalLocker'>;

const CATEGORIES: { key: DocCategory; label: string; icon: string }[] = [
  { key: 'Identity', label: 'पहचान', icon: 'person-outline' },
  { key: 'Land', label: 'भूमि', icon: 'earth-outline' },
  { key: 'Court', label: 'कोर्ट', icon: 'scale-outline' },
  { key: 'Police', label: 'पुलिस', icon: 'shield-outline' },
  { key: 'Bank', label: 'बैंक', icon: 'card-outline' },
  { key: 'Medical', label: 'चिकित्सा', icon: 'medkit-outline' },
  { key: 'Education', label: 'शिक्षा', icon: 'school-outline' },
  { key: 'Income', label: 'आय', icon: 'cash-outline' },
  { key: 'Pension', label: 'पेंशन', icon: 'wallet-outline' },
  { key: 'Other', label: 'अन्य', icon: 'folder-outline' },
];
const FILTER_LABELS = ['सभी', ...CATEGORIES.map(c => c.label)];

export default function DigitalLockerScreen({ navigation }: Props) {
  const [docs, setDocs] = useState<LockerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; categories: Record<string, number> }>({ total: 0, categories: {} });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('सभी');
  const [addVisible, setAddVisible] = useState(false);

  // Add form
  const [addTitle, setAddTitle] = useState('');
  const [addCat, setAddCat] = useState<DocCategory>('Other');
  const [addTags, setAddTags] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addUri, setAddUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    const catKey = filter === 'सभी' ? undefined : CATEGORIES.find(c => c.label === filter)?.key;
    const rows = await getAllLockerDocuments(catKey, search || undefined);
    setDocs(rows);
    const s = await getLockerStats();
    setStats(s);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const u = navigation.addListener('focus', load); return u; }, [navigation, load]);

  const pickFile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('⚠️', 'गैलरी की अनुमति आवश्यक है।'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!r.canceled && r.assets[0]) setAddUri(r.assets[0].uri);
  };

  const handleAdd = async () => {
    if (!addTitle.trim()) { Alert.alert('⚠️', 'शीर्षक आवश्यक है।'); return; }
    await addLockerDocument({ title: addTitle.trim(), category: addCat, tags: addTags.trim(), notes: addNotes.trim() || null, file_uri: addUri });
    setAddVisible(false); setAddTitle(''); setAddCat('Other'); setAddTags(''); setAddNotes(''); setAddUri(null);
    load();
  };

  const handleDelete = (doc: LockerDocument) => {
    Alert.alert('दस्तावेज़ हटाएं?', `"${doc.title}" हटाना चाहते हैं?`, [
      { text: 'रद्द करें', style: 'cancel' },
      { text: 'हटाएं', style: 'destructive', onPress: async () => { await deleteLockerDocument(doc.id); load(); } },
    ]);
  };

  // Mask Aadhaar-like patterns in text
  const safeText = (t: string | null) => (t || '').replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****');

  const renderDoc = ({ item }: { item: LockerDocument }) => {
    const cat = CATEGORIES.find(c => c.key === item.category);
    return (
      <TouchableOpacity style={S.docCard} activeOpacity={0.8} onPress={() => item.file_uri && setViewerUri(item.file_uri)}>
        {item.file_uri ? (
          <Image source={{ uri: item.file_uri }} style={S.docThumb} resizeMode="cover" />
        ) : null}
        <View style={S.docHeader}>
          <Ionicons name={(cat?.icon || 'folder-outline') as any} size={18} color="#E17055" />
          <Text style={S.docCat}>{cat?.label || item.category}</Text>
          {item.file_uri && <Ionicons name="image-outline" size={14} color="#27AE60" />}
          <TouchableOpacity onPress={() => handleDelete(item)}><Ionicons name="trash-outline" size={18} color="#D63031" /></TouchableOpacity>
        </View>
        <Text style={S.docTitle} numberOfLines={1}>{item.title}</Text>
        {item.tags ? <Text style={S.docTags} numberOfLines={1}>{item.tags}</Text> : null}
        {item.notes ? <Text style={S.docNotes} numberOfLines={1}>{safeText(item.notes)}</Text> : null}
        <View style={S.docMeta}>
          <Text style={S.metaText}>{item.date_added?.substring(0, 10)}</Text>
          {item.expiry_date ? <Text style={S.metaExpiry}>समाप्ति: {item.expiry_date.substring(0, 10)}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={S.container}>
      {/* Stats */}
      <View style={S.statsRow}>
        <View style={S.statChip}><Text style={S.statNum}>{stats.total}</Text><Text style={S.statLbl}>कुल</Text></View>
        {CATEGORIES.slice(0, 5).map(c => (
          <View key={c.key} style={S.statChip}><Text style={S.statNum}>{stats.categories[c.key] || 0}</Text><Text style={S.statLbl}>{c.label}</Text></View>
        ))}
      </View>

      {/* Search + Filter */}
      <View style={S.searchBar}>
        <Ionicons name="search" size={16} color="#999" />
        <TextInput style={S.searchInput} value={search} onChangeText={setSearch} placeholder="खोजें..." placeholderTextColor="#CCC" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.filterRow} contentContainerStyle={S.filterContent}>
        {FILTER_LABELS.map(f => (
          <TouchableOpacity key={f} style={[S.chip, filter === f && S.chipOn]} onPress={() => setFilter(f)}>
            <Text style={[S.chipText, filter === f && S.chipTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Document List */}
      {loading ? <ActivityIndicator size="large" color="#E17055" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={docs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDoc}
          contentContainerStyle={S.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="folder-open-outline" size={48} color="#CCC" />
              <Text style={S.emptyTitle}>अभी कोई दस्तावेज़ नहीं जोड़ा गया है।</Text>
              <TouchableOpacity style={S.addFirstBtn} onPress={() => setAddVisible(true)}>
                <Text style={S.addFirstText}>पहला दस्तावेज़ जोड़ें</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={S.fab} onPress={() => setAddVisible(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Full-screen Image Viewer */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={S.viewerOverlay}>
          <TouchableOpacity style={S.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          {viewerUri && <Image source={{ uri: viewerUri }} style={S.viewerImage} resizeMode="contain" />}
          <Text style={S.viewerPrivacy}>🔒 दस्तावेज़ आपके फोन में स्थानीय रूप से सुरक्षित है।</Text>
        </View>
      </Modal>

      {/* Add Document Modal */}
      <Modal visible={addVisible} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalCard}>
            <ScrollView>
              <Text style={S.modalTitle}>दस्तावेज़ जोड़ें</Text>
              <Text style={S.fieldLabel}>शीर्षक *</Text>
              <TextInput style={S.fieldInput} value={addTitle} onChangeText={setAddTitle} placeholder="जैसे: आधार कार्ड" placeholderTextColor="#CCC" />
              <Text style={S.fieldLabel}>श्रेणी</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.key} style={[S.catChip, addCat === c.key && S.catChipOn]} onPress={() => setAddCat(c.key)}>
                    <Text style={[S.catChipText, addCat === c.key && S.catChipTextOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={S.fieldLabel}>टैग (comma separated)</Text>
              <TextInput style={S.fieldInput} value={addTags} onChangeText={setAddTags} placeholder="जैसे: आधार, पहचान" placeholderTextColor="#CCC" />
              <Text style={S.fieldLabel}>नोट्स</Text>
              <TextInput style={[S.fieldInput, { minHeight: 60 }]} value={addNotes} onChangeText={setAddNotes} placeholder="कोई नोट..." placeholderTextColor="#CCC" multiline textAlignVertical="top" />
              <TouchableOpacity style={S.pickBtn} onPress={pickFile}><Ionicons name="image-outline" size={18} color="#E17055" /><Text style={S.pickText}>{addUri ? 'फाइल चुनी गई ✓' : 'फोटो/फाइल चुनें'}</Text></TouchableOpacity>
              <View style={S.modalActions}>
                <TouchableOpacity style={S.cancelBtn} onPress={() => setAddVisible(false)}><Text style={S.cancelText}>रद्द करें</Text></TouchableOpacity>
                <TouchableOpacity style={S.saveBtn} onPress={handleAdd}><Text style={S.saveText}>सेव करें</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, paddingBottom: 4 },
  statChip: { backgroundColor: '#FFF', borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 56, borderWidth: 1, borderColor: '#F0E8E0' },
  statNum: { fontSize: 18, fontWeight: '800', color: '#E17055' },
  statLbl: { fontSize: 10, color: '#999', marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', marginHorizontal: 12, marginTop: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E8E8E8' },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A2E' },
  filterRow: { maxHeight: 44, marginVertical: 8 },
  filterContent: { flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E8E8' },
  chipOn: { backgroundColor: '#E17055', borderColor: '#E17055' },
  chipText: { fontSize: 11, color: '#777', fontWeight: '500' },
  chipTextOn: { color: '#FFF' },
  list: { padding: 12, paddingTop: 4, paddingBottom: 80 },
  docCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F0E8E0' },
  docThumb: { width: '100%', height: 140, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginBottom: 10 },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  docCat: { fontSize: 11, color: '#E17055', fontWeight: '600', flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  docTags: { fontSize: 11, color: '#0984E3', marginBottom: 2 },
  docNotes: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 6 },
  docMeta: { flexDirection: 'row', gap: 10 },
  metaText: { fontSize: 10, color: '#BBB' },
  metaExpiry: { fontSize: 10, color: '#F39C12', fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 14, color: '#999', marginTop: 12, marginBottom: 16 },
  addFirstBtn: { backgroundColor: '#E17055', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  addFirstText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#E17055', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#E17055', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 8 },
  fieldInput: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 10, fontSize: 14, color: '#1A1A2E', borderWidth: 1, borderColor: '#E8E8E8' },
  catChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E8E8', marginRight: 6 },
  catChipOn: { backgroundColor: '#E17055', borderColor: '#E17055' },
  catChipText: { fontSize: 11, color: '#777' },
  catChipTextOn: { color: '#FFF' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0ED', borderRadius: 8, padding: 12, marginTop: 12 },
  pickText: { fontSize: 13, color: '#E17055', fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CCC' },
  cancelText: { fontSize: 13, color: '#999', fontWeight: '600' },
  saveBtn: { backgroundColor: '#27AE60', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  saveText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  viewerOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  viewerImage: { width: '100%', height: '70%' },
  viewerPrivacy: { color: '#888', fontSize: 11, marginTop: 16 },
});
