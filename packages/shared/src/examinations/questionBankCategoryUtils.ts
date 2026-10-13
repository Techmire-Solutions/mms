import type { QuestionCategory } from "./questionBankEntities.js";
import { QUESTION_CATEGORY_COLORS } from "./questionBankEntities.js";

/** Question shape used for category merge helpers. */
export type QuestionCategoryRef = {
  categoryIds?: string[];
  categoryId?: string | null;
};

/** Resolves category ids from `categoryIds` or legacy `categoryId`. */
export function getQuestionCategoryIds(question: QuestionCategoryRef): string[] {
  const fromArray = (question.categoryIds ?? [])
    .map((categoryId) => categoryId?.trim())
    .filter(Boolean) as string[];
  if (fromArray.length > 0) return [...new Set(fromArray)];
  const legacy = question.categoryId?.trim();
  return legacy ? [legacy] : [];
}

export function slugifyCategoryName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return base || "category";
}

/**
 * Creates a unique category entry from a user-provided name.
 */
export function createQuestionCategory(
  name: string,
  existing: readonly QuestionCategory[] = [],
  patch?: Partial<Pick<QuestionCategory, "icon" | "color">>,
): QuestionCategory {
  const trimmed = name.trim();
  const slug = slugifyCategoryName(trimmed);
  let id = `cat-${slug}`;
  let suffix = 1;
  while (existing.some((category) => category.id === id)) {
    id = `cat-${slug}-${suffix}`;
    suffix += 1;
  }
  const colorIdx = existing.length % QUESTION_CATEGORY_COLORS.length;
  return {
    id,
    name: trimmed,
    icon: patch?.icon ?? "📚",
    color: patch?.color ?? QUESTION_CATEGORY_COLORS[colorIdx],
  };
}

/**
 * Merges configured categories with any category ids referenced on questions.
 */
export function mergeQuestionCategories(
  configured: readonly QuestionCategory[],
  questions?: readonly QuestionCategoryRef[],
): QuestionCategory[] {
  const categoryById = new Map<string, QuestionCategory>();
  for (const category of configured) {
    if (category.id) categoryById.set(category.id, category);
  }
  for (const question of questions ?? []) {
    for (const questionCategoryId of getQuestionCategoryIds(question)) {
      if (!questionCategoryId || categoryById.has(questionCategoryId)) continue;
      const inferredName = questionCategoryId.startsWith("cat-")
        ? questionCategoryId
            .slice(4)
            .split("-")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
        : questionCategoryId;
      categoryById.set(questionCategoryId, {
        id: questionCategoryId,
        name: inferredName,
        icon: "📋",
        color: QUESTION_CATEGORY_COLORS[categoryById.size % QUESTION_CATEGORY_COLORS.length],
      });
    }
  }
  return [...categoryById.values()].sort((leftCategory, rightCategory) =>
    leftCategory.name.localeCompare(rightCategory.name),
  );
}

/**
 * Inserts or replaces a category in the list by id.
 */
export function upsertQuestionCategory(
  categories: readonly QuestionCategory[],
  category: QuestionCategory,
): QuestionCategory[] {
  const categoryIndex = categories.findIndex(
    (existingCategory) => existingCategory.id === category.id,
  );
  if (categoryIndex >= 0) {
    return categories.map((existingCategory, index) =>
      index === categoryIndex ? category : existingCategory,
    );
  }
  return [...categories, category];
}
