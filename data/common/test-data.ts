/**
 * Canonical, non-secret Wakanow test data.
 *
 * `wakanow.test-data.json` is a verbatim copy of the Wakanow QA project's
 * `projects/Wakanow/test-data/test-data.json` (the canonical source named in Project.md §3).
 * Credentials are NOT part of this file — they come from environment variables only.
 */
import raw from './wakanow.test-data.json';

export const canonicalTestData = raw;
export type CanonicalTestData = typeof raw;
