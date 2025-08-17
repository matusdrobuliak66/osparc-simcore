'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Project, WorkbenchNode, NodePosition } from '@/types/projects';

interface PipelineViewProps {
  project: Project;
  onUpdateNodePosition?: (nodeId: string, position: NodePosition) => void;
}

interface DragState {
  isDragging: boolean;
  nodeId: string | null;
  offset: { x: number; y: number };
}

export default function PipelineView({ project, onUpdateNodePosition }: PipelineViewProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 }
  });

  // Generate default positions if not available in UI
  const generateDefaultPositions = (workbench: Record<string, WorkbenchNode>) => {
    const positions: Record<string, NodePosition> = {};
    const nodeIds = Object.keys(workbench);

    nodeIds.forEach((nodeId, index) => {
      // Arrange nodes in a grid layout if no positions are specified
      const cols = Math.ceil(Math.sqrt(nodeIds.length));
      const row = Math.floor(index / cols);
      const col = index % cols;

      positions[nodeId] = {
        x: 50 + col * 200,
        y: 50 + row * 150
      };
    });

    return positions;
  };

  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>(() => {
    const uiPositions = project.ui?.workbench || {};
    const hasValidPositions = Object.keys(uiPositions).length > 0;

    if (hasValidPositions) {
      console.log('Using existing UI positions:', uiPositions);
      return uiPositions;
    } else {
      console.log('Generating default positions for workbench:', project.workbench);
      return generateDefaultPositions(project.workbench);
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    setDragState({
      isDragging: true,
      nodeId,
      offset
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.nodeId || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = {
      x: e.clientX - containerRect.left - dragState.offset.x,
      y: e.clientY - containerRect.top - dragState.offset.y
    };

    setNodePositions(prev => ({
      ...prev,
      [dragState.nodeId!]: newPosition
    }));
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.nodeId) {
      const finalPosition = nodePositions[dragState.nodeId];
      onUpdateNodePosition?.(dragState.nodeId, finalPosition);
    }

    setDragState({
      isDragging: false,
      nodeId: null,
      offset: { x: 0, y: 0 }
    });
  }, [dragState, nodePositions, onUpdateNodePosition]);

  const getNodeStatusColor = (node: WorkbenchNode) => {
    const status = node.state?.currentStatus?.toLowerCase() || 'unknown';
    switch (status) {
      case 'success':
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'running':
      case 'started':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'failed':
      case 'error':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'pending':
      case 'waiting':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const renderConnections = () => {
    const connections: React.ReactElement[] = [];

    Object.entries(project.workbench).forEach(([nodeId, node]) => {
      if (node.outputNodes && node.outputNodes.length > 0) {
        const startPos = nodePositions[nodeId];
        if (!startPos) return;

        node.outputNodes.forEach((targetNodeId, index) => {
          const endPos = nodePositions[targetNodeId];
          if (!endPos) return;

          const startX = startPos.x + 120; // Node width + padding
          const startY = startPos.y + 40; // Node height / 2
          const endX = endPos.x;
          const endY = endPos.y + 40;

          connections.push(
            <line
              key={`${nodeId}-${targetNodeId}-${index}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#6B7280"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          );
        });
      }
    });

    return connections;
  };

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
        <p className="text-sm text-gray-600">{project.description}</p>
      </div>

      {/* Pipeline Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-auto cursor-default"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* SVG for connections */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6B7280"
              />
            </marker>
          </defs>
          {renderConnections()}
        </svg>

        {/* Nodes */}
        <div className="relative" style={{ zIndex: 2 }}>
          {Object.entries(project.workbench).map(([nodeId, node]) => {
            const position = nodePositions[nodeId] || { x: 100, y: 100 };
            const statusColor = getNodeStatusColor(node);

            return (
              <div
                key={nodeId}
                className={`absolute w-32 h-20 rounded-lg border-2 shadow-md cursor-move transition-all duration-200 hover:shadow-lg ${statusColor} ${
                  dragState.nodeId === nodeId ? 'scale-105 shadow-xl' : ''
                }`}
                style={{
                  left: position.x,
                  top: position.y,
                  userSelect: 'none'
                }}
                onMouseDown={(e) => handleMouseDown(e, nodeId)}
              >
                <div className="p-2 h-full flex flex-col justify-between">
                  <div className="flex-1">
                    <div className="text-xs font-medium truncate" title={node.label}>
                      {node.label}
                    </div>
                    <div className="text-xs opacity-75 truncate" title={node.key}>
                      {node.key}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-xs">
                      v{node.version}
                    </div>
                    {node.state?.currentStatus && (
                      <div className="w-2 h-2 rounded-full bg-current opacity-75"></div>
                    )}
                  </div>
                </div>

                {/* Input/Output indicators */}
                {node.inputNodes && node.inputNodes.length > 0 && (
                  <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gray-400 rounded-full"></div>
                )}
                {node.outputNodes && node.outputNodes.length > 0 && (
                  <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gray-600 rounded-full"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 text-sm text-gray-600">
        Nodes: {Object.keys(project.workbench).length} |
        Status: {project.state?.state?.value || 'Unknown'}
      </div>
    </div>
  );
}
