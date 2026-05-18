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
        "You went to a site today — please tap 'Arrive Office' after returning, then punch out. (In-house employees can punch out directly.)",
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
