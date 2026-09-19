import { BranchesView } from "@/components/BranchesView";
import { LoadError } from "@/components/LoadError";
import { requireSuperAdmin } from "@/lib/auth";
import { listBranches } from "@/lib/branches";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  // Branch admins are redirected to their own dashboard.
  await requireSuperAdmin();

  const result = await listBranches();
  if (result.status !== "ok") return <LoadError kind={result.status} />;

  return <BranchesView branches={result.data} />;
}
