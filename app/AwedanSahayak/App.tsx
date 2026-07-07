import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import TabNavigator from './src/navigation/TabNavigator';
import { initDatabase } from './src/database/db';

// Keep the splash screen visible while we initialise the database
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        console.log('[App] Initializing database...');
        await initDatabase();
        console.log('[App] Database initialized successfully.');
        setDbReady(true);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        console.error('[App] Database initialization FAILED:', err);
        console.error('[App] Error details:', msg, err?.stack);
        setDbError(msg);
      }
    })();
  }, []);

  // Hide the splash screen once the DB is ready (or errored)
  const onLayout = useCallback(async () => {
    if (dbReady || dbError) {
      await SplashScreen.hideAsync();
    }
  }, [dbReady, dbError]);

  // ── Error state ─────────────────────────────────────────────────

  if (dbError) {
    return (
      <View style={styles.centered}>
        <StatusBar style="auto" />
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>डेटाबेस त्रुटि</Text>
        <Text style={styles.errorSubtitle}>Database Error</Text>
        <Text style={styles.errorMessage} selectable>
          {dbError}
        </Text>
      </View>
    );
  }

  // ── Loading state ───────────────────────────────────────────────

  if (!dbReady) {
    return (
      <View style={styles.centered}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color="#E17055" />
        <Text style={styles.loadingText}>डेटाबेस तैयार हो रहा है...</Text>
        <Text style={styles.loadingSubtext}>Initializing database</Text>
      </View>
    );
  }

  // ── App ready ───────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <TabNavigator />
      </NavigationContainer>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#999',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D63031',
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    overflow: 'hidden',
    lineHeight: 20,
  },
});
