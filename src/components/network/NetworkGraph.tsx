'use client';

import { FC, useRef, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NetworkGraph as NetworkGraphType, NetworkNode, NetworkEdge } from '@/lib/types/network';
import { getRelationshipTypeLabel, getRelationshipColor } from '@/lib/types/network';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

interface NetworkGraphProps {
  graph: NetworkGraphType;
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onNodeHover?: (node: NetworkNode | null) => void;
  selectedNodeId?: string | null;
  className?: string;
}

// Simple force-directed layout simulation
interface SimNode extends NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NetworkGraph: FC<NetworkGraphProps> = ({
  graph,
  width = 600,
  height = 400,
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [simulatedNodes, setSimulatedNodes] = useState<SimNode[]>([]);

  // Initialize and run force simulation
  useEffect(() => {
    if (graph.nodes.length === 0) return;

    // Initialize node positions
    const nodes: SimNode[] = graph.nodes.map((node, i) => {
      const angle = (i / graph.nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) / 3;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    // Create edge lookup for force calculation
    const edgeMap = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
      if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, []);
      edgeMap.get(edge.source)!.push(edge.target);
      edgeMap.get(edge.target)!.push(edge.source);
    }

    // Run simulation
    let iteration = 0;
    const maxIterations = 100;
    const alpha = 0.3;
    const repulsion = 500;
    const attraction = 0.01;
    const centerForce = 0.05;

    const simulate = () => {
      if (iteration >= maxIterations) return;

      // Apply forces
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Repulsion from all other nodes
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          node.vx += (dx / dist) * force * alpha;
          node.vy += (dy / dist) * force * alpha;
        }

        // Attraction to connected nodes
        const connected = edgeMap.get(node.id) || [];
        for (const connectedId of connected) {
          const other = nodes.find((n) => n.id === connectedId);
          if (!other) continue;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          node.vx += dx * attraction * alpha;
          node.vy += dy * attraction * alpha;
        }

        // Center force
        node.vx += (width / 2 - node.x) * centerForce * alpha;
        node.vy += (height / 2 - node.y) * centerForce * alpha;

        // Apply velocity with damping
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.9;
        node.vy *= 0.9;

        // Keep within bounds
        node.x = Math.max(30, Math.min(width - 30, node.x));
        node.y = Math.max(30, Math.min(height - 30, node.y));
      }

      iteration++;
      setSimulatedNodes([...nodes]);

      if (iteration < maxIterations) {
        requestAnimationFrame(simulate);
      }
    };

    simulate();
  }, [graph, width, height]);

  // Build edge paths
  const edgePaths = useMemo(() => {
    if (simulatedNodes.length === 0) return [];

    const nodeMap = new Map(simulatedNodes.map((n) => [n.id, n]));

    return graph.edges.map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!source || !target) return null;

      return {
        ...edge,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
      };
    }).filter(Boolean);
  }, [graph.edges, simulatedNodes]);

  const handleNodeClick = (node: NetworkNode) => {
    onNodeClick?.(node);
  };

  const handleNodeHover = (node: NetworkNode | null) => {
    setHoveredNode(node?.id || null);
    onNodeHover?.(node);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (graph.nodes.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ width, height }}
      >
        No network data available
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded bg-background/80 hover:bg-background border shadow-sm"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded bg-background/80 hover:bg-background border shadow-sm"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 rounded bg-background/80 hover:bg-background border shadow-sm"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Graph */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border rounded-lg bg-muted/20"
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edgePaths.map((edge) =>
            edge ? (
              <line
                key={edge.id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={edge.color || '#94a3b8'}
                strokeWidth={edge.width || 1}
                strokeDasharray={edge.dashed ? '4 2' : undefined}
                opacity={
                  hoveredNode
                    ? edge.source === hoveredNode || edge.target === hoveredNode
                      ? 1
                      : 0.2
                    : 0.6
                }
              />
            ) : null
          )}

          {/* Nodes */}
          {simulatedNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isHovered = node.id === hoveredNode;
            const isConnected =
              hoveredNode &&
              graph.edges.some(
                (e) =>
                  (e.source === hoveredNode && e.target === node.id) ||
                  (e.target === hoveredNode && e.source === node.id)
              );

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => handleNodeHover(node)}
                onMouseLeave={() => handleNodeHover(null)}
                className="cursor-pointer"
                opacity={
                  hoveredNode && !isHovered && !isConnected && hoveredNode !== node.id
                    ? 0.3
                    : 1
                }
              >
                {/* Node circle */}
                <circle
                  r={node.size || 8}
                  fill={node.color || '#3b82f6'}
                  stroke={isSelected ? '#000' : isHovered ? '#666' : 'white'}
                  strokeWidth={isSelected ? 3 : 2}
                />

                {/* Label */}
                <text
                  y={-12}
                  textAnchor="middle"
                  className="text-xs fill-foreground pointer-events-none"
                  style={{ fontSize: 10 }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-2 text-xs">
        <span className="text-muted-foreground">
          {graph.metadata.node_count} nodes, {graph.metadata.edge_count} edges
        </span>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-2 left-2 p-2 rounded bg-background/95 border shadow-lg text-xs">
          {(() => {
            const node = simulatedNodes.find((n) => n.id === hoveredNode);
            if (!node) return null;

            return (
              <div>
                <div className="font-medium">{node.label}</div>
                {node.aircraft_type && (
                  <div className="text-muted-foreground">
                    Type: {node.aircraft_type}
                  </div>
                )}
                {node.military_category && (
                  <div className="text-muted-foreground">
                    Category: {node.military_category}
                  </div>
                )}
                <div className="text-muted-foreground">
                  Connections: {node.degree}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;
