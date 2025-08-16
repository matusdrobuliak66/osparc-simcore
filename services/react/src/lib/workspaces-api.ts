import { ApiClient, API_ENDPOINTS } from './api';
import { Workspace, CreateWorkspaceData } from '@/types/workspaces';

export class WorkspacesApi {
  /**
   * List workspaces
   */
  static async listWorkspaces(): Promise<{ data: Workspace[] }> {
    return ApiClient.get<{ data: Workspace[] }>(API_ENDPOINTS.WORKSPACES);
  }

  /**
   * Create a new workspace
   */
  static async createWorkspace(workspaceData: CreateWorkspaceData): Promise<{ data: Workspace }> {
    return ApiClient.post<{ data: Workspace }>(API_ENDPOINTS.WORKSPACES, workspaceData);
  }
}
