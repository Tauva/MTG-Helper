import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CollectionProvider } from './src/context/CollectionContext';

// Screens
import CollectionScreen from './src/screens/CollectionScreen';
import SearchScreen from './src/screens/SearchScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import DecksScreen from './src/screens/DecksScreen';
import ImportScreen from './src/screens/ImportScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Collection':
              iconName = focused ? 'albums' : 'albums-outline';
              break;
            case 'Search':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Scanner':
              iconName = focused ? 'scan' : 'scan-outline';
              break;
            case 'Decks':
              iconName = focused ? 'layers' : 'layers-outline';
              break;
            default:
              iconName = 'help';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6B4FA2',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#1E1E1E',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          paddingTop: 8,
          // Ajoute le padding pour les boutons de navigation Android
          paddingBottom: Math.max(insets.bottom, 12),
          height: 60 + Math.max(insets.bottom, 12),
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginBottom: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Collection" 
        component={CollectionScreen}
        options={{ tabBarLabel: 'Collection' }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen 
        name="Scanner" 
        component={ScannerScreen}
        options={{ tabBarLabel: 'Scan' }}
      />
      <Tab.Screen 
        name="Decks" 
        component={DecksScreen}
        options={{ tabBarLabel: 'Decks' }}
      />
    </Tab.Navigator>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <CollectionProvider>
        <NavigationContainer>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: '#121212' },
            }}
          >
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen 
              name="Import" 
              component={ImportScreen}
              options={{
                presentation: 'modal',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </CollectionProvider>
    </SafeAreaProvider>
  );
};

export default App;
