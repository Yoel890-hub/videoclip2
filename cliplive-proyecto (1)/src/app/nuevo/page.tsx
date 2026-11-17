import { admin, requireUser } from "@/lib/supabase";
import ClipConfig from "@/components/ClipConfig";
export default async function Nuevo() {
  const user = (await requireUser())!;
  const { data: prof } = await admin().from("profiles").select("plan,credits").eq("id", user.id).single();
  return <ClipConfig plan={prof!.plan} credits={prof!.credits} />;
}
