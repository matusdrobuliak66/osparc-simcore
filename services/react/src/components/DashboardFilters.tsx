'use client';

import { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';

export interface FilterOptions {
  type: 'all' | 'user' | 'template';
  status: string[];
  tags: string[];
  owner: string;
  dateRange: {
    from?: string;
    to?: string;
  };
}

interface DashboardFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableTags: string[];
}

export default function DashboardFilters({
  filters,
  onFiltersChange,
  availableTags,
}: DashboardFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions = [
    'NOT_STARTED',
    'PENDING',
    'STARTED',
    'SUCCESS',
    'FAILED',
    'ABORTED',
  ];

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    updateFilter('status', newStatuses);
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    updateFilter('tags', newTags);
  };

  const clearFilters = () => {
    onFiltersChange({
      type: 'all',
      status: [],
      tags: [],
      owner: '',
      dateRange: {},
    });
  };

  const hasActiveFilters = 
    filters.type !== 'all' ||
    filters.status.length > 0 ||
    filters.tags.length > 0 ||
    filters.owner ||
    filters.dateRange.from ||
    filters.dateRange.to;

  const getStatusDisplayName = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-4">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {[filters.status.length, filters.tags.length, filters.owner ? 1 : 0].filter(n => n > 0).reduce((a, b) => a + b, 0)}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Quick Filter Pills */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => updateFilter('type', filters.type === 'user' ? 'all' : 'user')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filters.type === 'user'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                My Projects
              </button>
              <button
                onClick={() => updateFilter('type', filters.type === 'template' ? 'all' : 'template')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filters.type === 'template'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Templates
              </button>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
                <span>Clear all</span>
              </button>
            )}
          </div>
        </div>

        {/* Expanded Filter Panel */}
        {showFilters && (
          <div className="pb-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              {/* Project Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => updateFilter('type', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="all">All Projects</option>
                  <option value="user">My Projects</option>
                  <option value="template">Templates</option>
                </select>
              </div>

              {/* Owner Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner
                </label>
                <input
                  type="text"
                  value={filters.owner}
                  onChange={(e) => updateFilter('owner', e.target.value)}
                  placeholder="Filter by owner..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Modified
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateRange.from || ''}
                    onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, from: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.to || ''}
                    onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, to: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Project Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {statusOptions.map((status) => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => toggleStatus(status)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {getStatusDisplayName(status)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags Filter */}
            {availableTags.length > 0 && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        filters.tags.includes(tag)
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
