import { describe, expect, it } from "vitest";
import {
  getDaysUntilExpiry,
  getQualificationStatus,
  getQualificationRiskLevel,
  getQualificationsExpiringSoon,
  getRenewalRecommendedDate,
  evaluateQualificationReadiness,
} from "@/domain/rge/index";
import { toDate, daysBetween, isPast, clamp, escapeHtml } from "@/domain/utils";
import { getUrgentDeadlines } from "@/domain/deadlines/index";
import type { QualificationLike, EvidenceLike, DeadlineLike } from "@/domain/types";

// â”€â”€â”€ Fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NOW = new Date("2026-06-01");

function makeQualification(overrides: Partial<QualificationLike> & { validUntil: string }): QualificationLike {
  return {
    label: "QualiPAC",
    validUntil: overrides.validUntil,
    status: "ACTIVE",
    ...overrides,
  };
}

function makeEvidence(type: EvidenceLike["type"], status: EvidenceLike["status"] = "ACTIVE"): EvidenceLike {
  return { title: type, type, status };
}

// â”€â”€â”€ utils: toDate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("toDate", () => {
  it("returns Date as-is", () => {
    const d = new Date("2026-01-01");
    expect(toDate(d)).toBe(d);
  });

  it("parses ISO string to Date", () => {
    const result = toDate("2026-06-15");
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2026);
  });
});

// â”€â”€â”€ utils: daysBetween â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("daysBetween", () => {
  it("returns 0 for same day", () => {
    expect(daysBetween("2026-06-01", "2026-06-01")).toBe(0);
  });

  it("returns positive when to is after from", () => {
    expect(daysBetween("2026-06-01", "2026-06-10")).toBe(9);
  });

  it("returns negative when to is before from", () => {
    expect(daysBetween("2026-06-10", "2026-06-01")).toBe(-9);
  });

  it("handles Date objects", () => {
    expect(daysBetween(new Date("2026-06-01"), new Date("2026-06-30"))).toBe(29);
  });
});

// â”€â”€â”€ utils: isPast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("isPast", () => {
  it("returns true when date is before currentDate", () => {
    expect(isPast("2026-01-01", "2026-06-01")).toBe(true);
  });

  it("returns false when date equals currentDate (same day is not past)", () => {
    expect(isPast("2026-06-01", "2026-06-01")).toBe(false);
  });

  it("returns false when date is in the future", () => {
    expect(isPast("2026-12-31", "2026-06-01")).toBe(false);
  });
});

// â”€â”€â”€ utils: clamp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("returns min when value is below", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it("returns max when value exceeds it", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("returns exact boundary values", () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

// â”€â”€â”€ utils: escapeHtml â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("handles null and undefined gracefully", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("handles non-string values", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

// â”€â”€â”€ rge: getDaysUntilExpiry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getDaysUntilExpiry", () => {
  it("returns positive days when qualification is still valid", () => {
    const qual = makeQualification({ validUntil: "2026-09-01" });
    expect(getDaysUntilExpiry(qual, NOW)).toBe(92);
  });

  it("returns 0 when expiry is today", () => {
    const qual = makeQualification({ validUntil: "2026-06-01" });
    expect(getDaysUntilExpiry(qual, NOW)).toBe(0);
  });

  it("returns negative days when already expired", () => {
    const qual = makeQualification({ validUntil: "2026-01-01" });
    expect(getDaysUntilExpiry(qual, NOW)).toBeLessThan(0);
  });
});

// â”€â”€â”€ rge: getQualificationStatus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getQualificationStatus", () => {
  it("returns ACTIVE when expiry > 90 days away", () => {
    const qual = makeQualification({ validUntil: "2026-12-31", status: "ACTIVE" });
    expect(getQualificationStatus(qual, NOW)).toBe("ACTIVE");
  });

  it("returns EXPIRING_SOON when expiry â‰¤ 90 days away", () => {
    const qual = makeQualification({ validUntil: "2026-08-01", status: "ACTIVE" }); // 61 days
    expect(getQualificationStatus(qual, NOW)).toBe("EXPIRING_SOON");
  });

  it("returns EXPIRING_SOON on exactly 90 days", () => {
    const qual = makeQualification({ validUntil: "2026-08-30", status: "ACTIVE" }); // 90 days
    expect(getQualificationStatus(qual, NOW)).toBe("EXPIRING_SOON");
  });

  it("returns EXPIRED when expiry is in the past", () => {
    const qual = makeQualification({ validUntil: "2026-01-01", status: "ACTIVE" });
    expect(getQualificationStatus(qual, NOW)).toBe("EXPIRED");
  });

  it("returns ARCHIVED regardless of date when status is ARCHIVED", () => {
    const qual = makeQualification({ validUntil: "2030-01-01", status: "ARCHIVED" });
    expect(getQualificationStatus(qual, NOW)).toBe("ARCHIVED");
  });

  it("returns RENEWAL_IN_PROGRESS when status is RENEWAL_IN_PROGRESS", () => {
    const qual = makeQualification({ validUntil: "2026-07-01", status: "RENEWAL_IN_PROGRESS" });
    expect(getQualificationStatus(qual, NOW)).toBe("RENEWAL_IN_PROGRESS");
  });
});

// â”€â”€â”€ rge: getQualificationRiskLevel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getQualificationRiskLevel", () => {
  it("returns critical for expired qualification", () => {
    const qual = makeQualification({ validUntil: "2025-01-01", status: "ACTIVE" });
    expect(getQualificationRiskLevel(qual, NOW)).toBe("critical");
  });

  it("returns high when expiring within 30 days", () => {
    const qual = makeQualification({ validUntil: "2026-06-20", status: "ACTIVE" }); // 19 days
    expect(getQualificationRiskLevel(qual, NOW)).toBe("high");
  });

  it("returns medium when expiring between 31 and 90 days", () => {
    const qual = makeQualification({ validUntil: "2026-08-01", status: "ACTIVE" }); // 61 days
    expect(getQualificationRiskLevel(qual, NOW)).toBe("medium");
  });

  it("returns medium for RENEWAL_IN_PROGRESS", () => {
    const qual = makeQualification({ validUntil: "2026-12-31", status: "RENEWAL_IN_PROGRESS" });
    expect(getQualificationRiskLevel(qual, NOW)).toBe("medium");
  });

  it("returns low for ACTIVE with more than 90 days", () => {
    const qual = makeQualification({ validUntil: "2027-01-01", status: "ACTIVE" });
    expect(getQualificationRiskLevel(qual, NOW)).toBe("low");
  });
});

// â”€â”€â”€ rge: getQualificationsExpiringSoon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getQualificationsExpiringSoon", () => {
  it("returns qualifications expiring within default 90-day threshold", () => {
    const quals = [
      makeQualification({ validUntil: "2026-08-01", label: "Soon" }),     // 61 days
      makeQualification({ validUntil: "2027-06-01", label: "Far" }),      // 365 days
      makeQualification({ validUntil: "2026-06-15", label: "VeryClose" }),// 14 days
    ];
    const result = getQualificationsExpiringSoon(quals, NOW);
    expect(result.map((q) => q.label)).toContain("Soon");
    expect(result.map((q) => q.label)).toContain("VeryClose");
    expect(result.map((q) => q.label)).not.toContain("Far");
  });

  it("excludes already-expired qualifications", () => {
    const quals = [makeQualification({ validUntil: "2026-01-01", label: "Expired" })];
    expect(getQualificationsExpiringSoon(quals, NOW)).toHaveLength(0);
  });

  it("respects custom threshold", () => {
    const quals = [
      makeQualification({ validUntil: "2026-06-20", label: "Within30" }), // 19 days
      makeQualification({ validUntil: "2026-08-01", label: "Outside30" }), // 61 days
    ];
    const result = getQualificationsExpiringSoon(quals, NOW, 30);
    expect(result.map((q) => q.label)).toEqual(["Within30"]);
  });
});

// â”€â”€â”€ rge: getRenewalRecommendedDate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getRenewalRecommendedDate", () => {
  it("returns 6 months before expiry", () => {
    const result = getRenewalRecommendedDate("2027-06-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11); // December (0-indexed)
  });

  it("accepts Date objects", () => {
    const result = getRenewalRecommendedDate(new Date("2027-01-01"));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6); // July
  });
});

// â”€â”€â”€ rge: evaluateQualificationReadiness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("evaluateQualificationReadiness", () => {
  it("returns score 100 and ready=true when all required evidence is present", () => {
    const qual = makeQualification({ validUntil: "2027-01-01" });
    const evidence = [
      makeEvidence("QUALIFICATION_CERTIFICATE"),
      makeEvidence("INSURANCE_ATTESTATION"),
    ];
    const result = evaluateQualificationReadiness(qual, evidence);
    expect(result.score).toBe(100);
    expect(result.ready).toBe(true);
    expect(result.missingTypes).toHaveLength(0);
  });

  it("returns score 50 and ready=false when 1 of 2 required evidences is missing", () => {
    const qual = makeQualification({ validUntil: "2027-01-01" });
    const evidence = [makeEvidence("QUALIFICATION_CERTIFICATE")];
    const result = evaluateQualificationReadiness(qual, evidence);
    expect(result.score).toBe(50);
    expect(result.ready).toBe(false);
    expect(result.missingTypes).toContain("INSURANCE_ATTESTATION");
  });

  it("returns score 0 when no evidence is present", () => {
    const qual = makeQualification({ validUntil: "2027-01-01" });
    const result = evaluateQualificationReadiness(qual, []);
    expect(result.score).toBe(0);
    expect(result.missingTypes).toHaveLength(2);
  });

  it("excludes ARCHIVED evidence from consideration", () => {
    const qual = makeQualification({ validUntil: "2027-01-01" });
    const evidence = [
      makeEvidence("QUALIFICATION_CERTIFICATE", "ARCHIVED"),
      makeEvidence("INSURANCE_ATTESTATION"),
    ];
    const result = evaluateQualificationReadiness(qual, evidence);
    expect(result.missingTypes).toContain("QUALIFICATION_CERTIFICATE");
  });

  it("adds warning when annual follow-up is needed but not documented", () => {
    const qual = makeQualification({ validUntil: "2027-01-01", annualFollowUpDate: "2026-09-01" });
    const evidence = [
      makeEvidence("QUALIFICATION_CERTIFICATE"),
      makeEvidence("INSURANCE_ATTESTATION"),
    ];
    const result = evaluateQualificationReadiness(qual, evidence);
    expect(result.warnings.some((w) => w.toLowerCase().includes("annuel"))).toBe(true);
  });
});

// â”€â”€â”€ deadlines: getUrgentDeadlines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getUrgentDeadlines", () => {
  function makeDeadline(dueDate: string, status: DeadlineLike["status"] = "PENDING"): DeadlineLike {
    return {
      type: "QUALIFICATION_EXPIRY",
      title: "Ã‰chÃ©ance",
      dueDate,
      status,
    };
  }

  it("returns only PENDING deadlines within threshold", () => {
    const deadlines = [
      makeDeadline("2026-06-15"),  // 14 days â€” within 30
      makeDeadline("2026-07-15"),  // 44 days â€” outside 30
      makeDeadline("2026-06-20", "DONE"), // within range but not PENDING
    ];
    const result = getUrgentDeadlines(deadlines, NOW, 30);
    expect(result).toHaveLength(1);
    expect(result[0].dueDate).toBe("2026-06-15");
  });

  it("excludes past deadlines", () => {
    const deadlines = [makeDeadline("2026-05-01")]; // before NOW
    const result = getUrgentDeadlines(deadlines, NOW, 30);
    expect(result).toHaveLength(0);
  });

  it("sorts results by ascending due date", () => {
    const deadlines = [
      makeDeadline("2026-06-25"),
      makeDeadline("2026-06-10"),
      makeDeadline("2026-06-20"),
    ];
    const result = getUrgentDeadlines(deadlines, NOW, 30);
    expect(result[0].dueDate).toBe("2026-06-10");
    expect(result[1].dueDate).toBe("2026-06-20");
    expect(result[2].dueDate).toBe("2026-06-25");
  });

  it("uses default threshold of 30 days", () => {
    const deadlines = [
      makeDeadline("2026-06-20"),  // 19 days â€” within default 30
      makeDeadline("2026-07-10"),  // 39 days â€” outside default 30
    ];
    const result = getUrgentDeadlines(deadlines, NOW);
    expect(result).toHaveLength(1);
  });
});
