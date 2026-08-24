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


/**
 * Translates raw technical auth/network errors into plain language.
 * Never show "Failed to fetch" or similar to a field user.
 */
export function friendlyAuthMessage(message?: string | null): string {
  const msg = message || "";
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|timed out|ERR_/i.test(msg)) {
    return "No internet connection — please check your signal and try again.";
  }
  if (/invalid login credentials|invalid credentials/i.test(msg)) {
    return "Wrong email or password. Please try again.";
  }
  if (/email not confirmed/i.test(msg)) {
    return "This account is not activated yet. Please contact your admin.";
  }
  if (/rate limit|too many/i.test(msg)) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}
