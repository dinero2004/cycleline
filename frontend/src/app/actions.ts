"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { BackendError, backendFetch } from "@/lib/backend";
import { z } from "zod";
import { fitnessFor } from "@/lib/api";
import { latLng, preferences, rideProfile } from "@/lib/routing/schema";
import { routingService } from "@/lib/routing/service";
import { toBackendRoute, type StudioSaveInput } from "@/lib/studio";
import type { NewsArticle } from "@/types";

export interface ActionState {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

async function tokenOrRedirect() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect("/login");
  }
  return session;
}

function actionError(error: unknown): ActionState {
  if (error instanceof BackendError) {
    return { ok: false, message: error.message, errors: error.details };
  }
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await backendFetch("auth/register", {
      method: "POST",
      body: {
        email: formData.get("email"),
        username: formData.get("username"),
        password: formData.get("password"),
        password_confirmation: formData.get("password_confirmation"),
      },
    });
    return { ok: true, message: "Account created. You can sign in now." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await tokenOrRedirect();
  try {
    await backendFetch("me", {
      method: "PATCH",
      token: session.accessToken,
      body: {
        username: formData.get("username"),
        email: formData.get("email"),
        bio: formData.get("bio") || null,
        fitness_level: formData.get("fitness_level"),
        weekly_distance_goal: Number(formData.get("weekly_distance_goal")),
        preferred_distance: Number(formData.get("preferred_distance")),
      },
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}

export async function addBikeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await tokenOrRedirect();
  try {
    await backendFetch("bikes", {
      method: "POST",
      token: session.accessToken,
      body: {
        name: formData.get("name"),
        type: formData.get("type"),
        weight_kg: formData.get("weight_kg") || null,
        notes: formData.get("notes") || null,
        is_default: formData.get("is_default") === "on",
      },
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/profile");
  revalidatePath("/planner");
  return { ok: true, message: `${String(formData.get("name"))} is in your garage.` };
}

export async function setDefaultBikeAction(bikeId: number): Promise<ActionState> {
  const session = await tokenOrRedirect();
  try {
    await backendFetch(`bikes/${bikeId}`, { method: "PATCH", token: session.accessToken, body: { is_default: true } });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/profile");
  revalidatePath("/planner");
  return { ok: true, message: "Default bike changed." };
}

export async function deleteBikeAction(bikeId: number): Promise<ActionState> {
  const session = await tokenOrRedirect();
  try {
    await backendFetch(`bikes/${bikeId}`, { method: "DELETE", token: session.accessToken });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/profile");
  revalidatePath("/planner");
  return { ok: true, message: "Bike removed." };
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await tokenOrRedirect();
  try {
    await backendFetch("me/password", {
      method: "PUT",
      token: session.accessToken,
      body: {
        current_password: formData.get("current_password"),
        password: formData.get("password"),
        password_confirmation: formData.get("password_confirmation"),
      },
    });
  } catch (error) {
    return actionError(error);
  }
  return { ok: true, message: "Password changed. Other devices are signed out." };
}

export async function deleteAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await tokenOrRedirect();
  try {
    await backendFetch("me", { method: "DELETE", token: session.accessToken, body: { password: formData.get("password") } });
  } catch (error) {
    return actionError(error);
  }
  await signOut({ redirectTo: "/?account=deleted" });
  return { ok: true, message: "Account deleted." };
}

/** Saves (or updates, with routeId) a Route Studio route including its details. */
export async function saveStudioRouteAction(
  input: StudioSaveInput & { routeId?: number | null },
): Promise<ActionState & { routeId?: number }> {
  try {
    const session = await tokenOrRedirect();
    const body = toBackendRoute(input);
    const response = await backendFetch<{ route: { id: number } }>(input.routeId ? `routes/${input.routeId}` : "routes", {
      method: input.routeId ? "PATCH" : "POST",
      token: session.accessToken,
      body,
    });
    revalidatePath("/routes");
    revalidatePath("/dashboard");
    return { ok: true, message: input.routeId ? "Route updated." : "Route saved to your library.", routeId: response.route.id };
  } catch (error) {
    return actionError(error);
  }
}

const guestDrafts = z
  .array(
    z.object({
      id: z.string().max(40),
      name: z.string().max(120).default(""),
      profile: rideProfile,
      preferences,
      waypoints: z.array(z.object({ point: latLng, label: z.string().max(200).optional() })).min(2).max(25),
    }),
  )
  .max(10);

/**
 * Imports guest demo drafts into the signed-in account. Each draft's plan is routed again on the
 * server (nothing computed in the browser is trusted). Returns the ids that were saved so the
 * browser deletes only those; drafts that fail stay on the device.
 */
export async function importGuestDraftsAction(input: unknown): Promise<ActionState & { imported: string[] }> {
  const session = await tokenOrRedirect();
  const parsed = guestDrafts.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Those drafts could not be read.", imported: [] };
  const fitness = fitnessFor(session.user.fitnessLevel);
  const imported: string[] = [];
  for (const draft of parsed.data) {
    try {
      const route = await routingService().route({
        waypoints: draft.waypoints.map((w) => w.point),
        profile: draft.profile,
        preferences: draft.preferences,
        fitness,
      });
      const first = draft.waypoints[0];
      const last = draft.waypoints[draft.waypoints.length - 1];
      const label = (w: { point: [number, number]; label?: string }) => w.label ?? `${w.point[0].toFixed(4)}, ${w.point[1].toFixed(4)}`;
      await backendFetch("routes", {
        method: "POST",
        token: session.accessToken,
        body: toBackendRoute({
          name: draft.name.trim().length >= 3 ? draft.name.trim() : `Demo route ${imported.length + 1}`,
          startName: label(first),
          endName: label(last),
          bikeId: null,
          route,
          fitness,
        }),
      });
      imported.push(draft.id);
    } catch {
      // Left on the device; the rider can open it in the demo again.
    }
  }
  revalidatePath("/routes");
  revalidatePath("/dashboard");
  const left = parsed.data.length - imported.length;
  return {
    ok: imported.length > 0,
    message: imported.length
      ? `${imported.length} demo route${imported.length === 1 ? "" : "s"} moved to your library.${left ? ` ${left} couldn't be routed and stay in the demo.` : ""}`
      : "Your demo drafts couldn't be imported right now; they're still in the demo.",
    imported,
  };
}

export async function deleteRouteAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`routes/${formData.get("route_id")}`, {
    method: "DELETE",
    token: session.accessToken,
  });
  revalidatePath("/routes");
  revalidatePath("/dashboard");
}

export async function toggleFavoriteRouteAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`routes/${formData.get("route_id")}`, {
    method: "PATCH",
    token: session.accessToken,
    body: {
      is_favorite: formData.get("is_favorite") !== "true",
    },
  });
  revalidatePath("/routes");
  revalidatePath("/dashboard");
}

export async function adminUpdateUserAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`admin/users/${formData.get("user_id")}`, {
    method: "PATCH",
    token: session.accessToken,
    body: {
      fitness_level: formData.get("fitness_level"),
      is_admin: formData.get("is_admin") === "true",
    },
  });
  revalidatePath("/admin");
}

export async function adminResetDataAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`admin/users/${formData.get("user_id")}/reset-data`, {
    method: "POST",
    token: session.accessToken,
  });
  revalidatePath("/admin");
}

export async function adminResetPasswordAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`admin/users/${formData.get("user_id")}/reset-password`, {
    method: "POST",
    token: session.accessToken,
    body: {
      password: formData.get("password"),
      password_confirmation: formData.get("password_confirmation"),
    },
  });
  revalidatePath("/admin");
}

export async function adminDeleteUserAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`admin/users/${formData.get("user_id")}`, {
    method: "DELETE",
    token: session.accessToken,
  });
  revalidatePath("/admin");
}

export async function generateNewsDraftAction(input: {
  topic: string;
  category: string;
}): Promise<{ ok: boolean; message: string; draft?: Partial<NewsArticle> }> {
  try {
    const session = await tokenOrRedirect();
    const response = await backendFetch<{ draft: Partial<NewsArticle> }>("admin/news/generate-draft", {
      method: "POST",
      token: session.accessToken,
      body: input,
    });
    return { ok: true, message: "Draft generated.", draft: response.draft };
  } catch (error) {
    const result = actionError(error);
    return { ok: false, message: result.message };
  }
}

export interface NewsEditorInput {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  image_url: string;
  status: "draft" | "published";
}

export async function createNewsAction(input: NewsEditorInput): Promise<ActionState> {
  try {
    const session = await tokenOrRedirect();
    await backendFetch("admin/news", {
      method: "POST",
      token: session.accessToken,
      body: {
        ...input,
        image_url: input.image_url || null,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/news");
    return { ok: true, message: input.status === "published" ? "Article published." : "Draft saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateNewsAction(
  input: NewsEditorInput & { id: number },
): Promise<ActionState> {
  try {
    const session = await tokenOrRedirect();
    await backendFetch(`admin/news/${input.id}`, {
      method: "PATCH",
      token: session.accessToken,
      body: {
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        category: input.category,
        image_url: input.image_url || null,
        status: input.status,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/news");
    return { ok: true, message: "Ride Journal article updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteNewsAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`admin/news/${formData.get("article_id")}`, {
    method: "DELETE",
    token: session.accessToken,
  });
  revalidatePath("/admin");
  revalidatePath("/news");
}
