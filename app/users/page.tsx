import { LoadError } from "@/components/LoadError";
import { UsersView } from "@/components/UsersView";
import { requireSuperAdmin } from "@/lib/auth";
import { listBranches } from "@/lib/branches";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // Redirects a non-admin to the dashboard; the actions re-check as well.
  const admin = await requireSuperAdmin();

  const [users, branches] = await Promise.all([listUsers(), listBranches()]);
  if (users.status !== "ok") return <LoadError kind={users.status} />;
  if (branches.status !== "ok") return <LoadError kind={branches.status} />;

  return (
    <UsersView
      users={users.data}
      branches={branches.data}
      currentUserId={admin.id}
      currentUserIsOwner={admin.isOwner}
    />
  );
}
