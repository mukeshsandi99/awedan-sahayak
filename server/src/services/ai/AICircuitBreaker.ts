/** Circuit breaker for AI providers. Opens after N consecutive failures. */

export class AICircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private open = false;
  private halfOpen = false;

  constructor(
    private threshold: number,
    private resetMs: number,
  ) {}

  get isOpen(): boolean { return this.open; }

  recordSuccess(): void {
    this.failures = 0;
    this.open = false;
    this.halfOpen = false;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    if (this.failures >= this.threshold) {
      this.open = true;
    }
  }

  /** Allow one test request through after reset period. */
  allowTestRequest(): boolean {
    if (!this.open) return true;
    if (Date.now() - this.lastFailTime > this.resetMs) {
      this.halfOpen = true;
      return true;
    }
    return false;
  }

  /** Confirm the test request failed — re-close circuit. */
  confirmFailed(): void {
    if (this.halfOpen) {
      this.open = true;
      this.halfOpen = false;
      this.lastFailTime = Date.now();
    }
  }

  /** Confirm success — fully reset. */
  confirmSuccess(): void {
    this.recordSuccess();
  }
}
