export const INTEREST_TOPICS = [
  "periods",
  "hormones",
  "pcos",
  "fertility",
  "contraception",
  "sexual health",
  "breast health",
  "skin",
  "hair",
  "hygiene",
  "mental health",
  "relationships",
  "confidence",
  "puberty",
  "pregnancy",
  "postpartum",
  "menopause",
] as const;

export type InterestTopic = (typeof INTEREST_TOPICS)[number];
