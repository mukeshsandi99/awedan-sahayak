/**
 * ToolsStack — stack navigator for the उपकरण (Tools) tab.
 *
 * Screens:
 *   ToolsHome, ScamCheck, ScamHistory, CgpaCalculator, CgpaHistory,
 *   BiodataForm, BiodataPreview, BiodataDrafts,
 *   BarcodeHome, BarcodeScanner, BarcodeGenerator, BarcodeHistory,
 *   HandwritingInput, HandwritingPreview, HandwritingHistory,
 *   CourtPetitionList, CourtPetitionForm, CourtPetitionPreview
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ToolsHomeScreen from '../screens/tools/ToolsHomeScreen';
import ScamCheckScreen from '../screens/tools/ScamCheckScreen';
import ScamHistoryScreen from '../screens/tools/ScamHistoryScreen';
import CgpaCalculatorScreen from '../screens/tools/CgpaCalculatorScreen';
import CgpaHistoryScreen from '../screens/tools/CgpaHistoryScreen';
import BiodataFormScreen from '../screens/tools/BiodataFormScreen';
import BiodataPreviewScreen from '../screens/tools/BiodataPreviewScreen';
import BiodataDraftsScreen from '../screens/tools/BiodataDraftsScreen';
import BarcodeScannerScreen from '../screens/tools/BarcodeScannerScreen';
import BarcodeGeneratorScreen from '../screens/tools/BarcodeGeneratorScreen';
import BarcodeHistoryScreen from '../screens/tools/BarcodeHistoryScreen';
import HandwritingInputScreen from '../screens/tools/HandwritingInputScreen';
import HandwritingPreviewScreen from '../screens/tools/HandwritingPreviewScreen';
import HandwritingHistoryScreen from '../screens/tools/HandwritingHistoryScreen';
import CourtPetitionListScreen from '../screens/tools/CourtPetitionListScreen';
import CourtPetitionFormScreen from '../screens/tools/CourtPetitionFormScreen';
import CourtPetitionPreviewScreen from '../screens/tools/CourtPetitionPreviewScreen';

export type ToolsStackParamList = {
  ToolsHome: undefined;
  ScamCheck: undefined;
  ScamHistory: undefined;
  CgpaCalculator: undefined;
  CgpaHistory: undefined;
  BiodataForm: { draftId?: number } | undefined;
  BiodataPreview: { draftId: number };
  BiodataDrafts: undefined;
  BarcodeScanner: undefined;
  BarcodeGenerator: undefined;
  BarcodeHistory: undefined;
  HandwritingInput: { docId?: number } | undefined;
  HandwritingPreview: { docId: number };
  HandwritingHistory: undefined;
  CourtPetitionList: undefined;
  CourtPetitionForm: { petitionType: string; petitionName: string };
  CourtPetitionPreview: { petitionId: number };
};

const Stack = createNativeStackNavigator<ToolsStackParamList>();

export default function ToolsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FFF8F0' },
        headerTintColor: '#1A1A2E',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#FFF8F0' },
      }}
    >
      <Stack.Screen
        name="ToolsHome"
        component={ToolsHomeScreen}
        options={{ headerShown: false }}
      />
      {/* ── Safety Checker ─────────────────────────────── */}
      <Stack.Screen
        name="ScamCheck"
        component={ScamCheckScreen}
        options={{ title: 'सुरक्षा जांच', headerBackTitle: 'उपकरण' }}
      />
      <Stack.Screen
        name="ScamHistory"
        component={ScamHistoryScreen}
        options={{ title: 'जांच इतिहास', headerBackTitle: 'सुरक्षा' }}
      />
      {/* ── CGPA Calculator ─────────────────────────────── */}
      <Stack.Screen
        name="CgpaCalculator"
        component={CgpaCalculatorScreen}
        options={{ title: 'CGPA कैलकुलेटर', headerBackTitle: 'उपकरण' }}
      />
      <Stack.Screen
        name="CgpaHistory"
        component={CgpaHistoryScreen}
        options={{ title: 'कैलकुलेशन इतिहास', headerBackTitle: 'CGPA' }}
      />
      {/* ── Marriage Biodata ────────────────────────────── */}
      <Stack.Screen
        name="BiodataForm"
        component={BiodataFormScreen}
        options={{ title: 'बायोडाटा फॉर्म', headerBackTitle: 'उपकरण' }}
      />
      <Stack.Screen
        name="BiodataPreview"
        component={BiodataPreviewScreen}
        options={{ title: 'बायोडाटा प्रीव्यू', headerBackTitle: 'फॉर्म' }}
      />
      <Stack.Screen
        name="BiodataDrafts"
        component={BiodataDraftsScreen}
        options={{ title: 'सेव्ड बायोडाटा', headerBackTitle: 'बायोडाटा' }}
      />
      {/* ── Barcode ─────────────────────────────────────── */}
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ title: 'बारकोड स्कैनर', headerBackTitle: 'बारकोड' }}
      />
      <Stack.Screen
        name="BarcodeGenerator"
        component={BarcodeGeneratorScreen}
        options={{ title: 'बारकोड जनरेटर', headerBackTitle: 'बारकोड' }}
      />
      <Stack.Screen
        name="BarcodeHistory"
        component={BarcodeHistoryScreen}
        options={{ title: 'स्कैन इतिहास', headerBackTitle: 'बारकोड' }}
      />
      {/* ── Handwriting ─────────────────────────────────── */}
      <Stack.Screen
        name="HandwritingInput"
        component={HandwritingInputScreen}
        options={{ title: 'हस्तलिखित टेक्स्ट', headerBackTitle: 'उपकरण' }}
      />
      <Stack.Screen
        name="HandwritingPreview"
        component={HandwritingPreviewScreen}
        options={{ title: 'प्रीव्यू', headerBackTitle: 'टेक्स्ट' }}
      />
      <Stack.Screen
        name="HandwritingHistory"
        component={HandwritingHistoryScreen}
        options={{ title: 'दस्तावेज़', headerBackTitle: 'हस्तलिखित' }}
      />
      {/* ── Court Petitions ─────────────────────────────── */}
      <Stack.Screen
        name="CourtPetitionList"
        component={CourtPetitionListScreen}
        options={{ title: 'न्यायालय याचिकाएं', headerBackTitle: 'उपकरण' }}
      />
      <Stack.Screen
        name="CourtPetitionForm"
        component={CourtPetitionFormScreen}
        options={({ route }) => ({
          title: route.params.petitionName,
          headerBackTitle: 'याचिकाएं',
        })}
      />
      <Stack.Screen
        name="CourtPetitionPreview"
        component={CourtPetitionPreviewScreen}
        options={{ title: 'याचिका प्रीव्यू', headerBackTitle: 'फॉर्म' }}
      />
    </Stack.Navigator>
  );
}
