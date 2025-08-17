'use client';

import { useState, useEffect } from 'react';
import { ProjectsApi } from '@/lib/projects-api';
import { Project } from '@/types/projects';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectUuid: string | null;
}

export default function ProjectDetailsModal({
  isOpen,
  onClose,
  projectUuid,
}: ProjectDetailsModalProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectUuid) {
      loadProject();
    }
  }, [isOpen, projectUuid]);

  const loadProject = async () => {
    if (!projectUuid) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await ProjectsApi.getProject(projectUuid);
      setProject(response.data);
    } catch (err) {
      console.error('Failed to load project details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async () => {
    if (!projectUuid) return;

    try {
      setIsOpening(true);
      setError(null);

      await ProjectsApi.openProject(projectUuid);

      // TODO: Navigate to project pipeline view
      console.log('Project opened successfully. Navigation to pipeline view will be implemented in next iteration.');

      onClose();
    } catch (err) {
      console.error('Failed to open project:', err);
      setError(err instanceof Error ? err.message : 'Failed to open project');
    } finally {
      setIsOpening(false);
    }
  };

  const handleClose = () => {
    if (!isLoading && !isOpening) {
      setProject(null);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Project Details</h2>
          <button
            onClick={handleClose}
            disabled={isLoading || isOpening}
            className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-600">Loading project details...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Project</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadProject}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Try Again
              </button>
            </div>
          ) : project ? (
            <div className="space-y-6">
              {/* Project Info */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">{project.name}</h3>
                {project.description && (
                  <p className="text-gray-600 mb-4">{project.description}</p>
                )}
              </div>

              {/* Project Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Project Type</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{project.type}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Owner</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project.prjOwner}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(project.creationDate).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(project.lastChangeDate).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">State</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.state?.locked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {project.state?.locked ? 'Locked' : 'Available'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">UUID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{project.uuid}</dd>
                </div>
              </div>

              {/* Workbench Info */}
              {project.workbench && Object.keys(project.workbench).length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">Workbench Services</dt>
                  <dd className="text-sm text-gray-900">
                    {Object.keys(project.workbench).length} service(s) configured
                  </dd>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {project && !isLoading && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleClose}
              disabled={isOpening}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenProject}
              disabled={isOpening}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOpening ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Opening...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Project
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
