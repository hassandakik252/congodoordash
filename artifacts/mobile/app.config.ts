import type { ExpoConfig } from "expo/config";

const IS_PRODUCTION = process.env.APP_ENV === "production";
const APP_VERSION = "1.0.0";
const BUILD_NUMBER = "1";

const config: ExpoConfig = {
  name: "Deliver LBH",
  slug: "deliver-lbh",
  version: APP_VERSION,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "deliverlbh",
  userInterfaceStyle: "dark",
  newArchEnabled: true,

  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0F0F0F",
  },

  ios: {
    bundleIdentifier: "com.deliverlbh.app",
    buildNumber: BUILD_NUMBER,
    supportsTablet: false,
    requireFullScreen: true,
    infoPlist: {
      NSCameraUsageDescription:
        "Deliver LBH uses your camera to upload restaurant and profile photos.",
      NSPhotoLibraryUsageDescription:
        "Deliver LBH uses your photo library to upload images.",
      NSLocationWhenInUseUsageDescription:
        "Deliver LBH uses your location to find nearby restaurants and estimate delivery times.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Deliver LBH uses your location to track deliveries in real time.",
    },
  },

  android: {
    package: "com.deliverlbh.app",
    versionCode: parseInt(BUILD_NUMBER),
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#0F0F0F",
    },
    permissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ],
  },

  web: {
    favicon: "./assets/images/icon.png",
    bundler: "metro",
  },

  plugins: [
    [
      "expo-router",
      {
        // Web origin for the router. Set EXPO_PUBLIC_DOMAIN to your deployed
        // domain (e.g. deliver-lbh.app); falls back to localhost in dev.
        origin: process.env.EXPO_PUBLIC_DOMAIN
          ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
          : "http://localhost:8081",
      },
    ],
    "expo-font",
    "expo-web-browser",
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    appEnvironment: IS_PRODUCTION ? "production" : "development",
    // `eas init` writes the real projectId here; until then it can be provided
    // via the EAS_PROJECT_ID env var. Left undefined otherwise (no placeholder).
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
