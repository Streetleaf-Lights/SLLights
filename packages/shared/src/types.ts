// Domain model
//
// Hierarchy: Customer -> Project -> Pole
// Customers carry basic project name/id references inline (see
// CustomerProjectRef); the full Project record (poles under contract, dates,
// etc.) comes from a separate /getProjects?customerId= lookup. Users are
// managed separately (application accounts, not part of the customer hierarchy).

/** A project reference as carried inline on a Customer record. */
export interface CustomerProjectRef {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  projects: CustomerProjectRef[];
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  active: boolean;
}

/** Full project record from GET /getProjects?customerId=... */
/** A single controller/light on the Leadsun (device-vendor) side of a project. */
export interface LeadsunProduct {
  ProductId: number;
  ProductName: string;
  ProvidedProductId: string;
  PoleNumber: string;
}

/** A Leadsun gateway grouping of products within a project. */
export interface LeadsunGroup {
  GroupId: number;
  GroupName: string;
  GatewayCode: string;
  totalPoles: number;
  products: LeadsunProduct[];
}

/**
 * The Leadsun (device-vendor) side of a project — separate from our own
 * Project record, and only present for projects actually configured for
 * remote control. A product's ProductName lines up with a pole's
 * locationId (confirmed against sample data), which is how a given pole
 * is matched to its Leadsun product.
 */
export interface LeadsunProject {
  ProjectId: string;
  ProjectName: string;
  totalGateways: number;
  totalPoles: number;
  groups: LeadsunGroup[];
}

/**
 * A single lamp's live status from Leadsun's own status API (GET
 * /lamps/{leadsunProjectId}[/{productId}]) — separate from LeadsunProduct
 * above, which only describes a pole's static identity/config. Only the
 * fields this app actually uses are typed here; the real payload has many
 * more (battery/solar telemetry, temperatures, etc.) that we don't need.
 */
export interface LeadsunLampStatus {
  productId: string;
  lampPower1: number;
  lampPower2: number;
}

export interface Project {
  id: string;
  name: string;
  leadsunProject: LeadsunProject | null;
  active: boolean;
}

/**
 * A single pole's live status, as nested inside each project's vitals.
 * All telemetry fields are null for poles with no telemetry available (see
 * totalNonTelemetryAvailable on the parent project/customer).
 */
/** A single reported issue for a pole, as returned within PoleVital.poleIssues. */
export interface PoleIssue {
  issueId: string;
  status: string;
  poleStatus: string;
  dateReported: string;
  problemDetails: string | null;
}

export interface PoleVital {
  id: string;
  poleNumber: string;
  locationId: string;
  active: boolean;
  isOnline: boolean | null;
  installDate: string | null;
  lat: number | null;
  long: number | null;
  lastUpdate: string | null;
  batteryVoltage1: number | null;
  batteryVoltage2: number | null;
  lampPower1: number | null;
  lampPower2: number | null;
  batteryElecCurrent1: number | null;
  batteryElecCurrent2: number | null;
  solarBoardVoltage: number | null;
  solarBoardElecCurrent: number | null;
  isLedFault: boolean | null;
  isBatteryFault: boolean | null;
  isPanelFault: boolean | null;
  isOpenIssueFault: boolean | null;
  isPoleFault: boolean | null;
  avgBatteryPercentage: number | null;
  avgPanelPercentage: number | null;
  avgLightPercentage: number | null;
  sunsetTime: string | null;
  lightStatusText: string | null;
  panelStatusText: string | null;
  panelIdleReason: string | null;
  batteryStatusText: string | null;
  /** Shown as "Battery Percentage" on the pole detail page's Battery card. */
  electricCurrentAverage: number | null;
  /** Pre-computed "48h Connected" label — replaces the old client-side connectionStatus(isOnline, lastUpdate) computation. */
  connectedText: string | null;
  /** Pre-computed "48h Overall Status" label — replaces the old client-side poleOverallStatus(pole) computation. */
  overallStatusText: string | null;
  poleIssues: PoleIssue[];
}

/** Vitals for a single project, as nested inside GET /getPoleVitals?customerId=... */
export interface ProjectVitals {
  id: string;
  name: string;
  totalLights: number;
  connectedLights: number;
  totalFaults: number;
  percentWorking: number;
  poles: PoleVital[];
}

/** Customer-level vitals from GET /getPoleVitals?customerId=..., with per-project breakdowns. */
export interface CustomerPoleVitals extends ProjectVitals {
  projects: ProjectVitals[];
}

/**
 * Lightweight pole record from GET /getPoles?summary=true. The unfiltered
 * /getPoles response is capped at 1000 records without summary mode, but the
 * full system has ~14k poles — summary mode lifts that cap in exchange for
 * omitting lastUpdate and the two battery voltage fields.
 */
export type PoleSummary = Omit<PoleVital, "batteryVoltage1" | "batteryVoltage2"> & {
  customerId: string;
  projectId: string;
};

/** Valid periodType values for GET /getPoleVitalsByPeriod. */
export type PeriodType = "Hour" | "Day";

/** A single aggregated period's vitals, as returned by GET /getPoleVitalsByPeriod. */
export interface PoleVitalPeriod {
  periodStart: string;
  avgBatteryPercentage: number | null;
  avgPanelPercentage: number | null;
  avgLightPercentage: number | null;
}

/** Response shape for GET /getPoleVitalsByPeriod?poleId=&periodType=&limit= */
export interface PoleVitalsByPeriod {
  vitals: PoleVitalPeriod[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  customerId: string | null;
  customerName: string | null;
}

/** The signed-in user as returned by APIM's POST /signIn alongside the token. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  customerId: string | null;
}

/** The claims this app reads from a session JWT (see decodeSessionToken). */
export interface SessionUser {
  id: string;
  role: string;
  customerId: string | null;
}
