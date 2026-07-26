import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, productsTable, usersTable } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, getTableColumns } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";
import { isOpenByHours } from "../lib/hours";

const router = Router();

/** Attach `openNow` = manual isOpen AND within the store's schedule. */
function withOpenNow<T extends { isOpen: boolean; businessHours?: any }>(store: T) {
  return { ...store, openNow: store.isOpen && isOpenByHours(store.businessHours) };
}

const verticalValues = ["restaurant", "grocery", "pharmacy", "retail", "drinks"] as const;
const productUnitValues = ["each", "kg", "g", "L", "pack"] as const;

const modifiersSchema = z.array(z.object({
  name: z.string().min(1),
  required: z.boolean(),
  multiple: z.boolean(),
  options: z.array(z.object({ label: z.string().min(1), price: z.number().nonnegative() })).min(1),
})).nullable().optional();

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
  requiresPrescription: z.boolean().optional(),
  modifiers: modifiersSchema,
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
  requiresPrescription: z.boolean().optional(),
  modifiers: modifiersSchema,
});

// Helper — verify restaurant is owned by requester
async function requireOwnership(storeId: number, userId: number) {
  const [r] = await db.select({ ownerId: storesTable.ownerId })
    .from(storesTable)
    .where(eq(storesTable.id, storeId))
    .limit(1);
  if (!r) return "not_found";
  if (r.ownerId !== userId) return "forbidden";
  return "ok";
}

// ── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// GET /restaurants
router.get("/", async (req, res) => {
  const { category, search, vertical } = req.query as { category?: string; search?: string; vertical?: string };

  // Only show stores whose owner is approved (or a legacy null status). Pending
  // and rejected merchants stay hidden from customers.
  const conditions = [
    sql`(${usersTable.merchantStatus} IS NULL OR ${usersTable.merchantStatus} = 'approved')`,
  ];
  if (vertical && (verticalValues as readonly string[]).includes(vertical)) {
    conditions.push(eq(storesTable.vertical, vertical as (typeof verticalValues)[number]));
  }
  if (category) conditions.push(eq(storesTable.category, category));
  if (search) {
    conditions.push(
      or(
        ilike(storesTable.name, `%${search}%`),
        ilike(storesTable.description ?? "", `%${search}%`)
      )!,
    );
  }

  const restaurants = await db
    .select(getTableColumns(storesTable))
    .from(storesTable)
    .leftJoin(usersTable, eq(storesTable.ownerId, usersTable.id))
    .where(and(...conditions));

  res.json(restaurants.map(withOpenNow));
});

// ── OWNER-ONLY "MINE" ROUTES (must appear before /:id routes) ────────────────

// PATCH /restaurants/mine — update owner's own restaurant
router.patch("/mine", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
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
    businessHours: z.array(z.object({ open: z.string(), close: z.string() }).nullable()).length(7).nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [restaurant] = await db.select({ id: storesTable.id })
    .from(storesTable)
    .where(eq(storesTable.ownerId, req.user!.id))
    .orderBy(storesTable.id)
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
  if (d.businessHours !== undefined) updates.businessHours = d.businessHours;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request", message: "No fields to update" });
    return;
  }

  const [updated] = await db.update(storesTable)
    .set(updates)
    .where(eq(storesTable.id, restaurant.id))
    .returning();

  res.json(updated);
});

// GET /restaurants/mine — owner's own restaurant
router.get("/mine", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const [restaurant] = await db.select()
    .from(storesTable)
    .where(eq(storesTable.ownerId, req.user!.id))
    .orderBy(storesTable.id)
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "No restaurant found for this owner" });
    return;
  }
  res.json(restaurant);
});

// GET /restaurants/mine/menu — ALL menu items for owner (incl. unavailable)
router.get("/mine/menu", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const [restaurant] = await db.select({ id: storesTable.id })
    .from(storesTable)
    .where(eq(storesTable.ownerId, req.user!.id))
    .orderBy(storesTable.id)
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "No restaurant found" });
    return;
  }

  const items = await db.select()
    .from(productsTable)
    .where(eq(productsTable.storeId, restaurant.id))
    .orderBy(productsTable.category, productsTable.name);

  res.json(items);
});

// ── PARAMETERIZED ROUTES ─────────────────────────────────────────────────────

// GET /restaurants/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const [restaurant] = await db.select().from(storesTable).where(eq(storesTable.id, id)).limit(1);
  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "Restaurant not found" });
    return;
  }
  res.json(withOpenNow(restaurant));
});

// POST /restaurants
router.post("/", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const parsed = createRestaurantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [restaurant] = await db
    .insert(storesTable)
    .values({ ...parsed.data, ownerId: req.user!.id })
    .returning();

  res.status(201).json(restaurant);
});

// GET /restaurants/:id/menu — available items only (public, for customers)
router.get("/:id/menu", async (req, res) => {
  const storeId = parseInt(String(req.params.id));
  if (isNaN(storeId)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const items = await db.select()
    .from(productsTable)
    .where(and(
      eq(productsTable.storeId, storeId),
      eq(productsTable.isAvailable, true),
    ))
    .orderBy(productsTable.category, productsTable.name);

  res.json(items);
});

// GET /stores/:id/products — paginated, searchable catalog (grocery/retail/pharmacy)
// Query: ?search= ?categoryId= ?page=1 ?pageSize=20  — available items only.
// Returns { items, page, pageSize, total, hasMore } for large catalogs.
router.get("/:id/products", async (req, res) => {
  const storeId = parseInt(String(req.params.id));
  if (isNaN(storeId)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const { search, categoryId } = req.query as { search?: string; categoryId?: string };
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? "20")) || 20));

  const conditions = [
    eq(productsTable.storeId, storeId),
    eq(productsTable.isAvailable, true),
  ];
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(productsTable.name, term),
        ilike(productsTable.brand ?? "", term),
        ilike(productsTable.description ?? "", term),
      )!,
    );
  }
  if (categoryId) {
    const cid = parseInt(categoryId);
    if (!isNaN(cid)) conditions.push(eq(productsTable.categoryId, cid));
  }

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(where);

  const items = await db
    .select()
    .from(productsTable)
    .where(where)
    .orderBy(productsTable.category, productsTable.name)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  res.json({ items, page, pageSize, total, hasMore: page * pageSize < total });
});

// POST /restaurants/:id/menu — add menu item
router.post("/:id/menu", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const storeId = parseInt(String(req.params.id));
  if (isNaN(storeId)) { res.status(400).json({ error: "bad_request", message: "Invalid id" }); return; }

  const parsed = createMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const ownership = await requireOwnership(storeId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found", message: "Restaurant not found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [item] = await db
    .insert(productsTable)
    .values({ ...parsed.data, storeId: storeId })
    .returning();

  res.status(201).json(item);
});

// PATCH /restaurants/:id/menu/:itemId/availability — toggle availability
router.patch("/:id/menu/:itemId/availability", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const storeId = parseInt(String(req.params.id));
  const itemId = parseInt(String(req.params.itemId));
  if (isNaN(storeId) || isNaN(itemId)) { res.status(400).json({ error: "bad_request" }); return; }

  const ownership = await requireOwnership(storeId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [existing] = await db.select({ isAvailable: productsTable.isAvailable })
    .from(productsTable)
    .where(and(eq(productsTable.id, itemId), eq(productsTable.storeId, storeId)))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "not_found", message: "Item not found" }); return; }

  const [updated] = await db.update(productsTable)
    .set({ isAvailable: !existing.isAvailable })
    .where(eq(productsTable.id, itemId))
    .returning();

  res.json(updated);
});

// PATCH /restaurants/:id/menu/:itemId — update menu item fields
router.patch("/:id/menu/:itemId", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const storeId = parseInt(String(req.params.id));
  const itemId = parseInt(String(req.params.itemId));
  if (isNaN(storeId) || isNaN(itemId)) { res.status(400).json({ error: "bad_request" }); return; }

  const parsed = updateMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const ownership = await requireOwnership(storeId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [item] = await db.select({ id: productsTable.id })
    .from(productsTable)
    .where(and(eq(productsTable.id, itemId), eq(productsTable.storeId, storeId)))
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
  if (parsed.data.requiresPrescription !== undefined) updates.requiresPrescription = parsed.data.requiresPrescription;
  if (parsed.data.modifiers !== undefined) updates.modifiers = parsed.data.modifiers;

  const [updated] = await db.update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, itemId))
    .returning();

  res.json(updated);
});

// DELETE /restaurants/:id/menu/:itemId — permanently delete menu item
router.delete("/:id/menu/:itemId", requireAuth, requireRole("store_owner"), async (req: AuthRequest, res) => {
  const storeId = parseInt(String(req.params.id));
  const itemId = parseInt(String(req.params.itemId));
  if (isNaN(storeId) || isNaN(itemId)) { res.status(400).json({ error: "bad_request" }); return; }

  const ownership = await requireOwnership(storeId, req.user!.id);
  if (ownership === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (ownership === "forbidden") { res.status(403).json({ error: "forbidden", message: "Not your restaurant" }); return; }

  const [deleted] = await db.delete(productsTable)
    .where(and(eq(productsTable.id, itemId), eq(productsTable.storeId, storeId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "not_found", message: "Item not found" }); return; }

  res.json({ ok: true, id: deleted.id });
});

export default router;
