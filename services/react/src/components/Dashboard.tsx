'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectsApi } from '@/lib/projects-api';
import { ProjectListItem, ProjectFilters, ProjectsPage } from '@/types/projects';
import ProjectCard from './ProjectCard';
import DashboardFilters from './DashboardFilters';
import CreateProjectModal from './CreateProjectModal';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import WorkspaceSelector from './WorkspaceSelector';

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    count: 0,
    limit: 20,
    offset: 0,
  });

  const [filters, setFilters] = useState<ProjectFilters>({
    type: 'user', // Default to user projects (studies)
    workspaceId: null, // Start with private workspace (null = private)
    folderId: null, // No specific folder
    limit: 20,
    offset: 0,
  });

  // Track if we're in shared mode and if a workspace has been selected
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [selectedSharedWorkspaceId, setSelectedSharedWorkspaceId] = useState<string | null>(null);

  const loadProjects = useCallback(async (currentFilters: ProjectFilters) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading projects with filters:', currentFilters);

      // Use search API if there's a text search, otherwise use regular list
      const response: ProjectsPage = currentFilters.search
        ? await ProjectsApi.searchProjects({
            ...currentFilters,
            text: currentFilters.search,
          })
        : await ProjectsApi.listProjects(currentFilters);

      console.log('Projects loaded successfully:', response);
      setProjects(response.data || []);
      setPagination(response.meta || { total: 0, count: 0, limit: 20, offset: 0 });
    } catch (err) {
      console.error('Failed to load projects:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load projects');
      }
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependencies array to prevent recreation

  // Load projects when filters change
  useEffect(() => {
    loadProjects(filters);
  }, [loadProjects, filters.type, filters.workspaceId, filters.folderId, filters.search, filters.limit, filters.offset]); // Only track specific filter properties

  const handleFiltersChange = (newFilters: ProjectFilters) => {
    setFilters({ ...newFilters, offset: 0 }); // Reset to first page when filters change

    // Check if workspace mode changed
    if (newFilters.workspaceId === null && isSharedMode) {
      // Switched to private mode
      setIsSharedMode(false);
      setSelectedSharedWorkspaceId(null);
    } else if (newFilters.workspaceId === undefined && !isSharedMode) {
      // Switched to shared mode but no workspace selected yet
      setIsSharedMode(true);
      setSelectedSharedWorkspaceId(null);
    }
  };

  const handleProjectCreated = () => {
    // Refresh the projects list
    loadProjects(filters);
  };

  const handleWorkspaceCreated = () => {
    // For now just log, later we might want to refresh workspaces list
    console.log('Workspace created successfully');
  };

  const handleWorkspaceSelect = (workspaceId: string | null) => {
    setSelectedSharedWorkspaceId(workspaceId);
    // Update filters to load projects from the selected workspace
    setFilters(prevFilters => ({
      ...prevFilters,
      workspaceId: workspaceId,
      offset: 0
    }));
  };

  const handleProjectClick = (project: ProjectListItem) => {
    // TODO: Navigate to project details or open project
    console.log('Project clicked:', project);
  };

  const handleLoadMore = () => {
    const newOffset = filters.offset! + filters.limit!;
    setFilters({ ...filters, offset: newOffset });
  };

  const getWorkspaceDisplayName = () => {
    if (filters.workspaceId === null) {
      return 'Private Workspace';
    } else if (isSharedMode && selectedSharedWorkspaceId === null) {
      return 'Shared Workspaces';
    } else {
      return 'Shared Workspace';
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-red-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Projects</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => loadProjects(filters)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {getWorkspaceDisplayName()}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsCreateWorkspaceModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Workspace
            </button>
            <button
              onClick={() => setIsCreateProjectModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Project
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          {filters.workspaceId === null
            ? 'Your personal projects and studies'
            : isSharedMode && selectedSharedWorkspaceId === null
            ? 'Select a shared workspace to view its projects'
            : 'Shared projects across your organization'}
        </p>
      </div>

      {/* Filters */}
      <DashboardFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isLoading={loading}
      />

      {/* Workspace Selector - Show when in shared mode but no workspace selected */}
      {isSharedMode && selectedSharedWorkspaceId === null && (
        <WorkspaceSelector
          selectedWorkspaceId={selectedSharedWorkspaceId}
          onWorkspaceSelect={handleWorkspaceSelect}
          isLoading={loading}
        />
      )}

      {/* Loading State */}
      {loading && projects.length === 0 && (filters.workspaceId !== undefined || !isSharedMode) && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      )}

      {/* Projects Grid - Only show when we have a valid workspace selection */}
      {(!loading || projects.length > 0) && (filters.workspaceId !== undefined || !isSharedMode) ? (
        <>
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-4">
                {filters.search
                  ? `No projects match your search "${filters.search}"`
                  : filters.workspaceId === null
                  ? "You don't have any projects yet"
                  : 'No shared projects available'}
              </p>
              {!filters.search && filters.workspaceId === null && (
                <button
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Your First Project
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results count */}
              <div className="mb-4 text-sm text-gray-600">
                Showing {pagination.count} of {pagination.total} projects
              </div>

              {/* Projects grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.uuid}
                    project={project}
                    onClick={handleProjectClick}
                  />
                ))}
              </div>

              {/* Load more button */}
              {pagination.total > pagination.count + pagination.offset && (
                <div className="text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
        onWorkspaceCreated={handleWorkspaceCreated}
      />
    </div>
  );
}
