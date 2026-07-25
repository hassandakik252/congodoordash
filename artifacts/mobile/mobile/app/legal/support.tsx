import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";

const APP_VERSION = "1.0.0";

interface FaqItem {
  q: string;
  a: string;
}

function FaqCard({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      style={styles.faqCard}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setOpen(!open);
      }}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{item.q}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textMuted}
        />
      </View>
      {open && (
        <Text style={styles.faqA}>{item.a}</Text>
      )}
    </Pressable>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();

  const faqs: FaqItem[] = [
    { q: t("supportFaq1Q"), a: t("supportFaq1A") },
    { q: t("supportFaq2Q"), a: t("supportFaq2A") },
    { q: t("supportFaq3Q"), a: t("supportFaq3A") },
    { q: t("supportFaq4Q"), a: t("supportFaq4A") },
    { q: t("supportFaq5Q"), a: t("supportFaq5A") },
  ];

  const handleEmail = () => {
    Linking.openURL(`mailto:${t("supportEmailValue")}?subject=Deliver%20LBH%20Support`);
  };

  const handleWhatsApp = () => {
    const phone = t("supportWhatsAppValue").replace(/\D/g, "");
    Linking.openURL(`https://wa.me/${phone}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t("supportTitle")}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 40 : 100) },
        ]}
      >
        {/* Subtitle */}
        <Text style={styles.subtitle}>{t("supportSubtitle")}</Text>

        {/* Contact buttons */}
        <View style={styles.contactCard}>
          <Pressable
            style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
            onPress={handleEmail}
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.primary + "20" }]}>
              <Ionicons name="mail-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{t("supportEmailLabel")}</Text>
              <Text style={styles.contactValue}>{t("supportEmailValue")}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
            onPress={handleWhatsApp}
          >
            <View style={[styles.contactIcon, { backgroundColor: "#25D36620" }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{t("supportWhatsAppLabel")}</Text>
              <Text style={styles.contactValue}>{t("supportWhatsAppValue")}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        {/* FAQ */}
        <Text style={styles.faqTitle}>{t("supportFaqTitle")}</Text>
        {faqs.map((item) => (
          <FaqCard key={item.q} item={item} />
        ))}

        {/* Version */}
        <View style={styles.versionRow}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} />
          <Text style={styles.versionText}>Deliver LBH · {t("appVersion")} {APP_VERSION}</Text>
        </View>
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
  subtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, textAlign: "center", marginBottom: 4,
  },
  contactCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  contactBtn: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
  },
  contactIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  contactValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 74 },
  faqTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary, marginTop: 6, marginBottom: 4,
  },
  faqCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  faqHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary, lineHeight: 20 },
  faqA: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  versionRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    justifyContent: "center", marginTop: 8,
  },
  versionText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
});
