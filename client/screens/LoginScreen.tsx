import React, { useState, useRef } from "react";
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
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useFocusIndicator } from "@/styles/focusIndicators";
import { Spacing, Colors } from "@/constants/theme";

export default function LoginScreen() {
  const { login, isLoading, continueAsGuest } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  // Refs for focus management
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const signInButtonRef = useRef<Pressable>(null);
  const registerButtonRef = useRef<Pressable>(null);

  // Keyboard navigation setup
  const { moveFocus, handleActivate } = useKeyboardNavigation({
    enabled: true,
    onTab: (direction) => {
      const refs = [emailInputRef, passwordInputRef, signInButtonRef, registerButtonRef];
      const currentIndex = refs.findIndex(ref => ref.current?.isFocused?.());
      
      if (direction === 'forward') {
        const nextIndex = (currentIndex + 1) % refs.length;
        refs[nextIndex].current?.focus?.();
        setFocusedElement(['email', 'password', 'signin', 'register'][nextIndex]);
      } else {
        const prevIndex = currentIndex <= 0 ? refs.length - 1 : currentIndex - 1;
        refs[prevIndex].current?.focus?.();
        setFocusedElement(['email', 'password', 'signin', 'register'][prevIndex]);
      }
    },
    onActivate: () => {
      const currentIndex = [emailInputRef, passwordInputRef, signInButtonRef, registerButtonRef]
        .findIndex(ref => ref.current?.isFocused?.());
      
      if (currentIndex === 2) { // Sign in button
        handleLogin();
      } else if (currentIndex === 3) { // Register button
        navigation.navigate("Register");
      }
    },
  });

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
          ref={emailInputRef}
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
          onSubmitEditing={() => {
            setFocusedElement('password');
            passwordInputRef.current?.focus();
          }}
          returnKeyType="next"
          blurOnSubmit={false}
          onFocus={() => setFocusedElement('email')}
          onBlur={() => setFocusedElement(null)}
        />
        <TextInput
          ref={passwordInputRef}
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
          onSubmitEditing={handleLogin}
          returnKeyType="done"
          onFocus={() => setFocusedElement('password')}
          onBlur={() => setFocusedElement(null)}
        />
        <Pressable
          ref={signInButtonRef}
          style={[
            styles.button, 
            { backgroundColor: colors.accent },
            focusedElement === 'signin' && useFocusIndicator({ focused: true, darkTheme: isDark }).focusStyle
          ]}
          onPress={handleLogin}
          disabled={submitting || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Sign in button"
          accessibilityHint="Signs you into your account"
          focusable={true}
          onFocus={() => setFocusedElement('signin')}
          onBlur={() => setFocusedElement(null)}
        >
          {submitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={styles.buttonText}>Sign in</ThemedText>
          )}
        </Pressable>
        <Pressable
          ref={registerButtonRef}
          style={styles.link}
          onPress={() => navigation.navigate("Register")}
          accessibilityRole="button"
          accessibilityLabel="Create account"
          accessibilityHint="Navigate to registration screen"
          focusable={true}
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
    padding: Spacing.xl,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  button: {
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    padding: Spacing.sm,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
