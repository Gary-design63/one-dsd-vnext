// =====================================================================
// One DSD vNext — view models (Layer 7)
// Typed data shapes the render functions consume. The router maps gated
// DB rows into these; pages never touch the database or the request.
// =====================================================================

export interface NavContext {
  /** null when signed out. */
  viewer: { userId: string; roles: readonly string[] } | null;
  /** authority + edit mode active (shows the Edit toggle, enables in-place editing). */
  editMode?: boolean;
  /** active top-level route key for nav highlighting. */
  active?: "home" | "library" | "learning" | "calendar" | "ask" | "growth" | "console" | "audio" | "surveys";
}

export interface AssetCard {
  id: string;
  title: string;
  summary: string | null;
  format: string | null;
  proficiencyBand: string | null;
  primaryTrack: string | null;
  disciplineCluster: string | null;
  estimatedMinutes?: number | null;
  hasAudio?: boolean;
}

export interface FacetOption {
  key: string;
  label: string;
  count?: number;
  selected?: boolean;
}

export interface LibraryView {
  nav: NavContext;
  editMode?: boolean;
  copy?: Record<string, string>;
  items: AssetCard[];
  facets: {
    cluster: FacetOption[];
    format: FacetOption[];
    proficiency: FacetOption[];
  };
  total: number;
  limit: number;
  offset: number;
  query?: string;
}

export interface AssetView {
  nav: NavContext;
  editable?: boolean;
  asset: AssetCard & { body: string | null };
  audioUrl?: string | null;
  collections?: { key: string; label: string }[];
}

export interface JourneyDoor {
  key: string;
  label: string;
  description: string;
  href: string;
  /** IDC stage this door is calibrated for (informs copy/scaffolding). */
  idcStage?: string;
}

export interface HomeView {
  nav: NavContext;
  editMode?: boolean;
  greetingName?: string | null;
  heroEyebrow?: string;
  heroTitle?: string;
  heroLede?: string;
  doors: JourneyDoor[];
  featured: AssetCard[];
}

export interface LearningModuleVM {
  id: string;
  ordinal: number;
  title: string;
  kind: "read" | "watch" | "listen" | "reflect" | "practice" | "assess";
  estimatedMinutes?: number | null;
  state: "not_started" | "in_progress" | "completed";
}

export interface LearningPathView {
  nav: NavContext;
  editMode?: boolean;
  path: {
    id: string;
    title: string;
    summary: string | null;
    proficiencyBand: string | null;
    idcStage: string | null;
  };
  modules: LearningModuleVM[];
  completedCount: number;
}

export interface LearningIndexView {
  nav: NavContext;
  editMode?: boolean;
  copy?: Record<string, string>;
  paths: {
    id: string;
    title: string;
    summary: string | null;
    proficiencyBand: string | null;
    moduleCount: number;
  }[];
}

export interface CalendarEntry {
  id: string;
  title: string;
  startsOn: string; // ISO date
  kind: string;
  sensitivity?: string;
  humilityNote?: string | null;
}

export interface CalendarView {
  nav: NavContext;
  editMode?: boolean;
  copy?: Record<string, string>;
  entries: CalendarEntry[];
  monthLabel: string;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface SignInView {
  error?: string | null;
  returnTo?: string | null;
}

export interface AudioEpisodeVM {
  id: string;
  title: string;
  summary: string | null;
  episodeNo?: number | null;
  seasonNo?: number | null;
  audioUrl?: string | null;
  durationMin?: number | null;
}

export interface AudioView {
  nav: NavContext;
  editMode?: boolean;
  copy?: Record<string, string>;
  episodes: AudioEpisodeVM[];
}

export interface SurveyItemVM {
  id: string;            // instrument id (editable target)
  title: string;
  description: string | null;
  kind: string;          // module_survey | reflection | engagement | annual_deia | needs_assessment
  closesOn?: string | null;
}

export interface SurveyView {
  nav: NavContext;
  editMode?: boolean;
  copy?: Record<string, string>;
  items: SurveyItemVM[];
}
