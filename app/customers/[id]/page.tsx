import { CustomerDetailView } from "@/components/CustomerDetailView";
import { LoadError, NotFoundView } from "@/components/LoadError";
import { requireBranchUser } from "@/lib/auth";
import { getDeposit } from "@/lib/deposits";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: PageProps<"/customers/[id]">) {
  const user = await requireBranchUser();
  const { id } = await params;
  // Scoped to the caller's branch: another branch's id reads as "not found".
  const result = await getDeposit(id, user.branchId);

  if (result.status !== "ok") return <LoadError kind={result.status} />;
  if (!result.data) return <NotFoundView />;

  return <CustomerDetailView deposit={result.data} />;
}
