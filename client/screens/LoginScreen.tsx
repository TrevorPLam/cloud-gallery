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

export default function LoginScreen() {
  const { login, isLoading, continueAsGuest } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      Alert.alert(
        "Login failed",
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
        <ThemedText style={styles.title}>Sign in</ThemedText>
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
          accessibilityHint="Enter your email address to sign in"
          accessibilityRole="textbox"
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.backgroundDefault, color: colors.text },
          ]}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!submitting}
          accessibilityLabel="Password input"
          accessibilityHint="Enter your password to sign in"
          accessibilityRole="textbox"
        />
        <Pressable
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={handleLogin}
          disabled={submitting || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Sign in button"
          accessibilityHint="Signs you into your account"
        >
          {submitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={styles.buttonText}>Sign in</ThemedText>
          )}
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={() => navigation.navigate("Register")}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Create an account"
          accessibilityHint="Navigate to account registration page"
        >
          <ThemedText style={[styles.linkText, { color: colors.link }]}>
            Create an account
          </ThemedText>
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={() => navigation.navigate("ForgotPassword")}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          accessibilityHint="Navigate to password reset page"
        >
          <ThemedText style={[styles.linkText, { color: colors.link }]}>
            Forgot password?
          </ThemedText>
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={continueAsGuest}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Continue as guest"
          accessibilityHint="Use the app without creating an account"
        >
          <ThemedText style={[styles.linkText, { color: colors.link }]}>
            Continue as guest
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
