import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Appointment,
  Availability,
  ContactBlock,
  Contract,
  ContractingProcess,
  CrmTask,
  Assessment,
  AssessmentTemplate,
  BriefingForm,
  Dossier,
  DossierTemplate,
  FormResponse,
  Script,
  WebhookDelivery,
  WebhookSubscription,
  HealthWeights,
  Project,
  Squad,
  StatementLine,
  Idea,
  MonthlyPlan,
  PautaItem,
  Deal,
  Interaction,
  FinanceAccount,
  FinanceCategory,
  FinanceEntry,
  FinanceSeries,
  Transfer,
  Proposal,
  Service,
  BoardStage,
  Booking,
  BookingPage,
  Calendar,
  MarkedDate,
  Client,
  CreateClientInput,
  CreatePostInput,
  Post,
  PostStatus,
  Session,
  UpdateClientInput,
  UpdatePostInput,
} from "../types";
import { getDataService } from "../services";
import {
  advanceProcess,
  isActionable,
  newProcess,
  proposalsAwaitingProcess,
  type SagaContext,
} from "../orchestrator";
import { BILLING_LABEL, isRecurring, proposalTotals } from "../proposals";
import { projectFromContract } from "../projects";
import { DEFAULT_RENEW_NOTICE_DAYS, hashText, isEffective } from "../contracts";
import { formatMoney } from "../money";
import { shareToken, todayISO, uid } from "../utils";
import {
  newChain,
  pendingReviewEvents,
  runAutomations,
  type AutomationAction,
  type AutomationEvent,
  type AutomationRule,
  type AutomationRun,
} from "../automation";
import { addDays } from "date-fns";
import { toDayISO } from "../utils";

interface PostFilter {
  /** Include soft-deleted posts (default false). */
  includeDeleted?: boolean;
  status?: PostStatus | "all";
  contentType?: string | "all";
}

interface AppContextValue {
  serviceName: string;
  loading: boolean;
  session: Session | null;

  clients: Client[];
  calendars: Calendar[];
  posts: Post[];
  boardStages: BoardStage[];
  automationRules: AutomationRule[];
  deals: Deal[];
  interactions: Interaction[];
  crmTasks: CrmTask[];
  ideas: Idea[];
  plans: MonthlyPlan[];
  pautaItems: PautaItem[];
  dossierTemplates: DossierTemplate[];
  dossiers: Dossier[];
  projects: Project[];
  squads: Squad[];
  statementLines: StatementLine[];
  scripts: Script[];
  assessmentTemplates: AssessmentTemplate[];
  assessments: Assessment[];
  webhooks: WebhookSubscription[];
  webhookDeliveries: WebhookDelivery[];
  forms: BriefingForm[];
  formResponses: FormResponse[];
  healthWeights?: HealthWeights;
  blocks: ContactBlock[];
  processes: ContractingProcess[];
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  entries: FinanceEntry[];
  series: FinanceSeries[];
  transfers: Transfer[];
  services: Service[];
  proposals: Proposal[];
  contracts: Contract[];
  appointments: Appointment[];
  bookings: Booking[];
  markedDates: MarkedDate[];
  availability?: Availability;
  bookingPage?: BookingPage;

  // selectors
  getClient: (id: string) => Client | undefined;
  getCalendar: (id: string) => Calendar | undefined;
  getCalendarByClient: (clientId: string) => Calendar | undefined;
  getClientForCalendar: (calendarId: string) => Client | undefined;
  postsForCalendar: (calendarId: string, filter?: PostFilter) => Post[];
  rulesForCalendar: (calendarId: string) => AutomationRule[];
  /** The calendar's own columns; empty means it uses the standard four. */
  stagesForCalendar: (calendarId: string) => BoardStage[];

  // auth
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;

  // client actions
  createClient: (
    input: CreateClientInput,
  ) => Promise<{ client: Client; calendar: Calendar }>;
  updateClient: (id: string, patch: UpdateClientInput) => Promise<Client>;
  regenerateShareToken: (calendarId: string) => Promise<Calendar>;

  // post actions
  createPost: (input: CreatePostInput) => Promise<Post>;
  updatePost: (id: string, patch: UpdatePostInput) => Promise<Post>;
  reschedulePost: (id: string, newDate: string) => Promise<Post>;
  /** Optimistically move a post to another day (used by drag & drop). */
  movePost: (id: string, newDate: string) => Promise<void>;
  /**
   * Optimistically move a post on the board. `stageId` is the custom column
   * it landed in, or undefined on a standard stage.
   */
  changeStatus: (id: string, status: PostStatus, stageId?: string) => Promise<void>;
  /** Send a post to the client, opening a new review round. */
  requestApproval: (id: string, teamMessage?: string) => Promise<Post>;
  deletePost: (id: string) => Promise<Post>;
  restorePost: (id: string, status?: PostStatus) => Promise<Post>;

  // análise de perfil e concorrência
  saveAssessmentTemplate: (t: AssessmentTemplate) => Promise<AssessmentTemplate>;
  saveAssessment: (a: Assessment) => Promise<Assessment>;
  deleteAssessment: (id: string) => Promise<void>;

  // webhooks
  saveWebhook: (w: WebhookSubscription) => Promise<WebhookSubscription>;
  deleteWebhook: (id: string) => Promise<void>;
  enqueueWebhookTest: (id: string) => Promise<WebhookDelivery>;

  // roteiros
  saveScript: (s: Script) => Promise<Script>;
  deleteScript: (id: string) => Promise<void>;

  // formulários de briefing
  saveForm: (f: BriefingForm) => Promise<BriefingForm>;
  deleteForm: (id: string) => Promise<void>;

  // conciliação de extrato
  saveStatementLines: (lines: StatementLine[]) => Promise<StatementLine[]>;
  deleteStatementLine: (id: string) => Promise<void>;

  // projetos e squads
  saveProject: (p: Project) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  saveSquad: (s: Squad) => Promise<Squad>;
  deleteSquad: (id: string) => Promise<void>;
  saveHealthWeights: (w: HealthWeights) => Promise<void>;

  // dossiê estratégico
  saveDossierTemplate: (t: DossierTemplate) => Promise<DossierTemplate>;
  saveDossier: (d: Dossier) => Promise<Dossier>;

  // pauta única e planejamento mensal
  savePlan: (p: MonthlyPlan) => Promise<MonthlyPlan>;
  deletePlan: (id: string) => Promise<void>;
  savePautaItems: (items: PautaItem[]) => Promise<PautaItem[]>;
  deletePautaItems: (ids: string[]) => Promise<void>;

  // banco de ideias
  saveIdea: (i: Idea) => Promise<Idea>;
  deleteIdea: (id: string) => Promise<void>;

  // crm
  saveDeal: (d: Deal) => Promise<Deal>;
  deleteDeal: (id: string) => Promise<void>;
  addInteraction: (i: Interaction) => Promise<Interaction>;
  saveCrmTask: (t: CrmTask) => Promise<CrmTask>;
  deleteCrmTask: (id: string) => Promise<void>;
  saveBlock: (b: ContactBlock) => Promise<ContactBlock>;
  deleteBlock: (id: string) => Promise<void>;
  /** Push a stuck sale-to-operation process one more time. */
  retryProcess: (id: string) => Promise<void>;

  // financeiro
  saveAccount: (a: FinanceAccount) => Promise<FinanceAccount>;
  deleteAccount: (id: string) => Promise<void>;
  saveCategory: (c: FinanceCategory) => Promise<FinanceCategory>;
  deleteCategory: (id: string) => Promise<void>;
  saveEntry: (e: FinanceEntry) => Promise<FinanceEntry>;
  deleteEntry: (id: string) => Promise<void>;
  settleEntry: (id: string, accountId: string, date: string) => Promise<FinanceEntry>;
  unsettleEntry: (id: string) => Promise<FinanceEntry>;
  reverseEntry: (id: string) => Promise<FinanceEntry>;
  saveSeries: (s: FinanceSeries) => Promise<FinanceSeries>;
  deleteSeries: (id: string) => Promise<void>;
  materialiseSeries: () => Promise<number>;
  saveTransfer: (t: Transfer) => Promise<Transfer>;
  deleteTransfer: (id: string) => Promise<void>;

  // comercial
  createService: (input: Omit<Service, "id" | "createdAt">) => Promise<Service>;
  updateService: (id: string, patch: Partial<Service>) => Promise<Service>;
  deleteService: (id: string) => Promise<void>;
  saveProposal: (proposal: Proposal) => Promise<Proposal>;
  sendProposal: (id: string) => Promise<Proposal>;
  deleteProposal: (id: string) => Promise<void>;
  saveContract: (contract: Contract) => Promise<Contract>;
  deleteContract: (id: string) => Promise<void>;

  // agenda
  createAppointment: (input: Omit<Appointment, "id" | "createdAt">) => Promise<Appointment>;
  updateAppointment: (
    id: string,
    patch: Partial<Appointment>,
  ) => Promise<Appointment>;
  cancelAppointment: (id: string) => Promise<void>;
  addMarkedDate: (date: MarkedDate) => Promise<void>;
  removeMarkedDate: (id: string) => Promise<void>;
  saveBookingConfig: (input: {
    availability: Availability;
    page: Pick<BookingPage, "active" | "title" | "intro">;
  }) => Promise<void>;
  regenerateBookingLink: () => Promise<BookingPage>;

  // board columns
  createStage: (input: Omit<BoardStage, "id">) => Promise<BoardStage>;
  updateStage: (
    id: string,
    patch: Partial<Pick<BoardStage, "name" | "color" | "category" | "order">>,
  ) => Promise<BoardStage>;
  deleteStage: (id: string) => Promise<void>;
  reorderStages: (order: { id: string; order: number }[]) => Promise<void>;

  // automation rules
  createRule: (input: Omit<AutomationRule, "id" | "createdAt">) => Promise<AutomationRule>;
  updateRule: (
    id: string,
    patch: Partial<Pick<AutomationRule, "active" | "trigger" | "action">>,
  ) => Promise<AutomationRule>;
  deleteRule: (id: string) => Promise<void>;
  /** Recent executions for a calendar, newest first. */
  listRuns: (calendarId: string, limit?: number) => Promise<AutomationRun[]>;

  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const service = useMemo(() => getDataService(), []);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(() => service.getSession());
  const [clients, setClients] = useState<Client[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [boardStages, setBoardStages] = useState<BoardStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [crmTasks, setCrmTasks] = useState<CrmTask[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [pautaItems, setPautaItems] = useState<PautaItem[]>([]);
  const [dossierTemplates, setDossierTemplates] = useState<DossierTemplate[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [assessmentTemplates, setAssessmentTemplates] = useState<AssessmentTemplate[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [forms, setForms] = useState<BriefingForm[]>([]);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [healthWeights, setHealthWeights] = useState<HealthWeights | undefined>();
  const [blocks, setBlocks] = useState<ContactBlock[]>([]);
  const [processes, setProcesses] = useState<ContractingProcess[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [series, setSeries] = useState<FinanceSeries[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDate[]>([]);
  const [availability, setAvailability] = useState<Availability | undefined>();
  const [bookingPage, setBookingPage] = useState<BookingPage | undefined>();
  // Mirrors `posts` synchronously so an optimistic update can roll back even
  // when the write rejects before React has applied the state updater.
  const postsRef = useRef<Post[]>(posts);
  postsRef.current = posts;

  // Mirrors for the saga, which runs outside render and must not read stale
  // state captured by a closure.
  const clientsRef = useRef<Client[]>([]);
  const calendarsRef = useRef<Calendar[]>([]);
  const contractsRef = useRef<Contract[]>([]);
  const proposalsRef = useRef<Proposal[]>([]);
  const processesRef = useRef<ContractingProcess[]>([]);
  const dealsRef = useRef<Deal[]>([]);
  const projectsRef = useRef<Project[]>([]);

  const refresh = useCallback(async () => {
    const db = await service.getDatabase();
    setClients(db.clients);
    setCalendars(db.calendars);
    setPosts(db.posts);
    setAutomationRules(db.automationRules ?? []);
    setBoardStages(db.boardStages ?? []);
    setDeals(db.deals ?? []);
    setInteractions(db.interactions ?? []);
    setCrmTasks(db.crmTasks ?? []);
    setIdeas(db.ideas ?? []);
    setPlans(db.plans ?? []);
    setPautaItems(db.pautaItems ?? []);
    setDossierTemplates(db.dossierTemplates ?? []);
    setDossiers(db.dossiers ?? []);
    setProjects(db.projects ?? []);
    setSquads(db.squads ?? []);
    setStatementLines(db.statementLines ?? []);
    setScripts(db.scripts ?? []);
    setAssessmentTemplates(db.assessmentTemplates ?? []);
    setAssessments(db.assessments ?? []);
    setWebhooks(db.webhooks ?? []);
    setWebhookDeliveries(db.webhookDeliveries ?? []);
    setForms(db.forms ?? []);
    setFormResponses(db.formResponses ?? []);
    setHealthWeights(db.healthWeights);
    setBlocks(db.blocks ?? []);
    setProcesses(db.processes ?? []);
    setAccounts(db.accounts ?? []);
    setCategories(db.categories ?? []);
    setEntries(db.entries ?? []);
    setSeries(db.series ?? []);
    setTransfers(db.transfers ?? []);
    setServices(db.services ?? []);
    setProposals(db.proposals ?? []);
    setContracts(db.contracts ?? []);
    setAppointments(db.appointments ?? []);
    setBookings(db.bookings ?? []);
    setMarkedDates(db.markedDates ?? []);
    setAvailability(db.availability);
    setBookingPage(db.bookingPage);
  }, [service]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Resolve the session first (async for Supabase; instant for demo),
        // then load data with the right credentials in place.
        const s = service.initSession
          ? await service.initSession()
          : service.getSession();
        if (active) setSession(s);
        await refresh();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh, service]);

  // Restore the real cursor on calendar routes (the landing page hides it).
  // The `calendar-route` body class and the theme are owned by ThemeProvider.

  // ── selectors ──────────────────────────────────────────────
  const getClient = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients],
  );
  const getCalendar = useCallback(
    (id: string) => calendars.find((c) => c.id === id),
    [calendars],
  );
  const getCalendarByClient = useCallback(
    (clientId: string) => calendars.find((c) => c.clientId === clientId),
    [calendars],
  );
  const getClientForCalendar = useCallback(
    (calendarId: string) => {
      const cal = calendars.find((c) => c.id === calendarId);
      return cal ? clients.find((c) => c.id === cal.clientId) : undefined;
    },
    [calendars, clients],
  );
  const postsForCalendar = useCallback(
    (calendarId: string, filter: PostFilter = {}) => {
      return posts.filter((p) => {
        if (p.calendarId !== calendarId) return false;
        if (!filter.includeDeleted && p.status === "deleted") return false;
        if (filter.status && filter.status !== "all" && p.status !== filter.status)
          return false;
        if (
          filter.contentType &&
          filter.contentType !== "all" &&
          (p.contentType || "") !== filter.contentType
        )
          return false;
        return true;
      });
    },
    [posts],
  );

  const rulesForCalendar = useCallback(
    (calendarId: string) => automationRules.filter((r) => r.calendarId === calendarId),
    [automationRules],
  );
  const stagesForCalendar = useCallback(
    (calendarId: string) =>
      boardStages
        .filter((s) => s.calendarId === calendarId)
        .sort((a, b) => a.order - b.order),
    [boardStages],
  );

  // ── auth ───────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      const s = await service.login(email, password);
      setSession(s);
      await refresh(); // load data with the new credentials
    },
    [service, refresh],
  );
  const logout = useCallback(() => {
    service.logout();
    setSession(null);
    // Drop any loaded data so nothing lingers after signing out.
    setClients([]);
    setCalendars([]);
    setPosts([]);
    setAutomationRules([]);
    setBoardStages([]);
    setDeals([]);
    setInteractions([]);
    setCrmTasks([]);
    setBlocks([]);
    setProcesses([]);
    setAccounts([]);
    setCategories([]);
    setEntries([]);
    setSeries([]);
    setTransfers([]);
    setServices([]);
    setProposals([]);
    setContracts([]);
    setAppointments([]);
    setBookings([]);
    setMarkedDates([]);
  }, [service]);

  // ── mutations (each refreshes local state) ─────────────────
  const createClient = useCallback(
    async (input: CreateClientInput) => {
      const res = await service.createClient(input);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const updateClient = useCallback(
    async (id: string, patch: UpdateClientInput) => {
      const res = await service.updateClient(id, patch);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const regenerateShareToken = useCallback(
    async (calendarId: string) => {
      const res = await service.regenerateShareToken(calendarId);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const createPost = useCallback(
    async (input: CreatePostInput) => {
      const res = await service.createPost(input);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  // The engine is declared further down (hooks may not be reordered), so the
  // callbacks above it reach it through this ref.
  const fireRef = useRef<((event: AutomationEvent) => void) | null>(null);
  const updatePost = useCallback(
    async (id: string, patch: UpdatePostInput) => {
      const before = postsRef.current.find((p) => p.id === id);
      const res = await service.updatePost(id, patch);
      await refresh();
      // A stage reached through the edit form is the same event as a stage
      // reached by dragging a card: the rules must not care which it was.
      if (patch.status && before && before.status !== patch.status) {
        fireRef.current?.({
          kind: "entered_stage",
          calendarId: before.calendarId,
          postId: id,
          stage: patch.status,
        });
      }
      return res;
    },
    [service, refresh],
  );
  const reschedulePost = useCallback(
    async (id: string, newDate: string) => {
      const res = await service.reschedulePost(id, newDate);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  /**
   * Move a post to another day, applied optimistically so a drag feels
   * instant even when the backend is remote. Reverts if the write fails.
   */
  const movePost = useCallback(
    async (id: string, newDate: string) => {
      const snapshot = postsRef.current;
      setPosts((current) =>
        current.map((p) =>
          p.id === id && p.date !== newDate
            ? {
                ...p,
                date: newDate,
                rescheduleHistory: [
                  ...p.rescheduleHistory,
                  { from: p.date, to: newDate, at: new Date().toISOString() },
                ],
              }
            : p,
        ),
      );
      try {
        await service.updatePost(id, { date: newDate });
        await refresh();
      } catch (err) {
        setPosts(snapshot); // put it back where it was
        throw err;
      }
    },
    [service, refresh],
  );
  // ── Stage automations ──────────────────────────────────────
  // Rules are data (see ../automation.ts); this is the only place that knows
  // how to turn an action into a real write.
  const rulesRef = useRef<AutomationRule[]>(automationRules);
  rulesRef.current = automationRules;

  const applyAction = useCallback(
    async (postId: string, action: AutomationAction): Promise<AutomationEvent | null> => {
      const post = postsRef.current.find((p) => p.id === postId);
      if (!post) throw new Error("Post não encontrado.");

      switch (action.type) {
        case "move_to_stage": {
          if (post.status === action.stage) return null; // already there
          await service.updatePost(postId, { status: action.stage });
          // Landing on a stage is itself an event, so a chain can continue.
          return {
            kind: "entered_stage",
            calendarId: post.calendarId,
            postId,
            stage: action.stage,
          };
        }
        case "send_for_review":
          await service.requestApproval(postId, action.message);
          return null;
        case "set_due_in_days": {
          await service.updatePost(postId, {
            date: toDayISO(addDays(new Date(), action.days)),
          });
          return null;
        }
      }
    },
    [service],
  );

  /**
   * Run the rules for one event. Never throws: the user's own action already
   * succeeded, and an automation failing is something to show in the log, not
   * a reason to roll their change back.
   */
  const fireAutomations = useCallback(
    async (event: AutomationEvent, eventKey?: string) => {
      const rules = rulesRef.current.filter((r) => r.calendarId === event.calendarId);
      if (rules.length === 0) return;
      try {
        const runs = await runAutomations(
          event,
          rules,
          {
            apply: applyAction,
            eventKey,
            log: (run) => void service.logAutomationRun(run).catch(() => undefined),
          },
          newChain(),
        );
        if (runs.some((r) => r.result === "applied")) await refresh();
      } catch (err) {
        console.error("Falha ao executar automações", err);
      }
    },
    [applyAction, refresh, service],
  );

  const changeStatus = useCallback(
    async (id: string, status: PostStatus, stageId?: string) => {
      const snapshot = postsRef.current;
      setPosts((current) =>
        current.map((p) => (p.id === id ? { ...p, status, stageId } : p)),
      );
      try {
        await service.updatePost(id, { status, stageId: stageId ?? "" });
        await refresh();
      } catch (err) {
        setPosts(snapshot); // put the card back in its column
        throw err;
      }
      const post = snapshot.find((p) => p.id === id);
      if (post && post.status !== status) {
        await fireAutomations({
          kind: "entered_stage",
          calendarId: post.calendarId,
          postId: id,
          stage: status,
        });
      }
    },
    [service, refresh, fireAutomations],
  );
  fireRef.current = (event) => void fireAutomations(event);

  const requestApproval = useCallback(
    async (id: string, teamMessage?: string) => {
      const res = await service.requestApproval(id, teamMessage);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deletePost = useCallback(
    async (id: string) => {
      const res = await service.deletePost(id);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const restorePost = useCallback(
    async (id: string, status?: PostStatus) => {
      const res = await service.restorePost(id, status);
      await refresh();
      return res;
    },
    [service, refresh],
  );

  // ── CRM ────────────────────────────────────────────────────
  const saveDeal = useCallback(
    async (d: Deal) => {
      const res = await service.saveDeal(d);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteDeal = useCallback(
    async (id: string) => {
      await service.deleteDeal(id);
      await refresh();
    },
    [service, refresh],
  );
  const addInteraction = useCallback(
    async (i: Interaction) => {
      const res = await service.addInteraction(i);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const saveAssessmentTemplate = useCallback(
    async (t: AssessmentTemplate) => {
      const res = await service.saveAssessmentTemplate(t);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const saveAssessment = useCallback(
    async (a: Assessment) => {
      const res = await service.saveAssessment(a);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteAssessment = useCallback(
    async (id: string) => {
      await service.deleteAssessment(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveWebhook = useCallback(
    async (w: WebhookSubscription) => {
      const res = await service.saveWebhook(w);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteWebhook = useCallback(
    async (id: string) => {
      await service.deleteWebhook(id);
      await refresh();
    },
    [service, refresh],
  );
  const enqueueWebhookTest = useCallback(
    async (id: string) => {
      const res = await service.enqueueWebhookTest(id);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const saveScript = useCallback(
    async (sc: Script) => {
      const res = await service.saveScript(sc);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteScript = useCallback(
    async (id: string) => {
      await service.deleteScript(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveForm = useCallback(
    async (f: BriefingForm) => {
      const res = await service.saveForm(f);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteForm = useCallback(
    async (id: string) => {
      await service.deleteForm(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveStatementLines = useCallback(
    async (lines: StatementLine[]) => {
      const res = await service.saveStatementLines(lines);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteStatementLine = useCallback(
    async (id: string) => {
      await service.deleteStatementLine(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveProject = useCallback(
    async (p: Project) => {
      const res = await service.saveProject(p);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteProject = useCallback(
    async (id: string) => {
      await service.deleteProject(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveSquad = useCallback(
    async (sq: Squad) => {
      const res = await service.saveSquad(sq);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteSquad = useCallback(
    async (id: string) => {
      await service.deleteSquad(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveHealthWeights = useCallback(
    async (w: HealthWeights) => {
      await service.saveHealthWeights(w);
      await refresh();
    },
    [service, refresh],
  );
  const saveDossierTemplate = useCallback(
    async (t: DossierTemplate) => {
      const res = await service.saveDossierTemplate(t);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const saveDossier = useCallback(
    async (d: Dossier) => {
      const res = await service.saveDossier(d);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const savePlan = useCallback(
    async (p: MonthlyPlan) => {
      const res = await service.savePlan(p);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deletePlan = useCallback(
    async (id: string) => {
      await service.deletePlan(id);
      await refresh();
    },
    [service, refresh],
  );
  const savePautaItems = useCallback(
    async (items: PautaItem[]) => {
      const res = await service.savePautaItems(items);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deletePautaItems = useCallback(
    async (ids: string[]) => {
      await service.deletePautaItems(ids);
      await refresh();
    },
    [service, refresh],
  );
  const saveIdea = useCallback(
    async (i: Idea) => {
      const res = await service.saveIdea(i);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteIdea = useCallback(
    async (id: string) => {
      await service.deleteIdea(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveCrmTask = useCallback(
    async (t: CrmTask) => {
      const res = await service.saveCrmTask(t);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteCrmTask = useCallback(
    async (id: string) => {
      await service.deleteCrmTask(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveBlock = useCallback(
    async (b: ContactBlock) => {
      const res = await service.saveBlock(b);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteBlock = useCallback(
    async (id: string) => {
      await service.deleteBlock(id);
      await refresh();
    },
    [service, refresh],
  );

  // ── Orquestrador venda → operação (spec 10) ────────────────
  /**
   * The client accepts in their own browser, where nothing may touch the
   * agency's data. So the saga starts here, the next time the agency's app
   * has the proposal in front of it — the same catch-up shape the post
   * automations use. Each step records what it created, so running this
   * again never produces a second client, contract or billing series.
   */
  const buildSagaContext = useCallback((): SagaContext => {
    const db = {
      clients: clientsRef.current,
      calendars: calendarsRef.current,
      contracts: contractsRef.current,
    };
    return {
      resolveClient: async (proposal) => {
        if (proposal.clientId) return proposal.clientId;
        const name = (proposal.leadName ?? proposal.title).trim();
        const existing = db.clients.find(
          (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
        );
        // Same name is only a hint, never a merge — but with nothing else to
        // go on it is the best available, and the spec allows the suggestion.
        if (existing) return existing.id;
        const { client } = await service.createClient({ name });
        return client.id;
      },
      generateContract: async (proposal, clientId) => {
        const client = db.clients.find((c) => c.id === clientId);
        const totals = proposalTotals(proposal.items);
        const text = [
          `CONTRATO DE PRESTAÇÃO DE SERVIÇOS`,
          ``,
          `CONTRATANTE: ${client?.name ?? proposal.leadName ?? ""}`,
          `CONTRATADA: ${session?.name ?? "Agência"}`,
          ``,
          `Serviços contratados, conforme a proposta ${proposal.number ?? proposal.title}:`,
          ...proposal.items.map((i) => `- ${i.description} (${BILLING_LABEL[i.billing]})`),
          ``,
          `Valor recorrente: ${formatMoney(totals.recurringMonthly)} por mês.`,
          `Valor único: ${formatMoney(totals.oneOff)}.`,
        ].join("\n");

        const contract: Contract = {
          id: uid("ctr"),
          clientId,
          proposalId: proposal.id,
          title: `Contrato — ${proposal.title}`,
          status: "aguardando_partes",
          finalText: text,
          textHash: await hashText(text),
          startsOn: todayISO(),
          autoRenew: true,
          renewNoticeDays: DEFAULT_RENEW_NOTICE_DAYS,
          parties: [
            {
              id: uid("party"),
              role: "contratante",
              name: client?.name ?? proposal.leadName ?? "Contratante",
              order: 0,
              required: true,
              token: shareToken(),
            },
            {
              id: uid("party"),
              role: "contratada",
              name: session?.name ?? "Agência",
              order: 1,
              required: true,
              token: shareToken(),
            },
          ],
          signatures: [],
          createdAt: new Date().toISOString(),
        };
        await service.saveContract(contract);
        return contract.id;
      },
      isContractEffective: (contractId) => {
        const contract = contractsRef.current.find((c) => c.id === contractId);
        return Boolean(contract && isEffective(contract));
      },
      activateServices: async (proposal) => proposal.items.map((i) => i.id),
      createBilling: async (proposal, clientId) => {
        const ids: string[] = [];
        for (const item of proposal.items) {
          const total = Math.round(item.quantity * item.unitPrice);
          const recurring = isRecurring(item.billing);
          const months =
            item.billing === "trimestral"
              ? 3
              : item.billing === "semestral"
                ? 6
                : item.billing === "anual"
                  ? 12
                  : 1;
          const id = uid("ser");
          await service.saveSeries({
            id,
            kind: recurring ? "recorrente" : "parcelada",
            everyMonths: recurring ? months : 1,
            dayOfMonth: 5,
            count: recurring
              ? undefined
              : Math.max(2, proposal.payment?.installments ?? 2),
            totalAmount: total,
            startDate: todayISO(),
            nature: "receita",
            description: `${item.description} — ${proposal.title}`,
            clientId,
            createdAt: new Date().toISOString(),
          });
          ids.push(id);
        }
        return ids;
      },
      ensureBoard: async (clientId) => {
        const calendar = calendarsRef.current.find((c) => c.clientId === clientId);
        return calendar?.id ?? "";
      },
      /**
       * One contract, one project (ficha 14). The contract id is the key, so
       * a retry finds the project it already opened instead of a second one.
       */
      ensureProject: async (proposal, clientId, contractId) => {
        const existing = projectsRef.current.find((p) => p.contractId === contractId);
        if (existing) return existing.id;
        const totals = proposalTotals(proposal.items);
        const project = projectFromContract(
          clientId,
          contractId,
          proposal.title.trim() || "Projeto",
          // O valor do projeto é o compromisso do primeiro ano: é o que o
          // contrato de fato vale, e é por ele que a margem faz sentido.
          totals.firstYear,
        );
        const saved = await service.saveProject(project);
        return saved.id;
      },
      markDealWon: async (dealId) => {
        const deal = dealsRef.current.find((d) => d.id === dealId);
        if (!deal) return;
        await service.saveDeal({ ...deal, status: "ganho" });
      },
    };
  }, [service, session]);

  const runningSaga = useRef(false);
  const runPendingProcesses = useCallback(async () => {
    if (runningSaga.current) return;
    runningSaga.current = true;
    try {
      const ctx = buildSagaContext();
      const starting = proposalsAwaitingProcess(proposalsRef.current, processesRef.current);
      const toRun: ContractingProcess[] = [
        ...starting.map((p) => {
          const deal = dealsRef.current.find((d) => d.proposalId === p.id);
          return newProcess(p, deal?.id);
        }),
        ...processesRef.current.filter(isActionable),
      ];
      if (toRun.length === 0) return;

      let changed = false;
      for (const process of toRun) {
        const proposal = proposalsRef.current.find((p) => p.id === process.proposalId);
        if (!proposal) continue;
        const next = await advanceProcess(process, proposal, ctx);
        // Only write when something actually moved. A waiting process is
        // re-checked on every load, and saving an identical row would reload
        // the app, which would check again, forever.
        if (next === process) continue;
        await service.saveProcess(next);
        changed = true;
      }
      if (changed) await refresh();
    } catch (err) {
      console.error("Falha no processo de contratação", err);
    } finally {
      runningSaga.current = false;
    }
  }, [buildSagaContext, service, refresh]);

  const retryProcess = useCallback(
    async (id: string) => {
      const process = processesRef.current.find((p) => p.id === id);
      const proposal = process && proposalsRef.current.find((p) => p.id === process.proposalId);
      if (!process || !proposal) throw new Error("Processo não encontrado.");
      const next = await advanceProcess(process, proposal, buildSagaContext());
      await service.saveProcess(next);
      await refresh();
    },
    [buildSagaContext, service, refresh],
  );

  // Start or resume whenever the data the saga reads has changed.
  useEffect(() => {
    if (!session || loading) return;
    void runPendingProcesses();
  }, [session, loading, proposals, processes, contracts, runPendingProcesses]);

  // ── Financeiro ─────────────────────────────────────────────
  // Thin pass-throughs: every rule lives in finance.ts (pure, tested) or in
  // the database. Nothing is decided here beyond reloading afterwards.
  const saveAccount = useCallback(
    async (a: FinanceAccount) => {
      const res = await service.saveAccount(a);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteAccount = useCallback(
    async (id: string) => {
      await service.deleteAccount(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveCategory = useCallback(
    async (c: FinanceCategory) => {
      const res = await service.saveCategory(c);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteCategory = useCallback(
    async (id: string) => {
      await service.deleteCategory(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveEntry = useCallback(
    async (e: FinanceEntry) => {
      const res = await service.saveEntry(e);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteEntry = useCallback(
    async (id: string) => {
      await service.deleteEntry(id);
      await refresh();
    },
    [service, refresh],
  );
  const settleEntry = useCallback(
    async (id: string, accountId: string, date: string) => {
      const res = await service.settleEntry(id, accountId, date);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const unsettleEntry = useCallback(
    async (id: string) => {
      const res = await service.unsettleEntry(id);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const reverseEntry = useCallback(
    async (id: string) => {
      const res = await service.reverseEntry(id);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const saveSeries = useCallback(
    async (s: FinanceSeries) => {
      const res = await service.saveSeries(s);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteSeries = useCallback(
    async (id: string) => {
      await service.deleteSeries(id);
      await refresh();
    },
    [service, refresh],
  );
  const materialiseSeries = useCallback(async () => {
    const count = await service.materialiseSeries();
    if (count > 0) await refresh();
    return count;
  }, [service, refresh]);
  const saveTransfer = useCallback(
    async (t: Transfer) => {
      const res = await service.saveTransfer(t);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteTransfer = useCallback(
    async (id: string) => {
      await service.deleteTransfer(id);
      await refresh();
    },
    [service, refresh],
  );

  // ── Comercial (catálogo, propostas, contratos) ─────────────
  const createService = useCallback(
    async (input: Omit<Service, "id" | "createdAt">) => {
      const res = await service.createService(input);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const updateService = useCallback(
    async (id: string, patch: Partial<Service>) => {
      const res = await service.updateService(id, patch);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteService = useCallback(
    async (id: string) => {
      await service.deleteService(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveProposal = useCallback(
    async (proposal: Proposal) => {
      const res = await service.saveProposal(proposal);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const sendProposal = useCallback(
    async (id: string) => {
      const res = await service.sendProposal(id);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteProposal = useCallback(
    async (id: string) => {
      await service.deleteProposal(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveContract = useCallback(
    async (contract: Contract) => {
      const res = await service.saveContract(contract);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const deleteContract = useCallback(
    async (id: string) => {
      await service.deleteContract(id);
      await refresh();
    },
    [service, refresh],
  );

  // ── Agenda ─────────────────────────────────────────────────
  const createAppointment = useCallback(
    async (input: Omit<Appointment, "id" | "createdAt">) => {
      const res = await service.createAppointment(input);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  const updateAppointment = useCallback(
    async (id: string, patch: Partial<Appointment>) => {
      const res = await service.updateAppointment(id, patch);
      await refresh();
      return res;
    },
    [service, refresh],
  );
  /** The spec allows only marcado → cancelado; nothing is ever deleted. */
  const cancelAppointment = useCallback(
    async (id: string) => {
      await service.updateAppointment(id, { status: "cancelado" });
      await refresh();
    },
    [service, refresh],
  );
  const addMarkedDate = useCallback(
    async (date: MarkedDate) => {
      await service.addMarkedDate(date);
      await refresh();
    },
    [service, refresh],
  );
  const removeMarkedDate = useCallback(
    async (id: string) => {
      await service.removeMarkedDate(id);
      await refresh();
    },
    [service, refresh],
  );
  const saveBookingConfig = useCallback(
    async (input: {
      availability: Availability;
      page: Pick<BookingPage, "active" | "title" | "intro">;
    }) => {
      await service.saveBookingConfig(input);
      await refresh();
    },
    [service, refresh],
  );
  const regenerateBookingLink = useCallback(async () => {
    const page = await service.regenerateBookingLink();
    await refresh();
    return page;
  }, [service, refresh]);

  // ── Board columns (CRUD) ───────────────────────────────────
  const createStage = useCallback(
    async (input: Omit<BoardStage, "id">) => {
      const stage = await service.createBoardStage(input);
      await refresh();
      return stage;
    },
    [service, refresh],
  );
  const updateStage = useCallback(
    async (
      id: string,
      patch: Partial<Pick<BoardStage, "name" | "color" | "category" | "order">>,
    ) => {
      const stage = await service.updateBoardStage(id, patch);
      await refresh();
      return stage;
    },
    [service, refresh],
  );
  const deleteStage = useCallback(
    async (id: string) => {
      await service.deleteBoardStage(id);
      await refresh();
    },
    [service, refresh],
  );
  const reorderStages = useCallback(
    async (order: { id: string; order: number }[]) => {
      await service.reorderBoardStages(order);
      await refresh();
    },
    [service, refresh],
  );

  // ── Automation rules (CRUD) ────────────────────────────────
  const createRule = useCallback(
    async (input: Omit<AutomationRule, "id" | "createdAt">) => {
      const rule = await service.createAutomationRule(input);
      await refresh();
      return rule;
    },
    [service, refresh],
  );
  const updateRule = useCallback(
    async (
      id: string,
      patch: Partial<Pick<AutomationRule, "active" | "trigger" | "action">>,
    ) => {
      const rule = await service.updateAutomationRule(id, patch);
      await refresh();
      return rule;
    },
    [service, refresh],
  );
  const deleteRule = useCallback(
    async (id: string) => {
      await service.deleteAutomationRule(id);
      await refresh();
    },
    [service, refresh],
  );
  const listRuns = useCallback(
    (calendarId: string, limit?: number) => service.listAutomationRuns(calendarId, limit),
    [service],
  );

  /**
   * Catch up on decisions the client took on their own.
   *
   * The share link is deliberately allowed to do nothing but record a
   * decision, so "ao aprovar → Publicado" cannot run at the moment the client
   * clicks. It runs here instead, the next time the agency's app has the
   * calendar in front of it. The execution log is what makes this safe to
   * repeat: a decision already acted on is skipped.
   */
  const attemptedKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!session || loading) return;
    const candidates = pendingReviewEvents(posts, automationRules, []).filter(
      (c) => !attemptedKeys.current.has(c.eventKey),
    );
    if (candidates.length === 0) return;

    let active = true;
    (async () => {
      try {
        const handled = await service.findAutomationRuns(candidates.map((c) => c.eventKey));
        if (!active) return;
        const todo = pendingReviewEvents(posts, automationRules, handled);
        for (const { event, eventKey } of todo) {
          // Claim it before firing: a re-render must not start it twice.
          attemptedKeys.current.add(eventKey);
          await fireAutomations(event, eventKey);
          if (!active) return;
        }
      } catch (err) {
        console.error("Falha ao recuperar decisões do cliente", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, loading, posts, automationRules, service, fireAutomations]);

  clientsRef.current = clients;
  calendarsRef.current = calendars;
  contractsRef.current = contracts;
  proposalsRef.current = proposals;
  processesRef.current = processes;
  dealsRef.current = deals;
  projectsRef.current = projects;

  const value: AppContextValue = {
    serviceName: service.name,
    loading,
    session,
    clients,
    calendars,
    posts,
    boardStages,
    automationRules,
    deals,
    interactions,
    crmTasks,
    ideas,
    plans,
    pautaItems,
    dossierTemplates,
    dossiers,
    projects,
    squads,
    statementLines,
    scripts,
    assessmentTemplates,
    assessments,
    saveAssessmentTemplate,
    saveAssessment,
    deleteAssessment,
    webhooks,
    webhookDeliveries,
    saveWebhook,
    deleteWebhook,
    enqueueWebhookTest,
    forms,
    formResponses,
    saveScript,
    deleteScript,
    saveForm,
    deleteForm,
    healthWeights,
    saveStatementLines,
    deleteStatementLine,
    saveProject,
    deleteProject,
    saveSquad,
    deleteSquad,
    saveHealthWeights,
    saveDossierTemplate,
    saveDossier,
    savePlan,
    deletePlan,
    savePautaItems,
    deletePautaItems,
    saveIdea,
    deleteIdea,
    blocks,
    processes,
    accounts,
    categories,
    entries,
    series,
    transfers,
    services,
    proposals,
    contracts,
    appointments,
    bookings,
    markedDates,
    availability,
    bookingPage,
    getClient,
    getCalendar,
    getCalendarByClient,
    getClientForCalendar,
    postsForCalendar,
    rulesForCalendar,
    stagesForCalendar,
    login,
    logout,
    createClient,
    updateClient,
    regenerateShareToken,
    createPost,
    updatePost,
    reschedulePost,
    movePost,
    changeStatus,
    requestApproval,
    deletePost,
    restorePost,
    saveDeal,
    deleteDeal,
    addInteraction,
    saveCrmTask,
    deleteCrmTask,
    saveBlock,
    deleteBlock,
    retryProcess,
    saveAccount,
    deleteAccount,
    saveCategory,
    deleteCategory,
    saveEntry,
    deleteEntry,
    settleEntry,
    unsettleEntry,
    reverseEntry,
    saveSeries,
    deleteSeries,
    materialiseSeries,
    saveTransfer,
    deleteTransfer,
    createService,
    updateService,
    deleteService,
    saveProposal,
    sendProposal,
    deleteProposal,
    saveContract,
    deleteContract,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    addMarkedDate,
    removeMarkedDate,
    saveBookingConfig,
    regenerateBookingLink,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    createRule,
    updateRule,
    deleteRule,
    listRuns,
    refresh,
  };

  return (
    <AppContext.Provider value={value}>
      {loading ? (
        <div className="ce-app flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve ser usado dentro de <AppProvider>.");
  return ctx;
}
