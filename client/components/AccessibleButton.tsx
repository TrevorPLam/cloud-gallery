import React from 'react';
import { Pressable, PressableProps, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Colors } from '@/constants/theme';

interface AccessibleButtonProps extends PressableProps {
  accessibilityLabel: string;
  accessibilityHint: string;
  children: React.ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'link';
}

export function AccessibleButton({
  accessibilityLabel,
  accessibilityHint,
  children,
  loading = false,
  variant = 'primary',
  style,
  ...props
}: AccessibleButtonProps) {
  const { theme, isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const buttonStyle = variant === 'primary' ? styles.primaryButton : styles.linkButton;
  const textStyle = variant === 'primary' ? styles.primaryText : styles.linkText;

  return (
    <Pressable
      style={[
        buttonStyle,
        variant === 'primary' && { backgroundColor: colors.accent },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.buttonText} />
      ) : (
        <ThemedText style={[textStyle, variant === 'link' && { color: colors.link }]}>
          {children}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    padding: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  linkButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
});
