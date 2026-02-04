// AI-META-BEGIN
// AI-META: Simple spacer component for layout gaps with configurable width/height
// OWNERSHIP: client/components (layout primitives)
// ENTRYPOINTS: Used across UI for spacing control
// DEPENDENCIES: react-native
// DANGER: None - purely layout utility
// CHANGE-SAFETY: Safe to modify; minimal logic
// TESTS: Visual verification in layouts
// AI-META-END

import { View } from "react-native";

type Props = {
  width?: number;
  height?: number;
};

export default function Spacer(props: Props) {
  const width: number = props.width ?? 1;
  const height: number = props.height ?? 1;

  return (
    <View
      style={{
        width,
        height,
      }}
    />
  );
}
