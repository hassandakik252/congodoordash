/**
 * Mobile-money payment orchestration, provider-agnostic.
 *
 * The app initiates a payment through a `PaymentProvider`, the provider (or its
 * aggregator) prompts the customer on their phone, and later calls our webhook
 * to confirm/decline. Only the DB status lifecycle lives here; swap the provider
 * for a real DRC integration (M-Pesa / Airtel / an aggregator like Flutterwave,
 * CinetPay, MaxiCash) by implementing `PaymentProvider` and selecting it via the
 * PAYMENT_PROVIDER env var. The default `mock` provider is fully testable
 * locally and never contacts an external service.
 */

export type PaymentOutcome = "pending" | "confirmed" | "failed";

export interface InitiateInput {
  orderId: number;
  amount: number;          // CDF
  phone: string;           // payer MSISDN (empty for card)
  channel: "M-Pesa" | "Airtel Money" | "Card";
}

export interface InitiateResult {
  transactionId: string;   // provider reference we store on the order
  status: PaymentOutcome;  // usually "pending" (awaiting the phone prompt)
  message?: string;
}

export interface WebhookEvent {
  transactionId: string;
  status: "confirmed" | "failed";
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Validate an incoming webhook (signature / shared secret). */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean;
  /** Parse a verified webhook body into a normalized event, or null if unusable. */
  parseWebhook(body: unknown): WebhookEvent | null;
}

// ── Mock / sandbox provider ──────────────────────────────────────────────────
// initiate() returns a pending transaction without any network call. Confirm it
// by POSTing to /payments/webhook with { transactionId, status } and the
// x-webhook-secret header (if PAYMENT_WEBHOOK_SECRET is set).
class MockProvider implements PaymentProvider {
  readonly name = "mock";

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const transactionId = `MOCK-${input.orderId}-${Date.now().toString(36)}`;
    return { transactionId, status: "pending", message: "Prompt sent to the payer's phone (sandbox)." };
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>): boolean {
    const secret = process.env["PAYMENT_WEBHOOK_SECRET"];
    if (!secret) return true; // no secret configured → accept (dev)
    return headers["x-webhook-secret"] === secret;
  }

  parseWebhook(body: unknown): WebhookEvent | null {
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, unknown>;
    const transactionId = typeof b.transactionId === "string" ? b.transactionId : null;
    const status = b.status === "confirmed" || b.status === "failed" ? b.status : null;
    if (!transactionId || !status) return null;
    return { transactionId, status };
  }
}

let provider: PaymentProvider | null = null;

/** Resolve the configured payment provider (cached). */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  const name = process.env["PAYMENT_PROVIDER"] ?? "mock";
  switch (name) {
    case "mock":
      provider = new MockProvider();
      break;
    // case "flutterwave": provider = new FlutterwaveProvider(); break;  // add real adapters here
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  }
  return provider;
}
