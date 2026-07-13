import type { HealthProfile, LocalMetricEstimate } from "./health-types";

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const log10 = (value: number) => Math.log(value) / Math.LN10;

export function estimateLocalMetrics(profile: HealthProfile): LocalMetricEstimate {
  const riskFlags: string[] = [];
  const heightM = profile.heightCm ? profile.heightCm / 100 : undefined;
  const bmi = heightM && profile.weightKg ? round(profile.weightKg / (heightM * heightM), 1) : undefined;
  const waistToHeightRatio = profile.waistCm && profile.heightCm ? round(profile.waistCm / profile.heightCm, 2) : undefined;
  let navyBodyFatPercent: number | undefined;

  if (profile.sex === "male" && profile.waistCm && profile.neckCm && profile.heightCm && profile.waistCm > profile.neckCm) {
    navyBodyFatPercent = round(495 / (1.0324 - 0.19077 * log10(profile.waistCm - profile.neckCm) + 0.15456 * log10(profile.heightCm)) - 450, 1);
  }

  if (profile.sex === "female" && profile.waistCm && profile.neckCm && profile.hipCm && profile.heightCm) {
    navyBodyFatPercent = round(495 / (1.29579 - 0.35004 * log10(profile.waistCm + profile.hipCm - profile.neckCm) + 0.221 * log10(profile.heightCm)) - 450, 1);
  }

  let activityLevel: string | undefined;
  if (profile.dailySteps !== undefined) {
    if (profile.dailySteps < 5000) activityLevel = "sedentary";
    else if (profile.dailySteps < 7500) activityLevel = "lightly active";
    else if (profile.dailySteps < 10000) activityLevel = "active";
    else activityLevel = "highly active";
  }

  if (bmi && bmi >= 30) riskFlags.push("BMI is in an obesity range; verify with waist, body-fat, and clinician-grade measures.");
  if (bmi && bmi < 18.5) riskFlags.push("BMI is in an underweight range; prioritize clinical context and nutrition adequacy.");
  if (waistToHeightRatio && waistToHeightRatio >= 0.5) riskFlags.push("Waist-to-height ratio is elevated; central adiposity may be a useful target metric.");
  if (navyBodyFatPercent && (navyBodyFatPercent < 5 || navyBodyFatPercent > 60)) riskFlags.push("Navy body-fat estimate is outside normal human ranges; check measurements.");
  if (profile.dailySteps !== undefined && profile.dailySteps < 4000) riskFlags.push("Daily steps are very low; prioritize NEAT and walking volume before adding training load.");

  return { bmi, navyBodyFatPercent, waistToHeightRatio, activityLevel, riskFlags };
}

export function formatMetricContext(metrics: LocalMetricEstimate) {
  return [
    metrics.bmi ? `BMI: ${metrics.bmi}` : undefined,
    metrics.navyBodyFatPercent ? `U.S. Navy body-fat estimate: ${metrics.navyBodyFatPercent}%` : undefined,
    metrics.waistToHeightRatio ? `Waist-to-height ratio: ${metrics.waistToHeightRatio}` : undefined,
    metrics.activityLevel ? `Daily-steps activity level: ${metrics.activityLevel}` : undefined,
    metrics.riskFlags.length ? `Local risk flags: ${metrics.riskFlags.join(" | ")}` : undefined
  ].filter(Boolean).join("\n");
}
