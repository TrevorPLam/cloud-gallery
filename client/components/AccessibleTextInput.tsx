import React from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Colors } from '@/constants/theme';

interface AccessibleTextInputProps extends TextInputProps {
  accessibilityLabel: string;
  accessibilityHint: string;
}

export function AccessibleTextInput({
  accessibilityLabel,
  accessibilityHint,
  style,
  ...props
}: AccessibleTextInputProps) {
  const { theme, isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <TextInput
      style={[styles.input, { backgroundColor: theme.backgroundDefault, color: colors.text }, style]}
      placeholderTextColor={colors.textSecondary}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="textbox"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
});
