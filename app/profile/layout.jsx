import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/ui/AppShell";

export default async function ProfileLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  return (
    <AppShell role={profile?.role ?? "ec"} user={{ ...profile, email: user.email }}>
      {children}
    </AppShell>
  );
}
