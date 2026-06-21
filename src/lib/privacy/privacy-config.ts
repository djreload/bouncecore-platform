export const privacyPolicyHref = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim() || "/privacy";
export const cookiePolicyHref = process.env.NEXT_PUBLIC_COOKIE_POLICY_URL?.trim() || "/cookies";
export const termsHref = process.env.NEXT_PUBLIC_TERMS_URL?.trim() || "/terms";
export const mobilePrivacyChoicesHref = "/mobile/privacy-choices";

export const privacyChoicesEventName = "bouncecore:open-consent";
export const privacyConsentUpdatedEventName = "bouncecore:consent-updated";
