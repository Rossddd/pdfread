import React from 'react';
import { DocumentPage } from '../types';
import { Trash2, Plus, FileText, CheckCircle } from 'lucide-react';

interface DocumentSidebarProps {
  pages: DocumentPage[];
  onRemovePage: (id: string) => void;
  onAddFiles: (files: File[]) => void;
  isAnalyzing: boolean;
  activeReferenceId?: string | null;
  onSelectReference?: (page: DocumentPage) => void;
}

const DocumentSidebar: React.FC<DocumentSidebarProps> = ({ 
  pages, 
  onRemovePage, 
  onAddFiles, 
  isAnalyzing,
  activeReferenceId,
  onSelectReference
}) => {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      onAddFiles(filesArray);
    }
  };

  return (
    <div className="w-72 h-full flex flex-col bg-white border-r border-slate-200 shadow-sm z-10 flex-shrink-0">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          Documents
        </h2>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {pages.length} pages
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {pages.map((page, index) => {
          const isActive = activeReferenceId === page.id;
          return (
            <div 
              key={page.id} 
              onClick={() => onSelectReference && onSelectReference(page)}
              className={`
                relative group rounded-lg overflow-hidden border transition-all shadow-sm bg-slate-50
                ${isActive ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200 hover:border-indigo-300'}
                ${onSelectReference ? 'cursor-pointer' : ''}
              `}
            >
              <div className="aspect-[3/4] w-full relative bg-slate-100">
                <img 
                  src={page.url} 
                  alt={`Page ${index + 1}`} 
                  className="w-full h-full object-contain"
                />
                <div className={`absolute inset-0 transition-colors ${isActive ? 'bg-purple-500/10' : 'bg-black/0 group-hover:bg-black/5'}`} />
                
                {isActive && (
                  <div className="absolute top-2 left-2 bg-purple-600 text-white p-1 rounded-full shadow-md">
                    <CheckCircle size={14} />
                  </div>
                )}
              </div>
              
              {!isActive && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePage(page.id);
                    }}
                    disabled={isAnalyzing}
                    className="p-1.5 bg-white/90 text-red-500 rounded-full hover:bg-red-50 hover:text-red-600 shadow-sm border border-slate-200 transition-colors"
                    title="Remove page"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              
              <div className={`absolute bottom-0 inset-x-0 backdrop-blur-sm p-2 border-t ${isActive ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white/90 border-slate-100 text-slate-600'}`}>
                <p className="text-xs font-medium text-center truncate">
                  {isActive ? 'Active Reference' : `Page ${index + 1}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <input
          type="file"
          id="sidebar-upload"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={isAnalyzing}
        />
        <label
          htmlFor="sidebar-upload"
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border border-dashed border-slate-300 text-slate-600 font-medium text-sm hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all cursor-pointer ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Plus size={16} />
          Add More Pages
        </label>
      </div>
    </div>
  );
};

export default DocumentSidebar;