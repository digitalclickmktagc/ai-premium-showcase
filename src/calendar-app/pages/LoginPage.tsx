import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "../store/AppProvider";

const DEMO_EMAIL =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() ||
  "admin@digitalclick.com";
const DEMO_PASSWORD =
  (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || "nexa2026";
const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL;

export default function LoginPage() {
  const { session, login, serviceName } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const [email, setEmail] = useState(IS_DEMO ? DEMO_EMAIL : "");
  const [password, setPassword] = useState(IS_DEMO ? DEMO_PASSWORD : "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/app", { replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo(a)!");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ce-app relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "var(--grad-aurora)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-nexa shadow-[var(--glow-md)]">
            <CalendarDays className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold">Calendário Editorial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso da agência
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@agencia.com"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>

          {IS_DEMO && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground/80">Modo demonstração</p>
              <p>
                Credenciais pré-preenchidas · dados salvos apenas neste
                navegador ({serviceName}).
              </p>
            </div>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          É cliente? Use o link exclusivo que a agência enviou.
        </p>
      </div>
    </div>
  );
}
