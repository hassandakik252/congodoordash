import { Router, type IRouter, json } from "express";
import { requireAuth } from "../middlewares/auth";
import { getStorage, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../lib/storage";
import { z } from "zod";

const router: IRouter = Router();

// Accept larger bodies here only (base64 image ≈ 4/3 of the file size).
router.use(json({ limit: "8mb" }));

const uploadSchema = z.object({
  // Either a bare base64 string or a data URI (data:image/png;base64,....)
  data: z.string().min(1),
  contentType: z.string().optional(),
});

// POST /uploads — authenticated image upload. Returns { url }.
router.post("/", requireAuth, async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  let { data, contentType } = parsed.data;

  // Support data URIs: data:<mime>;base64,<payload>
  const dataUri = data.match(/^data:([^;]+);base64,(.*)$/s);
  if (dataUri) {
    contentType = contentType ?? dataUri[1];
    data = dataUri[2];
  }

  if (!contentType || !ALLOWED_IMAGE_TYPES[contentType]) {
    res.status(415).json({ error: "unsupported_type", message: "Only JPEG, PNG or WebP images are allowed." });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch {
    res.status(400).json({ error: "bad_data", message: "Invalid base64 image data" });
    return;
  }
  if (buffer.length === 0) {
    res.status(400).json({ error: "empty", message: "Empty image" });
    return;
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: "too_large", message: "Image exceeds the 5 MB limit." });
    return;
  }

  try {
    const { url } = await getStorage().save(buffer, ALLOWED_IMAGE_TYPES[contentType], contentType);
    res.status(201).json({ url });
  } catch (err) {
    console.error("[uploads] save failed", err);
    res.status(500).json({ error: "storage_error", message: "Could not store the image." });
  }
});

export default router;
