import type { ExerciseVideo, ExerciseVisual, RoutineExercise } from "../lib/health-types";

const CATEGORY_LABELS: Record<RoutineExercise["category"], string> = {
  warmup: "Warm-up",
  postureCorrection: "Posture correction",
  strength: "Strength",
  cardio: "Cardio",
  cooldown: "Cooldown"
};

type Props = {
  exercise: RoutineExercise;
  visual: ExerciseVisual | undefined;
  video: ExerciseVideo | undefined;
  visualsLoading: boolean;
};

export function ExerciseCard({ exercise, visual, video, visualsLoading }: Props) {
  return (
    <div className="exercise-card">
      {visual ? (
        <img className="exercise-visual" src={`data:${visual.mimeType};base64,${visual.data}`} alt={exercise.name} />
      ) : (
        <div className="exercise-visual-placeholder">{visualsLoading ? "Rendering form visual…" : "Visual unavailable"}</div>
      )}
      <div className="exercise-body">
        <span className="exercise-category">{CATEGORY_LABELS[exercise.category]}</span>
        <p className="exercise-name">{exercise.name}</p>
        <span className="exercise-sets">{exercise.sets}</span>
        <ul className="exercise-cues">
          {exercise.cues.map((cue, i) => (
            <li key={i}>{cue}</li>
          ))}
        </ul>
        {video ? (
          <a className="exercise-video-link" href={video.url} target="_blank" rel="noreferrer">
            ▶ Watch on YouTube
          </a>
        ) : visualsLoading ? (
          <span className="exercise-video-link muted">Finding tutorial video…</span>
        ) : null}
      </div>
    </div>
  );
}
