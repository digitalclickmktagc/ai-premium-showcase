import type {
  Dossier,
  DossierSection,
  DossierSectionDef,
  DossierTemplate,
  DossierVisibility,
} from "./types";
import { safeExternalUrl, uid } from "./utils";

/**
 * Dossiê estratégico (benchmark ficha 16).
 *
 * The ficha's critique is the whole design here: in the system it describes,
 * the eight sections are fixed in the code. An agency that works with
 * restaurants wants a menu section; one that works with clinics does not.
 * So the sections are a model the agency edits, and the eight from the ficha
 * are only the model it starts with.
 *
 * The other decision worth stating: each section says who may read it. The
 * raio-X of a profile is often blunt, and honest notes are worth more than
 * polite ones — so a section can be internal and stay out of the client's
 * link, instead of the team softening what it writes.
 */

export const SECTION_KIND_LABEL = {
  texto: "Texto livre",
  campos: "Campos",
  lista: "Lista",
  imagens: "Imagens",
  tabela: "Tabela",
} as const;

/** The eight sections of the ficha, as the model a new agency starts from. */
export function defaultSections(): DossierSectionDef[] {
  return [
    {
      id: "visao",
      title: "Visão geral",
      kind: "texto",
      hint: "Objetivos de marketing do cliente.",
      defaultVisibility: "cliente",
    },
    {
      id: "persona",
      title: "Persona",
      kind: "campos",
      defaultVisibility: "cliente",
      fields: [
        { id: "identidade", label: "Identidade" },
        { id: "demografia", label: "Demografia" },
        { id: "comportamento", label: "Comportamento" },
        { id: "dores", label: "Dores" },
        { id: "desejos", label: "Desejos" },
        { id: "gatilhos", label: "Gatilhos" },
      ],
    },
    {
      id: "moodboard",
      title: "Moodboard",
      kind: "imagens",
      hint: "Referências visuais e o clima que elas descrevem.",
      defaultVisibility: "cliente",
    },
    {
      id: "raiox",
      title: "Raio-X do perfil",
      kind: "campos",
      defaultVisibility: "interno",
      hint: "Diagnóstico franco. Nasce interno de propósito.",
      fields: [
        { id: "conta", label: "Conta" },
        { id: "publico", label: "Público" },
        { id: "conteudo", label: "Conteúdo atual" },
        { id: "engajamento", label: "Engajamento" },
        { id: "veredito", label: "Veredito" },
      ],
    },
    {
      id: "concorrentes",
      title: "Concorrentes",
      kind: "tabela",
      defaultVisibility: "cliente",
      fields: [
        { id: "nome", label: "Nome" },
        { id: "perfil", label: "Perfil" },
        { id: "seguidores", label: "Seguidores" },
        { id: "frequencia", label: "Frequência" },
        { id: "tipo", label: "Tipo de concorrência" },
      ],
    },
    {
      id: "posicionamento",
      title: "Posicionamento",
      kind: "campos",
      defaultVisibility: "cliente",
      fields: [
        { id: "arquetipo", label: "Arquétipo" },
        { id: "essencia", label: "Essência" },
        { id: "voz", label: "Voz" },
        { id: "visual", label: "Expressão visual" },
      ],
    },
    {
      id: "identidade",
      title: "Identidade visual",
      kind: "campos",
      defaultVisibility: "cliente",
      fields: [
        { id: "logo", label: "Logo" },
        { id: "paleta", label: "Paleta" },
        { id: "tipografia", label: "Tipografia" },
        { id: "composicao", label: "Regras de composição" },
      ],
    },
    {
      id: "editorial",
      title: "Linha editorial",
      kind: "lista",
      hint: "Os pilares vivem no planejamento do mês; aqui fica a linha.",
      defaultVisibility: "cliente",
    },
  ];
}

export function defaultTemplate(
  now = new Date().toISOString(),
  id: string = uid("tpl"),
): DossierTemplate {
  return {
    id,
    name: "Modelo da agência",
    sections: defaultSections(),
    createdAt: now,
    updatedAt: now,
  };
}

export function newSection(kind: DossierSectionDef["kind"] = "texto"): DossierSectionDef {
  return {
    id: uid("sec"),
    title: "",
    kind,
    defaultVisibility: "cliente",
    fields: kind === "campos" || kind === "tabela" ? [{ id: uid("fld"), label: "" }] : undefined,
  };
}

export function validateTemplate(template: DossierTemplate): string | null {
  if (!template.name.trim()) return "Dê um nome ao modelo.";
  if (template.sections.some((s) => !s.title.trim())) return "Toda seção precisa de título.";
  const ids = template.sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) return "Há seções com o mesmo identificador.";
  for (const section of template.sections) {
    if (section.kind === "campos" || section.kind === "tabela") {
      if (!section.fields || section.fields.length === 0)
        return `A seção "${section.title}" precisa de pelo menos um campo.`;
      if (section.fields.some((f) => !f.label.trim()))
        return `Todo campo de "${section.title}" precisa de rótulo.`;
      const fieldIds = section.fields.map((f) => f.id);
      if (new Set(fieldIds).size !== fieldIds.length)
        return `A seção "${section.title}" tem campos repetidos.`;
    }
  }
  return null;
}

/** Moves a section one place up or down. Out-of-range moves do nothing. */
export function moveSection(
  sections: DossierSectionDef[],
  id: string,
  direction: -1 | 1,
): DossierSectionDef[] {
  const index = sections.findIndex((s) => s.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function startDossier(
  clientId: string,
  template: DossierTemplate,
  now = new Date().toISOString(),
  id: string = uid("dos"),
): Dossier {
  return {
    id,
    clientId,
    templateId: template.id,
    sections: template.sections.map((s) => ({
      sectionId: s.id,
      visibility: s.defaultVisibility,
    })),
    shareEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The content of one section, creating it on demand. A section added to the
 * model after a dossier was written still shows up on every client, empty.
 */
export function sectionOf(dossier: Dossier, def: DossierSectionDef): DossierSection {
  return (
    dossier.sections.find((s) => s.sectionId === def.id) ?? {
      sectionId: def.id,
      visibility: def.defaultVisibility,
    }
  );
}

export function setSection(
  dossier: Dossier,
  section: DossierSection,
  now = new Date().toISOString(),
): Dossier {
  const exists = dossier.sections.some((s) => s.sectionId === section.sectionId);
  return {
    ...dossier,
    sections: exists
      ? dossier.sections.map((s) => (s.sectionId === section.sectionId ? section : s))
      : [...dossier.sections, section],
    updatedAt: now,
  };
}

/** True when the section holds nothing at all. */
export function isEmptySection(section: DossierSection): boolean {
  const hasValues = Object.values(section.values ?? {}).some((v) => v.trim());
  const hasRows = (section.rows ?? []).some((row) =>
    Object.values(row).some((v) => (v ?? "").trim()),
  );
  return (
    !section.text?.trim() &&
    !hasValues &&
    !(section.list ?? []).some((l) => l.trim()) &&
    (section.images ?? []).length === 0 &&
    !hasRows
  );
}

/**
 * How much of the model is filled in, as a percentage of its sections. The
 * formula is stated to the user because a number nobody can explain is a
 * number nobody trusts (the same critique the benchmark makes of its own
 * health score).
 */
export function completeness(dossier: Dossier, template: DossierTemplate): number {
  if (template.sections.length === 0) return 0;
  const filled = template.sections.filter((def) => !isEmptySection(sectionOf(dossier, def))).length;
  return Math.round((filled / template.sections.length) * 100);
}

/** Only images on the allow-list get in, and only with an http(s) address. */
export function buildImage(url: string, caption?: string): { id: string; url: string; caption?: string } | null {
  const safe = safeExternalUrl(url);
  if (!safe) return null;
  return { id: uid("img"), url: safe, caption: caption?.trim() || undefined };
}

/**
 * What the client's link serves: the sections marked `cliente` that actually
 * have something in them. An empty section is noise on a page the client
 * reads as the agency's work.
 */
export function publicSections(
  dossier: Dossier,
  template: DossierTemplate,
): { defs: DossierSectionDef[]; sections: DossierSection[] } {
  const defs: DossierSectionDef[] = [];
  const sections: DossierSection[] = [];
  for (const def of template.sections) {
    const section = sectionOf(dossier, def);
    if (section.visibility !== "cliente" || isEmptySection(section)) continue;
    defs.push(def);
    sections.push(section);
  }
  return { defs, sections };
}

/** Sections the client will never see, for the warning the editor shows. */
export function internalCount(dossier: Dossier, template: DossierTemplate): number {
  return template.sections.filter((def) => sectionOf(dossier, def).visibility === "interno").length;
}

export function flipVisibility(current: DossierVisibility): DossierVisibility {
  return current === "cliente" ? "interno" : "cliente";
}
