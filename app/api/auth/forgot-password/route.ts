import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import ResetPasswordEmail from "@/app/emails/ResetPasswordEmail";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  normalizeEmail,
} from "@/app/(auth)/forgot-password/forgot-password-flow";
import { createRequestLogger, writeLog } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import {
  getRequiredEnv,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

export async function POST(req: Request) {
  const logger = createRequestLogger(req, {
    route: "api.auth.forgot-password.post",
  });

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const supabaseAdmin = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
    );

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: {
          redirectTo: `${getRequiredEnv("NEXTAUTH_URL")}/reset-password`,
        },
      });

    if (!linkError && linkData?.properties?.action_link) {
      const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
      const { error: emailError } = await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ??
          "Nexus Orchestrator <onboarding@resend.dev>",
        to: [normalizedEmail],
        subject: "Reset your Nexus Orchestrator password",
        react: await ResetPasswordEmail({
          email: normalizedEmail,
          resetLink: linkData.properties.action_link,
        }),
      });

      if (emailError) {
        writeLog(logger, "warn", "Failed to send password reset email", {
          email: normalizedEmail,
          emailError,
        });
      }
    } else if (linkError) {
      // Keep response generic so account existence cannot be inferred.
      writeLog(logger, "warn", "Password reset link generation failed", {
        email: normalizedEmail,
        error: linkError.message,
      });
    }

    return NextResponse.json(
      { message: FORGOT_PASSWORD_SUCCESS_MESSAGE },
      { status: 200 },
    );
  } catch (err: unknown) {
    return handleRouteError(err, {
      request: req,
      logger,
      fallbackMessage: "Internal server error",
    });
  }
}
