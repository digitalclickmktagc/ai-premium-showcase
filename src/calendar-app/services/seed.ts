import type { Database } from "../types";
import { shareToken, toDayISO, uid } from "../utils";

/**
 * Demo dataset used the first time the app runs with the localStorage adapter.
 * Posts are placed relative to "today" so the current month always looks
 * populated regardless of when the app is opened.
 */
export function buildSeed(): Database {
  const now = new Date();
  const iso = now.toISOString();
  const year = now.getFullYear();
  const month = now.getMonth();

  /** A day in the current month, clamped to a valid date. */
  const day = (d: number) => {
    const last = new Date(year, month + 1, 0).getDate();
    return toDayISO(new Date(year, month, Math.min(Math.max(d, 1), last)));
  };

  const aurora = {
    id: uid("cli"),
    name: "Aurora Café",
    color: "#f97316",
    handle: "@auroracafe",
    active: true,
    createdAt: iso,
  };
  const lumina = {
    id: uid("cli"),
    name: "Lumina Studio",
    color: "#8b5cf6",
    handle: "@luminastudio",
    active: true,
    createdAt: iso,
  };
  const vitta = {
    id: uid("cli"),
    name: "Vitta Fit",
    color: "#22c55e",
    handle: "@vittafit",
    active: false,
    createdAt: iso,
  };

  const auroraCal = {
    id: uid("cal"),
    clientId: aurora.id,
    name: "Calendário Aurora Café",
    shareToken: shareToken(),
    createdAt: iso,
  };
  const luminaCal = {
    id: uid("cal"),
    clientId: lumina.id,
    name: "Calendário Lumina Studio",
    shareToken: shareToken(),
    createdAt: iso,
  };
  const vittaCal = {
    id: uid("cal"),
    clientId: vitta.id,
    name: "Calendário Vitta Fit",
    shareToken: shareToken(),
    createdAt: iso,
  };

  const mk = (
    calendarId: string,
    p: {
      title: string;
      date: string;
      status: Database["posts"][number]["status"];
      description?: string;
      contentType?: string;
      referenceLink?: string;
      internalNotes?: string;
      rescheduleHistory?: Database["posts"][number]["rescheduleHistory"];
    },
  ) => ({
    id: uid("post"),
    calendarId,
    title: p.title,
    date: p.date,
    status: p.status,
    description: p.description ?? "",
    contentType: p.contentType,
    referenceLink: p.referenceLink,
    internalNotes: p.internalNotes,
    rescheduleHistory: p.rescheduleHistory ?? [],
    createdAt: iso,
    updatedAt: iso,
  });

  const posts: Database["posts"] = [
    // Aurora Café
    mk(auroraCal.id, {
      title: "Novo blend de inverno",
      date: day(3),
      status: "published",
      contentType: "Feed",
      description:
        "Apresentação do blend sazonal de inverno com notas de chocolate e avelã. Foto do grão + xícara fumegante.",
      referenceLink: "https://drive.google.com/exemplo-briefing",
      internalNotes: "Confirmar se a foto do grão já foi aprovada pelo cliente.",
    }),
    mk(auroraCal.id, {
      title: "Bastidores da torra",
      date: day(7),
      status: "done",
      contentType: "Reels",
      description: "Vídeo curto mostrando o processo de torra artesanal.",
    }),
    mk(auroraCal.id, {
      title: "Enquete: seu café preferido",
      date: day(12),
      status: "todo",
      contentType: "Story",
      description: "Sequência de stories com enquete interativa.",
    }),
    mk(auroraCal.id, {
      title: "Combo café + brownie",
      date: day(18),
      status: "rescheduled",
      contentType: "Carrossel",
      description: "Divulgação da promoção de combo da semana.",
      rescheduleHistory: [{ from: day(15), to: day(18), at: iso }],
      internalNotes: "Cliente pediu para mover por conta de feriado.",
    }),
    mk(auroraCal.id, {
      title: "Depoimento de cliente",
      date: day(24),
      status: "todo",
      contentType: "Feed",
      description: "Card com depoimento e foto do cliente frequente.",
    }),

    // Lumina Studio
    mk(luminaCal.id, {
      title: "Case: ensaio corporativo",
      date: day(2),
      status: "published",
      contentType: "Carrossel",
      description: "Antes e depois de um ensaio corporativo recente.",
    }),
    mk(luminaCal.id, {
      title: "Dica de iluminação",
      date: day(9),
      status: "done",
      contentType: "Reels",
      description: "Dica rápida de iluminação natural para retratos.",
    }),
    mk(luminaCal.id, {
      title: "Promo ensaio gestante",
      date: day(16),
      status: "todo",
      contentType: "Feed",
      description: "Divulgação do pacote de ensaio gestante do mês.",
      internalNotes: "Aguardando valores finais do pacote.",
    }),
    mk(luminaCal.id, {
      title: "Behind the scenes",
      date: day(22),
      status: "todo",
      contentType: "Story",
      description: "Bastidores do estúdio em dia de gravação.",
    }),

    // Vitta Fit
    mk(vittaCal.id, {
      title: "Treino do dia",
      date: day(5),
      status: "published",
      contentType: "Reels",
      description: "Série de exercícios funcionais para iniciantes.",
    }),
    mk(vittaCal.id, {
      title: "Receita pós-treino",
      date: day(14),
      status: "todo",
      contentType: "Feed",
      description: "Receita rápida e proteica para o pós-treino.",
    }),
    mk(vittaCal.id, {
      title: "Post antigo (removido)",
      date: day(10),
      status: "deleted",
      contentType: "Feed",
      description: "Conteúdo cancelado — mantido como histórico.",
      internalNotes: "Cancelado pelo cliente.",
    }),
  ];

  return {
    clients: [aurora, lumina, vitta],
    calendars: [auroraCal, luminaCal, vittaCal],
    posts,
  };
}
