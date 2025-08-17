'use client';

import React, { useCallback } from 'react';
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
  addEdge,
  Connection,
  BackgroundVariant,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Sample workbench data to demonstrate the functionality
const initialNodes: Node[] = [
  {
    id: 'node-1',
    type: 'default',
    position: { x: 100, y: 100 },
    data: {
      label: 'Input Service',
      status: 'completed'
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: 'node-2',
    type: 'default',
    position: { x: 300, y: 100 },
    data: {
      label: 'Processing Service',
      status: 'running'
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: 'node-3',
    type: 'default',
    position: { x: 500, y: 100 },
    data: {
      label: 'Output Service',
      status: 'pending'
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
];

const initialEdges: Edge[] = [
  {
    id: 'edge-1-2',
    source: 'node-1',
    target: 'node-2',
    type: 'smoothstep',
    animated: true,
  },
  {
    id: 'edge-2-3',
    source: 'node-2',
    target: 'node-3',
    type: 'smoothstep',
    animated: true,
  },
];

export default function ReactFlowDemo() {
  return (
    <ReactFlowProvider>
      <ReactFlowDemoInner />
    </ReactFlowProvider>
  );
}

function ReactFlowDemoInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Log position changes for demonstration
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          console.log(`Node ${change.id} moved to position:`, change.position);
        }
      });
    },
    [onNodesChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('Connection created:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold text-gray-900">React Flow Demo - Project Workbench</h1>
        <p className="text-sm text-gray-600">
          Drag nodes around to see React Flow in action. This demonstrates the same functionality
          that will be used in the actual project workbench.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{
            padding: 50,
          }}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          selectNodesOnDrag={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#e5e7eb"
          />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={true}
          />
          <MiniMap
            nodeColor={(node) => {
              switch (node.data.status) {
                case 'completed': return '#10b981';
                case 'running': return '#3b82f6';
                case 'pending': return '#f59e0b';
                default: return '#6b7280';
              }
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
        </ReactFlow>
      </div>
    </div>
  );
}
