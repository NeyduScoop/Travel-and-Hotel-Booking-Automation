export interface VisaTestData {
  passportCountry: string;
  destinations: { primary: string; fallback: string[] };
}

/** Result of resolving the configured visa destination against the live destination list. */
export type VisaDestinationResolution =
  | { status: 'resolved'; destination: string; attempted: string[]; usedFallback: boolean }
  | { status: 'unavailable'; attempted: string[]; available: string[] };

export interface VisaOrderSummary {
  visaFee: number;
  consultationFee?: number;
  total: number;
}
