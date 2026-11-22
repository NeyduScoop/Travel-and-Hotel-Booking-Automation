/** Tier slug as used in the join URL: /wakanow-prime/join/<slug>. */
export type PrimeTierSlug = 'Single' | 'Duo' | 'Corporate';

export interface PrimeTier {
  slug: PrimeTierSlug;
  /** Heading on the Prime landing page. */
  heading: string;
  /** Accessible name of the join link on the landing page. */
  joinLinkName: string;
  /** Label displayed on the join page, e.g. "Individual". */
  joinLabel: string;
}
