import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

interface Props {
  label?: string;
  color?: string;
}

export default function LivePulse({ label = "Live", color = Colors.success }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(1000),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.dotWrap}>
        <Animated.View
          style={[
            styles.ripple,
            { backgroundColor: color, transform: [{ scale }], opacity },
          ]}
        />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      {!!label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(52,199,89,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ripple: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
