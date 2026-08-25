import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Calendar,
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

  // selectors
  getClient: (id: string) => Client | undefined;
  getCalendar: (id: string) => Calendar | undefined;
  getCalendarByClient: (clientId: string) => Calendar | undefined;
  getClientForCalendar: (calendarId: string) => Client | undefined;
  postsForCalendar: (calendarId: string, filter?: PostFilter) => Post[];

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
  deletePost: (id: string) => Promise<Post>;
  restorePost: (id: string, status?: PostStatus) => Promise<Post>;

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

  const refresh = useCallback(async () => {
    const db = await service.getDatabase();
    setClients(db.clients);
    setCalendars(db.calendars);
    setPosts(db.posts);
  }, [service]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  // Restore the real cursor on calendar routes (the landing page hides it).
  useEffect(() => {
    document.body.classList.add("calendar-route");
    return () => document.body.classList.remove("calendar-route");
  }, []);

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

  // ── auth ───────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      const s = await service.login(email, password);
      setSession(s);
    },
    [service],
  );
  const logout = useCallback(() => {
    service.logout();
    setSession(null);
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
  const updatePost = useCallback(
    async (id: string, patch: UpdatePostInput) => {
      const res = await service.updatePost(id, patch);
      await refresh();
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

  const value: AppContextValue = {
    serviceName: service.name,
    loading,
    session,
    clients,
    calendars,
    posts,
    getClient,
    getCalendar,
    getCalendarByClient,
    getClientForCalendar,
    postsForCalendar,
    login,
    logout,
    createClient,
    updateClient,
    regenerateShareToken,
    createPost,
    updatePost,
    reschedulePost,
    deletePost,
    restorePost,
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
