export interface RouteSummary {
  routeId: string;
  shortName: string | null;
  longName: string | null;
  color: string | null;
  textColor: string | null;
  type: number | null;
}

export interface TripSummary {
  tripId: string;
  routeId: string;
  directionId: number | null;
  shortName: string | null;
  headsign: string | null;
}

export interface StopInfo {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
}

export interface EdgeTripInfo {
  tripId: string;
  routeId: string;
  directionId: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  trips: EdgeTripInfo[];
  routeIds: string[];
  color: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  lat: number | null;
  lon: number | null;
}

export interface GraphPayload {
  nodes: GraphNode[];
  links: GraphLink[];
  routeColors: Record<string, string | null>;
}
