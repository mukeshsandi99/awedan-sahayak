/**
 * Common AI Provider Interface
 *
 * All AI providers (Claude, DeepSeek, future) implement this interface.
 * The AIRouter delegates to whichever provider is selected.
 */

// ── Request types ────────────────────────────────────────────────────────

export interface AIRequest {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerateRequest {
  applicationName: string;
  officeType: string;
  promptTemplate: string;
  formData: Record<string, string>;
}

export interface AICustomGenerateRequest {
  officeName: string;
  recipientDesignation?: string | null;
  formData: Record<string, string>;
}

// ── Response types ───────────────────────────────────────────────────────

export interface AIResponse {
  generatedText: string;
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  durationMs: number;
  fallbackUsed: boolean;
}

// ── Provider interface ───────────────────────────────────────────────────

export interface IAIProvider {
  /** Human-readable provider name. */
  readonly name: string;
  /** Model identifier. */
  readonly model: string;

  /** Check if the provider is healthy (credentials valid, recent success). */
  healthCheck(): Promise<boolean>;

  /** Send a raw chat completion request. */
  chat(request: AIRequest): Promise<AIResponse>;

  /** Estimate cost for given token counts. */
  estimateCost(inputTokens: number, outputTokens: number): number;
}

export default IAIProvider;
