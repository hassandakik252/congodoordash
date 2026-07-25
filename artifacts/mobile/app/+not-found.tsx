import { router, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LanguageContext";

export default function NotFoundScreen() {
  const { t } = useLang();

  return (
    <>
      <Stack.Screen options={{ title: "404", headerShown: false }} />
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={72} color={Colors.textMuted} />
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>
          {t("back") === "Back"
            ? "This page doesn't exist."
            : "Cette page n'existe pas."}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Ionicons name="home-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>
            {t("back") === "Back" ? "Go home" : "Retour à l'accueil"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.dark,
    alignItems: "center", justifyContent: "center",
    padding: 32, gap: 16,
  },
  title: {
    fontSize: 56, fontFamily: "Inter_700Bold",
    color: Colors.textMuted, marginTop: 8,
  },
  subtitle: {
    fontSize: 16, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, textAlign: "center",
  },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 24,
    paddingVertical: 14, borderRadius: 14, marginTop: 8,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
