import { describe, expect, it } from "vitest";
import {
  APPROVAL_COMMENT_MAX,
  approvalState,
  codesMatch,
  currentDecision,
  generateApprovalCode,
  maskEmail,
  validateDecision,
} from "./approval";
import type { ApprovalDecision, ApprovalRequest } from "./types";

const decision = (over: Partial<ApprovalDecision> = {}): ApprovalDecision => ({
  id: "d1",
  round: 1,
  result: "approved",
  verified: true,
  at: "2026-11-05T10:00:00.000Z",
  ...over,
});

describe("approvalState — derived, never stored", () => {
  it("is 'none' before the post is ever sent", () => {
    expect(approvalState(undefined)).toBe("none");
    expect(approvalState({ round: 0, decisions: [] })).toBe("none");
  });

  it("is 'pending' once sent, while the client has not decided", () => {
    expect(approvalState({ round: 1, decisions: [] })).toBe("pending");
  });

  it("reflects the decision of the current round", () => {
    const base = { round: 1 } as ApprovalRequest;
    expect(approvalState({ ...base, decisions: [decision()] })).toBe("approved");
    expect(
      approvalState({ ...base, decisions: [decision({ result: "changes" })] }),
    ).toBe("changes");
    expect(
      approvalState({ ...base, decisions: [decision({ result: "rejected" })] }),
    ).toBe("rejected");
  });

  it("ignores decisions from earlier rounds", () => {
    // Round 1 was rejected; the team fixed it and opened round 2.
    const approval: ApprovalRequest = {
      round: 2,
      decisions: [decision({ round: 1, result: "rejected" })],
    };
    expect(approvalState(approval)).toBe("pending");
  });

  it("lets the client change their mind within a round (latest wins)", () => {
    const approval: ApprovalRequest = {
      round: 1,
      decisions: [
        decision({ id: "a", result: "changes", at: "2026-11-05T10:00:00.000Z" }),
        decision({ id: "b", result: "approved", at: "2026-11-05T12:00:00.000Z" }),
      ],
    };
    expect(approvalState(approval)).toBe("approved");
    expect(currentDecision(approval)?.id).toBe("b");
  });
});

describe("validateDecision", () => {
  it("always requires a name", () => {
    expect(validateDecision({ result: "approved" })).toMatch(/nome/i);
    expect(validateDecision({ result: "approved", decidedByName: "  " })).toMatch(/nome/i);
  });

  it("requires a comment to request changes or reject", () => {
    expect(validateDecision({ result: "changes", decidedByName: "Ana" })).toMatch(/ajuste/i);
    expect(validateDecision({ result: "rejected", decidedByName: "Ana" })).toMatch(/motivo/i);
  });

  it("accepts an approval with no comment", () => {
    expect(validateDecision({ result: "approved", decidedByName: "Ana" })).toBeNull();
  });

  it("rejects an over-long comment", () => {
    const err = validateDecision({
      result: "changes",
      decidedByName: "Ana",
      comment: "x".repeat(APPROVAL_COMMENT_MAX + 1),
    });
    expect(err).toMatch(/caracteres/i);
  });
});

describe("maskEmail — the full address must not reach the public view", () => {
  it("keeps only the first characters of the local part", () => {
    expect(maskEmail("contato@agencia.com.br")).toBe("co*****@agencia.com.br");
    expect(maskEmail("ab@x.com")).toBe("ab*@x.com");
  });

  it("returns undefined for anything that is not an address", () => {
    expect(maskEmail(undefined)).toBeUndefined();
    expect(maskEmail("")).toBeUndefined();
    expect(maskEmail("sem-arroba")).toBeUndefined();
    expect(maskEmail("@dominio.com")).toBeUndefined();
    expect(maskEmail("a@semponto")).toBeUndefined();
  });

  it("never leaks the original local part beyond the prefix", () => {
    const masked = maskEmail("joaodasilva@empresa.com")!;
    expect(masked.startsWith("jo")).toBe(true);
    expect(masked).not.toContain("joaodasilva");
  });
});

describe("verification code", () => {
  it("is always six digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateApprovalCode()).toMatch(/^\d{6}$/);
    }
  });

  it("is not trivially repetitive across draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateApprovalCode());
    // 200 draws from 1e6 values: collisions are possible but must be rare.
    expect(seen.size).toBeGreaterThan(190);
  });

  it("compares exactly", () => {
    expect(codesMatch("123456", "123456")).toBe(true);
    expect(codesMatch("123456", "123457")).toBe(false);
    expect(codesMatch("123456", "12345")).toBe(false);
    expect(codesMatch("", "")).toBe(true);
  });
});
