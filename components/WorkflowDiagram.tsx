import React, { useRef } from 'react';
import { HciAnalysisData, NodeType } from '../types';
import { User, Cpu, Image as ImageIcon, X, Network, Share2, ArrowRight, Monitor, Download, ArrowDown, FileJson, FileImage, Zap, Database, Layers } from 'lucide-react';
import html2canvas from 'html2canvas';

interface WorkflowDiagramProps {
  data: HciAnalysisData;
  onClose: () => void;
}

// Fixed Layout Grid Positions (Percentages for the fixed 1200x900 canvas)
// Adjusted y-coordinates to prevent clipping and improve vertical flow
const NODE_POSITIONS: Record<NodeType, { x: number, y: number }> = {
  'user': { x: 50, y: 10 },           // Top
  'orchestrator': { x: 50, y: 40 },   // Center
  'logic_agent': { x: 20, y: 68 },    // Bottom Left
  'creative_agent': { x: 80, y: 68 }, // Bottom Right
  'interface': { x: 50, y: 90 }       // Bottom
};

const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({ data, onClose }) => {
  const diagramRef = useRef<HTMLDivElement>(null);

  const getNode = (type: NodeType) => data.nodes.find(n => n.type === type);

  const handleDownload = async () => {
    if (!diagramRef.current) return;
    try {
      // Small delay to ensure rendering is stable
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2, // High resolution for professional presentations
        backgroundColor: '#F1F5F9', // Match bg-slate-100
        useCORS: true,
        logging: false,
        allowTaint: true
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'architecture-data-flow.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download diagram", err);
    }
  };

  // Improved curve calculation for distinct separation
  const getPath = (from: NodeType, to: NodeType) => {
    const start = NODE_POSITIONS[from];
    const end = NODE_POSITIONS[to];
    
    // Control points to create nice "S" curves or wide arcs
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Curvature intensity
    const tension = 0.5;

    let cx1 = start.x;
    let cy1 = start.y + dy * tension;
    let cx2 = end.x;
    let cy2 = end.y - dy * tension;

    // Special case for Orchestrator to Agents (spread out sideways)
    if (from === 'orchestrator' && (to === 'logic_agent' || to === 'creative_agent')) {
         cx1 = start.x + dx * 0.2;
         cy1 = start.y + dy * 0.5;
         cx2 = end.x - dx * 0.2;
         cy2 = end.y - dy * 0.5;
    }

    return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
  };

  const getIcon = (type: NodeType) => {
    switch (type) {
      case 'user': return <User size={28} />;
      case 'orchestrator': return <Network size={28} />;
      case 'logic_agent': return <Cpu size={28} />;
      case 'creative_agent': return <ImageIcon size={28} />;
      case 'interface': return <Monitor size={28} />;
      default: return <Share2 size={28} />;
    }
  };

  const getNodeStyles = (type: NodeType) => {
    switch (type) {
      case 'user': return { bg: 'bg-blue-600', border: 'border-blue-200', text: 'text-blue-900', light: 'bg-blue-50' };
      case 'orchestrator': return { bg: 'bg-slate-700', border: 'border-slate-200', text: 'text-slate-900', light: 'bg-slate-50' };
      case 'logic_agent': return { bg: 'bg-indigo-600', border: 'border-indigo-200', text: 'text-indigo-900', light: 'bg-indigo-50' };
      case 'creative_agent': return { bg: 'bg-purple-600', border: 'border-purple-200', text: 'text-purple-900', light: 'bg-purple-50' };
      case 'interface': return { bg: 'bg-emerald-600', border: 'border-emerald-200', text: 'text-emerald-900', light: 'bg-emerald-50' };
      default: return { bg: 'bg-gray-600', border: 'border-gray-200', text: 'text-gray-900', light: 'bg-gray-50' };
    }
  };

  const getEdgeColor = (from: NodeType) => {
      switch(from) {
          case 'user': return '#2563EB'; // Blue
          case 'orchestrator': return '#64748B'; // Slate
          case 'logic_agent': return '#6366F1'; // Indigo
          case 'creative_agent': return '#9333EA'; // Purple
          default: return '#94A3B8';
      }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden relative">
        
        {/* Header Bar */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0 z-20">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Network className="text-indigo-600" />
                Architecture & Data Flow
                </h2>
                <p className="text-xs text-slate-500">Visualizing component relationships and information exchange</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                >
                    <Download size={18} />
                    Download Image
                </button>
                <button 
                    onClick={onClose}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-8 custom-scrollbar">
            
            {/* 
               THE CANVAS TO CAPTURE 
               Fixed width/height (1200x900) ensures consistent export layout.
            */}
            <div 
                ref={diagramRef}
                className="relative bg-slate-50 shadow-xl border border-slate-200 rounded-xl flex-shrink-0"
                style={{ width: '1200px', height: '900px' }}
            >
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.05]" 
                     style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                </div>

                {/* Metadata in corner */}
                <div className="absolute top-8 left-8">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">SYSTEM<br/>BLUEPRINT</h1>
                    <div className="h-2 w-20 bg-indigo-600 mt-2"></div>
                </div>

                {/* Legend */}
                <div className="absolute bottom-8 right-8 bg-white/90 p-4 rounded-lg border border-slate-200 shadow-sm text-xs">
                    <h4 className="font-bold text-slate-700 mb-2 uppercase">Data Flow Types</h4>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2"><div className="w-8 h-1 bg-blue-600 rounded"></div> <span className="text-slate-600">User Command</span></div>
                        <div className="flex items-center gap-2"><div className="w-8 h-1 bg-slate-500 rounded"></div> <span className="text-slate-600">Orchestration</span></div>
                        <div className="flex items-center gap-2"><div className="w-8 h-1 bg-indigo-500 rounded"></div> <span className="text-slate-600">Intelligence / Logic</span></div>
                        <div className="flex items-center gap-2"><div className="w-8 h-1 bg-purple-500 rounded"></div> <span className="text-slate-600">Creative Generation</span></div>
                    </div>
                </div>

                {/* SVG Layer for Edges (Now BOLD) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        {/* Markers for different colors */}
                        <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L6,3 z" fill="#2563EB" />
                        </marker>
                        <marker id="arrow-slate" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L6,3 z" fill="#64748B" />
                        </marker>
                        <marker id="arrow-indigo" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L6,3 z" fill="#6366F1" />
                        </marker>
                        <marker id="arrow-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L6,3 z" fill="#9333EA" />
                        </marker>
                    </defs>
                    
                    {data.edges.map((edge, idx) => {
                        const pathD = getPath(edge.from, edge.to);
                        // Center point for label
                        const start = NODE_POSITIONS[edge.from];
                        const end = NODE_POSITIONS[edge.to];
                        
                        // Simple linear midpoint isn't accurate for curves, but sufficient for simple S-curves usually
                        // Better approach for visuals: Weighted average based on hierarchy
                        const mx = (start.x + end.x) / 2;
                        const my = (start.y + end.y) / 2;
                        
                        let color = getEdgeColor(edge.from);
                        let arrowId = 'arrow-slate';
                        if (edge.from === 'user') arrowId = 'arrow-blue';
                        if (edge.from === 'logic_agent') arrowId = 'arrow-indigo';
                        if (edge.from === 'creative_agent') arrowId = 'arrow-purple';

                        return (
                            <g key={idx}>
                                {/* Shadow/Outline for better visibility over grid */}
                                <path 
                                    d={pathD} 
                                    fill="none" 
                                    stroke="white" 
                                    strokeWidth="6" 
                                    strokeOpacity="0.8"
                                />
                                {/* Main Line */}
                                <path 
                                    d={pathD} 
                                    fill="none" 
                                    stroke={color} 
                                    strokeWidth="3" 
                                    markerEnd={`url(#${arrowId})`}
                                />
                                
                                {/* Label Bubble on Path */}
                                <foreignObject x={mx - 10} y={my - 3.5} width="20" height="7">
                                    <div className="flex flex-col items-center justify-center w-full h-full">
                                        <div className={`bg-white border-2 px-2 py-1 rounded-lg shadow-md flex flex-col items-center z-10`} style={{ borderColor: color }}>
                                            <span className="text-[9px] font-bold text-slate-800 whitespace-nowrap leading-none mb-0.5 uppercase tracking-tight">{edge.label}</span>
                                            <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap bg-slate-50 px-1 rounded border border-slate-100">
                                                {edge.data_object}
                                            </span>
                                        </div>
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    })}
                </svg>

                {/* Nodes Layer */}
                {Object.keys(NODE_POSITIONS).map((key) => {
                    const type = key as NodeType;
                    const node = getNode(type);
                    const pos = NODE_POSITIONS[type];
                    const styles = getNodeStyles(type);

                    if (!node) return null;

                    return (
                        <div 
                            key={type}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-80 bg-white rounded-xl shadow-xl border-2 ${styles.border} flex flex-col z-20`}
                            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        >
                            {/* Connection Ports (Visual Only) */}
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white ${styles.bg}`}></div>
                            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full border-2 border-white ${styles.bg}`}></div>

                            {/* Card Header */}
                            <div className={`${styles.bg} p-4 rounded-t-lg flex items-center justify-between text-white`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-white/20 rounded-lg">
                                        {getIcon(type)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm leading-tight">{node.subLabel}</h3>
                                        <p className="text-[10px] uppercase tracking-wider opacity-80 font-medium">{node.label}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 bg-white rounded-b-lg">
                                
                                {/* Theory Context */}
                                <div className={`p-2.5 rounded-lg text-xs italic text-slate-600 mb-4 border ${styles.light.replace('bg-', 'border-').replace('50', '200')} ${styles.light}`}>
                                    "{node.theory_mapping}"
                                </div>

                                <div className="flex gap-4">
                                    {/* Inputs */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">
                                            <ArrowDown size={12} /> Input
                                        </div>
                                        <div className="space-y-1.5">
                                            {node.inputs.map((inp, i) => (
                                                <div key={i} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-600 font-medium truncate flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                    {inp}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Outputs */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">
                                            <Zap size={12} /> Output
                                        </div>
                                        <div className="space-y-1.5">
                                            {node.outputs.map((out, i) => (
                                                <div key={i} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-600 font-medium truncate flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${styles.bg}`}></div>
                                                    {out}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

            </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDiagram;