'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProjectsApi } from '@/lib/projects-api';
import { Project, NodePosition } from '@/types/projects';
import PipelineView from '@/components/PipelineView';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectUuid = params.uuid as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectUuid) {
      loadProject();
    }
  }, [projectUuid]);

  const loadProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await ProjectsApi.getProject(projectUuid);
      setProject(response.data);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNodePosition = async (nodeId: string, position: NodePosition) => {
    if (!project) return;

    try {
      // Update local state immediately for responsive UI
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          ui: {
            ...prev.ui,
            workbench: {
              ...prev.ui?.workbench,
              [nodeId]: position
            }
          }
        };
      });

      // TODO: Implement API call to update node position on the server
      console.log('Node position updated:', nodeId, position);
    } catch (err) {
      console.error('Failed to update node position:', err);
      // Reload project to revert local changes
      loadProject();
    }
  };

  const handleBackToDashboard = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Project</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="space-x-3">
              <button
                onClick={loadProject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleBackToDashboard}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Project not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={handleBackToDashboard}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">Project UUID: {project.uuid}</span>
          <button className="px-3 py-1 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 transition-colors">
            Save
          </button>
        </div>
      </div>

      {/* Pipeline View */}
      <div className="flex-1">
        <PipelineView
          project={project}
          onUpdateNodePosition={handleUpdateNodePosition}
        />
      </div>
    </div>
  );
}
