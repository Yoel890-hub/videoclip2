import { admin, requireUser } from "@/lib/supabase";
import ClipConfig from "@/components/ClipConfig";
import { TRIALS } from "@/lib/plans";
import { isAdmin } from "@/lib/admin";
export default async function Nuevo() {
  const user = (await requireUser())!;
  const { data: prof } = await admin().from("profiles").select("plan,credits,trials_used").eq("id", user.id).single();
  return <ClipConfig plan={prof!.plan} credits={prof!.credits} trialsLeft={Math.max(0, TRIALS - prof!.trials_used)} isAdmin={isAdmin(user.email)} />;
}
