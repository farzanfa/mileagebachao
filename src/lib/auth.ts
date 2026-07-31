// NextAuth v5 (Auth.js) configuration (AUTHMOD slice; BUILD-CONTRACT §11, §4).
//
// Identity is email magic-link + Google OAuth — no phone-OTP (memo A.9 / final-api.md §7.4).
// Everything is lazy and gated so NOTHING throws at import/build time when secrets are unset
// (contract §2): providers are only registered when their env is present, the session strategy
// is JWT (no NextAuth DB adapter, so browsing works with zero infra), and AUTH_SECRET is read
// lazily by NextAuth at request time. Admin role is derived from ADMIN_EMAILS.

import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

import { SITE_NAME } from "@/lib/constants";
import { adminEmails } from "@/lib/env";

function hasGoogle(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
function hasEmail(): boolean {
  return Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
}

/** True when `email` is in the configured ADMIN_EMAILS allow-list (case-insensitive). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// Email magic-link provider defined WITHOUT importing next-auth's nodemailer provider, so the
// app builds & typechecks with the contract's pinned deps (nodemailer is not listed). `nodemailer`
// is an optional runtime dependency resolved lazily inside sendVerificationRequest; FOUNDATION
// owns package.json and would add it when SMTP delivery is switched on. The provider is only
// registered when EMAIL_SERVER is configured, and the magic-link flow additionally needs a
// NextAuth database Adapter (a runtime/infra concern) to persist verification tokens.
function emailMagicLinkProvider(): Provider {
  return {
    id: "email",
    name: "Email",
    type: "email",
    from: process.env.EMAIL_FROM ?? "no-reply@octanefinder.in",
    server: process.env.EMAIL_SERVER ?? "",
    maxAge: 15 * 60, // 15-minute single-use magic link (final-api.md §7.4)
    options: {},
    async sendVerificationRequest(params: {
      identifier: string;
      url: string;
      provider: { from?: string; server?: string };
    }): Promise<void> {
      // Computed specifier => the bundler treats nodemailer as an external, runtime-only
      // require; a missing package fails here at send time, never at build time.
      const specifier = ["node", "mailer"].join("");
      const nm = (await import(specifier)) as {
        createTransport(server: string): {
          sendMail(message: {
            to: string;
            from: string;
            subject: string;
            text: string;
            html: string;
          }): Promise<unknown>;
        };
      };
      const transport = nm.createTransport(params.provider.server ?? "");
      await transport.sendMail({
        to: params.identifier,
        from: params.provider.from ?? "no-reply@octanefinder.in",
        subject: `Sign in to ${SITE_NAME}`,
        text:
          `Sign in to ${SITE_NAME}\n\n${params.url}\n\n` +
          "This link is single-use and expires in 15 minutes. If you did not request it, ignore this email.",
        html:
          `<p>Sign in to <strong>${SITE_NAME}</strong>.</p>` +
          `<p><a href="${params.url}">Click here to sign in</a>.</p>` +
          "<p>This link is single-use and expires in 15 minutes. If you did not request it, ignore this email.</p>",
      });
    },
  } as unknown as Provider;
}

function buildProviders(): Provider[] {
  const providers: Provider[] = [];
  if (hasGoogle()) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID as string,
        clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
      }),
    );
  }
  if (hasEmail()) {
    providers.push(emailMagicLinkProvider());
  }
  return providers;
}

export const authConfig: NextAuthConfig = {
  trustHost: true, // required behind the DO App Platform proxy; harmless locally
  secret: process.env.AUTH_SECRET, // read lazily; unset => no session (no throw at import)
  session: { strategy: "jwt" },
  providers: buildProviders(),
  callbacks: {
    // Derive the admin flag from ADMIN_EMAILS and surface it on the session (contract §4).
    session({ session, token }) {
      if (session.user) {
        const tokenEmail = typeof token?.email === "string" ? token.email : null;
        const email = tokenEmail ?? session.user.email ?? null;
        (session.user as { isAdmin?: boolean }).isAdmin = isAdminEmail(email);
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
