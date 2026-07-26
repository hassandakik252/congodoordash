import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { orderApi } from "@/services/api";

export default function OrderChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const oid = Number(orderId);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLang();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["order-messages", oid],
    queryFn: () => orderApi.messages(oid),
    enabled: !isNaN(oid),
    refetchInterval: 4000, // poll for new messages
  });

  const send = useMutation({
    mutationFn: (body: string) => orderApi.sendMessage(oid, body),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["order-messages", oid] }); },
  });

  useEffect(() => {
    if (messages?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages?.length]);

  const roleLabel = (r: string) =>
    r === "customer" ? (language === "fr" ? "Client" : "Customer")
    : r === "driver" ? (language === "fr" ? "Livreur" : "Driver")
    : r === "store_owner" ? (language === "fr" ? "Boutique" : "Store")
    : "Admin";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{language === "fr" ? "Discussion" : "Chat"} · #{oid}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m: any) => String(m.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>{language === "fr" ? "Aucun message. Dites bonjour !" : "No messages yet. Say hi!"}</Text>}
          renderItem={({ item }: { item: any }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine && <Text style={styles.sender}>{roleLabel(item.senderRole)}</Text>}
                  <Text style={[styles.body, mine && { color: "#fff" }]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={language === "fr" ? "Écrire un message…" : "Type a message…"}
          placeholderTextColor={Colors.placeholder}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || send.isPending) && { opacity: 0.5 }]}
          disabled={!text.trim() || send.isPending}
          onPress={() => send.mutate(text.trim())}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { textAlign: "center", color: Colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 40 },
  bubbleRow: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  sender: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, marginBottom: 3 },
  body: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 44, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingTop: 12, color: Colors.textPrimary, fontFamily: "Inter_400Regular", fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});
