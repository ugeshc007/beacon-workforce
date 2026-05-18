import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Mirrors the validation branch in index.ts. If you change the rule there,
 * keep this in sync.
 */
function validatePunchOut(opts: {
  hasOfficeArrival: boolean;
  assignments: { work_location: "in_house" | "site" | null }[];
}): { ok: true } | { ok: false; error: string } {
  if (opts.hasOfficeArrival) return { ok: true };
  const hasSite = opts.assignments.some((a) => a.work_location === "site");
  if (hasSite) {
    return {
      ok: false,
      error:
        "Can't punch out yet. You were assigned to a site today, so you must return to the office and tap 'Arrive Office' before punching out. Steps: 1) Tap 'Start Return Travel' at the site, 2) Tap 'Arrive Office' when you reach the office, 3) Then punch out. (In-house employees can punch out directly without these steps.)",
    };
  }
  return { ok: true };
}

Deno.test("in-house only employee can punch out without office_arrival_time", () => {
  const result = validatePunchOut({
    hasOfficeArrival: false,
    assignments: [{ work_location: "in_house" }, { work_location: "in_house" }],
  });
  assertEquals(result.ok, true);
});

Deno.test("employee with site assignment is blocked without office_arrival_time", () => {
  const result = validatePunchOut({
    hasOfficeArrival: false,
    assignments: [{ work_location: "site" }],
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertStringIncludes(result.error, "Arrive Office");
    assertStringIncludes(result.error, "In-house employees can punch out directly");
  }
});

Deno.test("mixed site + in_house is still blocked", () => {
  const result = validatePunchOut({
    hasOfficeArrival: false,
    assignments: [{ work_location: "in_house" }, { work_location: "site" }],
  });
  assertEquals(result.ok, false);
});

Deno.test("site employee with office_arrival_time can punch out", () => {
  const result = validatePunchOut({
    hasOfficeArrival: true,
    assignments: [{ work_location: "site" }],
  });
  assertEquals(result.ok, true);
});

Deno.test("employee with no assignments today can punch out", () => {
  const result = validatePunchOut({
    hasOfficeArrival: false,
    assignments: [],
  });
  assertEquals(result.ok, true);
});
