import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeStack from './HomeStack';
import MyApplicationsStack from './MyApplicationsStack';
import OfficeDirectoryScreen from '../screens/OfficeDirectoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: 'home', default: 'home-outline' },
  MyApplications: { focused: 'document-text', default: 'document-text-outline' },
  OfficeDirectory: { focused: 'business', default: 'business-outline' },
  Profile: { focused: 'person-circle', default: 'person-circle-outline' },
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#E17055',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F0F0F0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: 'होम' }}
      />
      <Tab.Screen
        name="MyApplications"
        component={MyApplicationsStack}
        options={{ tabBarLabel: 'आवेदन' }}
      />
      <Tab.Screen
        name="OfficeDirectory"
        component={OfficeDirectoryScreen}
        options={{ tabBarLabel: 'कार्यालय' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'प्रोफ़ाइल' }}
      />
    </Tab.Navigator>
  );
}
