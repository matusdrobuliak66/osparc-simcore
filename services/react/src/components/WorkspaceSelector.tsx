'use client';

import { useState, useEffect } from 'react';
import { WorkspacesApi } from '@/lib/workspaces-api';
import { Workspace } from '@/types/workspaces';

interface WorkspaceSelectorProps {
  selectedWorkspaceId: string | null;
  onWorkspaceSelect: (workspaceId: string | null) => void;
  isLoading?: boolean;
}

export default function WorkspaceSelector({
  selectedWorkspaceId,
  onWorkspaceSelect,
  isLoading = false,
}: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true);
      setError(null);
      const response = await WorkspacesApi.listWorkspaces();
      setWorkspaces(response.data || []);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const getSelectedWorkspaceName = () => {
    if (selectedWorkspaceId === null) return 'All Shared Workspaces';
    const workspace = workspaces.find(w => w.gid === selectedWorkspaceId);
    return workspace ? workspace.name : 'Unknown Workspace';
  };

  if (loadingWorkspaces) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin mr-3"></div>
          <span className="text-gray-600">Loading workspaces...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-5 h-5 text-red-500 mr-2">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-red-700">Failed to load workspaces: {error}</span>
          </div>
          <button
            onClick={loadWorkspaces}
            className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Select Workspace</h3>
        <button
          onClick={loadWorkspaces}
          disabled={loadingWorkspaces}
          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No shared workspaces</h4>
          <p className="text-gray-600">You don't have access to any shared workspaces yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Option to view all shared workspaces */}
          <button
            onClick={() => onWorkspaceSelect(null)}
            disabled={isLoading}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedWorkspaceId === null
                ? 'border-primary-500 bg-primary-50 text-primary-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center">
              <div className="w-5 h-5 mr-3 text-gray-400">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="font-medium">All Shared Workspaces</div>
                <div className="text-sm text-gray-600">View projects from all shared workspaces</div>
              </div>
            </div>
          </button>

          {/* Individual workspaces */}
          {workspaces.map((workspace) => (
            <button
              key={workspace.gid}
              onClick={() => onWorkspaceSelect(workspace.gid)}
              disabled={isLoading}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedWorkspaceId === workspace.gid
                  ? 'border-primary-500 bg-primary-50 text-primary-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <div className="w-5 h-5 mr-3 text-gray-400">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{workspace.name}</div>
                  {workspace.description && (
                    <div className="text-sm text-gray-600 truncate">{workspace.description}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Created {new Date(workspace.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Current selection indicator */}
      {workspaces.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium">{getSelectedWorkspaceName()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
