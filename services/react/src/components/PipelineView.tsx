'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  ConnectionMode,
  Position,
  BackgroundVariant,
  NodeProps,
  Handle,
  HandleType,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/styles/react-flow-custom.css';
import { Project, WorkbenchNode, NodePosition } from '@/types/projects';
import NodeSelector from './NodeSelector';

interface PipelineViewProps {
  project: Project;
  onUpdateNodePosition?: (nodeId: string, position: NodePosition) => void;
}

// Custom node component inspired by n8n design
const WorkbenchNodeComponent = ({ data, selected }: NodeProps<{ node: WorkbenchNode }>) => {
  const { node } = data;

  const getNodeStatusColors = (node: WorkbenchNode) => {
    const status = node.state?.currentStatus?.toLowerCase() || 'unknown';
    switch (status) {
      case 'success':
      case 'completed':
        return {
          bg: 'bg-white',
          border: 'border-green-400',
          accent: 'bg-green-500',
          text: 'text-gray-900',
          shadow: 'shadow-green-100'
        };
      case 'running':
      case 'started':
        return {
          bg: 'bg-white',
          border: 'border-blue-400',
          accent: 'bg-blue-500',
          text: 'text-gray-900',
          shadow: 'shadow-blue-100'
        };
      case 'failed':
      case 'error':
        return {
          bg: 'bg-white',
          border: 'border-red-400',
          accent: 'bg-red-500',
          text: 'text-gray-900',
          shadow: 'shadow-red-100'
        };
      case 'pending':
      case 'waiting':
        return {
          bg: 'bg-white',
          border: 'border-yellow-400',
          accent: 'bg-yellow-500',
          text: 'text-gray-900',
          shadow: 'shadow-yellow-100'
        };
      default:
        return {
          bg: 'bg-white',
          border: 'border-gray-300',
          accent: 'bg-gray-400',
          text: 'text-gray-900',
          shadow: 'shadow-gray-100'
        };
    }
  };

  const colors = getNodeStatusColors(node);

  // Count inputs and outputs for handle positioning
  const inputCount = Object.keys(node.inputs || {}).length;
  const outputCount = Object.keys(node.outputs || {}).length;
  const maxHandles = Math.max(inputCount, outputCount, 1);

  // Get node icon based on key
  const getNodeIcon = (key: string) => {
    if (key.includes('solver')) return '⚙️';
    if (key.includes('data')) return '📊';
    if (key.includes('file')) return '📁';
    if (key.includes('jupyter')) return '📓';
    if (key.includes('param')) return '🎛️';
    if (key.includes('postpro')) return '📈';
    if (key.includes('viewer')) return '👁️';
    return '🔧';
  };

  return (
    <div className={`relative group transition-all duration-200 ${selected ? 'scale-105' : ''}`}>
      {/* Input Handles */}
      {Array.from({ length: Math.max(inputCount, 1) }, (_, i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Left}
          id={`input-${i}`}
          style={{
            top: `${((i + 1) / (Math.max(inputCount, 1) + 1)) * 100}%`,
            width: '12px',
            height: '12px',
            backgroundColor: '#6B7280',
            border: '2px solid white',
            borderRadius: '50%',
          }}
          className="transition-all duration-200 hover:scale-125 hover:bg-blue-500"
        />
      ))}

      {/* Output Handles */}
      {Array.from({ length: Math.max(outputCount, 1) }, (_, i) => (
        <Handle
          key={`output-${i}`}
          type="source"
          position={Position.Right}
          id={`output-${i}`}
          style={{
            top: `${((i + 1) / (Math.max(outputCount, 1) + 1)) * 100}%`,
            width: '12px',
            height: '12px',
            backgroundColor: '#6B7280',
            border: '2px solid white',
            borderRadius: '50%',
          }}
          className="transition-all duration-200 hover:scale-125 hover:bg-green-500"
        />
      ))}

      {/* Main Node Body */}
      <div className={`
        w-56 min-h-[120px] rounded-xl border-2 shadow-lg transition-all duration-200
        ${colors.bg} ${colors.border} ${colors.shadow}
        ${selected ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        hover:shadow-xl hover:border-opacity-80
        relative overflow-hidden
      `}>
        {/* Status indicator stripe */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${colors.accent}`} />

        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getNodeIcon(node.key)}</div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-sm truncate ${colors.text}`} title={node.label}>
                {node.label}
              </h3>
              <p className="text-xs text-gray-500 truncate" title={node.key}>
                {node.key}
              </p>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              v{node.version}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4">
          {/* Inputs/Outputs Summary */}
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-400 mr-1"></span>
              {inputCount} input{inputCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-400 mr-1"></span>
              {outputCount} output{outputCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Status */}
          {node.state?.currentStatus && (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${colors.accent} animate-pulse`}></div>
              <span className="text-xs font-medium text-gray-700 capitalize">
                {node.state.currentStatus.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Hover overlay for additional info */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-200 rounded-xl pointer-events-none" />
      </div>
    </div>
  );
};

const nodeTypes = {
  workbenchNode: WorkbenchNodeComponent,
};

export default function PipelineView({ project, onUpdateNodePosition }: PipelineViewProps) {
  return (
    <ReactFlowProvider>
      <PipelineViewInner project={project} onUpdateNodePosition={onUpdateNodePosition} />
    </ReactFlowProvider>
  );
}

function PipelineViewInner({ project, onUpdateNodePosition }: PipelineViewProps) {
  const [showNodeSelector, setShowNodeSelector] = useState(false);

  // Validate project data
  if (!project || !project.workbench || typeof project.workbench !== 'object') {
    console.warn('Invalid project data received:', project);
    return (
      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Invalid Project Data</h3>
          <p className="text-gray-600">Unable to load the project workbench</p>
        </div>
      </div>
    );
  }

  // Generate default positions with improved layout algorithm
  const generateDefaultPositions = (workbench: Record<string, WorkbenchNode>) => {
    const positions: Record<string, NodePosition> = {};
    const nodeIds = Object.keys(workbench);

    if (nodeIds.length === 0) {
      console.warn('PipelineView: No workbench nodes found in project');
      return positions;
    }

    // Try to create a flow-like layout based on connections
    const processedNodes = new Set<string>();
    const levels: string[][] = [];

    // Find root nodes (nodes with no input connections)
    const rootNodes = nodeIds.filter(nodeId =>
      !nodeIds.some(otherId =>
        workbench[otherId].outputNodes?.includes(nodeId)
      )
    );

    // If no clear root nodes, start with first node
    if (rootNodes.length === 0 && nodeIds.length > 0) {
      rootNodes.push(nodeIds[0]);
    }

    // Build levels using BFS-like approach
    let currentLevel = [...rootNodes];
    while (currentLevel.length > 0) {
      levels.push([...currentLevel]);
      currentLevel.forEach(nodeId => processedNodes.add(nodeId));

      const nextLevel: string[] = [];
      currentLevel.forEach(nodeId => {
        const outputNodes = workbench[nodeId].outputNodes || [];
        outputNodes.forEach(outputNodeId => {
          if (!processedNodes.has(outputNodeId) && !nextLevel.includes(outputNodeId)) {
            nextLevel.push(outputNodeId);
          }
        });
      });
      currentLevel = nextLevel;
    }

    // Add any remaining unprocessed nodes to the last level
    const unprocessedNodes = nodeIds.filter(nodeId => !processedNodes.has(nodeId));
    if (unprocessedNodes.length > 0) {
      levels.push(unprocessedNodes);
    }

    // Position nodes based on levels
    const nodeWidth = 280; // Width including spacing
    const nodeHeight = 180; // Height including spacing
    const startX = 100;
    const startY = 100;

    levels.forEach((level, levelIndex) => {
      const levelY = startY + levelIndex * nodeHeight;
      level.forEach((nodeId, nodeIndex) => {
        const levelX = startX + nodeIndex * nodeWidth;

        // Ensure we never set NaN values
        positions[nodeId] = {
          x: isFinite(levelX) ? levelX : 100 + nodeIndex * 280,
          y: isFinite(levelY) ? levelY : 100 + levelIndex * 180
        };
      });
    });

    return positions;
  };

  // Convert workbench nodes to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    try {
      const uiPositions = project.ui?.workbench || {};
      const hasValidPositions = Object.keys(uiPositions).length > 0;
      const defaultPositions = hasValidPositions ? uiPositions : generateDefaultPositions(project.workbench);

      return Object.entries(project.workbench).map(([nodeId, node]) => {
        const rawPosition = defaultPositions[nodeId] || { x: 100, y: 100 };

        // Ensure position values are valid numbers
        const position = {
          x: typeof rawPosition.x === 'number' && !isNaN(rawPosition.x) ? rawPosition.x : 100,
          y: typeof rawPosition.y === 'number' && !isNaN(rawPosition.y) ? rawPosition.y : 100,
        };

        return {
          id: nodeId,
          type: 'workbenchNode',
          position,
          data: { node },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
        };
      });
    } catch (error) {
      console.error('Error creating React Flow nodes:', error);
      return [];
    }
  }, [project.workbench, project.ui?.workbench]);

  // Convert connections to React Flow edges with enhanced styling
  const initialEdges: Edge[] = useMemo(() => {
    try {
      const edges: Edge[] = [];

      Object.entries(project.workbench).forEach(([nodeId, node]) => {
        if (node.outputNodes && node.outputNodes.length > 0) {
          node.outputNodes.forEach((targetNodeId, index) => {
            // Check if target node exists to avoid React Flow warnings
            if (project.workbench[targetNodeId]) {
              const sourceNode = project.workbench[nodeId];
              const targetNode = project.workbench[targetNodeId];

              // Determine edge style based on node states
              const getEdgeStyle = () => {
                const sourceStatus = sourceNode.state?.currentStatus?.toLowerCase();
                const targetStatus = targetNode.state?.currentStatus?.toLowerCase();

                if (sourceStatus === 'running' || targetStatus === 'running') {
                  return {
                    stroke: '#3B82F6',
                    strokeWidth: 3,
                    strokeDasharray: '8 8',
                  };
                } else if (sourceStatus === 'completed' && targetStatus === 'completed') {
                  return {
                    stroke: '#10B981',
                    strokeWidth: 2,
                  };
                } else if (sourceStatus === 'failed' || targetStatus === 'failed') {
                  return {
                    stroke: '#EF4444',
                    strokeWidth: 2,
                  };
                } else {
                  return {
                    stroke: '#6B7280',
                    strokeWidth: 2,
                  };
                }
              };

              edges.push({
                id: `${nodeId}-${targetNodeId}-${index}`,
                source: nodeId,
                target: targetNodeId,
                sourceHandle: 'output-0', // Connect to first output by default
                targetHandle: 'input-0',  // Connect to first input by default
                type: 'smoothstep',
                animated: sourceNode.state?.currentStatus?.toLowerCase() === 'running' ||
                         targetNode.state?.currentStatus?.toLowerCase() === 'running',
                style: getEdgeStyle(),
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                  color: getEdgeStyle().stroke,
                },
              });
            }
          });
        }
      });

      return edges;
    } catch (error) {
      console.error('Error creating React Flow edges:', error);
      return [];
    }
  }, [project.workbench]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle node position changes
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      try {
        onNodesChange(changes);

        // Check for position changes and update the parent component
        changes.forEach((change) => {
          if (change.type === 'position' && change.position && onUpdateNodePosition) {
            const { x, y } = change.position;

            // Validate position values before updating
            if (typeof x === 'number' && typeof y === 'number' &&
                isFinite(x) && isFinite(y) && !isNaN(x) && !isNaN(y)) {
              onUpdateNodePosition(change.id, { x, y });
            } else {
              console.warn('Invalid position detected, skipping update:', change.position);
            }
          }
        });
      } catch (error) {
        console.error('Error handling node changes:', error);
      }
    },
    [onNodesChange, onUpdateNodePosition]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      try {
        setEdges((eds) => addEdge(params, eds));
      } catch (error) {
        console.error('Error connecting nodes:', error);
      }
    },
    [setEdges]
  );

  const handleAddNode = useCallback((nodeType: string) => {
    console.log('Adding node of type:', nodeType);
    // TODO: Implement actual node creation with backend API
    // For now, just log the action
  }, []);

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Enhanced Header with Gradient */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{project.name}</h1>
              <p className="text-gray-600">{project.description}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Workflow Stats */}
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-gray-600">{Object.keys(project.workbench).length} Nodes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-gray-600">{initialEdges.length} Connections</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span className="text-gray-600 capitalize">{project.state?.state?.value || 'Ready'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced React Flow Pipeline Canvas */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{
            padding: 100,
            includeHiddenNodes: false,
            maxZoom: 1,
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          minZoom={0.1}
          maxZoom={1.5}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          selectNodesOnDrag={false}
          deleteKeyCode={null} // Disable node deletion with delete key
          onError={(id, message) => {
            console.error(`React Flow Error [${id}]:`, message);
          }}
          className="bg-transparent"
        >
          <Background
            color="#e2e8f0"
            gap={24}
            size={1}
            variant={BackgroundVariant.Dots}
            className="opacity-40"
          />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            className="bg-white shadow-lg border border-gray-200 rounded-lg"
          />
          <MiniMap
            nodeColor={(node) => {
              try {
                const workbenchNode = node.data?.node as WorkbenchNode;
                const status = workbenchNode?.state?.currentStatus?.toLowerCase();
                switch (status) {
                  case 'running': return '#3B82F6';
                  case 'completed': return '#10B981';
                  case 'failed': return '#EF4444';
                  case 'pending': return '#F59E0B';
                  default: return '#6B7280';
                }
              } catch (error) {
                console.warn('Error getting node color for minimap:', error);
                return '#6B7280';
              }
            }}
            nodeStrokeWidth={2}
            nodeStrokeColor="#ffffff"
            nodeBorderRadius={8}
            zoomable
            pannable
            position="bottom-right"
            className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
            style={{
              backgroundColor: '#f8fafc',
              width: 200,
              height: 150,
            }}
          />
        </ReactFlow>

        {/* Floating Action Panel */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-3 text-sm">
            <button
              onClick={() => setShowNodeSelector(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Node</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Run</span>
            </button>
          </div>
        </div>
      </div>

      {/* Node Selector Modal */}
      <NodeSelector
        isOpen={showNodeSelector}
        onClose={() => setShowNodeSelector(false)}
        onAddNode={handleAddNode}
      />

      {/* Enhanced Status Bar */}
      <div className="bg-white border-t border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6 text-gray-600">
            <span>Pipeline: <strong className="text-gray-900">{project.name}</strong></span>
            <span>•</span>
            <span>Last Modified: <strong className="text-gray-900">{new Date(project.lastChangeDate).toLocaleDateString()}</strong></span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-gray-600">Auto-save enabled</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
