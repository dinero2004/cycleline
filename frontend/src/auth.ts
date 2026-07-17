import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { FitnessLevel } from "@/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    Credentials({
      credentials: {
        login: { label: "Username or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials.login || !credentials.password) {
          return null;
        }

        const response = await fetch(
          `${(process.env.BACKEND_URL ?? "http://127.0.0.1:8000/api").replace(/\/$/, "")}/auth/login`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              login: credentials.login,
              password: credentials.password,
            }),
          },
        );

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as {
          token: string;
          user: {
            id: number;
            username: string;
            email: string;
            fitness_level: FitnessLevel;
            is_admin: boolean;
          };
        };

        return {
          id: String(data.user.id),
          name: data.user.username,
          email: data.user.email,
          username: data.user.username,
          fitnessLevel: data.user.fitness_level,
          isAdmin: data.user.is_admin,
          accessToken: data.token,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.fitnessLevel = user.fitnessLevel;
        token.isAdmin = user.isAdmin;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.username = token.username as string;
      session.user.fitnessLevel = token.fitnessLevel as FitnessLevel;
      session.user.isAdmin = token.isAdmin as boolean;
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
});
