import React, { useState, useCallback } from 'react';
import { Sparkles, ArrowRight, FileText, Loader2, Download, Network, Wand2, MessagesSquare, Workflow, ScanText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import UploadZone from './components/UploadZone';
import DocumentSidebar from './components/DocumentSidebar';
import ChatInterface from './components/ChatInterface';
import AgentDiagram from './components/AgentDiagram';
import ImageGenerator from './components/ImageGenerator';
import WorkflowDiagram from './components/WorkflowDiagram';
import { geminiService } from './services/geminiService';
import { DocumentPage, ChatMessage, AppState, AgentDiagramData, GeneratedAsset, HciAnalysisData } from './types';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

const App: React.FC = () => {
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Diagram state
  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramData, setDiagramData] = useState<AgentDiagramData | null>(null);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);

  // Workflow Analysis State
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowData, setWorkflowData] = useState<HciAnalysisData | null>(null);
  const [isAnalyzingWorkflow, setIsAnalyzingWorkflow] = useState(false);

  // OCR/Text Extraction State
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  // Image Gen State
  const [activeReferencePageId, setActiveReferencePageId] = useState<string | null>(null);
  // Now stores the hybrid asset (nodes + background)
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Helper to convert PDF file to images
  const processPdf = async (file: File): Promise<DocumentPage[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const newPages: DocumentPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // High quality scale
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const base64Url = canvas.toDataURL('image/jpeg', 0.85);
        const base64Data = base64Url.split(',')[1];

        newPages.push({
          id: Math.random().toString(36).substring(7),
          url: base64Url,
          file: file, // Reference to original file (not strictly correct per page but okay for metadata)
          base64: base64Data,
          mimeType: 'image/jpeg',
        });
      }
    }
    return newPages;
  };

  // Helper to convert File to DocumentPage
  // Returns the newly created pages so caller can use them immediately
  const processFiles = useCallback(async (files: File[]): Promise<DocumentPage[]> => {
    setIsConvertingPdf(true);
    // Reset extracted text when new files are added
    setExtractedText(null);
    const newPages: DocumentPage[] = [];

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const pdfPages = await processPdf(file);
          newPages.push(...pdfPages);
        } else if (file.type.startsWith('image/')) {
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
            });

            // Strip prefix for API usage, keep full url for display
            const base64Data = base64.split(',')[1];
            
            newPages.push({
              id: Math.random().toString(36).substring(7),
              url: base64, // Used for <img> src
              file,
              base64: base64Data, // Used for API
              mimeType: file.type,
            });
          } catch (err) {
            console.error("Error processing image file:", err);
          }
        }
      }
      setPages(prev => [...prev, ...newPages]);
      return newPages;
    } catch (err) {
      console.error("Error processing files:", err);
      setError("Failed to process files. Please try again.");
      return [];
    } finally {
      setIsConvertingPdf(false);
    }
  }, []);

  const handleFilesSelected = (files: File[]) => {
    processFiles(files);
  };
  
  // Handlers specific to Image Gen studio upload
  const handleSketchUpload = async (files: File[]) => {
    const newPages = await processFiles(files);
    // If we are in image gen mode and uploaded files, select the first one as reference
    if (newPages.length > 0) {
      setActiveReferencePageId(newPages[0].id);
    }
  };

  const handleRemovePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
    if (activeReferencePageId === id) {
      setActiveReferencePageId(null);
    }
    setExtractedText(null); // Reset OCR on change
  };

  const startAnalysis = async () => {
    if (pages.length === 0) return;

    setAppState(AppState.ANALYZING);
    setIsProcessing(true);
    setError(null);

    try {
      const responseText = await geminiService.initializeChat(pages);
      
      setMessages([
        {
          role: 'model',
          text: responseText,
          timestamp: Date.now()
        }
      ]);
      setAppState(AppState.READY);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze documents. Please try again.");
      setAppState(AppState.IDLE); // Go back to allow retrying
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const responseText = await geminiService.sendMessage(text);
      const modelMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = { 
        role: 'model', 
        text: "I encountered an error trying to respond. Please try again.", 
        isError: true, 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) return;
    
    const textContent = messages
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role === 'user' ? 'You' : 'AI'}:\n${m.text}\n`)
      .join('\n-------------------\n\n');
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentic-insight-chat-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateDiagram = async () => {
    if (pages.length === 0) return;
    setIsGeneratingDiagram(true);
    try {
      // If we haven't initialized chat yet, we can still generate the diagram directly
      const data = await geminiService.analyzeForDiagram(pages);
      setDiagramData(data);
      setShowDiagram(true);
    } catch (err) {
      console.error("Failed to generate diagram:", err);
      // Optional: show user error
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  const handleGenerateWorkflow = async () => {
    if (pages.length === 0) return;
    setIsAnalyzingWorkflow(true);
    try {
        const data = await geminiService.generateAppWorkflowAnalysis(pages);
        setWorkflowData(data);
        setShowWorkflow(true);
    } catch (err) {
        console.error("Failed to generate workflow:", err);
        alert("Failed to analyze workflow. Please try again.");
    } finally {
        setIsAnalyzingWorkflow(false);
    }
  };

  const handleExtractText = async () => {
    if (pages.length === 0) return;
    if (extractedText) {
       // Already have it, just show confirm/toast or alert? 
       // For this UI, we might want a modal. For simplicity let's just log or re-open a simple modal.
       // We'll treat the button as a toggle or trigger.
    }

    setIsExtractingText(true);
    try {
        const text = await geminiService.extractTextFromPages(pages);
        setExtractedText(text);
    } catch (e) {
        console.error("Text extraction failed", e);
        alert("Failed to extract text.");
    } finally {
        setIsExtractingText(false);
    }
  };

  const handleImageGeneration = async (prompt: string) => {
    const referencePage = pages.find(p => p.id === activeReferencePageId);
    if (!referencePage) return;

    setIsGeneratingImage(true);
    try {
      // Returns { svg, background } object
      const asset = await geminiService.generateDiagramFromContent(pages, referencePage, prompt);
      setGeneratedAsset(asset);
    } catch (error) {
      console.error("Failed to generate diagram:", error);
      alert("Failed to generate diagram. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageRefinement = async (prompt: string, target: 'svg' | 'background') => {
    if (!generatedAsset) return;

    setIsGeneratingImage(true);
    try {
      if (target === 'svg') {
        // Now 'svg' target refers to refining the NODES structure
        if (generatedAsset.nodes) {
             const refinedNodes = await geminiService.refineNodes(generatedAsset.nodes, prompt);
             setGeneratedAsset({
                 ...generatedAsset,
                 nodes: refinedNodes
             });
        }
      } else {
        // Refines ONLY the background image
        if (generatedAsset.background) {
            const bgCode = await geminiService.refineBackground(generatedAsset.background, prompt);
            setGeneratedAsset({
                ...generatedAsset,
                background: bgCode
            });
        }
      }
    } catch (error) {
      console.error("Failed to refine diagram:", error);
      alert("Failed to refine diagram. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAssetUpdate = (updatedAsset: GeneratedAsset) => {
    setGeneratedAsset(updatedAsset);
  };

  const handleResetImage = () => {
    setGeneratedAsset(null);
  };

  const toggleImageMode = () => {
    if (appState === AppState.IMAGE_GEN) {
      setAppState(messages.length > 0 ? AppState.READY : AppState.IDLE);
    } else {
      setAppState(AppState.IMAGE_GEN);
      if (!activeReferencePageId && pages.length > 0) {
        setActiveReferencePageId(pages[0].id);
      }
    }
  };

  // View: Initial Upload
  if (pages.length === 0 && appState === AppState.IDLE) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
               <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
              Agentic Insight Reader
            </h1>
            <p className="text-lg text-slate-600 max-w-lg mx-auto">
              Unlock the knowledge inside your documents. Upload PDFs or visual pages to analyze, summarize, chat, or generate creative assets.
            </p>
          </div>

          <UploadZone onFilesSelected={handleFilesSelected} />
          
          {isConvertingPdf && (
            <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
              <Loader2 className="animate-spin" size={20} />
              <span>Processing PDF pages...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Main Application (Staging, Analyzing, Ready, Image Gen)
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <DocumentSidebar 
        pages={pages} 
        onRemovePage={handleRemovePage} 
        onAddFiles={handleFilesSelected}
        isAnalyzing={appState === AppState.ANALYZING || isProcessing || isConvertingPdf || isGeneratingImage}
        activeReferenceId={appState === AppState.IMAGE_GEN ? activeReferencePageId : null}
        onSelectReference={appState === AppState.IMAGE_GEN ? (page) => setActiveReferencePageId(page.id) : undefined}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative bg-slate-100/50">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm flex-shrink-0">
           <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-slate-800 hidden md:block">Agentic Insight Reader</span>
           </div>
           
           <div className="flex items-center gap-2">
             
             {/* Toggle Mode Button */}
             <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                <button
                  onClick={() => appState === AppState.IMAGE_GEN && toggleImageMode()}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${appState !== AppState.IMAGE_GEN ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <MessagesSquare size={16} />
                  Chat
                </button>
                <button
                  onClick={toggleImageMode}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${appState === AppState.IMAGE_GEN ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Wand2 size={16} />
                  Creative
                </button>
             </div>

             {/* Tools Group */}
             <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                 {/* Text Extractor */}
                <button
                    onClick={handleExtractText}
                    disabled={isExtractingText}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                    title="Extract Text (OCR)"
                >
                    {isExtractingText ? <Loader2 size={16} className="animate-spin"/> : <ScanText size={16} />}
                    <span className="hidden lg:inline">Text</span>
                </button>

                {/* Workflow Analyzer (NEW) */}
                <button
                    onClick={handleGenerateWorkflow}
                    disabled={isAnalyzingWorkflow}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                    title="Analyze Interaction Workflow"
                >
                    {isAnalyzingWorkflow ? <Loader2 size={16} className="animate-spin"/> : <Workflow size={16} />}
                    <span className="hidden lg:inline">Flow</span>
                </button>

                {/* Visualize Map */}
                <button
                onClick={handleGenerateDiagram}
                disabled={isGeneratingDiagram || appState === AppState.IMAGE_GEN}
                className={`flex items-center gap-2 px-3 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 ${appState === AppState.IMAGE_GEN ? 'hidden' : ''}`}
                title="Create Agent Map from PDF"
                >
                {isGeneratingDiagram ? <Loader2 size={16} className="animate-spin"/> : <Network size={16} />}
                <span className="hidden lg:inline">Map</span>
                </button>

                {appState === AppState.READY && (
                    <button
                    onClick={handleDownloadChat}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Download Chat History"
                    >
                    <Download size={20} />
                    </button>
                )}
             </div>
           </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* Staging Area */}
          {appState === AppState.IDLE && (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-10 h-10 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    {pages.length} Page{pages.length !== 1 ? 's' : ''} Uploaded
                  </h2>
                  <p className="text-slate-500">
                    Ready to analyze. Click the button below to start the intelligence agent.
                  </p>
                </div>
                
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                    {error}
                  </div>
                )}
                
                {isConvertingPdf ? (
                   <div className="flex items-center justify-center gap-2 py-3.5 text-indigo-600 font-medium">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Processing additional pages...</span>
                  </div>
                ) : (
                  <button
                    onClick={startAnalysis}
                    className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
                  >
                    <Sparkles size={18} className="group-hover:animate-spin-slow" />
                    Analyze Documents
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Analyzing State Overlay */}
          {appState === AppState.ANALYZING && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
               <div className="relative">
                 <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                 </div>
               </div>
               <p className="mt-6 text-lg font-medium text-slate-700 animate-pulse">Reading documents...</p>
               <p className="text-sm text-slate-500 mt-2">Extracting visual and textual insights</p>
            </div>
          )}

          {/* Chat Interface */}
          {(appState === AppState.READY || appState === AppState.ANALYZING) && (
            <ChatInterface 
              messages={messages} 
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
            />
          )}

           {/* Image Generator Studio */}
           {appState === AppState.IMAGE_GEN && (
            <ImageGenerator
              referencePage={pages.find(p => p.id === activeReferencePageId) || null}
              onGenerate={handleImageGeneration}
              onRefine={handleImageRefinement}
              onAssetUpdate={handleAssetUpdate}
              onUpload={handleSketchUpload}
              onReset={handleResetImage}
              isGenerating={isGeneratingImage}
              generatedAsset={generatedAsset}
            />
          )}

          {/* Diagram Overlay */}
          {showDiagram && diagramData && (
            <AgentDiagram 
              data={diagramData} 
              onClose={() => setShowDiagram(false)} 
            />
          )}

          {/* Workflow Overlay (NEW) */}
          {showWorkflow && workflowData && (
              <WorkflowDiagram 
                data={workflowData}
                onClose={() => setShowWorkflow(false)}
              />
          )}

          {/* Extracted Text Modal */}
          {extractedText && (
             <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[70vh] flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <ScanText size={18} className="text-indigo-600"/>
                            Extracted Text
                        </h3>
                        <button onClick={() => setExtractedText(null)} className="p-1 hover:bg-slate-100 rounded"><ArrowRight size={18}/></button>
                    </div>
                    <div className="flex-1 p-4 overflow-auto bg-slate-50 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {extractedText}
                    </div>
                    <div className="p-4 border-t border-slate-100 flex justify-end">
                         <button 
                             onClick={() => {navigator.clipboard.writeText(extractedText); alert('Copied!');}}
                             className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                         >
                             Copy to Clipboard
                         </button>
                    </div>
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default App;