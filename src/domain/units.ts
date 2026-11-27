/**
 * Waist size is asked in inches (how people in Cambodia know their trouser size) and converted to cm,
 * the unit the scoring tools use (FINDRISC waist cut-offs, profile schema 40–200 cm).
 */
export const CM_PER_INCH = 2.54;

/** Accepted waist range in inches: 16–78 in ≈ 40.6–198.1 cm (inside the 40–200 cm the scoring accepts). */
export const WAIST_INCHES = { min: 16, max: 78 } as const;

/** Inches → cm, rounded to 0.1 cm. */
export function waistInchesToCm(inches: number): number {
  return Math.round(inches * CM_PER_INCH * 10) / 10;
}

/** cm → inches, rounded to 0.1 in (to show a stored value back in the form). */
export function waistCmToInches(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * 10) / 10;
}
