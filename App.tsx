// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import { setAudioModeAsync } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/model/store';
import { engineer } from './src/engineer';
import { hub } from './src/telemetry/hub';
import { WelcomeSheet } from './src/ui/dialogs';
import { DriveScreen, HomeScreen } from './src/ui/screens';
import { C, fontState } from './src/ui/theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  fontState.loaded = fontsLoaded && !fontError;

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    // Let the race engineer speak even with the iPhone's silent switch on, and turn other audio down meanwhile.
    try {
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
    } catch {
      // audio mode is a nice-to-have
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {fontsLoaded || fontError ? (
          <StoreProvider>
            <Root />
          </StoreProvider>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

/** Starts and stops the telemetry connection as settings and app state change. */
function Root() {
  const { ready, settings, updateSettings } = useStore();
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    hub.start(settings.source, settings.ps5Address);
    // Phones suspend network sockets in the background; reconnect when the app comes back.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hub.start(settings.source, settings.ps5Address);
      else if (state === 'background') hub.stop();
    });
    return () => {
      sub.remove();
      hub.stop();
    };
  }, [ready, settings.source, settings.ps5Address]);

  useEffect(() => {
    engineer.configure(settings.engineer, { tyreCold: settings.tyreCold, tyreHot: settings.tyreHot });
  }, [settings.engineer, settings.tyreCold, settings.tyreHot]);

  if (!ready) return null;
  return (
    <>
      {driving ? <DriveScreen onClose={() => setDriving(false)} /> : <HomeScreen onDrive={() => setDriving(true)} />}
      <WelcomeSheet visible={!settings.hasSeenWelcome} onClose={() => updateSettings({ hasSeenWelcome: true })} />
    </>
  );
}
