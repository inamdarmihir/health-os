"use client";

import { useState } from "react";
import { CoachChat } from "../src/components/CoachChat";
import { useLocalStorage } from "../src/lib/use-local-storage";
import { generateId } from "../src/lib/id";
import type { HealthProfile, ImageInput, ImageKind } from "../src/lib/health-types";
import type {
  FoodJoint,
  FoodProfile,
  MealLogEntry,
  MealPlanResponse,
  WalkSpot,
} from "../src/lib/food-types";
import type {
  CoachAttachment,
  CoachJointDraft,
  CoachMealLogDraft,
  CoachProfile,
  CoachState,
  CoachWalkSpotDraft,
} from "../src/lib/coach-types";

const EMPTY_PROFILE: HealthProfile = {
  sex: "",
  trainingGoal: "",
  recoverySignals: "",
  constraints: "",
  browserGoal: "",
};

const EMPTY_FOOD_PROFILE: FoodProfile = {
  homeLocation: "",
  city: "",
  workLocation: "",
  dietaryPrefs: "",
  budgetMinRs: 500,
  budgetMaxRs: 700,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Page() {
  const [images, setImages] = useState<Partial<Record<ImageKind, ImageInput>>>({});
  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [mealPlanLoading, setMealPlanLoading] = useState(false);
  const [mealPlanResponse, setMealPlanResponse] = useState<MealPlanResponse | null>(null);

  const [foodProfile, setFoodProfile] = useLocalStorage<FoodProfile>(
    "aihealthos.food.profile",
    EMPTY_FOOD_PROFILE,
  );
  const [joints, setJoints] = useLocalStorage<FoodJoint[]>("aihealthos.food.joints", []);
  const [walkSpots, setWalkSpots] = useLocalStorage<WalkSpot[]>("aihealthos.food.walkSpots", []);
  const [mealLog, setMealLog] = useLocalStorage<MealLogEntry[]>("aihealthos.food.log", []);

  async function handleAnalyze() {
    if (Object.keys(images).length === 0) return;
    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, images: Object.values(images), runDeepAgent: true }),
      });
      await response.json();
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanMeals() {
    setMealPlanLoading(true);
    try {
      const response = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: foodProfile,
          joints,
          walkSpots,
          recentLog: mealLog,
          date: todayIso(),
        }),
      });
      const payload = await response.json();
      if (response.ok) setMealPlanResponse(payload as MealPlanResponse);
    } finally {
      setMealPlanLoading(false);
    }
  }

  function handleProfileUpdates(updates: Partial<CoachProfile>) {
    setProfile((prev) => ({ ...prev, ...updates }) as HealthProfile);
    setFoodProfile((prev) => ({ ...prev, ...updates }) as FoodProfile);
  }

  function handlePhotoCaptured(attachment: CoachAttachment) {
    setImages((prev) => ({ ...prev, [attachment.kind]: attachment }));
  }

  function handleLogMeal(draft: CoachMealLogDraft) {
    const entry: MealLogEntry = { id: generateId(), date: todayIso(), ...draft };
    setMealLog((prev) => [...prev, entry]);
  }

  function handleSaveJoint(draft: CoachJointDraft) {
    setJoints((prev) => [...prev, { id: generateId(), ...draft }]);
  }

  function handleSaveWalkSpot(draft: CoachWalkSpotDraft) {
    setWalkSpots((prev) => [...prev, { id: generateId(), ...draft }]);
  }

  const coachState: CoachState = {
    profile: { ...profile, ...foodProfile },
    capturedImageKinds: Object.keys(images) as ImageKind[],
    joints: joints.map((j) => ({ name: j.name, area: j.area })),
    walkSpots: walkSpots.map((s) => ({ name: s.name, area: s.area })),
    recentMealLog: mealLog.map((e) => ({ date: e.date, mealType: e.mealType, item: e.item })),
    report: null,
    mealPlan: mealPlanResponse?.plan ?? null,
  };

  return (
    <main className="coach-page">
      <CoachChat
        state={coachState}
        onProfileUpdates={handleProfileUpdates}
        onPhotoCaptured={handlePhotoCaptured}
        onLogMeal={handleLogMeal}
        onSaveJoint={handleSaveJoint}
        onSaveWalkSpot={handleSaveWalkSpot}
        onRunAnalysis={handleAnalyze}
        onRunMealPlan={handlePlanMeals}
        analysisLoading={loading}
        mealPlanLoading={mealPlanLoading}
      />
    </main>
  );
}
