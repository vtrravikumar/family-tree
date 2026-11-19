export type LifeStatus = "alive" | "deceased";
export type FamilyRole = "owner" | "admin" | "editor" | "viewer";
export type DatePrecision = "exact" | "year" | "approximate_year" | "range" | "unknown";

export interface HistoricalDate {
  precision: DatePrecision;
  exactDate?: string;
  year?: number;
  rangeStartYear?: number;
  rangeEndYear?: number;
  originalText?: string;
}

export interface PersonSummary {
  id: string;
  familyId: string;
  displayName: string;
  lifeStatus: LifeStatus;
  birthDate?: HistoricalDate;
  deathDate?: HistoricalDate;
}

export type RelationshipType =
  | "biological_parent" | "biological_child" | "spouse" | "partner"
  | "sibling" | "adoptive_parent" | "adopted_child" | "step_parent" | "step_child";
