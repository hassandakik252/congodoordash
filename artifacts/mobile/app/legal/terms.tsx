import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";

// NOTE: This is a starter template, not legal advice. Have a lawyer review and
// localise it for DR Congo before launch.
const SECTIONS = [
  {
    fr: { t: "1. Acceptation", b: "En créant un compte ou en passant une commande sur Deliver LBH, vous acceptez les présentes Conditions d'utilisation et notre Politique de confidentialité." },
    en: { t: "1. Acceptance", b: "By creating an account or placing an order on Deliver LBH, you agree to these Terms of Use and our Privacy Policy." },
  },
  {
    fr: { t: "2. Comptes", b: "Vous devez fournir des informations exactes, avoir au moins 18 ans et garder votre mot de passe confidentiel. Vous êtes responsable de l'activité sur votre compte. Les livreurs et les commerçants doivent réussir la vérification (KYC) avant d'opérer." },
    en: { t: "2. Accounts", b: "You must provide accurate information, be at least 18, and keep your password confidential. You are responsible for activity on your account. Drivers and merchants must pass verification (KYC) before operating." },
  },
  {
    fr: { t: "3. Commandes et paiement", b: "Les prix sont affichés en CDF (ou USD au taux en vigueur). Le paiement se fait en espèces à la livraison, par carte ou par Mobile Money. Pour les articles vendus au poids, le montant final peut différer de l'estimation. Un pourboire facultatif au livreur peut être ajouté." },
    en: { t: "3. Orders & payment", b: "Prices are shown in CDF (or USD at the current rate). Payment is by cash on delivery, card, or Mobile Money. For items sold by weight, the final amount may differ from the estimate. An optional driver tip may be added." },
  },
  {
    fr: { t: "4. Livraison", b: "Les délais sont estimatifs. La disponibilité dépend de votre zone et des horaires d'ouverture du commerce. Vous devez fournir une adresse exacte et être joignable." },
    en: { t: "4. Delivery", b: "Delivery times are estimates. Availability depends on your area and the store's opening hours. You must provide an accurate address and be reachable." },
  },
  {
    fr: { t: "5. Annulations et remboursements", b: "Vous pouvez annuler tant que la commande n'est pas en préparation. Les remboursements pour articles manquants ou substitutions refusées sont traités selon le mode de paiement. Les commandes en espèces déjà livrées ne sont pas remboursables." },
    en: { t: "5. Cancellations & refunds", b: "You may cancel while the order is not yet being prepared. Refunds for missing items or rejected substitutions are processed per your payment method. Delivered cash orders are non-refundable." },
  },
  {
    fr: { t: "6. Commerçants et livreurs", b: "Les commerçants garantissent l'exactitude de leur catalogue, de leurs stocks et de leurs prix. Les livreurs s'engagent à livrer avec soin. Deliver LBH prélève une commission par commande, détaillée dans votre contrat partenaire." },
    en: { t: "6. Merchants & drivers", b: "Merchants warrant the accuracy of their catalog, stock and prices. Drivers agree to deliver with care. Deliver LBH charges a per-order commission, detailed in your partner agreement." },
  },
  {
    fr: { t: "7. Conduite", b: "Il est interdit d'utiliser le service à des fins frauduleuses, de harceler d'autres utilisateurs ou de contourner les paiements. Nous pouvons suspendre tout compte qui enfreint ces règles." },
    en: { t: "7. Conduct", b: "You may not use the service fraudulently, harass other users, or bypass payments. We may suspend any account that breaches these rules." },
  },
  {
    fr: { t: "8. Responsabilité", b: "Deliver LBH agit comme intermédiaire entre clients, commerces et livreurs. Dans les limites de la loi, notre responsabilité est limitée au montant de la commande concernée. Les produits restent sous la responsabilité du commerce." },
    en: { t: "8. Liability", b: "Deliver LBH acts as an intermediary between customers, stores and drivers. To the extent permitted by law, our liability is limited to the value of the relevant order. Products remain the responsibility of the store." },
  },
  {
    fr: { t: "9. Modifications", b: "Nous pouvons modifier ces conditions. L'usage continu du service après mise à jour vaut acceptation." },
    en: { t: "9. Changes", b: "We may update these terms. Continued use of the service after an update constitutes acceptance." },
  },
  {
    fr: { t: "10. Contact", b: "Pour toute question : support@deliverlbh.com" },
    en: { t: "10. Contact", b: "Questions: support@deliverlbh.com" },
  },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLang();
  const fr = language === "fr";

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{fr ? "Conditions d'utilisation" : "Terms of Use"}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 40 : 100) }]}
      >
        <View style={styles.introCard}>
          <Ionicons name="document-text-outline" size={30} color={Colors.primary} />
          <Text style={styles.introText}>
            {fr
              ? "Veuillez lire attentivement ces conditions avant d'utiliser Deliver LBH."
              : "Please read these terms carefully before using Deliver LBH."}
          </Text>
        </View>

        {SECTIONS.map((s) => {
          const c = fr ? s.fr : s.en;
          return (
            <View key={c.t} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{c.t}</Text>
              <Text style={styles.sectionBody}>{c.b}</Text>
            </View>
          );
        })}

        <Text style={styles.updatedText}>{fr ? "Dernière mise à jour : 2026" : "Last updated: 2026"}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  content: { paddingHorizontal: 20 },
  introCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  introText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 6 },
  sectionBody: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 21 },
  updatedText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", marginTop: 8 },
});
