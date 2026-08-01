/**
 * Enterprise Template Manager — Unified template access layer.
 *
 * Combines: search, favorites, recents, categories, offline support.
 * All existing templates preserved — no data loss.
 */

import {
  getApplicationTypes,
  getApplicationTypeById,
  searchApplicationTypes,
  searchTemplatesFTS,
  getFavoriteTemplateIds,
  addFavoriteTemplate,
  removeFavoriteTemplate,
  getRecentTemplateIds,
  recordTemplateOpen,
} from '../../database/db';
import type { ApplicationType, OfficeType } from '../../types/database';
import { getPrimaryCategory, getCategoriesForOffice, getCategoryById, CATEGORIES } from './TemplateCategories';

// ── Types ────────────────────────────────────────────────────────────────

export interface TemplateWithMeta extends ApplicationType {
  isFavorite: boolean;
  isRecent: boolean;
  category: string;
  categoryName: string;
}

// ── Public API ───────────────────────────────────────────────────────────

export const TemplateManager = {
  /** Get all templates for an office type, enriched with favorites/recents. */
  async getTemplates(officeType?: OfficeType): Promise<TemplateWithMeta[]> {
    const templates = await getApplicationTypes(officeType as OfficeType);
    const [favIds, recentIds] = await Promise.all([
      getFavoriteTemplateIds(),
      getRecentTemplateIds(20),
    ]);
    const favSet = new Set(favIds);
    const recentSet = new Set(recentIds);

    return templates.map((t) => ({
      ...t,
      isFavorite: favSet.has(t.id),
      isRecent: recentSet.has(t.id),
      category: getPrimaryCategory(t.office_type),
      categoryName: getCategoryById(getPrimaryCategory(t.office_type))?.nameHindi ?? t.office_type,
    }));
  },

  /** Get a single template with metadata. */
  async getTemplate(id: number): Promise<TemplateWithMeta | null> {
    const t = await getApplicationTypeById(id);
    if (!t) return null;
    const [favIds, recentIds] = await Promise.all([getFavoriteTemplateIds(), getRecentTemplateIds(20)]);
    return {
      ...t,
      isFavorite: favIds.includes(t.id),
      isRecent: recentIds.includes(t.id),
      category: getPrimaryCategory(t.office_type),
      categoryName: getCategoryById(getPrimaryCategory(t.office_type))?.nameHindi ?? t.office_type,
    };
  },

  /** Search templates (multi-word, ranked). */
  async search(query: string): Promise<TemplateWithMeta[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    // Use enhanced search for multi-word queries
    const templates = await searchTemplatesFTS(trimmed);
    const [favIds, recentIds] = await Promise.all([getFavoriteTemplateIds(), getRecentTemplateIds(20)]);
    const favSet = new Set(favIds);
    const recentSet = new Set(recentIds);
    return templates.map((t) => ({
      ...t,
      isFavorite: favSet.has(t.id),
      isRecent: recentSet.has(t.id),
      category: getPrimaryCategory(t.office_type),
      categoryName: getCategoryById(getPrimaryCategory(t.office_type))?.nameHindi ?? t.office_type,
    }));
  },

  /** Get templates by category ID. */
  async getByCategory(categoryId: string): Promise<TemplateWithMeta[]> {
    const cats = CATEGORIES.find((c) => c.id === categoryId);
    if (!cats) return [];
    // Collect all office types for this category
    let allTemplates: ApplicationType[] = [];
    for (const ot of cats.officeTypes) {
      const batch = await getApplicationTypes(ot as OfficeType);
      allTemplates = allTemplates.concat(batch);
    }
    const [favIds, recentIds] = await Promise.all([getFavoriteTemplateIds(), getRecentTemplateIds(20)]);
    const favSet = new Set(favIds);
    const recentSet = new Set(recentIds);
    return allTemplates.map((t) => ({
      ...t,
      isFavorite: favSet.has(t.id),
      isRecent: recentSet.has(t.id),
      category: categoryId,
      categoryName: cats.nameHindi,
    }));
  },

  /** Get recently opened templates. */
  async getRecents(limit: number = 10): Promise<TemplateWithMeta[]> {
    const ids = await getRecentTemplateIds(limit);
    const templates: TemplateWithMeta[] = [];
    const favIds = await getFavoriteTemplateIds();
    const favSet = new Set(favIds);
    for (const id of ids) {
      const t = await getApplicationTypeById(id);
      if (t) {
        templates.push({
          ...t,
          isFavorite: favSet.has(t.id),
          isRecent: true,
          category: getPrimaryCategory(t.office_type),
          categoryName: getCategoryById(getPrimaryCategory(t.office_type))?.nameHindi ?? t.office_type,
        });
      }
    }
    return templates;
  },

  /** Get favorite templates. */
  async getFavorites(): Promise<TemplateWithMeta[]> {
    const ids = await getFavoriteTemplateIds();
    const templates: TemplateWithMeta[] = [];
    for (const id of ids) {
      const t = await getApplicationTypeById(id);
      if (t) {
        templates.push({
          ...t,
          isFavorite: true,
          isRecent: false,
          category: getPrimaryCategory(t.office_type),
          categoryName: getCategoryById(getPrimaryCategory(t.office_type))?.nameHindi ?? t.office_type,
        });
      }
    }
    return templates;
  },

  /** Toggle favorite status. Returns new status. */
  async toggleFavorite(templateId: number): Promise<boolean> {
    const favIds = await getFavoriteTemplateIds();
    if (favIds.includes(templateId)) {
      await removeFavoriteTemplate(templateId);
      return false;
    } else {
      await addFavoriteTemplate(templateId);
      return true;
    }
  },

  /** Record a template open (for recents). */
  async recordOpen(templateId: number): Promise<void> {
    await recordTemplateOpen(templateId);
  },

  /** Get all categories with template counts. */
  async getCategories(): Promise<{ category: string; nameHindi: string; nameEnglish: string; icon: string; count: number }[]> {
    const result: { category: string; nameHindi: string; nameEnglish: string; icon: string; count: number }[] = [];
    for (const cat of CATEGORIES) {
      let count = 0;
      for (const ot of cat.officeTypes) {
        const batch = await getApplicationTypes(ot as OfficeType);
        count += batch.length;
      }
      if (count > 0 || cat.id === 'other') {
        result.push({ category: cat.id, nameHindi: cat.nameHindi, nameEnglish: cat.nameEnglish, icon: cat.icon, count });
      }
    }
    return result;
  },
};

export default TemplateManager;
