import * as ImagePicker from "expo-image-picker";
import { uploadApi } from "@/services/api";

/**
 * Let the user pick an image from their library, upload it, and return the
 * hosted URL (or null if they cancelled / permission denied). Throws on upload
 * failure so callers can surface an error.
 */
export async function pickAndUploadImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) return null;

  // Derive the mime type from the file extension (default jpeg).
  const uri = asset.uri.toLowerCase();
  const contentType = uri.endsWith(".png")
    ? "image/png"
    : uri.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  const { url } = await uploadApi.image(asset.base64, contentType);
  return url;
}
