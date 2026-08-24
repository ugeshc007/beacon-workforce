/**
 * Classifies workflow/punch errors: some are genuine system errors (red),
 * others are just the flow telling the employee a step is missing (blue/info).
 */

const GUIDANCE_PATTERNS = [
  /can't punch out yet/i,
  /must return to the office/i,
  /arrive office/i,
  /start return travel/i,
  /already punched/i,
  /no active attendance/i,
  /not done/i,
  /finish .*(work|session)/i,
  /break/i,
  /assigned/i,
];

export const isGuidanceError = (message?: string | null) =>
  !!message && GUIDANCE_PATTERNS.some((p) => p.test(message));

export interface ActionToastContent {
  title: string;
  description: string;
  variant?: "default" | "destructive" | "info";
}

/** Toast payload for a failed workflow action. */
export function actionErrorToast(message?: string | null): ActionToastContent {
  if (isGuidanceError(message)) {
    return {
      title: "Attendance pending",
      description:
        "Some steps of your attendance are still pending. Please contact your admin to override the time and fix the pending attendance.",
      variant: "info",
    };
  }
  return {
    title: "Failed",
    description: message || "Something went wrong.",
    variant: "destructive",
  };
}

/**
 * Toast payload for anything the employee can resolve themselves
 * (validation, missing selection, offline, GPS, permissions).
 * Always blue with white text — red is reserved for system failures.
 */
export function userNoticeToast(title: string, description?: string | null): ActionToastContent {
  return {
    title,
    description: description || "Please check and try again.",
    variant: "info",
  };
}

