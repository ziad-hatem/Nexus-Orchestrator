import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import VerificationEmail from "@/app/emails/VerificationEmail";
import { createRequestLogger, writeLog } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { safeRedirectPath } from "@/lib/redirect-path";
import {
  getRequiredEnv,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

export async function POST(req: Request) {
  const logger = createRequestLogger(req, {
    route: "api.auth.register.post",
  });

  try {
    const { email, password, firstName, lastName, company, next } =
      await req.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Please fill out all required fields" },
        { status: 400 },
      );
    }

    const redirectPath = safeRedirectPath(next) ?? "/";
    const verificationUrl = new URL("/login", getRequiredEnv("NEXTAUTH_URL"));
    verificationUrl.searchParams.set("verified", "true");
    if (redirectPath !== "/") {
      verificationUrl.searchParams.set("next", redirectPath);
    }

    const supabaseAdmin = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
    );

    // Generate a signup link via the Supabase Admin API to use with Resend
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company: company || "",
            registered_via_nexusorchestrator: true,
          },
          redirectTo: verificationUrl.toString(),
        },
      });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    const verificationLink = linkData.properties.action_link;

    // Try sending email if registration link was generated successfully
    try {
      const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
      const { error: emailError } = await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ??
          "Nexus Orchestrator <onboarding@resend.dev>",
        to: [email],
        subject: "Verify your Nexus Orchestrator account",
        react: await VerificationEmail({ email, firstName, verificationLink }),
      });

      if (emailError) {
        writeLog(logger, "warn", "Failed to send verification email", {
          email,
          emailError,
        });
      }
    } catch (emailException) {
      writeLog(logger, "warn", "Verification email delivery threw an exception", {
        email,
        error: emailException instanceof Error
          ? {
              name: emailException.name,
              message: emailException.message,
              stack: emailException.stack,
            }
          : String(emailException),
      });
    }

    return NextResponse.json(
      { message: "User created successfully", user: linkData.user },
      { status: 201 },
    );
  } catch (err: unknown) {
    return handleRouteError(err, {
      request: req,
      logger,
      fallbackMessage: "Internal server error",
    });
  }
}
