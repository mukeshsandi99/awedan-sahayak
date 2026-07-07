import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { OfficeType } from '../types/database';
import HomeScreen from '../screens/HomeScreen';
import ApplicationTypeListScreen from '../screens/ApplicationTypeListScreen';
import ApplicationFormScreen from '../screens/ApplicationFormScreen';
import ApplicationPreviewScreen from '../screens/ApplicationPreviewScreen';
import HandwritingScanScreen from '../screens/HandwritingScanScreen';

export type HomeStackParamList = {
  HomeMain: undefined;
  ApplicationTypeList: { officeType: OfficeType; officeName: string };
  ApplicationForm: { applicationTypeId: number; applicationName: string };
  ApplicationPreview: {
    applicationName: string;
    generatedText: string;
    officeType: string;
    applicationTypeId: number;
  };
  HandwritingScan: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
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
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ApplicationTypeList"
        component={ApplicationTypeListScreen}
        options={({ route }) => ({
          title: route.params.officeName,
          headerBackTitle: 'होम',
        })}
      />
      <Stack.Screen
        name="ApplicationForm"
        component={ApplicationFormScreen}
        options={({ route }) => ({
          title: route.params.applicationName,
          headerBackTitle: 'पीछे',
        })}
      />
      <Stack.Screen
        name="ApplicationPreview"
        component={ApplicationPreviewScreen}
        options={({ route }) => ({
          title: 'आवेदन पत्र',
          headerBackTitle: 'फॉर्म',
        })}
      />
      <Stack.Screen
        name="HandwritingScan"
        component={HandwritingScanScreen}
        options={{
          title: 'हस्तलिखित स्कैन',
          headerBackTitle: 'होम',
        }}
      />
    </Stack.Navigator>
  );
}
