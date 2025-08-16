'use client';

import { ProjectListItem } from '@/types/projects';

interface ProjectCardProps {
  project: ProjectListItem;
  onClick?: (project: ProjectListItem) => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const handleClick = () => {
    onClick?.(project);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  const getProjectTypeLabel = (type: string) => {
    switch (type) {
      case 'user':
        return 'Study';
      case 'template':
        return 'Template';
      default:
        return type;
    }
  };

  const getProjectTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 text-blue-800';
      case 'template':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
        {project.thumbnail && project.thumbnail !== '' ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 truncate pr-2">
            {project.name}
          </h3>
          <span
            className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getProjectTypeBadgeColor(
              project.type
            )}`}
          >
            {getProjectTypeLabel(project.type)}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-gray-600 mb-3 overflow-hidden">
            <span className="block truncate">
              {project.description.length > 100
                ? `${project.description.substring(0, 100)}...`
                : project.description}
            </span>
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
            <span className="truncate">{project.prjOwner}</span>
          </div>
          <span>Updated {formatDate(project.lastChangeDate)}</span>
        </div>
      </div>
    </div>
  );
}
