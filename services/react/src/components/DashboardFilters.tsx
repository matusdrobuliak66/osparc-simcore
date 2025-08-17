'use client';

import { useState, useEffect, useRef } from 'react';
import { ProjectFilters } from '@/types/projects';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface DashboardFiltersProps {
  filters: {
    search?: string;
    type?: 'all' | 'user' | 'template';
    workspaceId?: string | number | null;
  };
  onFiltersChange: (filters: { search?: string; type?: 'all' | 'user' | 'template'; workspaceId?: string | number | null }) => void;
  currentWorkspaceId: string | null;
  onWorkspaceSelect: (workspaceId: string | null, workspaceName?: string) => void;
  isLoading?: boolean;
}

export default function DashboardFilters({
  filters,
  onFiltersChange,
  isLoading = false,
  currentWorkspaceId,
  onWorkspaceSelect,
}: DashboardFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const previousSearchRef = useRef(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== previousSearchRef.current) {
        previousSearchRef.current = searchTerm;
        onFiltersChange({ ...filters, search: searchTerm || undefined });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]); // Only depend on searchTerm, not the entire filters object

  const handleTypeChange = (type: 'all' | 'user' | 'template') => {
    onFiltersChange({ ...filters, type });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* Left side - Search and Type */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Project Type Filter */}
          <div className="flex-shrink-0">
            <select
              value={filters.type || 'all'}
              onChange={(e) => handleTypeChange(e.target.value as 'all' | 'user' | 'template')}
              disabled={isLoading}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Projects</option>
              <option value="user">Studies</option>
              <option value="template">Templates</option>
            </select>
          </div>
        </div>

        {/* Right side - Workspace Selection */}
        <div className="flex-shrink-0">
          <WorkspaceSwitcher
            currentWorkspaceId={currentWorkspaceId}
            onWorkspaceSelect={onWorkspaceSelect}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Active filters indicator */}
      {(filters.search || (filters.type && filters.type !== 'all')) && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <span>Active filters:</span>
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Search: "{filters.search}"
            </span>
          )}
          {filters.type && filters.type !== 'all' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Type: {filters.type === 'user' ? 'Studies' : 'Templates'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
