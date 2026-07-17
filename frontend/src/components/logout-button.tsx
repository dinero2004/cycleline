"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Sign out"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      <LogOut size={17} />
    </button>
  );
}
