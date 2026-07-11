import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinRedeemer } from "@/components/JoinRedeemer";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);

  return <JoinRedeemer code={code} />;
}
