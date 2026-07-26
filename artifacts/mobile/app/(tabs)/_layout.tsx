import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useLang } from "@/context/LanguageContext";
import { notificationApi } from "@/services/api";

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.role || "customer";
  const { itemCount } = useCart();
  const { t } = useLang();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const { data: notifCount } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => notificationApi.unreadCount(),
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    enabled: !!user,
  });
  const unreadCount = notifCount?.count ?? 0;

  const tabIcon = (ioName: string, ioFocused: string) =>
    ({ focused, size, color }: { focused: boolean; size: number; color: string }) => (
      <Ionicons name={(focused ? ioFocused : ioName) as any} size={size} color={color} />
    );

  const isAdmin = role === "admin";
  const isDriver = role === "driver";
  const isOwner = role === "store_owner";
  const isCustomer = role === "customer";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: isAdmin
          ? { display: "none" }
          : {
              position: "absolute",
              backgroundColor: isIOS ? "transparent" : Colors.surface,
              borderTopWidth: isWeb ? 1 : 0,
              borderTopColor: Colors.border,
              elevation: 0,
              ...(isWeb ? { height: 84 } : {}),
            },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isDriver ? t("myDeliveries") : isOwner ? t("dashboard") : t("allRestaurants"),
          tabBarIcon: tabIcon(
            isDriver ? "list-outline" : isOwner ? "bar-chart-outline" : "home-outline",
            isDriver ? "list" : isOwner ? "bar-chart" : "home"
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={
          isAdmin || isDriver
            ? { href: null }
            : {
                title: t("myOrders"),
                tabBarIcon: tabIcon(
                  isOwner ? "bag-outline" : "time-outline",
                  isOwner ? "bag" : "time"
                ),
              }
        }
      />
      <Tabs.Screen
        name="cart"
        options={
          isCustomer
            ? {
                title: t("yourCart"),
                tabBarBadge: itemCount > 0 ? itemCount : undefined,
                tabBarIcon: tabIcon("cart-outline", "cart"),
              }
            : { href: null }
        }
      />
      <Tabs.Screen
        name="menu"
        options={
          isOwner
            ? {
                title: t("menuManagement"),
                tabBarIcon: tabIcon("restaurant-outline", "restaurant"),
              }
            : { href: null }
        }
      />
      <Tabs.Screen
        name="store"
        options={
          isOwner
            ? {
                title: t("storeProfile"),
                tabBarIcon: tabIcon("storefront-outline", "storefront"),
              }
            : { href: null }
        }
      />
      <Tabs.Screen
        name="notifications"
        options={
          isAdmin
            ? { href: null }
            : {
                title: t("notifications"),
                tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined,
                tabBarIcon: tabIcon("notifications-outline", "notifications"),
              }
        }
      />
      <Tabs.Screen
        name="profile"
        options={
          isAdmin
            ? { href: null }
            : {
                title: t("profile"),
                tabBarIcon: tabIcon("person-outline", "person"),
              }
        }
      />
    </Tabs>
  );
}
