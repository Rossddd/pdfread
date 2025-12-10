import React, { useState, useRef, useEffect } from 'react';
import { DocumentPage, GeneratedAsset, DiagramNode, DiagramConnection } from '../types';
import { Wand2, Download, Image as ImageIcon, Loader2, Upload, RotateCcw, SlidersHorizontal, Code, Layers, Palette, Network, Type as TypeIcon, MousePointer2, Link as LinkIcon, X } from 'lucide-react';
import html2canvas from 'html2canvas';

type RefineTarget = 'svg' | 'background';

interface ImageGeneratorProps {
  referencePage: DocumentPage | null;
  onGenerate: (prompt: string) => Promise<void>;
  onRefine: (prompt: string, target: RefineTarget) => Promise<void>;
  onAssetUpdate: (asset: GeneratedAsset) => void;
  onUpload: (files: File[]) => void;
  onReset: () => void;
  isGenerating: boolean;
  generatedAsset: GeneratedAsset | null;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ 
  referencePage, 
  onGenerate, 
  onRefine,
  onAssetUpdate,
  onUpload,
  onReset,
  isGenerating, 
  generatedAsset 
}) => {
  // Main State
  const [prompt, setPrompt] = useState('');
  const [refineTarget, setRefineTarget] = useState<RefineTarget>('svg');
  
  // Diagram State (Nodes & Connections)
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [connections, setConnections] = useState<DiagramConnection[]>([]);
  
  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Dragging Card Logic
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // Connection Drawing Logic
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineStartNodeId, setLineStartNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  // Sync prop to local state
  useEffect(() => {
    if (generatedAsset) {
      if (generatedAsset.nodes) setNodes(generatedAsset.nodes);
      if (generatedAsset.connections) setConnections(generatedAsset.connections);
    }
  }, [generatedAsset]);

  const saveState = () => {
    if (generatedAsset) {
        onAssetUpdate({
            ...generatedAsset,
            nodes: nodes,
            connections: connections
        });
    }
  };

  // --- CARD DRAG HANDLERS ---
  const handleCardMouseDown = (e: React.MouseEvent, node: DiagramNode) => {
      e.stopPropagation();
      // If we are in "Link Mode" do nothing here, let the link button handle it
      if (isDrawingLine) return;

      setSelectedNodeId(node.id);
      setIsDragging(true);
      
      // Calculate offset within the card
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (containerRect) {
          dragOffset.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
          };
      }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      const relativeY = e.clientY - containerRect.top;

      setMousePos({ x: relativeX, y: relativeY });

      // Dragging Card
      if (isDragging && selectedNodeId) {
          setNodes(prev => prev.map(n => {
              if (n.id === selectedNodeId) {
                  return {
                      ...n,
                      x: relativeX - dragOffset.current.x,
                      y: relativeY - dragOffset.current.y
                  };
              }
              return n;
          }));
      }
  };

  const handleContainerMouseUp = (e: React.MouseEvent) => {
      if (isDragging) {
          setIsDragging(false);
          saveState();
      }

      // Finish Drawing Line
      if (isDrawingLine && lineStartNodeId) {
          // Add connection
          const newConnection: DiagramConnection = {
              id: `conn-${Date.now()}`,
              fromNodeId: lineStartNodeId,
              toX: mousePos.x,
              toY: mousePos.y
          };
          setConnections(prev => [...prev, newConnection]);
          
          // Reset
          setIsDrawingLine(false);
          setLineStartNodeId(null);
          saveState();
      }
  };

  // --- NODE CONTENT EDITING ---
  const updateSelectedNode = (updates: Partial<DiagramNode>) => {
      if (!selectedNodeId) return;
      setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, ...updates } : n));
      // No saveState here to avoid spamming updates, save on blur or dedicated save? 
      // Actually saveState propagates to parent, okay for now or use debounce.
  };

  // --- CONNECTION LOGIC ---
  const startConnection = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      e.preventDefault();
      setLineStartNodeId(nodeId);
      setIsDrawingLine(true);
      // Initialize mouse pos
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
  };
  
  const removeConnection = (id: string) => {
      setConnections(prev => prev.filter(c => c.id !== id));
      saveState();
  };

  // --- ACTIONS ---
  const handleAction = async () => {
    if (!prompt.trim()) return;
    if (generatedAsset) {
      await onRefine(prompt, refineTarget);
    } else {
      if (!referencePage) return;
      await onGenerate(prompt);
    }
  };

  const handleDownloadComposite = async () => {
    if (!resultContainerRef.current) return;
    setSelectedNodeId(null);
    
    setTimeout(async () => {
        try {
        const canvas = await html2canvas(resultContainerRef.current!, {
            useCORS: true,
            scale: 2,
            backgroundColor: null
        });
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-diagram-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        } catch (err) {
        console.error("Failed to generate composite image", err);
        }
    }, 50);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 h-full bg-slate-50 p-6 overflow-y-auto flex flex-col items-center">
      <div className="w-full max-w-7xl space-y-6">
        
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Wand2 className="text-purple-600" />
            Creative Studio
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Drag cards to arrange. Click the "Link" icon on a card to connect it to a point on the background.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start h-full">
          
          {/* LEFT: Input & Tools Section */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* Reference Image */}
            <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col transition-all ${generatedAsset ? 'h-[160px] opacity-70 hover:opacity-100' : 'min-h-[300px]'}`}>
              <div className="flex items-center gap-2 mb-3 text-slate-700 font-medium border-b border-slate-100 pb-2">
                <ImageIcon size={18} />
                <span>Reference Framework</span>
              </div>
              <div className="flex-1 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden relative group">
                {referencePage ? (
                  <img src={referencePage.url} alt="Reference" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-400 text-center p-6 flex flex-col items-center gap-4">
                    <p>No framework selected.</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
                    <button onClick={handleUploadClick} className="px-4 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-slate-700 hover:bg-slate-50 hover:text-purple-600 hover:border-purple-200 transition-all flex items-center gap-2 font-medium">
                      <Upload size={16} /> Upload Sketch
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Editor Panel */}
            {generatedAsset && selectedNodeId ? (
                 <div className="bg-indigo-50/50 rounded-2xl shadow-sm border border-indigo-200 p-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-indigo-100">
                        <div className="flex items-center gap-2 text-indigo-800 font-semibold">
                            <MousePointer2 size={18} /> Card Editor
                        </div>
                        <button onClick={() => { setSelectedNodeId(null); saveState(); }} className="text-xs text-indigo-500 hover:text-indigo-700 underline">Done</button>
                    </div>

                    <div className="space-y-4">
                        {nodes.find(n => n.id === selectedNodeId) && (
                            <>
                                <div>
                                    <label className="text-xs font-semibold text-indigo-600 mb-1 block">Title</label>
                                    <input 
                                        type="text"
                                        value={nodes.find(n => n.id === selectedNodeId)?.title || ''}
                                        onChange={(e) => updateSelectedNode({ title: e.target.value })}
                                        className="w-full p-2 text-sm rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-indigo-600 mb-1 block">Description</label>
                                    <textarea 
                                        value={nodes.find(n => n.id === selectedNodeId)?.content || ''}
                                        onChange={(e) => updateSelectedNode({ content: e.target.value })}
                                        className="w-full p-2 text-sm rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                                    />
                                </div>
                            </>
                        )}
                        <p className="text-xs text-indigo-400 italic mt-2 text-center">
                            Changes are applied immediately.
                        </p>
                    </div>
                 </div>
            ) : (
                <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-4 transition-all ${generatedAsset ? 'ring-2 ring-purple-500/20' : ''}`}>
                    {generatedAsset && (
                        <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                            <button onClick={() => setRefineTarget('svg')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${refineTarget === 'svg' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Network size={16} /> Content
                            </button>
                            <button onClick={() => setRefineTarget('background')} disabled={!generatedAsset?.background} className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${refineTarget === 'background' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'}`}>
                            <Palette size={16} /> Background
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-700">
                        {generatedAsset 
                            ? (refineTarget === 'svg' ? "AI: Regenerate Content" : "AI: Regenerate Art") 
                            : "What should this diagram show?"}
                        </label>
                        {generatedAsset && (
                        <button onClick={onReset} className="text-xs flex items-center gap-1 text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                            <RotateCcw size={12} /> Start Over
                        </button>
                        )}
                    </div>
                    
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={generatedAsset 
                        ? (refineTarget === 'svg' ? "E.g. Add a node for 'Safety Checks'..." : "E.g. Make it look like a blue print...")
                        : "E.g., Create a Cyberpunk style architecture diagram..."
                        }
                        className="w-full h-24 p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                    />
                    <button
                        onClick={handleAction}
                        disabled={(!referencePage && !generatedAsset) || !prompt.trim() || isGenerating}
                        className={`w-full mt-4 py-3 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                        ${generatedAsset 
                            ? (refineTarget === 'svg' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700') 
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                        }`}
                    >
                        {isGenerating ? (
                        <> <Loader2 className="animate-spin" size={18} /> {generatedAsset ? "Refining..." : "Creating Visuals..."} </>
                        ) : (
                        <> {generatedAsset ? <SlidersHorizontal size={18} /> : <Wand2 size={18} />} {generatedAsset ? (refineTarget === 'svg' ? "Update Content" : "Update Background") : "Generate Diagram"} </>
                        )}
                    </button>
                </div>
            )}
          </div>

          {/* RIGHT: Output Canvas */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 min-h-[600px] flex flex-col h-full relative">
             <div className="flex items-center justify-between gap-2 mb-3 text-slate-700 font-medium border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-emerald-500" />
                  <span>Interactive Canvas</span>
                </div>
                {generatedAsset && (
                  <button onClick={handleDownloadComposite} className="text-xs flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md transition-colors">
                    <Download size={14} /> PNG
                  </button>
                )}
              </div>

              <div className="flex-1 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-300 relative">
                {generatedAsset ? (
                  <div 
                    ref={resultContainerRef}
                    className="w-full h-full relative overflow-hidden select-none"
                    style={{ minHeight: '600px', cursor: isDrawingLine ? 'crosshair' : 'default' }}
                    onMouseMove={handleContainerMouseMove}
                    onMouseUp={handleContainerMouseUp}
                    onMouseLeave={handleContainerMouseUp}
                  >
                    {/* 1. Background Image */}
                    <div ref={containerRef} className="absolute inset-0 z-0">
                         {generatedAsset.background ? (
                            <img src={`data:image/png;base64,${generatedAsset.background}`} alt="Background Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800" />
                        )}
                    </div>

                    {/* 2. Connections Layer (SVG) */}
                    <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#60A5FA" />
                            </marker>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        
                        {/* Existing Connections */}
                        {connections.map(conn => {
                            const startNode = nodes.find(n => n.id === conn.fromNodeId);
                            if (!startNode) return null;
                            // Approximate center of node (assuming 200px width, 100px height for calculation if unknown, but better to just use x,y)
                            const startX = startNode.x + 160; // Right side of card
                            const startY = startNode.y + 40;  // Middle of card
                            return (
                                <g key={conn.id}>
                                    <line 
                                        x1={startX} y1={startY} 
                                        x2={conn.toX} y2={conn.toY} 
                                        stroke="#60A5FA" strokeWidth="2" 
                                        markerEnd="url(#arrowhead)"
                                        filter="url(#glow)"
                                        opacity="0.8"
                                    />
                                    <circle cx={conn.toX} cy={conn.toY} r="4" fill="#60A5FA" filter="url(#glow)" />
                                </g>
                            );
                        })}

                        {/* Dragging Line */}
                        {isDrawingLine && lineStartNodeId && (
                             (() => {
                                const startNode = nodes.find(n => n.id === lineStartNodeId);
                                if (!startNode) return null;
                                const startX = startNode.x + 160; 
                                const startY = startNode.y + 40;
                                return (
                                    <line 
                                        x1={startX} y1={startY} 
                                        x2={mousePos.x} y2={mousePos.y} 
                                        stroke="#F472B6" strokeWidth="2" strokeDasharray="5,5" 
                                    />
                                );
                             })()
                        )}
                    </svg>

                    {/* 3. Nodes Layer (HTML) */}
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            onMouseDown={(e) => handleCardMouseDown(e, node)}
                            style={{ 
                                left: node.x, 
                                top: node.y,
                                position: 'absolute'
                            }}
                            className={`
                                z-20 w-80 p-4 rounded-xl backdrop-blur-md border shadow-lg transition-shadow cursor-move group
                                ${selectedNodeId === node.id ? 'bg-white/20 border-white/50 ring-2 ring-indigo-400' : 'bg-slate-900/40 border-white/10 hover:border-white/30'}
                            `}
                        >
                            <h3 className="text-white font-bold text-sm mb-1">{node.title}</h3>
                            <p className="text-slate-200 text-xs leading-relaxed">{node.content}</p>
                            
                            {/* Actions on Card */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button 
                                    onMouseDown={(e) => startConnection(e, node.id)}
                                    className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600" title="Link to Background"
                                >
                                    <LinkIcon size={12} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Instructions Overlay if empty */}
                    {!generatedAsset.background && !isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                             <p>Canvas Empty</p>
                        </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    {isGenerating ? (
                      <div className="flex flex-col items-center gap-3 animate-pulse">
                         <div className="w-16 h-16 bg-slate-200 rounded-full"></div>
                         <p>Designing...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                           <Wand2 size={32} className="opacity-20" />
                        </div>
                        <p>Your artistic diagram will appear here.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;