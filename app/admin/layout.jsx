import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    // Not an admin — send them back to their dashboard.
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/verifications" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">⚡</div>
              <span className="font-black text-slate-900">SparkBid Admin</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/verifications" className="text-slate-700 hover:text-slate-900 font-medium">
                License verifications
              </Link>
            </nav>
          </div>
          <div className="text-sm text-slate-500">
            {profile.full_name}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
