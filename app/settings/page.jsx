"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/ui/LogoutButton";

const NOTIFICATION_SETTINGS = [
  {
    id: "new_projects",
    label: "New project alerts",
    desc: "Get notified when projects match your skills and area",
    ecOnly: true,
  },
  {
    id: "bid_updates",
    label: "Bid status updates",
    desc: "When you're outbid, winning, or a job is awarded",
    ecOnly: true,
  },
  {
    id: "new_bids",
    label: "Incoming bids",
    desc: "When electricians submit bids on your projects",
    gcOnly: true,
  },
  {
    id: "bid_deadline",
    label: "Bid deadline reminders",
    desc: "24-hour reminder before your project deadlines close",
    gcOnly: true,
  },
  {
    id: "messages",
    label: "Messages",
    desc: "From contractors and clients on the platform",
    ecOnly: false,
    gcOnly: false,
  },
  {
    id: "marketing",
    label: "Tips & product updates",
    desc: "Helpful bidding tips and new SparkBid features",
    ecOnly: false,
    gcOnly: false,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [role, setRole] = useState("ec");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  // Notification toggles — default all on
  const [notifications, setNotifications] = useState({
    new_projects: true,
    bid_updates: true,
    new_bids: true,
    bid_deadline: true,
    messages: true,
    marketing: false,
  });

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      setRole(profile?.role ?? "ec");
      setFullName(profile?.full_name ?? "");
      setLoading(false);
    }
    load();
  }, [router]);

  function toggleNotification(id) {
    setNotifications((prev) => ({ ...prev, [id]: !prev[id] }));
    // Flash saved indicator
    setSaved(false);
  }

  async function saveNotifications() {
    setSaving(true);
    // In a full app you'd persist these to the DB
    // For now we'll just show the saved state
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    }
    setPasswordSaving(false);
  }

  const visibleNotifications = NOTIFICATION_SETTINGS.filter((n) => {
    if (n.ecOnly && role !== "ec") return false;
    if (n.gcOnly && role !== "gc") return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-3xl animate-pulse">⚡</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* Header */}
      <header className="bg-[#0F2B46] px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push("/profile")} className="text-slate-400 font-semibold text-sm">
          ← Back
        </button>
        <span className="font-display font-black text-white text-lg">Settings</span>
      </header>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-5">

        {/* ── Account ── */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-xs font-black text-slate-400 tracking-wide px-5 pt-5 pb-3">ACCOUNT</p>

          {/* User info */}
          <div className="px-5 pb-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0F2B46] flex items-center justify-center shrink-0">
              <span className="text-amber-400 font-black text-lg">
                {fullName?.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div>
              <p className="font-black text-slate-800">{fullName}</p>
              <p className="text-slate-400 text-sm">{email}</p>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                {role === "ec" ? "⚡ Electrician" : "🏗️ General Contractor"}
              </span>
            </div>
          </div>

          <div className="h-px bg-slate-100 mx-5" />

          {/* Edit profile link */}
          <button
            onClick={() => router.push("/profile/edit")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">✏️</span>
              <div className="text-left">
                <p className="font-semibold text-slate-700 text-sm">Edit Profile</p>
                <p className="text-slate-400 text-xs">Name, company, specialties, location</p>
              </div>
            </div>
            <span className="text-slate-300 text-xl">›</span>
          </button>

          <div className="h-px bg-slate-100 mx-5" />

          {/* Password */}
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔒</span>
              <div className="text-left">
                <p className="font-semibold text-slate-700 text-sm">Change Password</p>
                <p className="text-slate-400 text-xs">Update your login password</p>
              </div>
            </div>
            <span className="text-slate-300 text-xl">{showPasswordForm ? "↑" : "›"}</span>
          </button>

          {/* Password form */}
          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="px-5 pb-5 space-y-3">
              {passwordError && (
                <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-green-700 text-sm bg-green-50 rounded-xl px-3 py-2">✅ Password updated!</p>
              )}
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min. 8 characters)"
                className={inputClass}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={passwordSaving}
                className="w-full bg-[#0F2B46] text-white font-bold py-3 rounded-xl text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>

        {/* ── Notifications ── */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="text-xs font-black text-slate-400 tracking-wide">NOTIFICATIONS</p>
            <button
              onClick={saveNotifications}
              disabled={saving}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                saved
                  ? "bg-green-50 text-green-600"
                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              {saving ? "Saving..." : saved ? "✅ Saved" : "Save"}
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleNotifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 pr-4">
                  <p className="font-semibold text-slate-700 text-sm">{n.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{n.desc}</p>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => toggleNotification(n.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    notifications[n.id] ? "bg-green-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifications[n.id] ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── App Preferences ── */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-xs font-black text-slate-400 tracking-wide px-5 pt-5 pb-3">APP</p>
          <div className="divide-y divide-slate-100">
            {[
              { icon: "⭐", label: "Rate SparkBid", desc: "Enjoying the app? Leave us a review", action: () => {} },
              { icon: "📣", label: "Share SparkBid", desc: "Invite other contractors to join", action: () => {} },
              { icon: "❓", label: "Help & FAQ",     desc: "Get answers to common questions",  action: () => {} },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div className="text-left">
                    <p className="font-semibold text-slate-700 text-sm">{item.label}</p>
                    <p className="text-slate-400 text-xs">{item.desc}</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-white rounded-2xl p-5 space-y-3">
          <p className="text-xs font-black text-slate-400 tracking-wide">ACCOUNT ACTIONS</p>
          <LogoutButton />
          <button
            onClick={() => {
              if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
                // Placeholder — would call a delete API route
                alert("Please contact support to delete your account.");
              }
            }}
            className="w-full text-red-400 font-semibold text-sm py-2 hover:text-red-600 transition-colors"
          >
            Delete Account
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-slate-400 text-xs pb-2">SparkBid v0.1 · Built with ⚡</p>
      </div>
    </div>
  );
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm";
