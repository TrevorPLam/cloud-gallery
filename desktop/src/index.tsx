import React from 'react';
import { AppRegistry } from 'react-native';
import DesktopApp from './DesktopApp';
import { name as appName } from '../../client/app.json';

// Register the React Native app for web
AppRegistry.registerComponent(appName, () => DesktopApp);

// Get the root component
const { root } = AppRegistry.getApplication(appName);

export default function App() {
  return root;
}
