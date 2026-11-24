/**
 * TB symptom screen, from the archived WHO guideline:
 *   WHO consolidated guidelines on tuberculosis. Module 2: Screening (2021, ISBN 9789240022676).
 *   - Recommendation 9 (PDF page 35): ages 15+, "systematic screening for TB disease may be conducted using a
 *     symptom screen, chest X-ray or molecular WHO-recommended rapid diagnostic tests".
 *   - Table 3 (PDF page 36): "Any TB symptom (cough, haemoptysis, fever, night sweats, weight loss)",
 *     sensitivity 0.71, specificity 0.64.
 *   - Recommendation 4 (PDF page 14): "Household contacts and other close contacts of individuals with TB disease
 *     should be systematically screened for TB disease".
 *   - Table 2 (PDF pages 32–33): risk factors (diabetes, smoking or a history of smoking, pregnancy, …).
 *   - Section 3 (PDF page 35): "Screening tests need to be followed by a diagnostic test".
 *   - Table 3 also lists "Prolonged cough (≥ 2 weeks)" as a screen: asked as a follow-up only after "cough = yes".
 *     It is recorded as a factor for the health worker; it does not change the result (any cough is already positive).
 * A screen is not a diagnosis; a positive screen means "get a TB test".
 * Method card: references/methods/tb-symptom/METHOD_CARD.md
 */
import type { ModuleDefinition } from "../types";

/** Table 3 "Any TB symptom": the five symptoms, in the source's order. */
export const TB_SYMPTOMS = ["tbCough", "tbCoughBlood", "tbFever", "tbNightSweats", "tbWeightLoss"] as const;

/** Table 3: sensitivity of "any TB symptom" = 0.71, so the screen misses about 3 in 10 people with TB. */
export const TB_SYMPTOM_SENSITIVITY = 0.71;

export const tbSymptomModule: ModuleDefinition = {
  id: "tb_symptom",
  healthArea: "lungs",
  title: { en: "Tuberculosis (TB) symptom check", km: "ការពិនិត្យរោគសញ្ញាជំងឺរបេង (TB)" },
  summary: {
    en: "WHO symptom screen for TB: 5 quick questions. Tells you whether to get a TB test.",
    km: "ការពិនិត្យរោគសញ្ញាជំងឺរបេងរបស់ WHO៖ សំណួរខ្លីៗ ៥។ ប្រាប់អ្នកថាតើគួរធ្វើតេស្តរបេងឬអត់។",
  },
  status: "draft", // TODO(VERIFY): clinician sign-off pending; CENAT wording not yet obtained
  sensitivity: "normal",
  // Recommendation 9: individuals aged 15 years and older (the profile already requires 18+).
  eligibility: (p) => (p.age >= 15 ? { eligible: true } : { eligible: false, reason: "age_under_15" }),
  requiredProfileFields: ["age", "knownDiabetes", "smokingStatus", "pregnant"],
  questions: [
    { id: "tbCough", kind: "yesno", textKey: "check.tb.cough" },
    // Adaptive follow-up (Table 3 "Prolonged cough (≥ 2 weeks)"): only after answering yes to cough.
    { id: "tbCoughLong", kind: "yesno", textKey: "check.tb.coughLong", showIf: (a) => a.tbCough === true },
    { id: "tbCoughBlood", kind: "yesno", textKey: "check.tb.coughBlood" },
    { id: "tbFever", kind: "yesno", textKey: "check.tb.fever" },
    { id: "tbNightSweats", kind: "yesno", textKey: "check.tb.nightSweats", helpKey: "check.tb.nightSweatsHelp" },
    { id: "tbWeightLoss", kind: "yesno", textKey: "check.tb.weightLoss" },
    { id: "tbContact", kind: "yesno", textKey: "check.tb.contact", helpKey: "check.tb.contactHelp" },
  ],
  // TODO(VERIFY): the source does not make coughing up blood an emergency, so it is a positive screen, not a red flag.
  // Clinician to decide whether it should go to the urgent screen.
  redFlags: () => false,
  score: (a, p) => {
    const symptoms = TB_SYMPTOMS.filter((s) => a[s] === true);
    const contact = a.tbContact === true;
    // Table 2 risk factors the profile already knows. Kept in details only: they do not change the result,
    // and the dashboard's factor line reads "What raised your result".
    const risk: string[] = [];
    if (p.knownDiabetes) risk.push("diabetes");
    if (p.smokingStatus !== "never") risk.push("smoking"); // "people who smoke or who have a history of smoking"
    if (p.pregnant === true) risk.push("pregnancy");

    const longCough = a.tbCough === true && a.tbCoughLong === true;
    const factors = [...symptoms.map((s) => `tb_symptom_${s}`), ...(longCough ? ["tb_cough_2w"] : []), ...(contact ? ["tb_contact"] : [])].map((factor) => ({ factor }));
    const details = { symptoms, contact, longCough, riskFactors: risk, sensitivity: TB_SYMPTOM_SENSITIVITY };

    if (symptoms.length > 0)
      return { score: null, band: "positive", urgency: "high", factors, nextStepKey: "results.nextSteps.tb_test", facilityType: "health_centre", details };
    if (contact)
      return { score: null, band: "contact", urgency: "moderate", factors, nextStepKey: "results.nextSteps.tb_contact_check", facilityType: "health_centre", details };
    return { score: null, band: "negative", urgency: "low", factors, nextStepKey: "results.nextSteps.tb_watch", facilityType: "health_centre", details };
  },
  bands: {
    positive: { en: "You have a possible TB symptom: get a TB test", km: "អ្នកមានរោគសញ្ញាដែលអាចជាជំងឺរបេង៖ សូមធ្វើតេស្តរបេង" },
    contact: { en: "Close contact of someone with TB: get checked", km: "ប៉ះពាល់ជិតស្និទ្ធនឹងអ្នកជំងឺរបេង៖ សូមទៅពិនិត្យ" },
    negative: { en: "No TB symptoms right now", km: "មិនមានរោគសញ្ញាជំងឺរបេងនៅពេលនេះទេ" },
  },
  references: ["R-WHO-TB-SCREEN-2021"],
  monitorIntervalMonths: null, // the source gives no recheck interval for individuals
};
