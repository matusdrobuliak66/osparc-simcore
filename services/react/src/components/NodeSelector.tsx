'use client';

import React, { useState } from 'react';

interface NodeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (nodeType: string) => void;
}

const NODE_TEMPLATES = [
  {
    id: 'file-picker',
    name: 'File Picker',
    description: 'Select input files for your workflow',
    icon: '📁',
    category: 'Input',
    color: 'blue'
  },
  {
    id: 'jupyter-lab',
    name: 'Jupyter Lab',
    description: 'Interactive computing environment',
    icon: '📓',
    category: 'Computing',
    color: 'orange'
  },
  {
    id: 'data-iterator',
    name: 'Data Iterator',
    description: 'Process data in batches',
    icon: '🔄',
    category: 'Processing',
    color: 'purple'
  },
  {
    id: 'parameter-sweep',
    name: 'Parameter Sweep',
    description: 'Run multiple parameter combinations',
    icon: '🎛️',
    category: 'Analysis',
    color: 'green'
  },
  {
    id: 'postpro',
    name: 'Post Processing',
    description: 'Analyze and visualize results',
    icon: '📈',
    category: 'Analysis',
    color: 'indigo'
  },
  {
    id: 'viewer',
    name: 'Result Viewer',
    description: 'Display outputs and results',
    icon: '👁️',
    category: 'Output',
    color: 'pink'
  }
];

const CATEGORIES = ['Input', 'Computing', 'Processing', 'Analysis', 'Output'];

export default function NodeSelector({ isOpen, onClose, onAddNode }: NodeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredNodes = NODE_TEMPLATES.filter(node => {
    const matchesCategory = !selectedCategory || node.category === selectedCategory;
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryColor = (category: string) => {
    const colors = {
      'Input': 'bg-blue-100 text-blue-800 border-blue-200',
      'Computing': 'bg-orange-100 text-orange-800 border-orange-200',
      'Processing': 'bg-purple-100 text-purple-800 border-purple-200',
      'Analysis': 'bg-green-100 text-green-800 border-green-200',
      'Output': 'bg-pink-100 text-pink-800 border-pink-200',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getNodeColor = (color: string) => {
    const colors = {
      'blue': 'border-blue-300 hover:border-blue-400 hover:bg-blue-50',
      'orange': 'border-orange-300 hover:border-orange-400 hover:bg-orange-50',
      'purple': 'border-purple-300 hover:border-purple-400 hover:bg-purple-50',
      'green': 'border-green-300 hover:border-green-400 hover:bg-green-50',
      'indigo': 'border-indigo-300 hover:border-indigo-400 hover:bg-indigo-50',
      'pink': 'border-pink-300 hover:border-pink-400 hover:bg-pink-50',
    };
    return colors[color as keyof typeof colors] || 'border-gray-300 hover:border-gray-400 hover:bg-gray-50';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Add Node to Pipeline</h2>
              <p className="text-blue-100 mt-1">Choose a component to add to your workflow</p>
            </div>
            <button
              onClick={onClose}
              className="text-blue-100 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    selectedCategory === category
                      ? getCategoryColor(category)
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Node Grid */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNodes.map(node => (
              <button
                key={node.id}
                onClick={() => {
                  onAddNode(node.id);
                  onClose();
                }}
                className={`text-left p-4 border-2 rounded-xl transition-all duration-200 ${getNodeColor(node.color)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">{node.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{node.name}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{node.description}</p>
                    <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-md border ${getCategoryColor(node.category)}`}>
                      {node.category}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredNodes.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No nodes found</h3>
              <p className="text-gray-600">Try adjusting your search or category filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
