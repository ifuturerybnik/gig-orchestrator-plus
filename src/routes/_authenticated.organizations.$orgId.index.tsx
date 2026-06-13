import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/organizations/$orgId/profile",
      params: { orgId: params.orgId },
    });
  },
});
