import type { Post, Script, ScriptKind, ScriptScene, StoryScreenKind } from "./types";
import { uid } from "./utils";

/**
 * Roteiros de vídeo e de stories (benchmark ficha 17, item F17c).
 *
 * The ficha's critique asks for one external-approval service instead of one
 * per tool, and that decides the shape of this module: a script belongs to a
 * card, and the card is what goes to the client. There is no separate
 * approval link for a script, no second decision to chase, and the private
 * notes of a scene never leave the agency, because nothing of the script
 * crosses into the client's view at all.
 *
 * The script's status follows the card's decision instead of being kept in
 * step by hand — a status someone has to remember to change is a status that
 * is wrong by Friday.
 */

export const MAX_SCENES: Record<ScriptKind, number> = { video: 60, stories: 40 };

export const SCREEN_KIND_LABEL: Record<StoryScreenKind, string> = {
  texto: "Texto",
  enquete: "Enquete",
  caixinha: "Caixinha de perguntas",
  quiz: "Quiz",
  contagem: "Contagem regressiva",
  link: "Link",
  produto: "Produto",
  bastidor: "Bastidor",
};

/** The optional columns of a video script, switched on per script. */
export const OPTIONAL_FIELDS = [
  { id: "shot", label: "Plano" },
  { id: "onScreen", label: "Texto na tela" },
  { id: "soundtrack", label: "Trilha" },
  { id: "seconds", label: "Duração" },
  { id: "notes", label: "Observações (internas)" },
  { id: "imageUrl", label: "Referência visual" },
] as const;

export function newScene(kind: ScriptKind): ScriptScene {
  return kind === "stories"
    ? { id: uid("cena"), screenKind: "texto", seconds: 5 }
    : { id: uid("cena"), seconds: 5 };
}

export function newScript(
  kind: ScriptKind,
  postId: string,
  title: string,
  now = new Date().toISOString(),
  id: string = uid("rot"),
): Script {
  return {
    id,
    postId,
    kind,
    title: title.trim() || (kind === "stories" ? "Roteiro de stories" : "Roteiro"),
    scenes: [newScene(kind)],
    fields: ["shot", "onScreen", "seconds", "notes"],
    status: "rascunho",
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateScript(script: Script): string | null {
  if (!script.title.trim()) return "Dê um nome ao roteiro.";
  const max = MAX_SCENES[script.kind];
  if (script.scenes.length > max)
    return `Um roteiro de ${script.kind === "stories" ? "stories" : "vídeo"} vai até ${max} ${
      script.kind === "stories" ? "telas" : "cenas"
    }.`;
  if (script.scenes.some((s) => (s.seconds ?? 0) < 0)) return "Duração não pode ser negativa.";
  if (script.scenes.some((s) => (s.seconds ?? 0) > 600))
    return "Uma cena de mais de dez minutos não é uma cena.";
  return null;
}

export function canAddScene(script: Script): boolean {
  return script.scenes.length < MAX_SCENES[script.kind];
}

/** Total running time, in seconds. */
export function totalSeconds(script: Script): number {
  return script.scenes.reduce((sum, scene) => sum + (scene.seconds ?? 0), 0);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  return `${minutes}min${rest > 0 ? ` ${String(rest).padStart(2, "0")}s` : ""}`;
}

/** Words of spoken lines — what the teleprompter would show. */
export function spokenWords(script: Script): number {
  return script.scenes.reduce(
    (sum, scene) => sum + (scene.speech?.trim() ? scene.speech.trim().split(/\s+/).length : 0),
    0,
  );
}

export interface ScriptWarning {
  sceneId?: string;
  message: string;
}

/**
 * What is likely to go wrong at recording time. These are warnings, never
 * blocks: a script that breaks a rule on purpose is still a script.
 */
export function reviewScript(script: Script, limitSeconds?: number): ScriptWarning[] {
  const warnings: ScriptWarning[] = [];
  const total = totalSeconds(script);
  if (limitSeconds && total > limitSeconds) {
    warnings.push({
      message: `O roteiro tem ${formatDuration(total)} e o formato aceita ${formatDuration(
        limitSeconds,
      )}.`,
    });
  }
  for (const scene of script.scenes) {
    const words = scene.speech?.trim() ? scene.speech.trim().split(/\s+/).length : 0;
    const seconds = scene.seconds ?? 0;
    // ~2,3 palavras por segundo é fala corrida; acima disso ninguém respira.
    if (seconds > 0 && words / seconds > 2.3) {
      warnings.push({
        sceneId: scene.id,
        message: `Fala longa demais para ${seconds}s (${words} palavras).`,
      });
    }
    if (scene.screenKind === "link" && !scene.onScreen?.trim()) {
      warnings.push({ sceneId: scene.id, message: "Tela de link sem o endereço escrito." });
    }
  }
  return warnings;
}

/**
 * The status, read from the card the script belongs to. The client decides
 * on the card; the script follows. Nobody has to remember to update it.
 */
export function statusFromPost(post: Pick<Post, "approval" | "status">): Script["status"] {
  const decisions = post.approval?.decisions ?? [];
  const last = decisions[decisions.length - 1];
  if (last?.result === "approved") return "aprovado";
  if ((post.approval?.round ?? 0) > 0) return "em_revisao";
  if (post.status === "published" || post.status === "done") return "aprovado";
  return "rascunho";
}

export const STATUS_LABEL: Record<Script["status"], string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão com o cliente",
  aprovado: "Aprovado",
};

/**
 * Optimistic locking. Two people editing the same script is normal in an
 * agency; silently overwriting one of them is not.
 */
export function nextVersion(script: Script, stored?: Script): Script | { conflict: true } {
  if (stored && stored.version > script.version) return { conflict: true };
  return { ...script, version: script.version + 1, updatedAt: new Date().toISOString() };
}

/** Plain text for the teleprompter or for pasting into a message. */
export function toPlainText(script: Script): string {
  const header = [
    script.title,
    script.goal && `Objetivo: ${script.goal}`,
    script.audience && `Público: ${script.audience}`,
    script.tone && `Tom: ${script.tone}`,
    script.cta && `Chamada: ${script.cta}`,
  ]
    .filter(Boolean)
    .join("\n");

  const scenes = script.scenes.map((scene, index) => {
    const label = script.kind === "stories" ? `Tela ${index + 1}` : `Cena ${index + 1}`;
    const parts = [
      scene.screenKind && SCREEN_KIND_LABEL[scene.screenKind],
      scene.shot,
      scene.seconds ? `${scene.seconds}s` : undefined,
    ].filter(Boolean);
    const lines = [
      `${label}${parts.length ? ` (${parts.join(" · ")})` : ""}`,
      scene.speech && `Fala: ${scene.speech}`,
      scene.onScreen && `Tela: ${scene.onScreen}`,
      scene.soundtrack && `Trilha: ${scene.soundtrack}`,
    ].filter(Boolean);
    // Observações são internas: não entram no texto que vai para fora.
    return lines.join("\n");
  });

  return [header, ...scenes].filter(Boolean).join("\n\n");
}
