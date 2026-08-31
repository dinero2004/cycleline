import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const requireSession = cache(async () => {
  const session = await auth();

  if (!session?.user || !session.accessToken) {
    redirect("/login");
  }

  return session;
});
