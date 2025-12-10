import React, { useRef } from 'react';
import { AgentDiagramData } from '../types';
import { Download, X, Brain, Network, Users, Wrench, Server } from 'lucide-react';
import html2canvas from 'html2canvas';

interface AgentDiagramProps {
  data: AgentDiagramData;
  onClose: () => void;
}

const AgentDiagram: React.FC<AgentDiagramProps> = ({ data, onClose }) => {
  const diagramRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!diagramRef.current) return;
    try {
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2, // High resolution
        backgroundColor: '#F8FAFC',
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agent-architecture-map.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Network className="text-indigo-600" />
            Agentic Architecture Map
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
              <Download size={16} />
              Save Image
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Diagram Canvas */}
        <div className="flex-1 overflow-auto bg-slate-50 p-8 flex items-center justify-center custom-scrollbar">
          <div 
            ref={diagramRef}
            className="bg-gradient-to-br from-slate-50 to-slate-100 p-12 rounded-xl border border-slate-200 shadow-sm relative w-[800px] min-h-[600px] flex flex-col items-center select-none"
          >
            {/* Title on the Image */}
            <div className="absolute top-6 left-6 text-slate-300 text-sm font-semibold tracking-widest uppercase">
              Agentic Insight Reader • Generated Map
            </div>

            {/* 1. HEAD: Model / Core */}
            <div className="relative z-10 w-64">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                  <Brain size={24} />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">Model / Core</h3>
                <p className="text-sm text-slate-600 leading-snug">{data.model_core}</p>
              </div>
              {/* Connector to Neck */}
              <div className="absolute left-1/2 -bottom-8 w-0.5 h-8 bg-slate-300 -translate-x-1/2"></div>
            </div>

            {/* 2. NECK: Nervous System */}
            <div className="mt-8 relative z-10 w-full max-w-sm flex justify-center">
               <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-200 shadow-sm flex items-center gap-3 text-sm font-medium text-slate-700">
                  <Network size={16} className="text-pink-500" />
                  <span className="text-slate-400">|</span>
                  <span>{data.nervous_system}</span>
               </div>
               {/* Vertical spine line */}
               <div className="absolute top-full left-1/2 w-0.5 h-24 bg-slate-300 -translate-x-1/2 -z-10"></div>
            </div>

            {/* MIDDLE SECTION: Arms and Spine */}
            <div className="w-full flex justify-between items-start mt-8 px-4 relative">
               
               {/* Left Arm: Human Collab */}
               <div className="flex-1 flex justify-end pr-12 relative pt-8">
                  {/* Horizontal Line */}
                  <div className="absolute right-0 top-16 w-12 h-0.5 bg-slate-300"></div>
                  {/* Box */}
                  <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-emerald-500 w-64 relative hover:shadow-lg transition-shadow">
                     <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-sm uppercase tracking-wide">
                        <Users size={16} />
                        Human Collaboration
                     </div>
                     <p className="text-sm text-slate-600">{data.human_collaboration}</p>
                  </div>
               </div>

               {/* Center Spine Point */}
               <div className="w-4 h-4 bg-slate-300 rounded-full z-10 mt-14 shadow-sm ring-4 ring-slate-50"></div>

               {/* Right Arm: Tools */}
               <div className="flex-1 flex justify-start pl-12 relative pt-8">
                   {/* Horizontal Line */}
                   <div className="absolute left-0 top-16 w-12 h-0.5 bg-slate-300"></div>
                   {/* Box */}
                   <div className="bg-white rounded-xl p-5 shadow-md border-r-4 border-amber-500 w-64 relative hover:shadow-lg transition-shadow">
                     <div className="flex items-center justify-end gap-2 mb-2 text-amber-700 font-bold text-sm uppercase tracking-wide">
                        Tools & RAG
                        <Wrench size={16} />
                     </div>
                     <p className="text-sm text-slate-600 text-right">{data.tools_rag}</p>
                  </div>
               </div>

            </div>

            {/* 3. BASE: Deployment */}
            <div className="mt-16 w-full flex justify-center relative">
               {/* Diagonal Legs */}
               <div className="absolute -top-12 left-1/2 w-0.5 h-12 bg-slate-300 -translate-x-1/2"></div>
               <div className="absolute -top-4 left-1/2 w-24 h-0.5 bg-slate-300 -translate-x-1/2"></div>
               <div className="absolute -top-4 left-[calc(50%-48px)] w-0.5 h-8 bg-slate-300 skew-x-12 origin-top"></div>
               <div className="absolute -top-4 right-[calc(50%-48px)] w-0.5 h-8 bg-slate-300 -skew-x-12 origin-top"></div>

               <div className="bg-slate-800 text-slate-200 rounded-xl p-6 shadow-xl w-96 text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                  <div className="flex items-center justify-center gap-2 mb-3 text-white font-bold">
                     <Server size={18} />
                     Deployment & Infrastructure
                  </div>
                  <p className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                     {data.deployment}
                  </p>
               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AgentDiagram;