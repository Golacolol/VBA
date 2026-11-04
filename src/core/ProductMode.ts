/** Shell modes for VORTEX Basketball. On-court play is stubbed. */
export const PRODUCT_MODES = ["BASKETBALL", "STREET", "MITEAM", "PYRAMID"] as const;

export type ProductMode = (typeof PRODUCT_MODES)[number];

export function isProductMode(value: unknown): value is ProductMode {
  return value === "BASKETBALL" || value === "STREET" || value === "MITEAM" || value === "PYRAMID";
}

/** Football-era saves (REAL / ARCADE / TABLE / FLICK and anything else) become BASKETBALL. */
export function normalizeProductMode(value: unknown): ProductMode {
  return isProductMode(value) ? value : "BASKETBALL";
}
