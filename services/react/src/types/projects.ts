export interface Project {
  uuid: string;
  name: string;
  description: string;
  thumbnail: string;
  type: ProjectType;
  templateType: ProjectTemplateType | null;
  workbench: Record<string, any>;
  prjOwner: string;
  accessRights: Record<string, AccessRights>;
  creationDate: string;
  lastChangeDate: string;
  state: ProjectState;
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
  workspaceId?: number | null;
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
