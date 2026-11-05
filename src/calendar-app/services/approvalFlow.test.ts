import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { LocalStorageService } from "./localStorageService";
import { approvalState } from "../approval";

let svc: LocalStorageService;
let calA: { id: string; shareToken: string };
let calB: { id: string; shareToken: string };
let postA: string;
let postB: string;

beforeEach(async () => {
  localStorage.clear();
  svc = new LocalStorageService();
  const a = await svc.createClient({ name: "Cliente A", email: "contato@clientea.com" });
  const b = await svc.createClient({ name: "Cliente B", email: "contato@clienteb.com" });
  calA = a.calendar;
  calB = b.calendar;
  postA = (
    await svc.createPost({
      calendarId: calA.id,
      title: "Post A",
      date: "2026-12-01",
      internalNotes: "segredo da agência",
    })
  ).id;
  postB = (await svc.createPost({ calendarId: calB.id, title: "Post B", date: "2026-12-02" })).id;
});

afterEach(() => vi.useRealTimers());

/** Happy path helper: send for approval and fetch a valid code. */
async function sendAndGetCode(token: string, postId: string) {
  await svc.requestApproval(postId);
  const { devCode } = await svc.issueApprovalCode(token, postId);
  return devCode!;
}

describe("requestApproval — rounds", () => {
  it("opens round 1 and moves the post to pending", async () => {
    const post = await svc.requestApproval(postA, "Segue para sua aprovação");
    expect(post.approval?.round).toBe(1);
    expect(post.approval?.teamMessage).toBe("Segue para sua aprovação");
    expect(approvalState(post.approval)).toBe("pending");
  });

  it("a new round reopens the review but keeps the earlier decisions", async () => {
    const code = await sendAndGetCode(calA.shareToken, postA);
    await svc.submitApprovalDecision(calA.shareToken, postA, {
      result: "changes",
      comment: "Trocar a foto",
      decidedByName: "Ana",
      code,
    });
    const reopened = await svc.requestApproval(postA, "Foto trocada");
    expect(reopened.approval?.round).toBe(2);
    expect(reopened.approval?.decisions).toHaveLength(1); // history preserved
    expect(approvalState(reopened.approval)).toBe("pending"); // round 2 undecided
  });

  it("refuses to send a deleted post", async () => {
    await svc.deletePost(postA);
    await expect(svc.requestApproval(postA)).rejects.toThrow(/deletado/i);
  });
});

describe("isolation — a token may only act on its own calendar", () => {
  it("refuses to issue a code for another calendar's post", async () => {
    await svc.requestApproval(postB);
    // Client A's token, Client B's post.
    await expect(svc.issueApprovalCode(calA.shareToken, postB)).rejects.toThrow(
      /não encontrado neste calendário/i,
    );
  });

  it("refuses to record a decision on another calendar's post", async () => {
    const codeB = await sendAndGetCode(calB.shareToken, postB);
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postB, {
        result: "approved",
        decidedByName: "Invasor",
        code: codeB,
      }),
    ).rejects.toThrow(/não encontrado neste calendário/i);
  });

  it("refuses an unknown token outright", async () => {
    await svc.requestApproval(postA);
    await expect(svc.issueApprovalCode("token-falso", postA)).rejects.toThrow(
      /inválido ou expirado/i,
    );
  });
});

describe("verification code", () => {
  it("is required — no code, no decision", async () => {
    await svc.requestApproval(postA);
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postA, {
        result: "approved",
        decidedByName: "Ana",
      }),
    ).rejects.toThrow(/solicite um código/i);
  });

  it("rejects a wrong code", async () => {
    await sendAndGetCode(calA.shareToken, postA);
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postA, {
        result: "approved",
        decidedByName: "Ana",
        code: "000000",
      }),
    ).rejects.toThrow(/incorreto/i);
  });

  it("expires after its window", async () => {
    const code = await sendAndGetCode(calA.shareToken, postA);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000); // 11 minutes later
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postA, {
        result: "approved",
        decidedByName: "Ana",
        code,
      }),
    ).rejects.toThrow(/expirou/i);
  });

  it("is single use", async () => {
    const code = await sendAndGetCode(calA.shareToken, postA);
    await svc.submitApprovalDecision(calA.shareToken, postA, {
      result: "approved",
      decidedByName: "Ana",
      code,
    });
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postA, {
        result: "rejected",
        comment: "mudei de ideia",
        decidedByName: "Ana",
        code,
      }),
    ).rejects.toThrow(/solicite um código/i);
  });

  it("re-issuing replaces the previous code", async () => {
    const first = await sendAndGetCode(calA.shareToken, postA);
    const { devCode: second } = await svc.issueApprovalCode(calA.shareToken, postA);
    expect(second).not.toBe(first);
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postA, {
        result: "approved",
        decidedByName: "Ana",
        code: first,
      }),
    ).rejects.toThrow(/incorreto/i);
  });
});

describe("decision rules", () => {
  it("requires a comment to request changes", async () => {
    const code = await sendAndGetCode(calA.shareToken, postA);
    await expect(
      svc.submitApprovalDecision(calA.shareToken, postA, {
        result: "changes",
        decidedByName: "Ana",
        code,
      }),
    ).rejects.toThrow(/ajuste/i);
  });

  it("records an approval as verified", async () => {
    const code = await sendAndGetCode(calA.shareToken, postA);
    await svc.submitApprovalDecision(calA.shareToken, postA, {
      result: "approved",
      decidedByName: "Ana Souza",
      code,
    });
    const db = await svc.getDatabase();
    const decision = db.posts.find((p) => p.id === postA)!.approval!.decisions[0];
    expect(decision).toMatchObject({
      result: "approved",
      decidedByName: "Ana Souza",
      verified: true,
      round: 1,
    });
  });

  it("refuses a decision on a post never sent for review", async () => {
    await expect(svc.issueApprovalCode(calA.shareToken, postA)).rejects.toThrow(
      /ainda não foi enviado/i,
    );
  });
});

describe("public view — what the client may see", () => {
  it("masks the contact e-mail and never ships the real one", async () => {
    const view = (await svc.getPublicView(calA.shareToken))!;
    expect(view.client.maskedEmail).toBe("co*****@clientea.com");
    expect(JSON.stringify(view)).not.toContain("contato@clientea.com");
  });

  it("still never leaks internal notes, now that approval travels with the post", async () => {
    await svc.requestApproval(postA);
    const view = (await svc.getPublicView(calA.shareToken))!;
    expect(JSON.stringify(view)).not.toContain("segredo da agência");
    expect(view.posts[0]).not.toHaveProperty("internalNotes");
    expect(view.posts[0].approval?.round).toBe(1); // approval does come through
  });

  it("never exposes verification codes", async () => {
    await sendAndGetCode(calA.shareToken, postA);
    const view = (await svc.getPublicView(calA.shareToken))!;
    expect(JSON.stringify(view)).not.toMatch(/approvalCodes|code_hash/);
  });
});
