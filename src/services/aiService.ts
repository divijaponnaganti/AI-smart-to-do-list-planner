import { GoogleGenAI, Type } from "@google/genai";
import { Task, AIPlanResponse } from "../types";

export async function optimizeTasks(tasks: Task[]): Promise<AIPlanResponse> {
  // Ensure we have an API key. In AI Studio, it's injected via process.env.GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Please add it to your secrets.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an expert productivity coach and task planner. 
    I have a list of tasks that need to be prioritized and scheduled intelligently for today.
    
    Current Tasks:
    ${JSON.stringify(tasks, null, 2)}
    
    Instructions:
    1. Analyze the tasks based on their titles, descriptions, and deadlines.
    2. Assign a priority (high, medium, low) to each task.
    3. Schedule each task with a 'scheduledTime' (ISO string) starting from 9:00 AM today, assuming a standard workday.
    4. Provide a brief 'reasoning' for the overall plan.
    5. Return the updated tasks list with priorities and scheduled times.
    6. Keep the original 'id' for each task.
    
    Current Date/Time: ${new Date().toISOString()}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                  status: { type: Type.STRING, enum: ["todo", "completed"] },
                  deadline: { type: Type.STRING },
                  estimatedTime: { type: Type.NUMBER },
                  scheduledTime: { type: Type.STRING },
                },
                required: ["id", "title", "priority", "status"],
              },
            },
            reasoning: { type: Type.STRING },
          },
          required: ["tasks", "reasoning"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned an empty response.");
    }

    return JSON.parse(text) as AIPlanResponse;
  } catch (error) {
    console.error("AI Optimization Error:", error);
    throw error;
  }
}
