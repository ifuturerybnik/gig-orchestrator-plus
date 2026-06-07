// Pojedyncze źródło prawdy listy modułów dostępnych w sidebar organizacji.
// Jeśli dodajesz nowy moduł do <OrgSidebar>, MUSISZ dopisać go również tutaj
// (oraz, jeśli ma sens konfigurowalność uprawnień — pozostawić `configurable: true`).
// Inaczej moduł nie pojawi się w dialogu uprawnień członka i nie będzie ograniczalny.

export type OrgModuleId =
  | "overview"
  | "events"
  | "budget"
  | "profile"
  | "contacts"
  | "counterparties"
  | "mail"
  | "autokorespondencja"
  | "ai_studio"
  | "assistant"
  | "social"
  | "web"
  | "dysk"
  | "members";

export type OrgModuleGroupId = "correspondence" | "media_web";

export interface OrgModuleDef {
  id: OrgModuleId;
  labelKey: string; // i18n key (zgodny z używanym w OrgSidebar)
  /** Grupa nadrzędna w sidebarze (jeśli moduł jest w podmenu). */
  group?: OrgModuleGroupId;
  /** Czy zawsze widoczny dla każdego członka (overview/profile). */
  alwaysVisible?: boolean;
  /** Czy konfigurowalny w dialogu uprawnień. */
  configurable: boolean;
}

export interface OrgModuleGroupDef {
  id: OrgModuleGroupId;
  labelKey: string;
}

export const ORG_MODULE_GROUPS: OrgModuleGroupDef[] = [
  { id: "correspondence", labelKey: "organizations.sidebar.correspondence" },
  { id: "media_web", labelKey: "organizations.sidebar.media_web" },
];

export const ORG_MODULES: OrgModuleDef[] = [
  // zawsze widoczne, nie konfigurowalne
  { id: "overview", labelKey: "organizations.sidebar.overview", alwaysVisible: true, configurable: false },
  { id: "profile", labelKey: "organizations.sidebar.profile", alwaysVisible: true, configurable: false },
  { id: "members", labelKey: "organizations.sidebar.members", alwaysVisible: false, configurable: false },

  // konfigurowalne
  { id: "events", labelKey: "organizations.sidebar.events", configurable: true },
  { id: "budget", labelKey: "organizations.sidebar.budget", configurable: true },
  { id: "contacts", labelKey: "organizations.sidebar.contacts", configurable: true },
  { id: "counterparties", labelKey: "organizations.sidebar.counterparties", configurable: true },
  { id: "mail", labelKey: "organizations.sidebar.mail", group: "correspondence", configurable: true },
  { id: "autokorespondencja", labelKey: "organizations.sidebar.autokorespondencja", group: "correspondence", configurable: true },
  { id: "ai_studio", labelKey: "organizations.sidebar.ai_studio", group: "media_web", configurable: true },
  { id: "social", labelKey: "organizations.sidebar.social", group: "media_web", configurable: true },
  { id: "web", labelKey: "organizations.sidebar.web", group: "media_web", configurable: true },
  { id: "dysk", labelKey: "organizations.sidebar.dysk", configurable: true },
];

export const CONFIGURABLE_MODULE_IDS: OrgModuleId[] = ORG_MODULES
  .filter((m) => m.configurable)
  .map((m) => m.id);

export type BudgetPermissionMode = "full" | "unrealized_only";
export type EventsPermissionMode = "full" | "view_only" | "view_confirmed_only";
export type AiStudioPermissionMode =
  | "full"
  | "create_only"
  | "moderation_only"
  | "view_only";

export const AI_STUDIO_MODES: AiStudioPermissionMode[] = [
  "full",
  "create_only",
  "moderation_only",
  "view_only",
];

export interface EffectiveOrgPermissions {
  isOrgAdmin: boolean;
  /** Zbiór id modułów, do których user ma dostęp (oprócz alwaysVisible). */
  modules: OrgModuleId[];
  budgetMode: BudgetPermissionMode;
  eventsMode: EventsPermissionMode;
  aiStudioMode: AiStudioPermissionMode;
}

/** Czy user ma dostęp do danego modułu (uwzględnia alwaysVisible i org admin). */
export function hasModuleAccess(perms: EffectiveOrgPermissions | null | undefined, moduleId: OrgModuleId): boolean {
  const def = ORG_MODULES.find((m) => m.id === moduleId);
  if (def?.alwaysVisible) return true;
  if (!perms) return true; // brak danych = nie blokujemy; serwer i tak waliduje
  if (perms.isOrgAdmin) return true;
  return perms.modules.includes(moduleId);
}

/** Czy user może edytować/dodawać/usuwać wydarzenia. */
export function canEditEvents(perms: EffectiveOrgPermissions | null | undefined): boolean {
  if (!perms) return true;
  if (perms.isOrgAdmin) return true;
  if (!perms.modules.includes("events")) return false;
  return perms.eventsMode === "full";
}

