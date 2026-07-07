/**
 * @deprecated Import from './aiService' instead.
 *
 * This file exists for backward compatibility. All functionality
 * has moved to aiService.ts which supports multiple AI providers.
 */
export {
  buildSystemPrompt,
  interpolateTemplate,
  draftApplication,
  getActiveConfig,
  resetProviderConfig,
} from './aiService';

export type {
  ApplicationDraftRequest,
  ApplicationDraftResponse,
} from './aiService';
