"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/app/actions";

/** Shows a server action's result as a toast once; field errors stay with their fields. */
export function useActionToast(state: ActionState, onSuccess?: () => void) {
  const success = useRef(onSuccess);
  useEffect(() => {
    success.current = onSuccess;
  });
  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      success.current?.();
    } else if (!state.errors) {
      toast.error(state.message);
    }
  }, [state]);
}
