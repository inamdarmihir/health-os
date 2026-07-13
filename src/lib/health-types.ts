export type ImageKind = "face" | "frontBody" | "sideBody" | "posture";

export type ImageInput = {
  kind: ImageKind;
  mimeType: string;
  data: string;
};

export type HealthProfile = {
  age?: number;
  sex?: "male" | "female" | "other" | "";
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  neckCm?: number;
  hipCm?: number;
  dailySteps?: number;
  trainingGoal?: string;
  recoverySignals?: string;
  constraints?: string;
  browserGoal?: string;
};

export type LocalMetricEstimate = {
  bmi?: number;
  navyBodyFatPercent?: number;
  waistToHeightRatio?: number;
  activityLevel?: string;
  riskFlags: string[];
};

export type HealthOsReport = {
  summary: string;
  readinessScore: number;
  confidence: "low" | "medium" | "high";
  face: {
    observations: string[];
    recoverySignals: string[];
    skinAndInflammationSignals: string[];
  };
  bodyComposition: {
    estimate: string;
    visualSignals: string[];
    measurementSignals: string[];
  };
  posture: {
    score: number;
    findings: string[];
    likelyDrivers: string[];
    correctiveProtocol: string[];
  };
  plan: {
    today: string[];
    thisWeek: string[];
    nutrition: string[];
    recovery: string[];
  };
  routine: WorkoutRoutine;
  risksAndDisclaimers: string[];
  questions: string[];
  browserResearchNeeded: string[];
  generatedVisualPrompt: string;
};

export type ExerciseCategory = "warmup" | "postureCorrection" | "strength" | "cardio" | "cooldown";

export type RoutineExercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  sets: string;
  cues: string[];
  imagePrompt: string;
};

export type WorkoutRoutine = {
  focus: string;
  weeklyFrequency: string;
  stepsContext: string;
  exercises: RoutineExercise[];
};

export type ExerciseVisual = {
  id: string;
  mimeType: string;
  data: string;
};

export type ExerciseVideo = {
  id: string;
  title: string;
  url: string;
};

export type ChatMessage = {
  role: "user" | "coach";
  content: string;
};

export type HealthOsResponse = {
  report: HealthOsReport;
  localMetrics: LocalMetricEstimate;
  agentBrief: string;
  agentStatus: "completed" | "fallback" | "disabled";
  browserStatus: string;
  models: {
    intelligence: string;
    image: string;
  };
};
