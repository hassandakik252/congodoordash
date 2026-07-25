import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ScrollView, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/services/api";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const { token, user } = await authApi.login(email.trim(), password);
      await login(token, user);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{t("signIn")}</Text>
          <Text style={styles.subtitle}>{t("tagline")}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("email")}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t("email")}
                placeholderTextColor={Colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("password")}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t("password")}
                placeholderTextColor={Colors.placeholder}
                secureTextEntry={!showPwd}
              />
              <Pressable onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, (loading || !email || !password) && styles.disabledBtn, pressed && { opacity: 0.85 }]}
            onPress={handleLogin}
            disabled={loading || !email || !password}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? t("loading") : t("signIn")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("dontHaveAccount")} </Text>
          <Pressable onPress={() => router.replace("/(auth)/register")}>
            <Text style={styles.link}>{t("signUp")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  back: { marginTop: 16, marginBottom: 32, width: 40, height: 40, justifyContent: "center" },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  form: { gap: 20, marginBottom: 32 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  disabledBtn: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, color: Colors.primary, fontFamily: "Inter_600SemiBold" },
});
