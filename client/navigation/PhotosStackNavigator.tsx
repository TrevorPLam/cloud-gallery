import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PhotosScreen from "@/screens/PhotosScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type PhotosStackParamList = {
  Photos: undefined;
};

const Stack = createNativeStackNavigator<PhotosStackParamList>();

export default function PhotosStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Photos"
        component={PhotosScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Photo Vault" />,
        }}
      />
    </Stack.Navigator>
  );
}
