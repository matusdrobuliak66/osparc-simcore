'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  Calendar, 
  User, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Share2, 
  Copy,
  ExternalLink 
} from 'lucide-react';
import { Project } from '@/types/api';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onShare: (project: Project) => void;
}

export default function ProjectCard({ project, onEdit, onDelete, onShare }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProjectStatusColor = () => {
    const status = project.state?.state?.value;
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'STARTED':
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'NOT_STARTED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getProjectStatus = () => {
    const status = project.state?.state?.value;
    if (!status) {
      return 'Ready';
    }
    
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const handleMenuAction = (action: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowMenu(false);
    
    switch (action) {
      case 'edit':
        onEdit(project);
        break;
      case 'delete':
        onDelete(project.uuid);
        break;
      case 'share':
        onShare(project);
        break;
      case 'duplicate':
        // TODO: Implement duplicate functionality
        console.log('Duplicate project:', project.uuid);
        break;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer">
      {/* Project Thumbnail */}
      <div className="relative">
        {project.thumbnail ? (
          <Image
            src={project.thumbnail}
            alt={project.name}
            width={400}
            height={192}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-lg flex items-center justify-center">
            <div className="text-white text-4xl font-bold">
              {project.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProjectStatusColor()}`}>
            {getProjectStatus()}
          </span>
        </div>

        {/* Menu Button */}
        <div className="absolute top-3 right-3">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full transition-all duration-200"
            >
              <MoreVertical className="h-4 w-4 text-gray-600" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  <button
                    onClick={(e) => handleMenuAction('edit', e)}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Edit className="mr-3 h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleMenuAction('duplicate', e)}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Copy className="mr-3 h-4 w-4" />
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => handleMenuAction('share', e)}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Share2 className="mr-3 h-4 w-4" />
                    Share
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={(e) => handleMenuAction('delete', e)}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="mr-3 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-2">
            {project.name}
          </h3>
          <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </div>

        {project.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Project Metadata */}
        <div className="space-y-2">
          <div className="flex items-center text-xs text-gray-500">
            <User className="mr-1 h-3 w-3" />
            <span className="truncate">{project.prjOwner}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center">
              <Calendar className="mr-1 h-3 w-3" />
              <span>Updated {formatDate(project.lastChangeDate)}</span>
            </div>
            
            {project.classifiers && project.classifiers.length > 0 && (
              <div className="flex items-center space-x-1">
                {project.classifiers.slice(0, 2).map((classifier, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {classifier}
                  </span>
                ))}
                {project.classifiers.length > 2 && (
                  <span className="text-xs text-gray-400">
                    +{project.classifiers.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
