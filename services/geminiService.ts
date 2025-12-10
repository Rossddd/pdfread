import { GoogleGenAI, Chat, Type } from "@google/genai";
import { DocumentPage, ChatMessage, AgentDiagramData, GeneratedAsset, DiagramNode, HciAnalysisData } from "../types";

const MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private chatSession: Chat | null = null;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.error("API_KEY not found in environment variables");
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  async initializeChat(pages: DocumentPage[]): Promise<string> {
    if (!this.ai) throw new Error("Gemini API not initialized");

    const parts: any[] = [];
    
    for (const page of pages) {
      parts.push({
        inlineData: {
          mimeType: page.mimeType,
          data: page.base64,
        }
      });
    }

    parts.push({
      text: "Here are the pages of a document. Please analyze them and provide a brief summary of what this document is about. Then, be ready to answer my questions about specific details within these pages."
    });

    try {
      this.chatSession = this.ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: "You are an intelligent document assistant. You have been provided with images of document pages. Your goal is to help the user understand the content, extract information, and answer questions based VISUALLY and textually on these pages. Be concise, accurate, and helpful. Use markdown for formatting."
        }
      });

      const response = await this.chatSession.sendMessage({
        message: parts
      });
      
      return response.text || "I've analyzed the document. What would you like to know?";
    } catch (error) {
      console.error("Error initializing chat:", error);
      throw error;
    }
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.chatSession) throw new Error("Chat session not started");

    try {
      const response = await this.chatSession.sendMessage({
        message: message
      });
      return response.text || "I couldn't generate a response.";
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async analyzeForDiagram(pages: DocumentPage[]): Promise<AgentDiagramData> {
    if (!this.ai) throw new Error("Gemini API not initialized");

    const parts: any[] = [];
    for (const page of pages) {
      parts.push({
        inlineData: {
          mimeType: page.mimeType,
          data: page.base64,
        }
      });
    }

    const prompt = `Analyze these document pages and extract information to map onto a specific "Agent Architecture" diagram. 
    You need to fill in 5 specific boxes based on the content of the document.
    
    1. Model / Core Intelligence: What is the main model, brain, or core logic described?
    2. Nervous System / Coordination: How does the system coordinate? What is the architecture layer?
    3. Human Collaboration: How do humans interact, provide feedback, or collaborate?
    4. Tools / RAG / Actions: What tools, retrieval mechanisms (RAG), or actions are performed?
    5. Deployment / Body: How is it deployed, what is the infrastructure, or where does it "live"?

    Return ONLY a JSON object with keys: "model_core", "nervous_system", "human_collaboration", "tools_rag", "deployment". 
    Keep the text for each concise (under 25 words).`;

    parts.push({ text: prompt });

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              model_core: { type: Type.STRING },
              nervous_system: { type: Type.STRING },
              human_collaboration: { type: Type.STRING },
              tools_rag: { type: Type.STRING },
              deployment: { type: Type.STRING },
            },
            required: ["model_core", "nervous_system", "human_collaboration", "tools_rag", "deployment"],
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from model");
      
      return JSON.parse(text) as AgentDiagramData;
    } catch (error) {
      console.error("Error generating diagram data:", error);
      return {
        model_core: "Could not extract Model info",
        nervous_system: "Could not extract System info",
        human_collaboration: "Could not extract Human info",
        tools_rag: "Could not extract Tools info",
        deployment: "Could not extract Deployment info"
      };
    }
  }

  /**
   * Extract all text from pages using Gemini
   */
  async extractTextFromPages(pages: DocumentPage[]): Promise<string> {
    if (!this.ai) throw new Error("Gemini API not initialized");
    
    const parts: any[] = [];
    for (const page of pages) {
      parts.push({
        inlineData: {
          mimeType: page.mimeType,
          data: page.base64,
        }
      });
    }
    
    parts.push({ 
      text: "Extract all visible text from these pages. Maintain the original paragraph structure and formatting as much as possible. Do not add any introductory or concluding remarks, just the extracted text." 
    });

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts }
      });
      return response.text || "No text found.";
    } catch (error) {
      console.error("Extraction error", error);
      throw error;
    }
  }

  /**
   * Generates a Hybrid Asset: 
   * 1. JSON List of Cards (Concepts)
   * 2. Image for Background (Cool visuals)
   */
  async generateDiagramFromContent(
    documentPages: DocumentPage[], 
    referencePage: DocumentPage, 
    userPrompt: string
  ): Promise<GeneratedAsset> {
    if (!this.ai) throw new Error("Gemini API not initialized");

    // 1. Prepare parts for Analysis
    const analysisParts: any[] = [];
    analysisParts.push({ text: "Here are the pages of a document:" });
    for (const page of documentPages) {
      analysisParts.push({ inlineData: { mimeType: page.mimeType, data: page.base64 } });
    }
    
    // 2. Define Tasks
    const textTaskPrompt = `
      User Instruction: ${userPrompt}
      
      TASK: Extract 5 to 7 key concepts, modules, or steps from the document that should be visualized in a diagram.
      Return a JSON list of "nodes". 
      For each node, provide a "title" (2-5 words) and "content" (10-20 words description).
    `;

    const bgTaskPrompt = `
      User Instruction: ${userPrompt}
      
      TASK: Transform the provided Reference Sketch into a high-quality abstract background art.
      
      REQUIREMENTS:
      - STRICTLY FOLLOW the layout of the input image.
      - Create "Target Zones" (glowing areas, platforms, or HUD elements) where text cards could be placed.
      - Style: High-tech, Sci-Fi, HUD, Glassmorphism, Cinematic Lighting.
      - NO TEXT. Pure art/texture only.
      - Keep it dark enough for white text overlays.
    `;

    try {
      const [dataResponse, bgResponse] = await Promise.all([
        // Task A: Generate Data Nodes (JSON)
        this.ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts: [...analysisParts, { text: textTaskPrompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    nodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                content: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
          }
        }),
        
        // Task B: Generate Background (Image)
        this.ai.models.generateContent({
          model: IMAGE_MODEL_NAME,
          contents: { 
            parts: [
              { inlineData: { mimeType: referencePage.mimeType, data: referencePage.base64 } },
              { text: bgTaskPrompt }
            ] 
          }
        })
      ]);

      // 4. Process JSON Nodes
      let nodes: DiagramNode[] = [];
      try {
          const json = JSON.parse(dataResponse.text || "{}");
          // Initialize with random positions for now, user will drag them
          nodes = (json.nodes || []).map((n: any, i: number) => ({
              id: `node-${Date.now()}-${i}`,
              title: n.title,
              content: n.content,
              x: 50 + (i % 3) * 200, // Basic grid layout
              y: 50 + Math.floor(i / 3) * 150
          }));
      } catch (e) {
          console.error("Failed to parse nodes JSON", e);
          nodes = [{ id: 'error', title: 'Error', content: 'Failed to generate nodes', x: 100, y: 100 }];
      }

      // 5. Process Background Image
      let bgBase64 = undefined;
      if (bgResponse.candidates && bgResponse.candidates[0].content.parts) {
        for (const part of bgResponse.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            bgBase64 = part.inlineData.data;
            break;
          }
        }
      }

      return {
        nodes: nodes,
        connections: [],
        background: bgBase64
      };

    } catch (error) {
      console.error("Error generating hybrid diagram:", error);
      throw error;
    }
  }

  /**
   * Deep Analysis of App Workflow based on PDF context.
   */
  async generateAppWorkflowAnalysis(pages: DocumentPage[]): Promise<HciAnalysisData> {
     if (!this.ai) throw new Error("Gemini API not initialized");

     const parts: any[] = [];
     for (const page of pages) {
       parts.push({
         inlineData: { mimeType: page.mimeType, data: page.base64 }
       });
     }

     const prompt = `
        TASK: Perform a "System Architecture & Interaction Analysis" of the "Agentic Insight Reader" application (THIS app the user is using).
        
        1. FIRST, analyze the uploaded document pages. Identify any theoretical frameworks about "Agents", "HCI", "Workflows", or "Systems" described in the PDF.
           (e.g., Does it talk about a 'Cognitive Loop'? A 'Perception Module'? 'Human-in-the-loop'?)
        
        2. THEN, map the actual components of "Agentic Insight Reader" to these theoretical concepts.
           
           THE APP COMPONENTS ARE:
           - User: The human operator providing prompts and sketches.
           - Orchestrator (React App): The central nervous system managing state and API calls.
           - Logic Agent (Gemini 2.5 Flash): The text/logic processor that extracts JSON nodes.
           - Creative Agent (Gemini 2.5 Flash Image): The visual processor that generates background art.
           - Interface (Canvas): The final synthesis layer where nodes + background combine.

        3. OUTPUT A JSON GRAPH representing the flow of data and commands.
           
           For each node, specifically list:
           - 'inputs': What exact data does it receive? (e.g. "Raw PDF Bytes", "User Prompt")
           - 'outputs': What does it produce? (e.g. "Structured JSON", "PNG Blob")
           - 'theory_mapping': How does this component relate to the theory in the uploaded PDF?
           
           Define 'edges' to show who talks to whom (e.g., User -> Orchestrator, Orchestrator -> Logic Agent).
     `;

     parts.push({ text: prompt });

     try {
        const response = await this.ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "A high-level summary of the architectural mapping." },
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['user', 'orchestrator', 'logic_agent', 'creative_agent', 'interface'] },
                                    label: { type: Type.STRING, description: "The theoretical name from the PDF (e.g. 'Cognitive Core')" },
                                    subLabel: { type: Type.STRING, description: "The actual App component name (e.g. 'Gemini Flash')" },
                                    description: { type: Type.STRING },
                                    theory_mapping: { type: Type.STRING },
                                    inputs: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    outputs: { type: Type.ARRAY, items: { type: Type.STRING } }
                                }
                            }
                        },
                        edges: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    from: { type: Type.STRING, enum: ['user', 'orchestrator', 'logic_agent', 'creative_agent', 'interface'] },
                                    to: { type: Type.STRING, enum: ['user', 'orchestrator', 'logic_agent', 'creative_agent', 'interface'] },
                                    label: { type: Type.STRING, description: "Action verb (e.g. 'Dispatches')" },
                                    data_object: { type: Type.STRING, description: "Data payload (e.g. 'JSON Response')" }
                                }
                            }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        return JSON.parse(text) as HciAnalysisData;
     } catch (e) {
         console.error("Error generating HCI report", e);
         throw e;
     }
  }

  /**
   * Refines the Nodes (Text content).
   */
  async refineNodes(currentNodes: DiagramNode[], instruction: string): Promise<DiagramNode[]> {
    if (!this.ai) throw new Error("Gemini API not initialized");

    try {
        // Construct a simple text representation of current nodes
        const nodesContext = JSON.stringify(currentNodes.map(n => ({ id: n.id, title: n.title, content: n.content })));

      const response = await this.ai.models.generateContent({
        model: MODEL_NAME, 
        contents: {
          parts: [
            {
              text: `Current Diagram Nodes: ${nodesContext}
              
              USER INSTRUCTION: ${instruction}
              
              TASK: Update the list of nodes based on the instruction. You can edit text, add new nodes, or remove nodes.
              Return the full updated list of nodes in JSON format.`
            },
          ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    nodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: "Keep existing ID if updating, generate new if adding" },
                                title: { type: Type.STRING },
                                content: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
      });

      const json = JSON.parse(response.text || "{}");
      
      // Merge logic: preserve positions for existing IDs
      const newNodes = (json.nodes || []).map((n: any) => {
          const existing = currentNodes.find(cn => cn.id === n.id);
          return {
              id: n.id || `node-${Date.now()}-${Math.random()}`,
              title: n.title,
              content: n.content,
              x: existing ? existing.x : 50, // Keep pos or default
              y: existing ? existing.y : 50
          };
      });

      return newNodes;
    } catch (error) {
      console.error("Error refining nodes:", error);
      throw error;
    }
  }

  /**
   * Refines the Background Image.
   */
  async refineBackground(previousImageBase64: string, instruction: string): Promise<string> {
    if (!this.ai) throw new Error("Gemini API not initialized");

    try {
      const response = await this.ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: previousImageBase64,
              },
            },
            {
              text: `Edit this image to match the user's request: ${instruction}. Maintain the abstract, high-tech aesthetic. Do not add text.`
            },
          ],
        },
      });

      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return part.inlineData.data;
          }
        }
      }

      throw new Error("No image data found in response");
    } catch (error) {
      console.error("Error refining background:", error);
      throw error;
    }
  }

  // Legacy support method if needed
  async refineImage(svg: string, prompt: string): Promise<string> {
      return svg; 
  }
}

export const geminiService = new GeminiService();