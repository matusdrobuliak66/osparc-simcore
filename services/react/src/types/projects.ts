export interface Project {
  uuid: string;
  name: string;
  description: string;
  thumbnail: string;
  type: ProjectType;
  templateType: ProjectTemplateType | null;
  workbench: Record<string, WorkbenchNode>;
  ui: ProjectUI;
  prjOwner: string;
  accessRights: Record<string, AccessRights>;
  creationDate: string;
  lastChangeDate: string;
  state: ProjectState;
}

export interface WorkbenchNode {
  key: string;
  version: string;
  label: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  inputNodes?: string[];
  outputNodes?: string[];
  thumbnail?: string;
  runHash?: string | null;
  state?: {
    currentStatus: string;
    dependencies?: string[];
  };
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface ProjectUI {
  workbench?: Record<string, NodePosition>;
  slideshow?: any;
  currentNodeId?: string;
  mode?: string;
}

export interface ProjectListItem {
  uuid: string;
  name: string;
  description: string;
  thumbnail: string;
  type: ProjectType;
  templateType: ProjectTemplateType | null;
  prjOwner: string;
  accessRights: Record<string, AccessRights>;
  creationDate: string;
  lastChangeDate: string;
  state: ProjectState;
}

export interface ProjectsPage {
  data: ProjectListItem[];
  meta: {
    total: number;
    count: number;
    limit: number;
    offset: number;
  };
}

export interface AccessRights {
  read: boolean;
  write: boolean;
  delete: boolean;
}

export interface ProjectState {
  locked?: boolean;
  state?: {
    value: string;
    timestamp?: string;
  };
}

export type ProjectType = 'user' | 'template' | 'study';
export type ProjectTemplateType = 'computational' | 'sim4life';

export interface ProjectFilters {
  type?: 'all' | 'user' | 'template';
  templateType?: ProjectTemplateType | null;
  showHidden?: boolean;
  search?: string;
  folderId?: number | null;
  workspaceId?: string | number | null;
  text?: string;
  tagIds?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectSearchParams extends ProjectFilters {
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  workbench?: Record<string, any>;
  accessRights?: Record<string, AccessRights>;
  workspaceId?: string | number | null;
}
