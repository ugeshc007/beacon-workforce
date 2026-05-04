// Compute a project health score (0–100) from real signals.
//
// Signals (each penalizes the score):
//   1. Budget pressure  — actual_cost vs budget
//   2. Schedule slippage — past end_date but not completed
//   3. Time vs progress — for in_progress projects, elapsed time should roughly
//      track project status (a project 90% through its window but still "on hold"
//      is unhealthy).
//
// Completed projects are always 100. Projects without a budget or dates lose
// the corresponding signal but are not penalized for it.

export type ProjectHealthInput = {
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  actual_cost?: number;
};

export function computeProjectHealth(p: ProjectHealthInput): number {
  if (p.status === "completed") return 100;

  let score = 100;
  const now = new Date();

  // 1. Budget pressure
  if (p.budget && p.budget > 0) {
    const used = (p.actual_cost ?? 0) / p.budget;
    if (used > 1) score -= Math.min(40, Math.round((used - 1) * 100)); // over budget: -1 per %, cap 40
    else if (used > 0.9) score -= 10; // burning fast
    else if (used > 0.75) score -= 5;
  }

  // 2. Schedule slippage
  if (p.end_date) {
    const end = new Date(p.end_date + "T23:59:59");
    if (now > end && p.status !== "completed") {
      const daysOver = Math.floor((now.getTime() - end.getTime()) / 86_400_000);
      score -= Math.min(40, 10 + daysOver * 2); // base 10, +2 per day overdue, cap 40
    }
  }

  // 3. Stuck on hold while time is passing
  if (p.start_date && p.end_date && p.status === "on_hold") {
    const start = new Date(p.start_date + "T00:00:00");
    const end = new Date(p.end_date + "T23:59:59");
    if (now >= start) {
      const total = end.getTime() - start.getTime();
      const elapsed = Math.min(total, now.getTime() - start.getTime());
      const pct = total > 0 ? elapsed / total : 0;
      score -= Math.min(25, Math.round(pct * 25));
    }
  }

  return Math.max(0, Math.min(100, score));
}
