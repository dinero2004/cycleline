export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type BikeType = "road" | "gravel" | "mountain" | "city" | "electric" | "touring";

export interface Bike {
  id: number;
  user_id: number;
  name: string;
  type: BikeType;
  weight_kg: string | null;
  is_default: boolean;
  notes: string | null;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  fitness_level: FitnessLevel;
  weekly_distance_goal: number;
  preferred_distance: number;
  is_admin: boolean;
  routes_count: number;
  bikes: Bike[];
  created_at: string;
}

export interface SavedRoute {
  id: number;
  user_id: number;
  bike_id: number | null;
  bike?: Pick<Bike, "id" | "name" | "type"> | null;
  name: string;
  description: string | null;
  start_name: string;
  end_name: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  distance_km: string;
  duration_minutes: number;
  elevation_gain_m: number;
  difficulty: FitnessLevel;
  route_type: "one-way" | "round-trip";
  profile: BikeType;
  coordinates: [number, number][];
  is_favorite: boolean;
  created_at: string;
}

export interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  image_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  author?: { id: number; username: string };
}

export interface RouteSuggestion {
  id: string;
  title: string;
  start_name: string;
  end_name: string;
  start: [number, number];
  end: [number, number];
  distance_km: number;
  difficulty: FitnessLevel;
  surface: string;
}

export interface AdminUser extends UserProfile {
  bikes_count: number;
}

export interface AdminStats {
  users: number;
  routes: number;
  distance_km: number;
  bikes: number;
  published_articles: number;
}

export interface PlannerResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  elevationGainM: number;
}
