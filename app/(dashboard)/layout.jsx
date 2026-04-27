import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/ui/AppShell";

// Wraps every authenticated dashboard route (/ec, /gc, /gc/post, /gc/projects, …)
// in the shared sidebar shell so the look stays consistent across roles.
export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <AppShell role={profile?.role ?? "ec"} user={{ ...profile, email: user.email }}>
      {children}
    </AppShell>
  );
}
