"use client";

import type { DiscoveredFoodOutlet, MealPlanResponse } from "../../lib/food-types";

type Props = {
  response: MealPlanResponse | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onSaveOutlet: (outlet: DiscoveredFoodOutlet) => void;
};

function budgetPct(plan: MealPlanResponse["plan"]) {
  if (plan.budgetMaxRs <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((plan.estimatedTotalRs / plan.budgetMaxRs) * 100)));
}

export function MealPlanCard({ response, loading, error, onGenerate, onSaveOutlet }: Props) {
  const plan = response?.plan;
  const searchStatus = response?.searchStatus ?? "offline";

  return (
    <div className="card">
      <div className="routine-header">
        <h2 style={{ margin: 0 }}>Today&apos;s order plan</h2>
        {response && <span className="routine-meta">{response.models.provider} · {response.models.intelligence}</span>}
      </div>
      <p className="muted">Picks from your saved joints, grounded in live Swiggy/Zomato search where available, inside your daily budget.</p>

      <div className="actions">
        <button type="button" className="primary" disabled={loading} onClick={onGenerate}>
          {loading ? "Planning…" : "Plan today's meals"}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}

      {plan && (
        <>
          <div className="section-block">
            <div className="pill-row">
              <span className={`pill ${searchStatus === "live" ? "on" : "off"}`}>
                Swiggy/Zomato search: {searchStatus === "live" ? "live" : "offline (set EXA_API_KEY)"}
              </span>
              <span className="pill on">
                ₹{plan.estimatedTotalRs} of ₹{plan.budgetMinRs}-₹{plan.budgetMaxRs}
              </span>
            </div>
            <div className="budget-bar">
              <div className="budget-bar-fill" style={{ width: `${budgetPct(plan)}%` }} />
            </div>
            <p className="muted" style={{ fontSize: 13 }}>{plan.budgetNote}</p>
          </div>

          <div className="section-block meal-plan-grid">
            {plan.meals.map((meal, i) => (
              <div key={i} className="meal-card">
                <div className="exercise-category">{meal.mealType}</div>
                <div className="joint-name">{meal.item}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {meal.jointName} · {meal.platform}
                </div>
                <div className="tag-row">
                  <span className="tag">₹{meal.estimatedCostRs}</span>
                </div>
                <p style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--text)" }}>{meal.reason}</p>
                {meal.orderUrl && (
                  <a className="exercise-video-link" href={meal.orderUrl} target="_blank" rel="noreferrer">
                    Open order link →
                  </a>
                )}
              </div>
            ))}
          </div>

          {plan.walk && (
            <div className="section-block">
              <h3>Walk</h3>
              <p>
                <strong>{plan.walk.spotName}</strong> — {plan.walk.timing}. {plan.walk.reason}
              </p>
            </div>
          )}

          <div className="section-block">
            <h3>Variety note</h3>
            <p>{plan.varietyNote}</p>
          </div>

          {plan.sources.length > 0 && (
            <div className="section-block">
              <h3>Search evidence</h3>
              <ul>
                {plan.sources.map((source, i) => (
                  <li key={i}>
                    <a href={source.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                      {source.title}
                    </a>{" "}
                    <span className="muted">— {source.jointName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.discoveredOutlets.length > 0 && (
            <div className="section-block">
              <h3>Discovered nearby</h3>
              <div className="joint-list">
                {plan.discoveredOutlets.map((outlet, i) => (
                  <div key={i} className="joint-item">
                    <div>
                      <a
                        className="joint-name"
                        href={outlet.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent)" }}
                      >
                        {outlet.name}
                      </a>
                      {(outlet.area || outlet.cuisine) && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {outlet.area}
                          {outlet.cuisine ? ` · ${outlet.cuisine}` : ""}
                        </div>
                      )}
                      <div className="tag-row">
                        <span className={`pill ${outlet.verifiedLive ? "on" : "off"}`}>
                          {outlet.verifiedLive ? "Verified live" : "Unverified"}
                        </span>
                      </div>
                      {outlet.snippet && (
                        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                          {outlet.snippet}
                        </p>
                      )}
                    </div>
                    <button type="button" className="secondary" onClick={() => onSaveOutlet(outlet)}>
                      Save as joint
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!plan && !loading && !error && (
        <p className="muted" style={{ marginTop: 14 }}>
          Add at least a home location, then plan today&apos;s meals.
        </p>
      )}
    </div>
  );
}
