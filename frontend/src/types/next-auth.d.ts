import type { DefaultSession } from "next-auth";
import type { FitnessLevel } from "@/types";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
      fitnessLevel: FitnessLevel;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    isAdmin: boolean;
    fitnessLevel: FitnessLevel;
    accessToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username: string;
    isAdmin: boolean;
    fitnessLevel: FitnessLevel;
    accessToken: string;
  }
}
