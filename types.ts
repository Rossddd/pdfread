
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
  timestamp: number;
}

export interface DocumentPage {
  id: string;
  url: string;
  file: File;
  base64: string;
  mimeType: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  IMAGE_GEN = 'IMAGE_GEN',
}

export interface AgentDiagramData {
  model_core: string;
  nervous_system: string;
  human_collaboration: string;
  tools_rag: string;
  deployment: string;
}

export interface DiagramNode {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
}

export interface DiagramConnection {
  id: string;
  fromNodeId: string;
  toX: number;
  toY: number;
}

export interface GeneratedAsset {
  svg?: string; // Legacy support
  background?: string; // Base64 image data
  nodes?: DiagramNode[];
  connections?: DiagramConnection[];
}

// --- Workflow Analysis Graph Types ---

export type NodeType = 'user' | 'orchestrator' | 'logic_agent' | 'creative_agent' | 'interface';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;       // e.g., "Cognitive Controller" (from PDF theory)
  subLabel: string;    // e.g., "React App Engine" (Actual implementation)
  description: string; // Short role description
  theory_mapping: string; // How this relates to the PDF's theory
  inputs: string[];    // e.g. ["User Prompt", "PDF Base64"]
  outputs: string[];   // e.g. ["JSON Structure"]
}

export interface WorkflowEdge {
  from: NodeType;
  to: NodeType;
  label: string;       // e.g. "Dispatches Task"
  data_object: string; // e.g. "Prompt + Context"
}

export interface HciAnalysisData {
  summary: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}