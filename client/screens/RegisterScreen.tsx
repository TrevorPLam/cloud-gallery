import React, { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, Colors } from "@/constants/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password);
    } catch (err: unknown) {
      Alert.alert(
        "Registration failed",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.form}>
        <ThemedText style={styles.title}>Create account</ThemedText>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.backgroundDefault, color: colors.text },
          ]}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!submitting}
          accessibilityLabel="Email address input"
          accessibilityHint="Enter your email address to create an account"
          accessibilityRole="textbox"
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.backgroundDefault, color: colors.text },
          ]}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!submitting}
          accessibilityLabel="Password input"
          accessibilityHint="Enter a password with at least 8 characters"
          accessibilityRole="textbox"
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.backgroundDefault, color: colors.text },
          ]}
          placeholder="Confirm password"
          placeholderTextColor={colors.textSecondary}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!submitting}
          accessibilityLabel="Confirm password input"
          accessibilityHint="Re-enter your password to confirm"
          accessibilityRole="textbox"
        />
        <Pressable
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={handleRegister}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Create account button"
          accessibilityHint="Creates your new account"
        >
          {submitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={styles.buttonText}>Create account</ThemedText>
          )}
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={() => navigation.goBack()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          accessibilityHint="Navigate back to sign in page"
        >
          <ThemedText style={[styles.linkText, { color: colors.link }]}>
            Already have an account? Sign in
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing["2xl"],
  },
  form: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  button: {
    padding: Spacing.lg,
    borderRadius: 8,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  link: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
  },
});
