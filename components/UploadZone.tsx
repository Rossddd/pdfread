import React, { useCallback } from 'react';
import { Upload, FileUp, FileText } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isCompact?: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, isCompact = false }) => {
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Accept images and PDFs
      const filesArray = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      onFilesSelected(filesArray);
    }
  }, [onFilesSelected]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
       const filesArray = Array.from(e.target.files).filter(file => 
         file.type.startsWith('image/') || file.type === 'application/pdf'
       );
      onFilesSelected(filesArray);
    }
  };

  if (isCompact) {
    return (
      <div className="relative group">
        <input
          type="file"
          id="file-upload-compact"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleChange}
        />
        <label
          htmlFor="file-upload-compact"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 cursor-pointer transition-colors text-sm font-medium border border-indigo-200"
        >
          <FileUp size={16} />
          Add Files
        </label>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="w-full h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
    >
      <input
        type="file"
        id="file-upload"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      <label
        htmlFor="file-upload"
        className="flex flex-col items-center cursor-pointer w-full h-full justify-center"
      >
        <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-8 h-8 text-indigo-600" />
        </div>
        <p className="text-lg font-semibold text-slate-700 mb-1">Upload Documents</p>
        <p className="text-sm text-slate-500 max-w-xs text-center">
          Drag & drop PDF, Images, or Sketches here.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-100 px-3 py-1 rounded-full">
            <FileText size={14}/>
            <span>Supports PDF, PNG, JPG</span>
        </div>
      </label>
    </div>
  );
};

export default UploadZone;