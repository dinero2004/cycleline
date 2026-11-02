"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  deleted: "Your account and everything in it has been deleted.",
};

/** One-off confirmation after a redirect (?account=deleted), then the query is removed. */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const message = MESSAGES[params.get("account") ?? ""];

  useEffect(() => {
    if (!message) return;
    toast.success(message);
    router.replace(window.location.pathname, { scroll: false });
  }, [message, router]);

  return null;
}
