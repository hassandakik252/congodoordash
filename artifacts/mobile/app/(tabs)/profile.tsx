import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ScrollView, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { userApi } from "@/services/api";

const APP_VERSION = "1.0.0";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { t, language, setLanguage } = useLang();
  const { currency, setCurrency, usdRate } = useCurrency();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [saving, setSaving] = useState(false);

  const getRoleLabel = () => {
    if (user?.role === "customer") return t("customer");
    if (user?.role === "restaurant_owner") return t("restaurantOwner");
    if (user?.role === "driver") return t("driver");
    return user?.role || "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await userApi.updateProfile({ name, phone, address });
      updateUser(updated);
      setEditing(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t("logout"), "", [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("logout"),
        style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          qc.clear();
          await logout();
        },
      },
    ]);
  };

  const avatar = user?.name?.charAt(0).toUpperCase() || "?";

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("profile")}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {editing && !saving && (
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                setName(user?.name || "");
                setPhone(user?.phone || "");
                setAddress(user?.address || "");
                setEditing(false);
              }}
            >
              <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.editBtn, saving && { opacity: 0.5 }]}
            onPress={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
          >
            <Text style={styles.editBtnText}>{editing ? (saving ? t("loading") : t("save")) : t("editProfile")}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatar}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleLabel()}</Text>
          </View>
        </View>

        {/* Info Fields */}
        <View style={styles.section}>
          {[
            { label: t("name"), value: name, setter: setName, icon: "person-outline" },
            { label: t("email"), value: user?.email || "", setter: () => {}, icon: "mail-outline", disabled: true },
            { label: t("phone"), value: phone, setter: setPhone, icon: "call-outline", kbType: "phone-pad" },
            { label: t("address"), value: address, setter: setAddress, icon: "location-outline" },
          ].map(({ label, value, setter, icon, disabled, kbType }) => (
            <View key={label} style={styles.fieldRow}>
              <Ionicons name={icon as any} size={18} color={Colors.textMuted} />
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>{label}</Text>
                {editing && !disabled ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={value}
                    onChangeText={setter as any}
                    keyboardType={kbType as any || "default"}
                    placeholderTextColor={Colors.placeholder}
                  />
                ) : (
                  <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>
                    {value || "—"}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("language")}</Text>
          <View style={styles.langRow}>
            {([{ code: "fr", label: t("french") }, { code: "en", label: t("english") }] as const).map(l => (
              <Pressable
                key={l.code}
                style={[styles.langBtn, language === l.code && styles.langActive]}
                onPress={() => setLanguage(l.code)}
              >
                <Text style={[styles.langText, language === l.code && styles.langActiveText]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{language === "fr" ? "Devise" : "Currency"}</Text>
          <View style={styles.langRow}>
            {(["CDF", "USD"] as const).map(c => (
              <Pressable
                key={c}
                style={[styles.langBtn, currency === c && styles.langActive]}
                onPress={() => setCurrency(c)}
              >
                <Text style={[styles.langText, currency === c && styles.langActiveText]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 8, fontFamily: "Inter_400Regular" }}>
            {language === "fr" ? `Taux : 1 USD = ${usdRate.toLocaleString()} CDF` : `Rate: 1 USD = ${usdRate.toLocaleString()} CDF`}
          </Text>
        </View>

        {/* Legal & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("legalSupport")}</Text>
          {[
            { label: t("privacyPolicy"), icon: "shield-checkmark-outline", href: "/legal/privacy" },
            { label: t("supportContact"), icon: "help-circle-outline", href: "/legal/support" },
          ].map(({ label, icon, href }) => (
            <Pressable
              key={href}
              style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(href as any);
              }}
            >
              <Ionicons name={icon as any} size={18} color={Colors.textMuted} />
              <Text style={styles.menuItemText}>{label}</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
            </Pressable>
          ))}
          <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
            <Text style={styles.menuItemText}>{t("appVersion")} {APP_VERSION}</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + (Platform.OS === "web" ? 34 : 90) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  editBtn: { backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  cancelBtn: { backgroundColor: Colors.surfaceAlt, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 84, height: 84, borderRadius: 28,
    backgroundColor: "rgba(255,69,0,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.primary,
    marginBottom: 12,
  },
  avatarText: { fontSize: 34, fontFamily: "Inter_700Bold", color: Colors.primary },
  userName: { fontSize: 22, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 8 },
  roleBadge: { backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  roleText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  section: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, marginBottom: 12 },
  fieldRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted, marginBottom: 2 },
  fieldValue: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  fieldEmpty: { color: Colors.textMuted },
  fieldInput: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderBottomWidth: 1, borderBottomColor: Colors.primary, paddingVertical: 2 },
  langRow: { flexDirection: "row", gap: 10 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  langActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  langActiveText: { color: "#fff" },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuItemText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  logoutText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.error },
});
