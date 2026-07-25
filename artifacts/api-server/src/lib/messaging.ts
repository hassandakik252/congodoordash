import { logger } from "./logger";

/**
 * Outbound email / SMS, provider-agnostic. The default `console` driver just
 * logs (dev/testing) — no message actually leaves the server. Swap for real
 * providers (SendGrid/SES for email, Twilio/Africa's Talking for SMS) by
 * implementing the senders and selecting via EMAIL_PROVIDER / SMS_PROVIDER.
 */
export const EMAIL_PROVIDER = process.env["EMAIL_PROVIDER"] ?? "console";
export const SMS_PROVIDER = process.env["SMS_PROVIDER"] ?? "console";

/** True while no real sender is configured — lets dev flows surface the code. */
export const messagingIsConsole = EMAIL_PROVIDER === "console" && SMS_PROVIDER === "console";

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  switch (EMAIL_PROVIDER) {
    case "console":
      logger.info({ to, subject, body }, "[email:console] would send");
      return;
    // case "sendgrid": ... ; return;
    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${EMAIL_PROVIDER}"`);
  }
}

export async function sendSms(to: string, body: string): Promise<void> {
  switch (SMS_PROVIDER) {
    case "console":
      logger.info({ to, body }, "[sms:console] would send");
      return;
    // case "twilio": ... ; return;
    default:
      throw new Error(`Unknown SMS_PROVIDER "${SMS_PROVIDER}"`);
  }
}
