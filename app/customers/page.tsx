import { CustomersView } from "@/components/CustomersView";
import { LoadError } from "@/components/LoadError";
import { requireBranchUser } from "@/lib/auth";
import { listDeposits } from "@/lib/deposits";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireBranchUser();
  const result = await listDeposits(user.branchId);
  if (result.status !== "ok") return <LoadError kind={result.status} />;
  return <CustomersView deposits={result.data} />;
}
