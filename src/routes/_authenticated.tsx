import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ConsentGate } from "@/components/consent-gate";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" />;
  }
  return (
    <ConsentGate>
      <Outlet />
    </ConsentGate>
  );
}
