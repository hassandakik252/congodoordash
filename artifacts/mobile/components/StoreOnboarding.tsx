import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";
import { restaurantApi, kycApi } from "@/services/api";
import { pickAndUploadImage } from "@/utils/imageUpload";
import { VERTICALS } from "@/utils/format";

/** Onboarding for a store owner who hasn't created their store yet. */
export default function StoreOnboarding({ topPad }: { topPad: number }) {
  const { t, language } = useLang();
  const qc = useQueryClient();
  const fr = language === "fr";

  const [vertical, setVertical] = useState("restaurant");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("2000");
  const [deliveryTimeMin, setDeliveryTimeMin] = useState("30");
  const [creating, setCreating] = useState(false);

  const valid = name.trim() && category.trim() && address.trim() && phone.trim()
    && Number(deliveryFee) > 0 && Number(deliveryTimeMin) >= 1;

  const createStore = async () => {
    if (!valid) return;
    setCreating(true);
    try {
      await restaurantApi.create({
        name: name.trim(), vertical, category: category.trim(), address: address.trim(),
        phone: phone.trim(), deliveryFee: Number(deliveryFee), deliveryTimeMin: Number(deliveryTimeMin),
      });
      await qc.invalidateQueries({ queryKey: ["my-restaurant"] });
    } catch (e: any) {
      Alert.alert(t("error"), e?.message || t("error"));
    } finally {
      setCreating(false);
    }
  };

  const uploadDoc = async (type: string, label: string) => {
    try {
      const url = await pickAndUploadImage();
      if (!url) return;
      await kycApi.submit(type, url);
      Alert.alert("✓", fr ? `${label} envoyé pour vérification` : `${label} submitted for review`);
    } catch (e: any) {
      Alert.alert(t("error"), e?.message || t("error"));
    }
  };

  const F = (label: string, value: string, set: (v: string) => void, opts?: { keyboardType?: any; placeholder?: string }) => (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={set}
        placeholder={opts?.placeholder}
        placeholderTextColor={Colors.placeholder}
        keyboardType={opts?.keyboardType}
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <ScrollView style={[styles.container, { paddingTop: topPad }]} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Ionicons name="storefront" size={44} color={Colors.primary} />
      <Text style={styles.title}>{fr ? "Créer votre boutique" : "Create your store"}</Text>
      <Text style={styles.sub}>{fr ? "Configurez votre boutique pour commencer à recevoir des commandes." : "Set up your store to start receiving orders."}</Text>

      <Text style={styles.label}>{fr ? "Type de commerce" : "Store type"}</Text>
      <View style={styles.chips}>
        {VERTICALS.map(v => (
          <Pressable key={v.id} style={[styles.chip, vertical === v.id && styles.chipActive]} onPress={() => setVertical(v.id)}>
            <Ionicons name={v.icon as any} size={15} color={vertical === v.id ? "#fff" : Colors.primary} />
            <Text style={[styles.chipText, vertical === v.id && styles.chipTextActive]}>{fr ? v.labelFr : v.label}</Text>
          </Pressable>
        ))}
      </View>

      {F(fr ? "Nom" : "Name", name, setName)}
      {F(fr ? "Catégorie" : "Category", category, setCategory, { placeholder: fr ? "ex. Congolais, Épicerie" : "e.g. Food, Grocery" })}
      {F(fr ? "Adresse" : "Address", address, setAddress)}
      {F(fr ? "Téléphone" : "Phone", phone, setPhone, { keyboardType: "phone-pad" })}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>{F(fr ? "Frais livraison (CDF)" : "Delivery fee (CDF)", deliveryFee, v => setDeliveryFee(v.replace(/[^0-9]/g, "")), { keyboardType: "numeric" })}</View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>{F(fr ? "Temps (min)" : "Time (min)", deliveryTimeMin, v => setDeliveryTimeMin(v.replace(/[^0-9]/g, "")), { keyboardType: "numeric" })}</View>
      </View>

      <Pressable style={[styles.primaryBtn, !valid && { opacity: 0.5 }]} onPress={createStore} disabled={!valid || creating}>
        {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{fr ? "Créer la boutique" : "Create store"}</Text>}
      </Pressable>

      {/* KYC */}
      <View style={styles.kycCard}>
        <Text style={styles.kycTitle}>{fr ? "Vérification (KYC)" : "Verification (KYC)"}</Text>
        <Text style={styles.kycDesc}>{fr ? "Envoyez vos documents. Votre boutique sera visible après validation." : "Submit your documents. Your store goes live after approval."}</Text>
        <Pressable style={styles.docBtn} onPress={() => uploadDoc("business_registration", fr ? "Enregistrement (RCCM)" : "Business registration")}>
          <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
          <Text style={styles.docBtnText}>{fr ? "Enregistrement de commerce (RCCM)" : "Business registration"}</Text>
        </Pressable>
        <Pressable style={styles.docBtn} onPress={() => uploadDoc("id_card", fr ? "Pièce d'identité" : "ID card")}>
          <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
          <Text style={styles.docBtnText}>{fr ? "Pièce d'identité du propriétaire" : "Owner ID"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginTop: 12 },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted, marginBottom: 6 },
  group: { marginBottom: 14 },
  input: { height: 48, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, color: Colors.textPrimary, fontFamily: "Inter_400Regular", fontSize: 15 },
  row: { flexDirection: "row" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  chipTextActive: { color: "#fff" },
  primaryBtn: { height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  kycCard: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  kycTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  kycDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 4, marginBottom: 14 },
  docBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: 12, paddingHorizontal: 14, marginBottom: 10, backgroundColor: Colors.primary + "1A", borderWidth: 1, borderColor: Colors.primary + "55" },
  docBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary },
});
