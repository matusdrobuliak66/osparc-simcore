// API Types based on oSPARC OpenAPI specification

export interface Project {
  uuid: string;
  name: string;
  description?: string;
  prjOwner: string;
  accessRights: Record<string, AccessRights>;
  creationDate: string;
  lastChangeDate: string;
  thumbnail?: string;
  workbench: Record<string, any>;
  ui?: ProjectUI;
  classifiers?: string[];
  dev?: Record<string, any>;
  quality?: Record<string, any>;
  state?: ProjectState;
  tags?: number[];
}

export interface AccessRights {
  read: boolean;
  write: boolean;
  delete: boolean;
}

export interface ProjectUI {
  slideshow?: Record<string, any>;
  workbench?: Record<string, any>;
  mode?: "workbench" | "guided";
}

export interface ProjectState {
  locked?: ProjectLocked;
  state?: ProjectRunningState;
}

export interface ProjectLocked {
  value: boolean;
  status?: "CLOSED" | "OPENED" | "CLOSING" | "OPENING";
}

export interface ProjectRunningState {
  value: "NOT_STARTED" | "PUBLISHED" | "PENDING" | "WAITING_FOR_RESOURCES" | "STARTED" | "SUCCESS" | "FAILED" | "ABORTED" | "WAITING_FOR_CLUSTER";
}

export interface UserProfile {
  id: number;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  gravatar_id?: string;
  groups?: Group[];
  preferences?: Record<string, any>;
}

export interface Group {
  gid: number;
  label: string;
  description?: string;
  type: "EVERYONE" | "ORGANIZATIONS" | "PRIMARY" | "STANDARD";
  thumbnail?: string;
  inclusionRules?: Record<string, any>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  message: string;
  status: number;
}

export interface ProjectsListParams {
  type?: "template" | "user";
  show_hidden?: boolean;
  search?: string;
  tag_ids?: number[];
  offset?: number;
  limit?: number;
  workspace_id?: string | null;
  folder_id?: string | null;
  order_by?: string; // JSON string for ordering like {"field":"last_change_date","direction":"desc"}
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message?: string;
  status: number;
  nextStep?: "PHONE_NUMBER_REQUIRED" | "SMS_CODE_REQUIRED" | "EMAIL_CODE_REQUIRED";
  retryAfter?: number;
}

export interface AuthUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  groups?: Group[];
}
