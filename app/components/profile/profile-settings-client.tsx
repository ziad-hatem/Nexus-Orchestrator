"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Camera, Loader2, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { PasskeySettingsCard } from "@/app/components/profile/passkey-settings-card";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type ProfileSettingsClientProps = {
  organizationName: string;
  roleLabel: string;
  fallbackUser: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type ProfileResponse = {
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
  profile: {
    phone: string | null;
    title: string | null;
    department: string | null;
    bio: string | null;
    timezone: string | null;
    multiStepAuthEnabled: boolean;
  };
};

type ProfileFormState = {
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string;
  title: string;
  department: string;
  bio: string;
  timezone: string;
  multiStepAuthEnabled: boolean;
  newPassword: string;
};

function toFormState(
  payload: ProfileResponse | null,
  fallbackUser: ProfileSettingsClientProps["fallbackUser"],
): ProfileFormState {
  return {
    name: payload?.user.name ?? fallbackUser.name ?? "",
    email: payload?.user.email ?? fallbackUser.email ?? "",
    avatarUrl: payload?.user.avatar_url ?? fallbackUser.image ?? null,
    phone: payload?.profile.phone ?? "",
    title: payload?.profile.title ?? "",
    department: payload?.profile.department ?? "",
    bio: payload?.profile.bio ?? "",
    timezone: payload?.profile.timezone ?? "",
    multiStepAuthEnabled: payload?.profile.multiStepAuthEnabled ?? false,
    newPassword: "",
  };
}

export function ProfileSettingsClient({
  organizationName,
  roleLabel,
  fallbackUser,
}: ProfileSettingsClientProps) {
  const setProfile = useWorkspaceStore((state) => state.setProfile);
  const clearWorkspace = useWorkspaceStore((state) => state.clearWorkspace);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState(fallbackUser.email ?? "");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success" | "info";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<ProfileFormState>(
    toFormState(null, fallbackUser),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/me/profile", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ProfileResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load profile");
        }

        if (!isMounted) {
          return;
        }

        setForm(toFormState(payload, fallbackUser));
        setProfileUserId(payload.user.id);
        setFeedback({
          tone: "info",
          message: "Profile loaded. Review your details and save any updates.",
        });
        setProfile({
          name: payload.user.name,
          email: payload.user.email,
          avatarUrl: payload.user.avatar_url,
        });
        setDeleteEmail(payload.user.email);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [fallbackUser, setProfile]);

  const handleChange = <Key extends keyof ProfileFormState>(
    key: Key,
    value: ProfileFormState[Key],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          title: form.title,
          department: form.department,
          bio: form.bio,
          timezone: form.timezone,
          multiStepAuthEnabled: form.multiStepAuthEnabled,
          ...(form.newPassword ? { newPassword: form.newPassword } : {}),
        }),
      });

      const payload = (await response.json()) as ProfileResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update profile");
      }

      setForm((current) => ({
        ...current,
        ...toFormState(payload, fallbackUser),
        newPassword: "",
      }));
      setProfileUserId(payload.user.id);
      setProfile({
        name: payload.user.name,
        email: payload.user.email,
        avatarUrl: payload.user.avatar_url,
      });
      setDeleteEmail(payload.user.email);
      setFeedback({
        tone: "success",
        message: "Profile updated successfully.",
      });
      toast.success("Profile updated.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingAvatar(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/me/avatar", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        avatarUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.avatarUrl) {
        throw new Error(payload.error ?? "Failed to upload avatar");
      }

      setForm((current) => ({
        ...current,
        avatarUrl: payload.avatarUrl ?? current.avatarUrl,
      }));
      setProfile({
        name: form.name || null,
        email: form.email || null,
        avatarUrl: payload.avatarUrl ?? form.avatarUrl,
      });
      setFeedback({
        tone: "success",
        message: "Avatar updated successfully.",
      });
      toast.success("Avatar updated.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to upload avatar";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/me/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          email: deleteEmail,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete account");
      }

      toast.success("Account deleted.");
      clearWorkspace();
      await signOut({ callbackUrl: "/login" });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete account";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-[2rem] p-8">
        <div className="flex items-center gap-3 text-sm text-[var(--on-surface-variant)]" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <Avatar
              ariaLabel={`${form.name || form.email || "Current user"} profile image`}
              className="h-20 w-20 rounded-[1.75rem] shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
              email={form.email}
              fallbackClassName="bg-[rgba(255,255,255,0.18)] text-white"
              imageUrl={form.avatarUrl}
              name={form.name}
              textClassName="text-2xl font-bold"
            />
            <div>
              <p className="label-caps text-[rgba(255,255,255,0.72)]">Profile</p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
                {form.name || form.email}
              </h1>
              <p className="mt-2 text-sm text-[rgba(255,255,255,0.82)]">
                {roleLabel} at {organizationName}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl bg-[rgba(255,255,255,0.14)] text-white hover:bg-[rgba(255,255,255,0.22)]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Change avatar
                    </>
                  )}
                </Button>
                <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.12)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.82)]">
                  <ShieldCheck className="h-4 w-4" />
                  Verified workspace identity
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                aria-label="Upload a new profile image"
              />
            </div>
          </div>
        </div>
      </section>

      <form
        className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
        onSubmit={handleProfileSave}
        aria-busy={saving || uploadingAvatar || deletingAccount}
      >
        <div className="lg:col-span-2">
          <FormStatusMessage
            id="profile-form-status"
            message={feedback?.message}
            tone={feedback?.tone}
          />
        </div>
        <div className="space-y-8">
          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps">Identity and contact</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-name">
                  Full name
                </label>
                <Input
                  id="profile-name"
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  className="input-field border-0 shadow-none"
                  autoComplete="name"
                  aria-describedby="profile-form-status"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-email">
                  Email
                </label>
                <Input
                  id="profile-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  className="input-field border-0 shadow-none"
                  autoComplete="email"
                  aria-describedby="profile-form-status"
                />
              </div>
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-phone">
                  Phone
                </label>
                <Input
                  id="profile-phone"
                  value={form.phone}
                  onChange={(event) => handleChange("phone", event.target.value)}
                  className="input-field border-0 shadow-none"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-timezone">
                  Timezone
                </label>
                <Input
                  id="profile-timezone"
                  value={form.timezone}
                  onChange={(event) => handleChange("timezone", event.target.value)}
                  className="input-field border-0 shadow-none"
                  aria-describedby="profile-timezone-help profile-form-status"
                />
                <p id="profile-timezone-help" className="mt-2 text-xs text-[var(--on-surface-variant)]">
                  Use a timezone such as Africa/Cairo or America/New_York when possible.
                </p>
              </div>
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-title">
                  Job title
                </label>
                <Input
                  id="profile-title"
                  value={form.title}
                  onChange={(event) => handleChange("title", event.target.value)}
                  className="input-field border-0 shadow-none"
                />
              </div>
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-department">
                  Department
                </label>
                <Input
                  id="profile-department"
                  value={form.department}
                  onChange={(event) => handleChange("department", event.target.value)}
                  className="input-field border-0 shadow-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-bio">
                  Bio
                </label>
                <textarea
                  id="profile-bio"
                  value={form.bio}
                  onChange={(event) => handleChange("bio", event.target.value)}
                  className="min-h-32 w-full rounded-[1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps">Security</p>
            <div className="mt-6 grid gap-5">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="profile-password">
                  New password
                </label>
                <Input
                  id="profile-password"
                  type="password"
                  value={form.newPassword}
                  onChange={(event) => handleChange("newPassword", event.target.value)}
                  className="input-field border-0 shadow-none"
                  placeholder="Leave blank to keep the current password"
                  autoComplete="new-password"
                  aria-describedby="profile-password-help profile-form-status"
                />
                <p id="profile-password-help" className="mt-2 text-xs text-[var(--on-surface-variant)]">
                  Password changes require at least 8 characters.
                </p>
              </div>
              <label className="flex items-start gap-3 rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface)]">
                <input
                  type="checkbox"
                  checked={form.multiStepAuthEnabled}
                  onChange={(event) =>
                    handleChange("multiStepAuthEnabled", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] text-primary focus:ring-primary/20"
                />
                <span>
                  <span className="block font-semibold">Enable multi-step email verification</span>
                  <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
                    Require a one-time code during sign-in before the session is finalized.
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <PasskeySettingsCard
            userId={profileUserId}
            userName={form.name}
            userEmail={form.email}
          />

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps">Workspace context</p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Organization
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--on-surface)]">
                  {organizationName}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Access role
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--on-surface)]">
                  {roleLabel}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
                Use the organization switcher in the sidebar to change tenant context before reviewing audit data or managing members.
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps text-[var(--error)]">Danger zone</p>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="delete-email">
                  Confirm email
                </label>
                <Input
                  id="delete-email"
                  type="email"
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                  className="input-field border-0 shadow-none"
                />
              </div>
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="delete-confirmation">
                  Type DELETE
                </label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  className="input-field border-0 shadow-none"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting account...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </>
                )}
              </Button>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Account deletion is blocked while you are the final org admin in any organization.
              </p>
            </div>
          </section>
        </div>

        <div className="lg:col-span-2">
          <Button type="submit" className="premium-gradient min-h-11 rounded-xl px-6" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving profile...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Save profile changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
