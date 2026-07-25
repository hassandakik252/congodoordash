import React from "react";
import {
  View, Text, Pressable, StyleSheet, Platform,
  useColorScheme, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useLang();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0F0F0F", "#1a0a00", "#0F0F0F"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Language Toggle */}
      <View style={[styles.langRow, { top: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Pressable
          style={[styles.langBtn, language === "fr" && styles.langActive]}
          onPress={() => setLanguage("fr")}
        >
          <Text style={[styles.langText, language === "fr" && styles.langActiveText]}>FR</Text>
        </Pressable>
        <Pressable
          style={[styles.langBtn, language === "en" && styles.langActive]}
          onPress={() => setLanguage("en")}
        >
          <Text style={[styles.langText, language === "en" && styles.langActiveText]}>EN</Text>
        </Pressable>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.iconContainer}>
          <Ionicons name="bicycle" size={64} color={Colors.primary} />
        </View>
        <Text style={styles.appName}>{t("appName")}</Text>
        <Text style={styles.tagline}>{t("tagline")}</Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: "flash", label: t("fastDelivery") },
          { icon: "restaurant", label: t("bestRestaurants") },
          { icon: "phone-portrait", label: t("realTimeTracking") },
        ].map((f) => (
          <View key={f.label} style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={18} color={Colors.primary} />
            </View>
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* CTA Buttons */}
      <View style={[styles.buttons, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={styles.primaryBtnText}>{t("signUp")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.secondaryBtnText}>{t("signIn")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  langRow: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langText: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  langActiveText: { color: "#fff" },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: "rgba(255,69,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255,69,0,0.3)",
  },
  appName: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  tagline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
  },
  features: {
    paddingHorizontal: 32,
    gap: 14,
    marginBottom: 36,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,69,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  buttons: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryBtn: {
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
