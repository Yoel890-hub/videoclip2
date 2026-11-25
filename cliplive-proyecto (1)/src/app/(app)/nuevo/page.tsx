import { requireUser, getProfile } from "@/lib/supabase";
import ClipConfig from "@/components/ClipConfig";
import { TRIALS } from "@/lib/plans";
import { isAdmin } from "@/lib/admin";
export default async function Nuevo({ searchParams }: { searchParams: Promise<{ origen?: string }> }) {
  const user = (await requireUser())!;
  const prof = await getProfile(user.id);
  const fromFile = (await searchParams).origen === "archivo";
  return <ClipConfig key={fromFile ? "file" : "url"} fromFile={fromFile} plan={prof!.plan} credits={prof!.credits} trialsLeft={Math.max(0, TRIALS - prof!.trials_used)} isAdmin={isAdmin(user)} />;
}
