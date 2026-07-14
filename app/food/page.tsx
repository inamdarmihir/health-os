"use client";

import { useState } from "react";
import Link from "next/link";
import { JointManager } from "../../src/components/food/JointManager";
import { WalkSpotManager } from "../../src/components/food/WalkSpotManager";
import { MealLogger } from "../../src/components/food/MealLogger";
import { MealPlanCard } from "../../src/components/food/MealPlanCard";
import { useLocalStorage } from "../../src/lib/use-local-storage";
import type { FoodJoint, FoodProfile, MealLogEntry, MealPlanResponse, WalkSpot } from "../../src/lib/food-types";

const EMPTY_PROFILE: FoodProfile = {
  homeLocation: "",
  city: "",
  workLocation: "",
  dietaryPrefs: "",
  budgetMinRs: 500,
  budgetMaxRs: 700
};

export default function FoodPage() {
  const [profile, setProfile] = useLocalStorage<FoodProfile>("aihealthos.food.profile", EMPTY_PROFILE);
  const [joints, setJoints] = useLocalStorage<FoodJoint[]>("aihealthos.food.joints", []);
  const [walkSpots, setWalkSpots] = useLocalStorage<WalkSpot[]>("aihealthos.food.walkSpots", []);
  const [mealLog, setMealLog] = useLocalStorage<MealLogEntry[]>("aihealthos.food.log", []);

  const [planResponse, setPlanResponse] = useState<MealPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlan() {
    if (!profile.homeLocation.trim()) {
      setError("Add your home location first.");
      return;
    }
    if (profile.budgetMinRs > profile.budgetMaxRs) {
      setError("Budget min must be less than or equal to budget max.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, joints, walkSpots, recentLog: mealLog })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Meal plan generation failed.");
      setPlanResponse(payload as MealPlanResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meal plan generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="hero">
        <span className="hero-badge">AI Health OS · Meal Planner</span>
        <h1>
          Log your meals, save your <em>joints</em>, and get a daily order plan on <em>budget</em>
        </h1>
        <p>
          Save your preferred Swiggy/Zomato joints and walk spots once. Log what you eat as you go. Every day, get a
          full breakfast-to-dinner order plan that fits your ₹{profile.budgetMinRs || 500}-₹{profile.budgetMaxRs || 700}
          budget, stays varied against your recent log, and pairs a meal with a walk.
        </p>
        <p style={{ marginTop: 4 }}>
          <Link href="/" style={{ color: "var(--accent)", fontSize: 13 }}>
            ← Back to health dashboard
          </Link>
        </p>
      </div>

      <div className="grid">
        <section>
          <div className="card">
            <h2>Your location &amp; budget</h2>
            <div className="field-grid">
              <label>
                Home location
                <input
                  value={profile.homeLocation}
                  onChange={(e) => setProfile((p) => ({ ...p, homeLocation: e.target.value }))}
                  placeholder="e.g. Koramangala, Bengaluru"
                />
              </label>
              <label>
                City
                <input value={profile.city ?? ""} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} placeholder="e.g. Bengaluru" />
              </label>
              <label>
                Work / other frequent location
                <input
                  value={profile.workLocation ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, workLocation: e.target.value }))}
                  placeholder="e.g. Indiranagar office"
                />
              </label>
              <label>
                Dietary preferences
                <input
                  value={profile.dietaryPrefs ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, dietaryPrefs: e.target.value }))}
                  placeholder="e.g. vegetarian, no seafood, high protein"
                />
              </label>
              <label>
                Daily budget min (₹)
                <input
                  type="number"
                  min={0}
                  value={profile.budgetMinRs}
                  onChange={(e) => setProfile((p) => ({ ...p, budgetMinRs: Number(e.target.value) || 0 }))}
                />
              </label>
              <label>
                Daily budget max (₹)
                <input
                  type="number"
                  min={0}
                  value={profile.budgetMaxRs}
                  onChange={(e) => setProfile((p) => ({ ...p, budgetMaxRs: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <div className="status-line">Saved locally in this browser — nothing here leaves your device except when generating a plan.</div>
          </div>

          <JointManager joints={joints} onChange={setJoints} />
          <WalkSpotManager walkSpots={walkSpots} onChange={setWalkSpots} />
        </section>

        <section>
          <MealPlanCard response={planResponse} loading={loading} error={error} onGenerate={() => void handlePlan()} />
          <MealLogger log={mealLog} joints={joints} onChange={setMealLog} />
        </section>
      </div>
    </main>
  );
}
