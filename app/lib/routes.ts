export type RouteInstruction = {
  text?: string;
  distance?: number;
  time?: number;
  street_name?: string;
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
    low_traffic_percent: number;
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

export function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 1 ? 1 : 2)} mi`;
}

export function formatDuration(minutes: number) {
  return `${Math.round(minutes)} min`;
}
