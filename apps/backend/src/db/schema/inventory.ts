import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  varchar,
  primaryKey,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { desc } from "drizzle-orm";
import { workspaces } from "./platform.js";
import { students } from "./students.js";

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    name: text("name").notNull(),
    itemType: varchar("item_type", { length: 30 }).notNull(), // 'book' | 'stationery'
    language: varchar("language", { length: 100 }), // for books
    totalStock: integer("total_stock").default(0).notNull(),
    remainingStock: integer("remaining_stock").default(0).notNull(),
    purchaseCost: numeric("purchase_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
    sellingPrice: numeric("selling_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("inventory_items_workspace_type_idx").on(table.workspaceSubdomain, table.itemType),
    index("inventory_items_workspace_name_idx").on(table.workspaceSubdomain, table.name),
  ],
);

export const inventorySales = pgTable(
  "inventory_sales",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    studentId: text("student_id"),
    buyerName: text("buyer_name"),
    qty: integer("qty").default(1).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
    saleDate: timestamp("sale_date", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    status: varchar("status", { length: 20 }).default("completed").notNull(), // 'completed' | 'cancelled' | 'pending'
    soldBy: text("sold_by"),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    foreignKey({
      columns: [table.workspaceSubdomain, table.itemId],
      foreignColumns: [inventoryItems.workspaceSubdomain, inventoryItems.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceSubdomain, table.studentId],
      foreignColumns: [students.workspaceSubdomain, students.id],
    }).onDelete("set null"),
    index("inventory_sales_workspace_item_idx").on(table.workspaceSubdomain, table.itemId),
    index("inventory_sales_workspace_student_idx").on(table.workspaceSubdomain, table.studentId),
  ],
);

export const ecommerceOrders = pgTable(
  "ecommerce_orders",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    buyerName: text("buyer_name").notNull(),
    buyerContact: text("buyer_contact"),
    orderDate: timestamp("order_date", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    status: varchar("status", { length: 30 }).default("pending").notNull(), // 'pending' | 'paid' | 'shipped'
  },
  (table) => [
    primaryKey({ columns: [table.workspaceSubdomain, table.id] }),
    index("ecommerce_orders_workspace_status_date_idx").on(
      table.workspaceSubdomain,
      table.status,
      desc(table.orderDate),
    ),
  ],
);

export const ijaraOrders = pgTable(
  "ijara_orders",
  {
    id: text("id").notNull(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    assetName: text("asset_name").notNull(),
    renterName: text("renter_name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    rentAmount: numeric("rent_amount", { precision: 15, scale: 2 }).notNull(),
    status: varchar("status", { length: 30 }).default("active").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceSubdomain, table.id] })],
);

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type InventorySale = typeof inventorySales.$inferSelect;
export type NewInventorySale = typeof inventorySales.$inferInsert;
export type EcommerceOrder = typeof ecommerceOrders.$inferSelect;
export type NewEcommerceOrder = typeof ecommerceOrders.$inferInsert;
export type IjaraOrder = typeof ijaraOrders.$inferSelect;
export type NewIjaraOrder = typeof ijaraOrders.$inferInsert;
