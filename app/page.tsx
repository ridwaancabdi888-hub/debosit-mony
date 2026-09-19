import { DashboardView } from "@/components/DashboardView";
import { LoadError } from "@/components/LoadError";
import { requireBranchUser } from "@/lib/auth";
import { listDeposits } from "@/lib/deposits";

// Always read live figures; the dashboard must reflect the latest mutation.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Sends a super admin to /branches: it never sees a branch's figures.
  const user = await requireBranchUser();
  const result = await listDeposits(user.branchId);
  if (result.status !== "ok") return <LoadError kind={result.status} />;
  return <DashboardView deposits={result.data} />;
}
