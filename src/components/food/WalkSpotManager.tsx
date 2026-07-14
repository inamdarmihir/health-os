"use client";

import { useState } from "react";
import type { WalkSpot } from "../../lib/food-types";
import { generateId } from "../../lib/id";

type Props = {
  walkSpots: WalkSpot[];
  onChange: (walkSpots: WalkSpot[]) => void;
};

const EMPTY_DRAFT = { name: "", area: "", notes: "" };

export function WalkSpotManager({ walkSpots, onChange }: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  function addSpot() {
    if (!draft.name.trim()) return;
    const spot: WalkSpot = {
      id: generateId(),
      name: draft.name.trim(),
      area: draft.area.trim(),
      notes: draft.notes.trim() || undefined
    };
    onChange([...walkSpots, spot]);
    setDraft(EMPTY_DRAFT);
  }

  function removeSpot(id: string) {
    onChange(walkSpots.filter((s) => s.id !== id));
  }

  return (
    <div className="card">
      <h2>Walk spots</h2>
      <p className="muted">Places you like to walk — the daily plan pairs one of these with a meal.</p>

      {walkSpots.length > 0 && (
        <div className="joint-list">
          {walkSpots.map((spot) => (
            <div key={spot.id} className="joint-item">
              <div>
                <div className="joint-name">{spot.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {spot.area}
                  {spot.notes ? ` — ${spot.notes}` : ""}
                </div>
              </div>
              <button type="button" className="secondary" onClick={() => removeSpot(spot.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <h3>Add a walk spot</h3>
      <div className="field-grid">
        <label>
          Name
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Cubbon Park loop" />
        </label>
        <label>
          Area / locality
          <input value={draft.area} onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))} placeholder="e.g. near MG Road" />
        </label>
      </div>
      <label style={{ marginTop: 10 }}>
        Notes
        <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="e.g. 25 min loop, shaded, good after dinner" />
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={!draft.name.trim()} onClick={addSpot}>
          Add walk spot
        </button>
      </div>
    </div>
  );
}
