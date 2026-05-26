import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/organizations/new")({
  component: () => <Navigate to="/organizations" replace />,
});
