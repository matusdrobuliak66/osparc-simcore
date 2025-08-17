import { ApiClient, API_ENDPOINTS } from './api';
import { ProjectsPage, ProjectSearchParams, CreateProjectData } from '@/types/projects';

export class ProjectsApi {
  /**
   * List projects with optional filters
   */
  static async listProjects(params: ProjectSearchParams = {}): Promise<ProjectsPage> {
    const searchParams = new URLSearchParams();

    // Add parameters to search params
    if (params.type) searchParams.append('type', params.type);
    if (params.templateType) searchParams.append('template_type', params.templateType);
    if (params.showHidden !== undefined) searchParams.append('show_hidden', params.showHidden.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.folderId !== undefined) {
      searchParams.append('folder_id', params.folderId?.toString() || 'null');
    }
    if (params.workspaceId !== undefined) {
      if (params.workspaceId === null) {
        searchParams.append('workspace_id', 'null');
      } else {
        searchParams.append('workspace_id', params.workspaceId.toString());
      }
    }

    // Add default order_by if not specified
    const orderBy = params.orderBy || '{"field":"last_change_date","direction":"desc"}';
    searchParams.append('order_by', orderBy);

    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const url = `${API_ENDPOINTS.PROJECTS}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return ApiClient.get<ProjectsPage>(url);
  }

  /**
   * Full-text search projects
   */
  static async searchProjects(params: ProjectSearchParams = {}): Promise<ProjectsPage> {
    const searchParams = new URLSearchParams();

    // Add parameters to search params
    if (params.type) searchParams.append('type', params.type);
    if (params.templateType) searchParams.append('template_type', params.templateType);
    if (params.text) searchParams.append('text', params.text);
    if (params.tagIds) searchParams.append('tag_ids', params.tagIds);
    if (params.folderId !== undefined) {
      searchParams.append('folder_id', params.folderId?.toString() || 'null');
    }
    if (params.workspaceId !== undefined) {
      if (params.workspaceId === null) {
        searchParams.append('workspace_id', 'null');
      } else {
        searchParams.append('workspace_id', params.workspaceId.toString());
      }
    }

    // Add default order_by if not specified
    const orderBy = params.orderBy || '{"field":"last_change_date","direction":"desc"}';
    searchParams.append('order_by', orderBy);

    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const url = `${API_ENDPOINTS.PROJECTS_SEARCH}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return ApiClient.get<ProjectsPage>(url);
  }

  /**
   * Create a new project
   */
  static async createProject(projectData: CreateProjectData): Promise<any> {
    return ApiClient.post(API_ENDPOINTS.PROJECTS, projectData);
  }
}
