import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";

interface Section {
  title: string;
  body: string;
}

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();

  const sections: Section[] = [
    { title: t("privacyDataTitle"),    body: t("privacyDataItems") },
    { title: t("privacyUseTitle"),     body: t("privacyUseItems") },
    { title: t("privacyPaymentTitle"), body: t("privacyPaymentItems") },
    { title: t("privacyContactTitle"), body: `${t("privacyContactText")}\n${t("supportEmailValue")}` },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t("privacyPolicyTitle")}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 40 : 100) },
        ]}
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <Ionicons name="shield-checkmark-outline" size={32} color={Colors.success} />
          <Text style={styles.introText}>{t("privacyPolicyIntro")}</Text>
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        {/* Updated date */}
        <Text style={styles.updatedText}>{t("privacyUpdatedText")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  content: { padding: 16, gap: 12 },
  introCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", gap: 14,
  },
  introText: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, textAlign: "center", lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  sectionBody: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, lineHeight: 20,
  },
  updatedText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: Colors.textMuted, textAlign: "center", marginTop: 8,
  },
});
