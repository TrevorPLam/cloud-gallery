import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ThemedText style={styles.title}>Forgot password</ThemedText>
      <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
        Password reset is not yet available. Please sign in with your current
        password or create a new account.
      </ThemedText>
      <Pressable 
        style={styles.link} 
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        accessibilityHint="Navigate back to the sign in page"
      >
        <ThemedText style={[styles.linkText, { color: colors.link }]}>
          Back to sign in
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing["2xl"],
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  link: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
  },
});
