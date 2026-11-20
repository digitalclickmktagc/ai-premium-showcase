import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AppProvider } from "./calendar-app/store/AppProvider";
import { ThemeProvider } from "./calendar-app/theme";
import RequireAuth from "./calendar-app/components/RequireAuth";
import LoginPage from "./calendar-app/pages/LoginPage";
import DashboardPage from "./calendar-app/pages/DashboardPage";
import AgendaPage from "./calendar-app/pages/AgendaPage";
import PublicBookingPage from "./calendar-app/pages/PublicBookingPage";
import CommercialPage from "./calendar-app/pages/CommercialPage";
import FinancePage from "./calendar-app/pages/FinancePage";
import CrmPage from "./calendar-app/pages/CrmPage";
import TodayPage from "./calendar-app/pages/TodayPage";
import IdeasPage from "./calendar-app/pages/IdeasPage";
import PautaPage from "./calendar-app/pages/PautaPage";
import DossierPage from "./calendar-app/pages/DossierPage";
import ProjectsPage from "./calendar-app/pages/ProjectsPage";
import PublicDossierPage from "./calendar-app/pages/PublicDossierPage";
import PublicProposalPage from "./calendar-app/pages/PublicProposalPage";
import PublicContractPage from "./calendar-app/pages/PublicContractPage";
import CalendarPage from "./calendar-app/pages/CalendarPage";
import ClientViewPage from "./calendar-app/pages/ClientViewPage";
import ClientHubPage from "./calendar-app/pages/ClientHubPage";

const queryClient = new QueryClient();

/**
 * Hash routing for standalone preview builds, where there is no server to
 * rewrite deep links onto index.html. Normal builds keep clean URLs.
 */
const Router = import.meta.env.VITE_ROUTER === "hash" ? HashRouter : BrowserRouter;

/** Admin area — a single AppProvider wraps all admin routes so state persists. */
const AdminApp = () => (
  <ThemeProvider>
    <AppProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          index
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="hoje"
          element={
            <RequireAuth>
              <TodayPage />
            </RequireAuth>
          }
        />
        <Route
          path="projetos"
          element={
            <RequireAuth>
              <ProjectsPage />
            </RequireAuth>
          }
        />
        <Route
          path="dossie"
          element={
            <RequireAuth>
              <DossierPage />
            </RequireAuth>
          }
        />
        <Route
          path="pauta"
          element={
            <RequireAuth>
              <PautaPage />
            </RequireAuth>
          }
        />
        <Route
          path="ideias"
          element={
            <RequireAuth>
              <IdeasPage />
            </RequireAuth>
          }
        />
        <Route
          path="crm"
          element={
            <RequireAuth>
              <CrmPage />
            </RequireAuth>
          }
        />
        <Route
          path="financeiro"
          element={
            <RequireAuth>
              <FinancePage />
            </RequireAuth>
          }
        />
        <Route
          path="comercial"
          element={
            <RequireAuth>
              <CommercialPage />
            </RequireAuth>
          }
        />
        <Route
          path="agenda"
          element={
            <RequireAuth>
              <AgendaPage />
            </RequireAuth>
          }
        />
        <Route
          path="calendars/:calendarId"
          element={
            <RequireAuth>
              <CalendarPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppProvider>
  </ThemeProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* Editorial calendar — admin area */}
          <Route path="/app/*" element={<AdminApp />} />
          {/* Proposal and contract, each reachable only by its own token */}
          <Route
            path="/p/:linkId"
            element={
              <ThemeProvider>
                <PublicProposalPage />
              </ThemeProvider>
            }
          />
          <Route
            path="/assinar/:token"
            element={
              <ThemeProvider>
                <PublicContractPage />
              </ThemeProvider>
            }
          />
          {/* Client's strategy page — read-only, token only */}
          <Route
            path="/estrategia/:token"
            element={
              <ThemeProvider>
                <PublicDossierPage />
              </ThemeProvider>
            }
          />
          {/* Public booking page — anonymous visitor, token only */}
          <Route
            path="/agendar/:linkId"
            element={
              <ThemeProvider>
                <PublicBookingPage />
              </ThemeProvider>
            }
          />
          {/* Editorial calendar — isolated client share view (token only) */}
          <Route
            path="/c/:token"
            element={
              <ThemeProvider>
                <ClientViewPage />
              </ThemeProvider>
            }
          />
          {/* Client hub — behind VITE_FEATURE_CLIENT_HUB, off by default */}
          <Route
            path="/c/:token/hub"
            element={
              <ThemeProvider>
                <ClientHubPage />
              </ThemeProvider>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
