import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ToolsStackParamList } from '../../navigation/ToolsStack';
import { insertBiodataDraft, updateBiodataDraft, getBiodataDraftById } from '../../database/db';
import type { MarriageBiodataDraftInsert } from '../../types/database';
import { BIODATA_THEME_LABELS, type BiodataColorTheme, BIODATA_THEME_COLORS } from '../../utils/biodataTemplates';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { COLORS, FONT, SPACING, RADIUS } from '../../constants/theme';

type Props = NativeStackScreenProps<ToolsStackParamList, 'BiodataForm'>;

interface FormData {
  full_name: string; dob: string; age: string; height: string;
  gender: string; religion: string; caste: string; gotra: string;
  education: string; occupation: string; income: string;
  father_name: string; mother_name: string; family_details: string;
  address: string; contact_details: string; siblings: string;
  hobbies: string; expectations: string; horoscope_details: string;
  template_style: string; language: string; photo_uri: string;
  color_theme: BiodataColorTheme;
}

const EMPTY_FORM: FormData = {
  full_name: '', dob: '', age: '', height: '', gender: '', religion: '',
  caste: '', gotra: '', education: '', occupation: '', income: '',
  father_name: '', mother_name: '', family_details: '', address: '',
  contact_details: '', siblings: '', hobbies: '', expectations: '',
  horoscope_details: '', template_style: 'classic', language: 'hi', photo_uri: '',
  color_theme: 'maroon',
};

export default function BiodataFormScreen({ navigation, route }: Props) {
  const draftId = route.params?.draftId;
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draftId) {
      getBiodataDraftById(draftId).then((d) => {
        if (d) setForm({
          full_name: d.full_name ?? '', dob: d.dob ?? '', age: d.age?.toString() ?? '',
          height: d.height ?? '', gender: d.gender ?? '', religion: d.religion ?? '',
          caste: d.caste ?? '', gotra: d.gotra ?? '', education: d.education ?? '',
          occupation: d.occupation ?? '', income: d.income ?? '',
          father_name: d.father_name ?? '', mother_name: d.mother_name ?? '',
          family_details: d.family_details ?? '', address: d.address ?? '',
          contact_details: d.contact_details ?? '', siblings: d.siblings ?? '',
          hobbies: d.hobbies ?? '', expectations: d.expectations ?? '',
          horoscope_details: d.horoscope_details ?? '',
          template_style: d.template_style, language: d.language, photo_uri: d.photo_uri ?? '',
          color_theme: (d.color_theme as BiodataColorTheme) ?? 'maroon',
        });
      });
    }
  }, [draftId]);

  const update = (key: keyof FormData, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Voice input hook for biodata fields
  const [voiceField, setVoiceField] = useState<string | null>(null);
  const voiceHook = useVoiceInput({
    locale: 'hi-IN',
    onResult: (text) => {
      if (voiceField) {
        setForm(f => ({ ...f, [voiceField]: f[voiceField as keyof FormData] ? String(f[voiceField as keyof FormData]) + ' ' + text : text }));
      }
    },
  });

  const calcAge = () => {
    if (!form.dob) return;
    const d = new Date(form.dob);
    if (isNaN(d.getTime())) return;
    const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    update('age', age.toString());
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('अनुमति नहीं', 'फोटो चुनने के लिए अनुमति दें।'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const cropped = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 400 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      update('photo_uri', cropped.uri);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const insert: MarriageBiodataDraftInsert = {
        full_name: form.full_name || null, photo_uri: form.photo_uri || null,
        dob: form.dob || null, age: form.age ? parseInt(form.age) : null,
        height: form.height || null, gender: form.gender || null,
        religion: form.religion || null, caste: form.caste || null,
        gotra: form.gotra || null, education: form.education || null,
        occupation: form.occupation || null, income: form.income || null,
        father_name: form.father_name || null, mother_name: form.mother_name || null,
        family_details: form.family_details || null, address: form.address || null,
        contact_details: form.contact_details || null, siblings: form.siblings || null,
        hobbies: form.hobbies || null, expectations: form.expectations || null,
        horoscope_details: form.horoscope_details || null,
        template_style: form.template_style,
        language: form.language,
        color_theme: form.color_theme,
        is_draft: 1,
      };
      if (draftId) {
        await updateBiodataDraft(draftId, insert);
        Alert.alert('सेव्ड', 'बायोडाटा अपडेट हो गया।');
      } else {
        const saved = await insertBiodataDraft(insert);
        navigation.setParams({ draftId: saved.id } as any);
        Alert.alert('सेव्ड', 'बायोडाटा सेव हो गया।');
      }
    } catch (e: any) {
      Alert.alert('त्रुटि', e?.message ?? 'सेव नहीं हो सका।');
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    if (!draftId && !route.params?.draftId) {
      Alert.alert('पहले सेव करें', 'प्रीव्यू के लिए पहले ड्राफ्ट सेव करें।');
      return;
    }
    navigation.navigate('BiodataPreview', { draftId: draftId ?? route.params?.draftId ?? 0 });
  };

  const isMicField = (k: string) => !['dob', 'age', 'income', 'height'].includes(k);

  const inputField = (label: string, key: keyof FormData, opts?: { numeric?: boolean; multiline?: boolean }) => (
    <View style={styles.fieldGroup}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.label}>{label}</Text>
        {isMicField(key as string) && (
          <TouchableOpacity
            onPress={() => {
              if (voiceField === key) { voiceHook.stopListening(); setVoiceField(null); }
              else { setVoiceField(key as string); voiceHook.startListening(); }
            }}
            style={styles.micBtn}
          >
            <Ionicons name={voiceField === key && voiceHook.isListening ? 'mic' : 'mic-outline'} size={18} color={voiceField === key && voiceHook.isListening ? '#E17055' : '#999'} />
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={[styles.input, opts?.multiline && styles.textArea]}
        value={form[key]}
        onChangeText={(t) => update(key, t)}
        keyboardType={opts?.numeric ? 'numeric' : 'default'}
        multiline={opts?.multiline}
        placeholderTextColor="#CCC"
      />
      {voiceField === key && voiceHook.isListening && <Text style={{ fontSize: 11, color: '#E17055', marginTop: 2 }}>🎤 सुन रहा हूँ...</Text>}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* Template & Language selectors */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>टेम्पलेट</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['classic', 'elegant', 'modern', 'traditional', 'professional'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, form.template_style === t && styles.chipActive]} onPress={() => update('template_style', t)}>
                <Text style={[styles.chipText, form.template_style === t && styles.chipTextActive]}>
                  {t === 'classic' ? 'क्लासिक' : t === 'elegant' ? 'एलिगेंट' : t === 'modern' ? 'मॉडर्न' : t === 'traditional' ? 'पारंपरिक' : 'प्रोफेशनल'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      {/* Color theme selector */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>रंग / Theme</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(BIODATA_THEME_LABELS) as BiodataColorTheme[]).map((theme) => {
              const tc = BIODATA_THEME_COLORS[theme];
              return (
                <TouchableOpacity
                  key={theme}
                  style={[styles.chip, form.color_theme === theme && { backgroundColor: tc.primary, borderColor: tc.primary }]}
                  onPress={() => update('color_theme', theme)}
                >
                  <View style={[styles.colorDot, { backgroundColor: tc.primary }]} />
                  <Text style={[styles.chipText, form.color_theme === theme && { color: '#FFF' }]}>
                    {BIODATA_THEME_LABELS[theme]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>भाषा / Language</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.chip, form.language === 'hi' && styles.chipActive]} onPress={() => update('language', 'hi')}>
              <Text style={[styles.chipText, form.language === 'hi' && styles.chipTextActive]}>🇮🇳 हिंदी</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, form.language === 'en' && styles.chipActive]} onPress={() => update('language', 'en')}>
              <Text style={[styles.chipText, form.language === 'en' && styles.chipTextActive]}>🇬🇧 English</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Photo */}
      <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
        {form.photo_uri ? (
          <Image source={{ uri: form.photo_uri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={32} color="#CCC" />
            <Text style={styles.photoHint}>फोटो जोड़ें</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Personal */}
      <Text style={styles.sectionTitle}>व्यक्तिगत जानकारी</Text>
      {inputField('पूरा नाम (Full Name)*', 'full_name')}
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>{inputField('जन्म तिथि (YYYY-MM-DD)', 'dob')}</View>
        <View style={{ flex: 1 }}>{inputField('आयु', 'age', { numeric: true })}</View>
  </View>
      <TouchableOpacity style={styles.calcAgeBtn} onPress={calcAge}>
        <Text style={styles.calcAgeText}>DOB से आयु कैलकुलेट करें</Text>
      </TouchableOpacity>
      {inputField('ऊंचाई (Height)', 'height')}
      {inputField('लिंग (Gender)', 'gender')}

      {/* Religion/Caste */}
      <Text style={styles.sectionTitle}>धर्म व जाति</Text>
      {inputField('धर्म (Religion)', 'religion')}
      {inputField('जाति/समुदाय (Caste)', 'caste')}
      {inputField('गोत्र (Gotra)', 'gotra')}

      {/* Education/Career */}
      <Text style={styles.sectionTitle}>शिक्षा व करियर</Text>
      {inputField('शिक्षा (Education)', 'education')}
      {inputField('व्यवसाय (Occupation)', 'occupation')}
      {inputField('आय (Income)', 'income')}

      {/* Family */}
      <Text style={styles.sectionTitle}>परिवार</Text>
      {inputField('पिता का नाम (Father)', 'father_name')}
      {inputField('माता का नाम (Mother)', 'mother_name')}
      {inputField('पारिवारिक विवरण (Family Details)', 'family_details', { multiline: true })}
      {inputField('भाई-बहन (Siblings)', 'siblings')}

      {/* Contact */}
      <Text style={styles.sectionTitle}>संपर्क व पता</Text>
      {inputField('पता (Address)', 'address', { multiline: true })}
      {inputField('संपर्क (Contact)', 'contact_details')}

      {/* Additional */}
      <Text style={styles.sectionTitle}>अन्य जानकारी</Text>
      {inputField('शौक/रुचियां (Hobbies)', 'hobbies')}
      {inputField('अपेक्षाएं (Expectations)', 'expectations', { multiline: true })}
      {inputField('कुंडली/राशिफल (Horoscope)', 'horoscope_details', { multiline: true })}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.saveBtn} onPress={saveDraft} disabled={saving}>
          <Ionicons name="save-outline" size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>{saving ? 'सेव हो रहा है...' : 'ड्राफ्ट सेव करें'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.previewBtn} onPress={preview}>
          <Ionicons name="eye-outline" size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>प्रीव्यू</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.previewBtn, { backgroundColor: COLORS.textSecondary }]} onPress={() => navigation.navigate('BiodataDrafts')}>
          <Ionicons name="folder-open-outline" size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>ड्राफ्ट</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  row: { flexDirection: 'row', paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.md },
  row2: { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.pageHorizontal },
  fieldGroup: { paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.sm },
  label: { fontSize: FONT.caption, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: FONT.bodySmall,
    backgroundColor: COLORS.card, color: COLORS.textPrimary,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  sectionTitle: {
    fontSize: FONT.body, fontWeight: '700', color: COLORS.primary,
    paddingHorizontal: SPACING.pageHorizontal, marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.round,
    borderWidth: 1, borderColor: COLORS.borderInput, backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT.micro, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFF' },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  photoBtn: { alignItems: 'center', marginVertical: SPACING.md },
  photo: { width: 120, height: 150, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.primary },
  photoPlaceholder: {
    width: 120, height: 150, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.borderInput,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA',
  },
  photoHint: { fontSize: FONT.micro, color: '#CCC', marginTop: 4 },
  micBtn: { padding: 6 },
  calcAgeBtn: { alignItems: 'flex-end', paddingHorizontal: SPACING.pageHorizontal, marginBottom: SPACING.sm },
  calcAgeText: { fontSize: FONT.caption, color: COLORS.info },
  actionRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: SPACING.pageHorizontal, marginTop: SPACING.xl,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.aiCleanup, borderRadius: RADIUS.sm,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  saveBtnText: { fontSize: FONT.bodySmall, fontWeight: '600', color: '#FFF' },
});
