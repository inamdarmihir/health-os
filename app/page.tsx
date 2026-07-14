"use client";

import { useState } from "react";
import Link from "next/link";
import { CaptureSlot } from "../src/components/CaptureSlot";
import { ExerciseCard } from "../src/components/ExerciseCard";
import { ChatCoach } from "../src/components/ChatCoach";
import type { ExerciseVideo, ExerciseVisual, HealthOsResponse, HealthProfile, ImageInput, ImageKind } from "../src/lib/health-types";

const IMAGE_KINDS: ImageKind[] = ["face", "frontBody", "sideBody", "posture"];

const EMPTY_PROFILE: HealthProfile = {
  sex: "",
  trainingGoal: "",
  recoverySignals: "",
  constraints: "",
  browserGoal: ""
};

function scorePercent(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function Page() {
  const [images, setImages] = useState<Partial<Record<ImageKind, ImageInput>>>({});
  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const [routineVisualsLoading, setRoutineVisualsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HealthOsResponse | null>(null);
  const [visual, setVisual] = useState<{ mimeType: string; data: string } | null>(null);
  const [exerciseVisuals, setExerciseVisuals] = useState<Record<string, ExerciseVisual>>({});
  const [exerciseVideos, setExerciseVideos] = useState<Record<string, ExerciseVideo>>({});

  const capturedCount = Object.keys(images).length;

  async function fetchRoutineVisuals(response: HealthOsResponse) {
    const exercises = response.report.routine.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      imagePrompt: exercise.imagePrompt
    }));
    if (exercises.length === 0) return;
    setRoutineVisualsLoading(true);
    try {
      const visualsResponse = await fetch("/api/routine-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises })
      });
      const payload = await visualsResponse.json();
      if (!visualsResponse.ok) throw new Error(payload.error || "Routine visual generation failed.");
      const visualsById: Record<string, ExerciseVisual> = {};
      for (const image of payload.images as ExerciseVisual[]) visualsById[image.id] = image;
      setExerciseVisuals(visualsById);
      const videosById: Record<string, ExerciseVideo> = {};
      for (const video of (payload.videos as ExerciseVideo[]) ?? []) videosById[video.id] = video;
      setExerciseVideos(videosById);
    } catch {
      // Non-fatal: exercise cards fall back to a placeholder when a visual or video is missing.
    } finally {
      setRoutineVisualsLoading(false);
    }
  }

  async function handleAnalyze() {
    if (capturedCount === 0) {
      setError("Capture at least a face photo before analyzing.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setVisual(null);
    setExerciseVisuals({});
    setExerciseVideos({});
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, images: Object.values(images), runDeepAgent: true })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Analysis failed.");
      const typedPayload = payload as HealthOsResponse;
      setResult(typedPayload);
      void fetchRoutineVisuals(typedPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVisual() {
    if (!result) return;
    setVisualLoading(true);
    setError(null);
    try {
      const reference = images.face || images.posture || Object.values(images)[0];
      const response = await fetch("/api/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: result.report.generatedVisualPrompt, reference })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Visual generation failed.");
      setVisual(payload.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visual generation failed.");
    } finally {
      setVisualLoading(false);
    }
  }

  return (
    <main>
      <div className="hero">
        <span className="hero-badge">AI Health OS</span>
        <h1>
          Personalized health intelligence, from your <em>camera</em> to a <em>coaching plan</em>
        </h1>
        <p>
          Capture face, body, and posture photos, log today&apos;s steps. A frontier reasoning + vision model reads the
          visual signals, a deep-agent crew of posture, body-composition, and recovery specialists dispatches
          dynamically to build a full workout routine, Nano Banana renders a form visual for every exercise, Exa
          finds real tutorial videos and reference articles, and your coach is one message away.
        </p>
        <p style={{ marginTop: 4 }}>
          <Link href="/food" style={{ color: "var(--accent)", fontSize: 13 }}>
            Log meals &amp; plan today&apos;s orders on a budget →
          </Link>
        </p>
      </div>

      <div className="grid">
        <section>
          <div className="card">
            <h2>1. Capture</h2>
            <div className="capture-grid">
              {IMAGE_KINDS.map((kind) => (
                <CaptureSlot
                  key={kind}
                  kind={kind}
                  image={images[kind] ?? null}
                  onCapture={(image) => setImages((prev) => ({ ...prev, [kind]: image }))}
                  onClear={() => setImages((prev) => {
                    const next = { ...prev };
                    delete next[kind];
                    return next;
                  })}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <h2>2. Profile &amp; activity</h2>
            <div className="field-grid">
              <label>
                Age
                <input
                  type="number"
                  value={profile.age ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label>
                Biological sex
                <select
                  value={profile.sex ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, sex: e.target.value as HealthProfile["sex"] }))}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Height (cm)
                <input
                  type="number"
                  value={profile.heightCm ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, heightCm: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label>
                Weight (kg)
                <input
                  type="number"
                  value={profile.weightKg ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, weightKg: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label>
                Waist (cm)
                <input
                  type="number"
                  value={profile.waistCm ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, waistCm: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label>
                Neck (cm)
                <input
                  type="number"
                  value={profile.neckCm ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, neckCm: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label>
                Hip (cm, optional)
                <input
                  type="number"
                  value={profile.hipCm ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, hipCm: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
              <label>
                Today&apos;s steps
                <input
                  type="number"
                  placeholder="e.g. 6400"
                  value={profile.dailySteps ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, dailySteps: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </label>
            </div>
            <label style={{ marginTop: 10 }}>
              Training goal
              <textarea
                value={profile.trainingGoal ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, trainingGoal: e.target.value }))}
                placeholder="e.g. Cut to 12% body fat while keeping strength, fix rounded shoulders"
              />
            </label>
            <label style={{ marginTop: 10 }}>
              Recovery / sleep / stress notes
              <textarea
                value={profile.recoverySignals ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, recoverySignals: e.target.value }))}
                placeholder="e.g. 5.5 hrs sleep, high stress week, sore lower back"
              />
            </label>
            <label style={{ marginTop: 10 }}>
              Constraints (injuries, equipment, schedule)
              <textarea
                value={profile.constraints ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, constraints: e.target.value }))}
              />
            </label>

            <div className="actions">
              <button className="primary" disabled={loading} onClick={handleAnalyze}>
                {loading ? "Analyzing…" : "Run AI Health OS analysis"}
              </button>
            </div>
            <div className="status-line">
              {capturedCount} of {IMAGE_KINDS.length} images captured. Deep-agent crew (posture, body-composition,
              recovery) and a full illustrated workout routine build automatically after the vision report.
            </div>
            {error && <div className="error-box">{error}</div>}
          </div>

          <ChatCoach report={result?.report ?? null} />
        </section>

        <section>
          {!result && (
            <div className="card">
              <h2>Report</h2>
              <p className="muted">Capture at least a face photo, log today&apos;s steps, and run the analysis to see your report here.</p>
            </div>
          )}

          {result && (
            <>
              <div className="card">
                <h2>Readiness</h2>
                <div className="score-row">
                  <div className="score-ring" style={{ "--pct": scorePercent(result.report.readinessScore) } as React.CSSProperties}>
                    <span>{scorePercent(result.report.readinessScore)}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0 }}>{result.report.summary}</p>
                    <div className="pill-row">
                      <span className="pill on">confidence: {result.report.confidence}</span>
                      <span className={`pill ${result.browserStatus.startsWith("enabled") ? "on" : "off"}`}>
                        browser: {result.browserStatus.startsWith("enabled") ? "live" : "offline"}
                      </span>
                      <span className="pill on">agent: {result.agentStatus}</span>
                      {result.localMetrics.activityLevel && <span className="pill on">activity: {result.localMetrics.activityLevel}</span>}
                    </div>
                  </div>
                </div>

                <div className="section-block">
                  <h3>Posture — {scorePercent(result.report.posture.score)}/100</h3>
                  <ul>{result.report.posture.findings.map((item, i) => <li key={i}>{item}</li>)}</ul>
                  <h3>Correction protocol</h3>
                  <ul>{result.report.posture.correctiveProtocol.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>

                <div className="section-block">
                  <h3>Body composition</h3>
                  <p>{result.report.bodyComposition.estimate}</p>
                  <ul>{result.report.bodyComposition.visualSignals.map((item, i) => <li key={i}>{item}</li>)}</ul>
                  {(result.localMetrics.bmi || result.localMetrics.navyBodyFatPercent) && (
                    <div className="tag-row">
                      {result.localMetrics.bmi && <span className="tag">BMI {result.localMetrics.bmi}</span>}
                      {result.localMetrics.navyBodyFatPercent && (
                        <span className="tag">Navy est. {result.localMetrics.navyBodyFatPercent}%</span>
                      )}
                      {result.localMetrics.waistToHeightRatio && (
                        <span className="tag">WHtR {result.localMetrics.waistToHeightRatio}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="section-block">
                  <h3>Face &amp; recovery signals</h3>
                  <ul>{result.report.face.recoverySignals.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>

                <div className="section-block">
                  <h3>Plan — today</h3>
                  <ul>{result.report.plan.today.map((item, i) => <li key={i}>{item}</li>)}</ul>
                  <h3>Plan — this week</h3>
                  <ul>{result.report.plan.thisWeek.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>

                <div className="section-block">
                  <h3>Risks &amp; disclaimers</h3>
                  <ul>{result.report.risksAndDisclaimers.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>

                {result.references.length > 0 && (
                  <div className="section-block">
                    <h3>Further reading</h3>
                    <ul>
                      {result.references.map((ref) => (
                        <li key={ref.url}>
                          <a href={ref.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                            {ref.title}
                          </a>{" "}
                          <span className="muted">— {ref.topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="routine-header">
                  <h2 style={{ margin: 0 }}>Your illustrated workout routine</h2>
                  <span className="routine-meta">{result.report.routine.weeklyFrequency}</span>
                </div>
                <p className="muted">{result.report.routine.focus}</p>
                <p className="muted">{result.report.routine.stepsContext}</p>
                <div className="exercise-grid">
                  {result.report.routine.exercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      visual={exerciseVisuals[exercise.id]}
                      video={exerciseVideos[exercise.id]}
                      visualsLoading={routineVisualsLoading}
                    />
                  ))}
                </div>
              </div>

              <div className="card">
                <h2>Deep-agent coaching brief</h2>
                <p className="muted">Dynamic subagents (posture, body-composition, recovery) via deepagents, {result.models.intelligence}.</p>
                <div className="brief-box">{result.agentBrief || "Deep agent did not return a brief for this run."}</div>
              </div>

              <div className="card">
                <h2>Nano Banana dashboard visual</h2>
                <p className="muted">{result.report.generatedVisualPrompt}</p>
                <div className="actions">
                  <button className="secondary" disabled={visualLoading} onClick={handleGenerateVisual}>
                    {visualLoading ? "Rendering…" : "Generate coaching visual"}
                  </button>
                </div>
                {visual && <img className="visual-preview" src={`data:${visual.mimeType};base64,${visual.data}`} alt="Generated coaching visual" />}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
