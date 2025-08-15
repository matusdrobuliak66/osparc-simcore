'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Grid, List } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import ProjectCard from '@/components/ProjectCard';
import DashboardFilters, { FilterOptions } from '@/components/DashboardFilters';
import { Project } from '@/types/api';
import { apiClient } from '@/lib/api';

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    status: [],
    tags: [],
    owner: '',
    dateRange: {},
  });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        type: filters.type !== 'all' ? filters.type as 'user' | 'template' : 'user',
        search: searchQuery || undefined,
        offset: 0,
        limit: 20, // Load more projects initially
        workspace_id: null,
        folder_id: null,
        order_by: JSON.stringify({
          field: "last_change_date",
          direction: "desc"
        })
      };
      
      const projectsData = await apiClient.getProjects(params);
      setProjects(projectsData);
    } catch (err) {
      setError('Failed to fetch projects. Please try again.');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters or search change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProjects();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters.type]);

  // Client-side filtering for complex filters
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !project.name.toLowerCase().includes(query) &&
          !project.description?.toLowerCase().includes(query) &&
          !project.prjOwner.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (filters.status.length > 0) {
        const projectStatus = project.state?.state?.value || 'NOT_STARTED';
        if (!filters.status.includes(projectStatus)) {
          return false;
        }
      }

      // Owner filter
      if (filters.owner) {
        if (!project.prjOwner.toLowerCase().includes(filters.owner.toLowerCase())) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const projectDate = new Date(project.lastChangeDate);
        if (filters.dateRange.from && projectDate < new Date(filters.dateRange.from)) {
          return false;
        }
        if (filters.dateRange.to && projectDate > new Date(filters.dateRange.to)) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const projectTags = project.classifiers || [];
        if (!filters.tags.some(tag => projectTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }, [projects, searchQuery, filters]);

  // Extract available tags from all projects
  const availableTags = useMemo(() => {
    const allTags = projects.flatMap(project => project.classifiers || []);
    return Array.from(new Set(allTags));
  }, [projects]);

  const handleEditProject = (project: Project) => {
    // TODO: Implement edit functionality
    console.log('Edit project:', project.uuid);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        const success = await apiClient.deleteProject(projectId);
        if (success) {
          setProjects(projects.filter(p => p.uuid !== projectId));
        } else {
          alert('Failed to delete project. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  const handleShareProject = (project: Project) => {
    // TODO: Implement share functionality
    console.log('Share project:', project.uuid);
  };

  const handleCreateProject = () => {
    // TODO: Implement create project functionality
    console.log('Create new project');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onSearch={setSearchQuery} searchQuery={searchQuery} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-red-600 text-lg mb-4">{error}</div>
            <button
              onClick={fetchProjects}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={setSearchQuery} searchQuery={searchQuery} />
      
      <DashboardFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={availableTags}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {loading ? 'Loading...' : `${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${
                  viewMode === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Create Project Button */}
            <button
              onClick={handleCreateProject}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Projects Grid/List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
                <div className="w-full h-48 bg-gray-200 rounded-t-lg"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">
              {searchQuery || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v)
                ? 'No projects match your search criteria'
                : 'No projects found'}
            </div>
            <button
              onClick={handleCreateProject}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.uuid}
                project={project}
                onEdit={handleEditProject}
                onDelete={handleDeleteProject}
                onShare={handleShareProject}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
