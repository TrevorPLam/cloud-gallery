import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AlbumsScreen from "@/screens/AlbumsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AlbumsStackParamList = {
  Albums: undefined;
};

const Stack = createNativeStackNavigator<AlbumsStackParamList>();

export default function AlbumsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Albums"
        component={AlbumsScreen}
        options={{
          headerTitle: "Albums",
        }}
      />
    </Stack.Navigator>
  );
}
