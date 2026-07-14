"use client";

import { useMemo, useState } from "react";
import type { FoodJoint, MealLogEntry, MealPlatform, MealType } from "../../lib/food-types";
import { generateId } from "../../lib/id";

type Props = {
  log: MealLogEntry[];
  joints: FoodJoint[];
  onChange: (log: MealLogEntry[]) => void;
};

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snack", "dinner"];
const PLATFORMS: MealPlatform[] = ["swiggy", "zomato", "home", "dine-in", "other"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_DRAFT = {
  date: todayIso(),
  mealType: "lunch" as MealType,
  item: "",
  jointName: "",
  costRs: "",
  platform: "swiggy" as MealPlatform
};

export function MealLogger({ log, joints, onChange }: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const sortedLog = useMemo(() => [...log].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [log]);
  const todaySpend = useMemo(() => log.filter((e) => e.date === todayIso()).reduce((sum, e) => sum + (e.costRs || 0), 0), [log]);

  function addEntry() {
    if (!draft.item.trim()) return;
    const entry: MealLogEntry = {
      id: generateId(),
      date: draft.date,
      mealType: draft.mealType,
      item: draft.item.trim(),
      jointName: draft.jointName.trim() || undefined,
      costRs: draft.costRs ? Number(draft.costRs) : undefined,
      platform: draft.platform
    };
    onChange([...log, entry]);
    setDraft((d) => ({ ...EMPTY_DRAFT, date: d.date }));
  }

  function removeEntry(id: string) {
    onChange(log.filter((e) => e.id !== id));
  }

  return (
    <div className="card">
      <h2>Meal log</h2>
      <p className="muted">
        Log what you actually ate. Today&apos;s logged spend: <strong>₹{todaySpend}</strong>. The planner uses this history to keep
        tomorrow&apos;s picks varied.
      </p>

      <div className="field-grid">
        <label>
          Date
          <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </label>
        <label>
          Meal
          <select value={draft.mealType} onChange={(e) => setDraft((d) => ({ ...d, mealType: e.target.value as MealType }))}>
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Item
          <input value={draft.item} onChange={(e) => setDraft((d) => ({ ...d, item: e.target.value }))} placeholder="e.g. Chicken biryani" />
        </label>
        <label>
          Joint
          <input
            value={draft.jointName}
            onChange={(e) => setDraft((d) => ({ ...d, jointName: e.target.value }))}
            list="joint-names"
            placeholder="e.g. Behrouz Biryani"
          />
          <datalist id="joint-names">
            {joints.map((j) => (
              <option key={j.id} value={j.name} />
            ))}
          </datalist>
        </label>
        <label>
          Cost (₹)
          <input type="number" min={0} value={draft.costRs} onChange={(e) => setDraft((d) => ({ ...d, costRs: e.target.value }))} placeholder="e.g. 260" />
        </label>
        <label>
          Platform
          <select value={draft.platform} onChange={(e) => setDraft((d) => ({ ...d, platform: e.target.value as MealPlatform }))}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button type="button" className="primary" disabled={!draft.item.trim()} onClick={addEntry}>
          Log meal
        </button>
      </div>

      {sortedLog.length > 0 && (
        <div className="log-list">
          {sortedLog.slice(0, 30).map((entry) => (
            <div key={entry.id} className="log-item">
              <div>
                <span className="log-date">{entry.date}</span> <span className="log-meal">{entry.mealType}</span> — {entry.item}
                {entry.jointName ? ` @ ${entry.jointName}` : ""}
                {entry.costRs ? ` (₹${entry.costRs})` : ""}
              </div>
              <button type="button" className="secondary" onClick={() => removeEntry(entry.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
