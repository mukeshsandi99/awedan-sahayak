/**
 * MyApplicationsStack — stack navigator for the My Applications tab.
 *
 * Screens:
 *   - MyApplicationsList — full list with search, delete, empty state
 *   - MyApplicationPreview — full preview with PDF/RTF/share actions
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyApplicationsScreen from '../screens/MyApplicationsScreen';
import MyApplicationPreviewScreen from '../screens/MyApplicationPreviewScreen';

export type MyApplicationsStackParamList = {
  MyApplicationsList: undefined;
  MyApplicationPreview: {
    applicationName: string;
    generatedText: string;
    officeType: string;
    applicationId: number;
  };
};

const Stack = createNativeStackNavigator<MyApplicationsStackParamList>();

export default function MyApplicationsStack() {
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
        name="MyApplicationsList"
        component={MyApplicationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MyApplicationPreview"
        component={MyApplicationPreviewScreen}
        options={{
          title: 'आवेदन पत्र',
          headerBackTitle: 'आवेदन',
        }}
      />
    </Stack.Navigator>
  );
}
