"use client";

import { useState } from "react";
import type { FoodJoint } from "../../lib/food-types";
import { generateId } from "../../lib/id";

type Props = {
  joints: FoodJoint[];
  onChange: (joints: FoodJoint[]) => void;
};

const EMPTY_DRAFT = { name: "", area: "", cuisine: "", swiggyUrl: "", zomatoUrl: "", notes: "" };

export function JointManager({ joints, onChange }: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  function addJoint() {
    if (!draft.name.trim()) return;
    const joint: FoodJoint = {
      id: generateId(),
      name: draft.name.trim(),
      area: draft.area.trim(),
      cuisine: draft.cuisine.trim() || undefined,
      swiggyUrl: draft.swiggyUrl.trim() || undefined,
      zomatoUrl: draft.zomatoUrl.trim() || undefined,
      notes: draft.notes.trim() || undefined
    };
    onChange([...joints, joint]);
    setDraft(EMPTY_DRAFT);
  }

  function removeJoint(id: string) {
    onChange(joints.filter((j) => j.id !== id));
  }

  return (
    <div className="card">
      <h2>Preferred food joints</h2>
      <p className="muted">Places you actually order from — the planner prefers these before suggesting anything else.</p>

      {joints.length > 0 && (
        <div className="joint-list">
          {joints.map((joint) => (
            <div key={joint.id} className="joint-item">
              <div>
                <div className="joint-name">{joint.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {joint.area}
                  {joint.cuisine ? ` · ${joint.cuisine}` : ""}
                </div>
                {(joint.swiggyUrl || joint.zomatoUrl) && (
                  <div className="tag-row">
                    {joint.swiggyUrl && (
                      <a className="tag" href={joint.swiggyUrl} target="_blank" rel="noreferrer">
                        Swiggy
                      </a>
                    )}
                    {joint.zomatoUrl && (
                      <a className="tag" href={joint.zomatoUrl} target="_blank" rel="noreferrer">
                        Zomato
                      </a>
                    )}
                  </div>
                )}
              </div>
              <button type="button" className="secondary" onClick={() => removeJoint(joint.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <h3>Add a joint</h3>
      <div className="field-grid">
        <label>
          Name
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Behrouz Biryani" />
        </label>
        <label>
          Area / locality
          <input value={draft.area} onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))} placeholder="e.g. Koramangala 5th Block" />
        </label>
        <label>
          Cuisine
          <input value={draft.cuisine} onChange={(e) => setDraft((d) => ({ ...d, cuisine: e.target.value }))} placeholder="e.g. Biryani, North Indian" />
        </label>
        <label>
          Notes
          <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="e.g. go-to for lunch, spicy" />
        </label>
        <label>
          Swiggy link (optional)
          <input value={draft.swiggyUrl} onChange={(e) => setDraft((d) => ({ ...d, swiggyUrl: e.target.value }))} placeholder="https://www.swiggy.com/..." />
        </label>
        <label>
          Zomato link (optional)
          <input value={draft.zomatoUrl} onChange={(e) => setDraft((d) => ({ ...d, zomatoUrl: e.target.value }))} placeholder="https://www.zomato.com/..." />
        </label>
      </div>
      <div className="actions">
        <button type="button" className="primary" disabled={!draft.name.trim()} onClick={addJoint}>
          Add joint
        </button>
      </div>
    </div>
  );
}
