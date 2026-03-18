import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { AccessibleTextInput } from "@/components/AccessibleTextInput";
import { AccessibleButton } from "@/components/AccessibleButton";

interface RouteParams {
  token: string;
}

export default function ResetPasswordScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const colors = isDark ? Colors.dark : Colors.light;
  
  const { token } = route.params as RouteParams;
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword.trim()) {
      Alert.alert("Error", "Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          token: token.trim(),
          newPassword: newPassword.trim() 
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setShowSuccess(true);
      } else {
        Alert.alert("Error", data.message || "Invalid or expired reset link");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigation.navigate("Login");
  };

  if (showSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.successCard}>
          <ThemedText style={styles.successTitle}>Password Reset Successful</ThemedText>
          <ThemedText style={[styles.successMessage, { color: colors.textSecondary }]}>
            Your password has been updated successfully.
          </ThemedText>
          <ThemedText style={[styles.instructionText, { color: colors.textSecondary }]}>
            You can now sign in with your new password.
          </ThemedText>
          
          <AccessibleButton
            title="Sign In"
            onPress={handleBackToSignIn}
            style={styles.signInButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ThemedText style={styles.title}>Reset Password</ThemedText>
      <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
        Enter your new password below.
      </ThemedText>

      <View style={styles.form}>
        <AccessibleTextInput
          style={styles.input}
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          accessibilityLabel="New password input"
          accessibilityHint="Enter your new password (minimum 8 characters)"
        />

        <AccessibleTextInput
          style={styles.input}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          accessibilityLabel="Confirm password input"
          accessibilityHint="Re-enter your new password to confirm"
        />

        <AccessibleButton
          title={loading ? "Resetting..." : "Reset Password"}
          onPress={handleSubmit}
          disabled={loading || !newPassword.trim() || !confirmPassword.trim()}
          style={styles.submitButton}
          accessibilityLabel="Reset password button"
          accessibilityHint="Updates your account password and signs you in"
        />
      </View>

      <Pressable 
        style={styles.backLink} 
        onPress={handleBackToSignIn}
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        accessibilityHint="Navigate back to the sign in page"
      >
        <ThemedText style={[styles.backLinkText, { color: colors.link }]}>
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
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  form: {
    marginBottom: Spacing.xl,
  },
  input: {
    marginBottom: Spacing.lg,
  },
  submitButton: {
    marginBottom: Spacing.lg,
  },
  backLink: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  backLinkText: {
    fontSize: 14,
  },
  successCard: {
    backgroundColor: "#f8f9fa",
    padding: Spacing.xl,
    borderRadius: 12,
    alignItems: "center",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  signInButton: {
    marginTop: Spacing.md,
  },
});
