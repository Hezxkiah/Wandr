export type RouteInstruction = {
  text?: string;
  distance?: number;
  time?: number;
  street_name?: string;
  interval?: [number, number];
  sign?: number;
};

export type WandrRoute = {
  type: "Feature";
  id: string;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: {
    rank: number;
    mode: "point_to_point" | "round_trip";
    vibe: "serenity" | "discovery";
    target_minutes: number;
    distance_meters: number;
    duration_minutes: number;
    target_difference_minutes: number;
    within_time_limit: boolean;
    points: number;
    low_traffic_percent: number | null;
    walk_score?: number | null;
    scenery?: { score: number; nearby_percent: Record<string, number> } | null;
    instructions: RouteInstruction[];
  };
};

export type RouteCollection = {
  type: "FeatureCollection";
  features: WandrRoute[];
  properties: {
    mode: "point_to_point" | "round_trip";
    target_minutes: number;
    requested_routes: number;
    returned_routes: number;
  };
};

export const ROUTES_STORAGE_KEY = "wandr:route-options";
export const SELECTED_ROUTE_STORAGE_KEY = "wandr:selected-route";

// Also calculate for routes saved before the backend introduced walk_score.
export function walkScore(route: WandrRoute): number | null {
  const { scenery, low_traffic_percent: quiet } = route.properties;
  if (route.properties.walk_score !== undefined) return route.properties.walk_score;
  if (scenery && quiet != null) return 0.65 * scenery.score + 0.35 * quiet;
  return scenery?.score ?? quiet ?? null;
}

export function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 1 ? 1 : 2)} mi`;
}

export function formatDuration(minutes: number) {
  return `${Math.round(minutes)} min`;
}
