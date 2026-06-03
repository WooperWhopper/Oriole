import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import DrillScreen from './src/screens/DrillScreen';
import EndgameScreen from './src/screens/EndgameScreen';
import WordsCollectionScreen from './src/screens/WordsCollectionScreen';

// ── Param lists ──────────────────────────────────────────────────────────
export type TabParamList = {
  Home: undefined;
  Progress: undefined;
};

export type RootStackParamList = {
  HomeTabs: undefined;
  Drill: undefined;
  Endgame: undefined;
  WordsCollection: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeTabs(): React.ReactElement {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
    </Tab.Navigator>
  );
}

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="HomeTabs" component={HomeTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Drill" component={DrillScreen} />
          <Stack.Screen name="Endgame" component={EndgameScreen} />
          <Stack.Screen name="WordsCollection" component={WordsCollectionScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
