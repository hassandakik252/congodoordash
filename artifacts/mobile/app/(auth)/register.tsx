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

type Role = "customer" | "restaurant_owner" | "driver";
type VehicleType = "motorcycle" | "bicycle" | "car" | "foot";

const ROLES: { value: Role; icon: string }[] = [
  { value: "customer", icon: "person-outline" },
  { value: "restaurant_owner", icon: "restaurant-outline" },
  { value: "driver", icon: "bicycle-outline" },
];

const VEHICLE_TYPES: { value: VehicleType; icon: string; labelKey: string }[] = [
  { value: "motorcycle", icon: "speedometer-outline", labelKey: "vehicleMoto" },
  { value: "bicycle", icon: "bicycle-outline", labelKey: "vehicleBicycle" },
  { value: "car", icon: "car-outline", labelKey: "vehicleCar" },
  { value: "foot", icon: "walk-outline", labelKey: "vehicleFoot" },
];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLang();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("customer");
  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !acceptTerms) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const body: any = { name, email: email.trim(), phone, password, role, acceptTerms: true };
      if (role === "driver") body.vehicleType = vehicleType;
      const { token, user } = await authApi.register(body);
      await login(token, user);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("error"));
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (r: Role) => {
    if (r === "customer") return t("customer");
    if (r === "restaurant_owner") return t("restaurantOwner");
    return t("driver");
  };

  const valid = name && email && phone && password.length >= 6 && (role !== "driver" || vehicleType) && acceptTerms;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{t("signUp")}</Text>
          <Text style={styles.subtitle}>{t("tagline")}</Text>
        </View>

        {/* Role Selection */}
        <View style={styles.roleSection}>
          <Text style={styles.label}>{t("selectRole")}</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <Pressable
                key={r.value}
                style={[styles.roleBtn, role === r.value && styles.roleBtnActive]}
                onPress={() => setRole(r.value)}
              >
                <Ionicons name={r.icon as any} size={22} color={role === r.value ? "#fff" : Colors.textMuted} />
                <Text style={[styles.roleBtnText, role === r.value && styles.roleBtnTextActive]}>
                  {getRoleLabel(r.value)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Vehicle type picker — drivers only */}
        {role === "driver" && (
          <View style={styles.roleSection}>
            <Text style={styles.label}>{t("vehicleType")}</Text>
            <View style={styles.vehicleRow}>
              {VEHICLE_TYPES.map(v => (
                <Pressable
                  key={v.value}
                  style={[styles.vehicleBtn, vehicleType === v.value && styles.vehicleBtnActive]}
                  onPress={() => setVehicleType(v.value)}
                >
                  <Ionicons name={v.icon as any} size={22} color={vehicleType === v.value ? "#fff" : Colors.textMuted} />
                  <Text style={[styles.vehicleBtnText, vehicleType === v.value && styles.vehicleBtnTextActive]}>
                    {t(v.labelKey as any)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.form}>
          {[
            { label: t("name"), value: name, setter: setName, icon: "person-outline", kbType: "default" },
            { label: t("email"), value: email, setter: setEmail, icon: "mail-outline", kbType: "email-address" },
            { label: t("phone"), value: phone, setter: setPhone, icon: "call-outline", kbType: "phone-pad" },
          ].map(({ label, value, setter, icon, kbType }) => (
            <View key={label} style={styles.inputGroup}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputRow}>
                <Ionicons name={icon as any} size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setter}
                  placeholder={label}
                  placeholderTextColor={Colors.placeholder}
                  keyboardType={kbType as any}
                  autoCapitalize={kbType === "email-address" ? "none" : "words"}
                  autoCorrect={false}
                />
              </View>
            </View>
          ))}

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

          {/* Terms & Privacy acceptance */}
          <Pressable style={styles.termsRow} onPress={() => setAcceptTerms(v => !v)}>
            <Ionicons
              name={acceptTerms ? "checkbox" : "square-outline"}
              size={22}
              color={acceptTerms ? Colors.primary : Colors.textMuted}
            />
            <Text style={styles.termsText}>
              {language === "fr" ? "J'accepte les " : "I accept the "}
              <Text style={styles.termsLink} onPress={() => router.push("/legal/privacy")}>
                {language === "fr" ? "Conditions et la Politique de confidentialité" : "Terms & Privacy Policy"}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, !valid && styles.disabledBtn, pressed && { opacity: 0.85 }]}
            onPress={handleRegister}
            disabled={loading || !valid}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? t("loading") : t("signUp")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("alreadyHaveAccount")} </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.link}>{t("signIn")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  back: { marginTop: 16, marginBottom: 24, width: 40, height: 40, justifyContent: "center" },
  header: { marginBottom: 28 },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  roleSection: { marginBottom: 24, gap: 10 },
  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, textAlign: "center" },
  roleBtnTextActive: { color: "#fff" },
  form: { gap: 16, marginBottom: 28 },
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
  termsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, paddingHorizontal: 2 },
  termsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  termsLink: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  vehicleRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  vehicleBtn: {
    flex: 1, minWidth: 70,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vehicleBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  vehicleBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, textAlign: "center" },
  vehicleBtnTextActive: { color: "#fff" },

  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  link: { fontSize: 14, color: Colors.primary, fontFamily: "Inter_600SemiBold" },
});
