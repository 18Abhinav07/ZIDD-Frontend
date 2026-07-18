// Presentation flag only. Session-start billing decisions remain backend-owned.
export function isBetaBillingDisabled() {
  return process.env.NEXT_PUBLIC_BETA_BILLING_DISABLED === '1';
}
