"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BackendError, backendFetch } from "@/lib/backend";
import type { BikeType, FitnessLevel, NewsArticle, PlannerResult } from "@/types";

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

export async function updateProfileAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch("me", {
    method: "PATCH",
    token: session.accessToken,
    body: {
      username: formData.get("username"),
      email: formData.get("email"),
      bio: formData.get("bio"),
      fitness_level: formData.get("fitness_level"),
      weekly_distance_goal: Number(formData.get("weekly_distance_goal")),
      preferred_distance: Number(formData.get("preferred_distance")),
    },
  });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function addBikeAction(formData: FormData) {
  const session = await tokenOrRedirect();
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
  revalidatePath("/profile");
  revalidatePath("/planner");
}

export async function deleteBikeAction(formData: FormData) {
  const session = await tokenOrRedirect();
  await backendFetch(`bikes/${formData.get("bike_id")}`, {
    method: "DELETE",
    token: session.accessToken,
  });
  revalidatePath("/profile");
  revalidatePath("/planner");
}

export interface SaveRouteInput extends PlannerResult {
  name: string;
  description: string;
  startName: string;
  endName: string;
  start: [number, number];
  end: [number, number];
  difficulty: FitnessLevel;
  routeType: "one-way" | "round-trip";
  profile: BikeType;
  bikeId: number | null;
}

export async function saveRouteAction(input: SaveRouteInput): Promise<ActionState> {
  try {
    const session = await tokenOrRedirect();
    await backendFetch("routes", {
      method: "POST",
      token: session.accessToken,
      body: {
        bike_id: input.bikeId,
        name: input.name,
        description: input.description,
        start_name: input.startName,
        end_name: input.endName,
        start_lat: input.start[0],
        start_lng: input.start[1],
        end_lat: input.end[0],
        end_lng: input.end[1],
        distance_km: input.distanceKm,
        duration_minutes: input.durationMinutes,
        elevation_gain_m: input.elevationGainM,
        difficulty: input.difficulty,
        route_type: input.routeType,
        profile: input.profile,
        coordinates: input.coordinates,
      },
    });
    revalidatePath("/routes");
    revalidatePath("/dashboard");
    return { ok: true, message: "Route saved to your library." };
  } catch (error) {
    return actionError(error);
  }
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
