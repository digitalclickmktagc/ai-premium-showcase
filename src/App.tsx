import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AppProvider } from "./calendar-app/store/AppProvider";
import RequireAuth from "./calendar-app/components/RequireAuth";
import LoginPage from "./calendar-app/pages/LoginPage";
import DashboardPage from "./calendar-app/pages/DashboardPage";
import CalendarPage from "./calendar-app/pages/CalendarPage";
import ClientViewPage from "./calendar-app/pages/ClientViewPage";

const queryClient = new QueryClient();

/** Admin area — a single AppProvider wraps all admin routes so state persists. */
const AdminApp = () => (
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
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* Editorial calendar — admin area */}
          <Route path="/app/*" element={<AdminApp />} />
          {/* Editorial calendar — isolated client share view (token only) */}
          <Route path="/c/:token" element={<ClientViewPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
