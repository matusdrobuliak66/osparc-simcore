export interface Workspace {
  gid: string;
  name: string;
  description?: string;
  thumbnail?: string;
  created_at: string;
  modified_at: string;
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
  thumbnail?: string;
}
