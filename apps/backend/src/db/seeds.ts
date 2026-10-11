import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { sanitizeContactSeedObjects } from "@mms/shared";
import { hashPassword } from "../services/auth/passwordService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedsData {
  DEFAULT_COLLECTIONS: Record<string, unknown[]>;
  DEFAULT_OBJECTS: Record<string, unknown>;
}

interface LegacySeedUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  roles?: string[];
  passwordHash?: string;
  createdAt?: string;
  createdDate?: string;
}

interface StoredSeedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  createdAt: string;
}

let cachedSeeds: SeedsData | null = null;

/**
 * Lazily loads seed data from seeds.json.gz (or falls back to seeds.json).
 *
 * @returns {SeedsData} The parsed seeds data.
 */
function loadSeeds(): SeedsData {
  if (!cachedSeeds) {
    const gzPath = path.join(__dirname, "seeds.json.gz");
    if (fs.existsSync(gzPath)) {
      const compressed = fs.readFileSync(gzPath);
      const decompressed = zlib.gunzipSync(compressed);
      cachedSeeds = JSON.parse(decompressed.toString("utf8")) as SeedsData;
    } else {
      const jsonPath = path.join(__dirname, "seeds.json");
      const raw = fs.readFileSync(jsonPath, "utf8");
      cachedSeeds = JSON.parse(raw) as SeedsData;
    }
  }
  return cachedSeeds;
}

/**
 * Normalizes legacy seed users to the canonical StoredUser shape.
 *
 * @param {unknown[]} rawUsers - Users array from seeds.json.
 * @returns {Promise<StoredSeedUser[]>} Canonical users with password hashes.
 */
async function normalizeSeedUsers(rawUsers: unknown[]): Promise<StoredSeedUser[]> {
  const needsGeneratedPassword = rawUsers.some((entry) => !(entry as LegacySeedUser).passwordHash);
  const seedPassword = process.env.SEED_DEV_PASSWORD?.trim();

  if (needsGeneratedPassword && !seedPassword) {
    throw new Error(
      "SEED_DEV_PASSWORD is required when legacy seed users do not include password hashes",
    );
  }

  const generatedPasswordHash = seedPassword ? await hashPassword(seedPassword) : "";

  return rawUsers.map((entry) => {
    const user = entry as LegacySeedUser;
    const role = user.role ?? user.roles?.[0] ?? "assistant_teacher";
    const createdAt = user.createdAt ?? user.createdDate ?? new Date().toISOString();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      passwordHash: user.passwordHash ?? generatedPasswordHash,
      createdAt,
    };
  });
}

/**
 * Returns the default collections for database seeding.
 *
 * @returns {Record<string, unknown[]>} Map of collection name to document array.
 */
export function getDefaultCollections(): Record<string, unknown[]> {
  return loadSeeds().DEFAULT_COLLECTIONS;
}

/**
 * Returns default collections with users normalized for auth (hashed passwords, singular role).
 *
 * @returns {Promise<Record<string, unknown[]>>} Seed collections ready for persistence.
 */
export async function getDefaultCollectionsForSeed(): Promise<Record<string, unknown[]>> {
  const collections = { ...loadSeeds().DEFAULT_COLLECTIONS };

  if (Array.isArray(collections.users)) {
    collections.users = await normalizeSeedUsers(collections.users);
  }

  return collections;
}

/**
 * Returns the default objects for database seeding.
 *
 * @returns {Record<string, unknown>} Map of object key to object data.
 */
export function getDefaultObjects(): Record<string, unknown> {
  return sanitizeContactSeedObjects({ ...loadSeeds().DEFAULT_OBJECTS });
}
