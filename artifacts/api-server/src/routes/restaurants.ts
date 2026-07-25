import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, menuItemsTable } from "@workspace/db/schema";
import { eq, ilike, or, and } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const verticalValues = ["restaurant", "grocery", "pharmacy", "retail", "drinks"] as const;
const productUnitValues = ["each", "kg", "g", "L", "pack"] as const;

const createRestaurantSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  vertical: z.enum(verticalValues).optional().default("restaurant"),
  category: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  imageUrl: z.string().optional(),
  deliveryTimeMin: z.number().int().positive(),
  deliveryFee: z.number().positive(),
});

const createMenuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional().default(true),
  // Grocery / retail / pharmacy inventory fields (optional; ignored by restaurants)
  categoryId: z.number().int().positive().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  unit: z.enum(productUnitValues).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
});

const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
  categoryId: z.number().int().positive().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  unit: z.enum(productUnitValues).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
});

// Helper — verify restaurant is owned by requester
async function requireOwnership(restaurantId: number, userId: number) {
  const [r] = await db.select({ ownerId: restaurantsTable.ownerId })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);
  if (!r) return "not_found";
  if (r.ownerId !== userId) return "forbidden";
  return "ok";
}

// ── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// GET /restaurants
router.get("/", async (req, res) => {
  const { category, search, vertical } = req.query as { category?: string; search?: string; vertical?: string };

  const conditions = [];
  if (vertical && (verticalValues as readonly string[]).includes(vertical)) {
    conditions.push(eq(restaurantsTable.vertical, vertical as (typeof verticalValues)[number]));
  }
  if (category) conditions.push(eq(restaurantsTable.category, category));
  if (search) {
    conditions.push(
      or(
        ilike(restaurantsTable.name, `%${search}%`),
        ilike(restaurantsTable.description ?? "", `%${search}%`)
      )
    );
  }

  const restaurants = conditions.length > 0
    ? await db.select().from(restaurantsTable).where(and(...conditions))
    : await db.select().from(restaurantsTable);

  res.json(restaurants);
});

// ── OWNER-ONLY "MINE" ROUTES (must appear before /:id routes) ────────────────

// PATCH /restaurants/mine — update owner's own restaurant
router.patch("/mine", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    imageUrl: z.string().optional(),
    deliveryTimeMin: z.number().int().positive().optional(),
    deliveryFee: z.number().nonnegative().optional(),
    isOpen: z.boolean().optional(),
    openingHours: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [restaurant] = await db.select({ id: restaurantsTable.id })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.ownerId, req.user!.id))
    .orderBy(restaurantsTable.id)
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "No restaurant found for this owner" });
    return;
  }

  const updates: Record<string, any> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.description !== undefined) updates.description = d.description;
  if (d.category !== undefined) updates.category = d.category;
  if (d.address !== undefined) updates.address = d.address;
  if (d.phone !== undefined) updates.phone = d.phone;
  if (d.imageUrl !== undefined) updates.imageUrl = d.imageUrl;
  if (d.deliveryTimeMin !== undefined) updates.deliveryTimeMin = d.deliveryTimeMin;
  if (d.deliveryFee !== undefined) updates.deliveryFee = d.deliveryFee;
  if (d.isOpen !== undefined) updates.isOpen = d.isOpen;
  if (d.openingHours !== undefined) updates.openingHours = d.openingHours;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request", message: "No fields to update" });
    return;
  }

  const [updated] = await db.update(restaurantsTable)
    .set(updates)
    .where(eq(restaurantsTable.id, restaurant.id))
    .returning();

  res.json(updated);
});

// GET /restaurants/mine — owner's own restaurant
router.get("/mine", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const [restaurant] = await db.select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.ownerId, req.user!.id))
    .orderBy(restaurantsTable.id)
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "No restaurant found for this owner" });
    return;
  }
  res.json(restaurant);
});

// GET /restaurants/mine/menu — ALL menu items for owner (incl. unavailable)
router.get("/mine/menu", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const [restaurant] = await db.select({ id: restaurantsTable.id })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.ownerId, req.user!.id))
    .orderBy(restaurantsTable.id)
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "No restaurant found" });
    return;
  }

  const items = await db.select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.restaurantId, restaurant.id))
    .orderBy(menuItemsTable.category, menuItemsTable.name);

  res.json(items);
});

// ── PARAMETERIZED ROUTES ─────────────────────────────────────────────────────

// GET /restaurants/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id)).limit(1);
  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "Restaurant not found" });
    return;
  }
  res.json(restaurant);
});

// POST /restaurants
router.post("/", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const parsed = createRestaurantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [restaurant] = await db
    .insert(restaurantsTable)
    .values({ ...parsed.data, ownerId: req.user!.id })
    .returning();

  res.status(201).json(restaurant);
});

// GET /restaurants/:id/menu — available items only (public, for customers)
router.get("/:id/menu", async (req, res) => {
  const restaurantId = parseInt(String(req.params.id));
  if (isNaN(restaurantId)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const items = await db.select()
    .from(menuItemsTable)
    .where(and(
      eq(menuItemsTable.restaurantId, restaurantId),
      eq(menuItemsTable.isAvailable, true),
    ))
    .orderBy(menuItemsTable.category, menuItemsTable.name);

  res.json(items);
});

// POST /restaurants/:id/menu — add menu item
router.post("/:id/menu", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const restaurantId = parseInt(String(req.params.id));
  if (isNaN(restaurantId)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const parsed = createMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const ownership = await requireOwnership(restaurantId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found", message: "Restaurant not found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [item] = await db
    .insert(menuItemsTable)
    .values({ ...parsed.data, restaurantId })
    .returning();

  res.status(201).json(item);
});

// PATCH /restaurants/:id/menu/:itemId/availability — toggle availability
router.patch("/:id/menu/:itemId/availability", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const restaurantId = parseInt(String(req.params.id));
  const itemId = parseInt(String(req.params.itemId));
  if (isNaN(restaurantId) || isNaN(itemId)) { res.status(400).json({ error: "bad_request" }); return; }

  const ownership = await requireOwnership(restaurantId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [existing] = await db.select({ isAvailable: menuItemsTable.isAvailable })
    .from(menuItemsTable)
    .where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId)))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "not_found", message: "Item not found" }); return; }

  const [updated] = await db.update(menuItemsTable)
    .set({ isAvailable: !existing.isAvailable })
    .where(eq(menuItemsTable.id, itemId))
    .returning();

  res.json(updated);
});

// PATCH /restaurants/:id/menu/:itemId — update menu item fields
router.patch("/:id/menu/:itemId", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const restaurantId = parseInt(String(req.params.id));
  const itemId = parseInt(String(req.params.itemId));
  if (isNaN(restaurantId) || isNaN(itemId)) { res.status(400).json({ error: "bad_request" }); return; }

  const parsed = updateMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const ownership = await requireOwnership(restaurantId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [item] = await db.select({ id: menuItemsTable.id })
    .from(menuItemsTable)
    .where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId)))
    .limit(1);
  if (!item) { res.status(404).json({ error: "not_found", message: "Item not found" }); return; }

  const updates: Record<string, any> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.price !== undefined) updates.price = parsed.data.price;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
  if (parsed.data.isAvailable !== undefined) updates.isAvailable = parsed.data.isAvailable;
  if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
  if (parsed.data.stockQuantity !== undefined) updates.stockQuantity = parsed.data.stockQuantity;
  if (parsed.data.unit !== undefined) updates.unit = parsed.data.unit;
  if (parsed.data.sku !== undefined) updates.sku = parsed.data.sku;
  if (parsed.data.barcode !== undefined) updates.barcode = parsed.data.barcode;
  if (parsed.data.brand !== undefined) updates.brand = parsed.data.brand;

  const [updated] = await db.update(menuItemsTable)
    .set(updates)
    .where(eq(menuItemsTable.id, itemId))
    .returning();

  res.json(updated);
});

// DELETE /restaurants/:id/menu/:itemId — permanently delete menu item
router.delete("/:id/menu/:itemId", requireAuth, requireRole("restaurant_owner"), async (req: AuthRequest, res) => {
  const restaurantId = parseInt(String(req.params.id));
  const itemId = parseInt(String(req.params.itemId));
  if (isNaN(restaurantId) || isNaN(itemId)) { res.status(400).json({ error: "bad_request" }); return; }

  const ownership = await requireOwnership(restaurantId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [deleted] = await db.delete(menuItemsTable)
    .where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "not_found", message: "Item not found" }); return; }

  res.json({ ok: true, id: deleted.id });
});

export default router;
