'use client';

import { useState, useEffect } from 'react';
import { WorkspacesApi } from '@/lib/workspaces-api';
import { Workspace } from '@/types/workspaces';

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string | null;
  onWorkspaceSelect: (workspaceId: string | null, workspaceName?: string) => void;
  isLoading?: boolean;
}

export default function WorkspaceSwitcher({
  currentWorkspaceId,
  onWorkspaceSelect,
  isLoading = false,
}: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true);
      const response = await WorkspacesApi.listWorkspaces();
      setWorkspaces(response.data || []);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const getCurrentWorkspaceName = () => {
    if (currentWorkspaceId === null) return 'Private Workspace';
    const workspace = workspaces.find(w => w.gid === currentWorkspaceId);
    return workspace ? workspace.name : 'Unknown Workspace';
  };

  const handleWorkspaceSelect = (workspaceId: string | null, workspaceName: string) => {
    onWorkspaceSelect(workspaceId, workspaceName);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || loadingWorkspaces}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
      >
        <div className="w-5 h-5 text-gray-500">
          {currentWorkspaceId === null ? (
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          )}
        </div>
        <span className="max-w-48 truncate">{getCurrentWorkspaceName()}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-64 z-50">
          {/* Private Workspace */}
          <button
            onClick={() => handleWorkspaceSelect(null, 'Private Workspace')}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
              currentWorkspaceId === null ? 'bg-primary-50 text-primary-700' : ''
            }`}
          >
            <div className="flex items-center">
              <div className="w-5 h-5 mr-3 text-gray-500">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <div className="font-medium">Private Workspace</div>
                <div className="text-sm text-gray-600">Your personal projects</div>
              </div>
            </div>
          </button>

          {/* Shared Workspaces */}
          {loadingWorkspaces ? (
            <div className="p-4 text-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
              <span className="text-sm text-gray-600">Loading workspaces...</span>
            </div>
          ) : (
            <>
              {workspaces.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shared Workspaces
                  </div>
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.gid}
                      onClick={() => handleWorkspaceSelect(workspace.gid, workspace.name)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        currentWorkspaceId === workspace.gid ? 'bg-primary-50 text-primary-700' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-5 h-5 mr-3 text-gray-500">
                          <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{workspace.name}</div>
                          {workspace.description && (
                            <div className="text-sm text-gray-600 truncate">{workspace.description}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
