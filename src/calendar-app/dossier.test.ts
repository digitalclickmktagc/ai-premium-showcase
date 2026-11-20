import { describe, expect, it } from "vitest";
import {
  buildImage,
  completeness,
  defaultTemplate,
  flipVisibility,
  internalCount,
  isEmptySection,
  moveSection,
  newSection,
  publicSections,
  sectionOf,
  setSection,
  startDossier,
  validateTemplate,
} from "./dossier";
import type { DossierSectionDef, DossierTemplate } from "./types";

const NOW = "2026-05-01T10:00:00.000Z";

function template(sections: DossierSectionDef[]): DossierTemplate {
  return { id: "t1", name: "Modelo", sections, createdAt: NOW, updatedAt: NOW };
}

const textSection: DossierSectionDef = {
  id: "a",
  title: "Visão geral",
  kind: "texto",
  defaultVisibility: "cliente",
};

describe("default model", () => {
  it("starts with the ficha's eight sections", () => {
    const t = defaultTemplate(NOW, "t1");
    expect(t.sections).toHaveLength(8);
    expect(t.sections.map((s) => s.id)).toContain("persona");
    expect(validateTemplate(t)).toBeNull();
  });

  it("keeps the raio-X internal by default", () => {
    const raiox = defaultTemplate(NOW, "t1").sections.find((s) => s.id === "raiox");
    expect(raiox?.defaultVisibility).toBe("interno");
  });
});

describe("validateTemplate", () => {
  it("demands a name and a title per section", () => {
    expect(validateTemplate({ ...template([textSection]), name: " " })).toMatch(/nome/);
    expect(validateTemplate(template([{ ...textSection, title: "" }]))).toMatch(/título/);
  });

  it("refuses two sections with the same id", () => {
    expect(validateTemplate(template([textSection, { ...textSection }]))).toMatch(/mesmo identificador/);
  });

  it("demands fields for campos and tabela, with labels", () => {
    const empty: DossierSectionDef = { id: "b", title: "Persona", kind: "campos", defaultVisibility: "cliente" };
    expect(validateTemplate(template([empty]))).toMatch(/pelo menos um campo/);
    expect(
      validateTemplate(template([{ ...empty, fields: [{ id: "f1", label: " " }] }])),
    ).toMatch(/rótulo/);
    expect(
      validateTemplate(
        template([{ ...empty, fields: [{ id: "f1", label: "A" }, { id: "f1", label: "B" }] }]),
      ),
    ).toMatch(/campos repetidos/);
  });

  it("accepts a well-formed model", () => {
    expect(validateTemplate(template([textSection]))).toBeNull();
  });

  it("gives a new section of kind campos one field to start", () => {
    expect(newSection("campos").fields).toHaveLength(1);
    expect(newSection("texto").fields).toBeUndefined();
  });
});

describe("moveSection", () => {
  const sections = [textSection, { ...textSection, id: "b" }, { ...textSection, id: "c" }];

  it("swaps with the neighbour", () => {
    expect(moveSection(sections, "b", -1).map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(moveSection(sections, "b", 1).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the ends or for an unknown section", () => {
    expect(moveSection(sections, "a", -1)).toBe(sections);
    expect(moveSection(sections, "c", 1)).toBe(sections);
    expect(moveSection(sections, "x", 1)).toBe(sections);
  });
});

describe("dossier content", () => {
  const t = template([
    textSection,
    { id: "b", title: "Raio-X", kind: "texto", defaultVisibility: "interno" },
  ]);

  it("starts with one empty section per model section, carrying its visibility", () => {
    const d = startDossier("c1", t, NOW, "d1");
    expect(d.sections.map((s) => [s.sectionId, s.visibility])).toEqual([
      ["a", "cliente"],
      ["b", "interno"],
    ]);
    expect(d.shareEnabled).toBe(false);
    expect(d.shareToken).toBeUndefined();
  });

  it("invents an empty section for one added to the model later", () => {
    const d = startDossier("c1", template([textSection]), NOW, "d1");
    const added: DossierSectionDef = { id: "novo", title: "Cardápio", kind: "lista", defaultVisibility: "cliente" };
    expect(sectionOf(d, added)).toEqual({ sectionId: "novo", visibility: "cliente" });
  });

  it("writes a section and then replaces it", () => {
    let d = startDossier("c1", t, NOW, "d1");
    d = setSection(d, { sectionId: "a", visibility: "cliente", text: "Vender mais" }, NOW);
    expect(sectionOf(d, textSection).text).toBe("Vender mais");
    d = setSection(d, { sectionId: "a", visibility: "cliente", text: "Outro" }, NOW);
    expect(d.sections.filter((s) => s.sectionId === "a")).toHaveLength(1);
  });
});

describe("isEmptySection", () => {
  it("sees through whitespace and empty structures", () => {
    expect(isEmptySection({ sectionId: "a", visibility: "cliente" })).toBe(true);
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", text: "   " })).toBe(true);
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", values: { x: " " } })).toBe(true);
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", list: ["", " "] })).toBe(true);
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", images: [] })).toBe(true);
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", rows: [{ nome: " " }] })).toBe(true);
  });

  it("counts anything actually written", () => {
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", text: "x" })).toBe(false);
    expect(isEmptySection({ sectionId: "a", visibility: "cliente", rows: [{ nome: "Concorrente" }] })).toBe(false);
  });
});

describe("completeness", () => {
  const t = template([textSection, { ...textSection, id: "b" }, { ...textSection, id: "c" }]);

  it("counts filled sections over the model's sections", () => {
    let d = startDossier("c1", t, NOW, "d1");
    expect(completeness(d, t)).toBe(0);
    d = setSection(d, { sectionId: "a", visibility: "cliente", text: "x" }, NOW);
    expect(completeness(d, t)).toBe(33);
    d = setSection(d, { sectionId: "b", visibility: "cliente", list: ["y"] }, NOW);
    expect(completeness(d, t)).toBe(67);
  });

  it("does not divide by zero on an empty model", () => {
    expect(completeness(startDossier("c1", template([]), NOW, "d1"), template([]))).toBe(0);
  });
});

describe("the client's link", () => {
  const t = template([
    textSection,
    { id: "b", title: "Raio-X", kind: "texto", defaultVisibility: "interno" },
    { id: "c", title: "Vazia", kind: "texto", defaultVisibility: "cliente" },
  ]);

  it("never serves an internal section", () => {
    let d = startDossier("c1", t, NOW, "d1");
    d = setSection(d, { sectionId: "a", visibility: "cliente", text: "Objetivo" }, NOW);
    d = setSection(d, { sectionId: "b", visibility: "interno", text: "Perfil fraco" }, NOW);
    const out = publicSections(d, t);
    expect(out.defs.map((s) => s.id)).toEqual(["a"]);
    expect(JSON.stringify(out)).not.toContain("Perfil fraco");
  });

  it("leaves out sections nobody filled in", () => {
    let d = startDossier("c1", t, NOW, "d1");
    d = setSection(d, { sectionId: "a", visibility: "cliente", text: "Objetivo" }, NOW);
    expect(publicSections(d, t).defs.map((s) => s.id)).toEqual(["a"]);
  });

  it("follows the dossier's own visibility, not the model's default", () => {
    let d = startDossier("c1", t, NOW, "d1");
    d = setSection(d, { sectionId: "b", visibility: "cliente", text: "Revisado" }, NOW);
    expect(publicSections(d, t).defs.map((s) => s.id)).toEqual(["b"]);
  });

  it("counts the internal sections for the warning", () => {
    expect(internalCount(startDossier("c1", t, NOW, "d1"), t)).toBe(1);
  });

  it("flips visibility both ways", () => {
    expect(flipVisibility("cliente")).toBe("interno");
    expect(flipVisibility("interno")).toBe("cliente");
  });
});

describe("buildImage", () => {
  it("accepts an http(s) address and trims the caption", () => {
    const img = buildImage("https://drive.google.com/file/abc", "  Referência  ");
    expect(img?.url).toBe("https://drive.google.com/file/abc");
    expect(img?.caption).toBe("Referência");
  });

  it("refuses anything that is not http(s)", () => {
    expect(buildImage("javascript:alert(1)")).toBeNull();
    expect(buildImage("   ")).toBeNull();
  });
});
