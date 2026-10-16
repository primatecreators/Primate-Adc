export const CREATOR_FIELDS = ["name", "country", "platform", "profileUrl", "followers", "audienceCountry", "relationship", "contactMethod", "contact", "adult", "casinoAccepted", "consent"] as const;
export const BRAND_FIELDS = ["name", "company", "role", "website", "targetMarkets", "proposal", "formats", "timing", "budget", "currency", "contactMethod", "contact", "prepaidAccepted", "consent"] as const;
export const CREATOR_FILE_FIELDS = ["reach7", "demographics", "stories7", "stories30"] as const;
export type LeadKind = "creator" | "brand";
export type LeadLanguage = "es" | "en";
