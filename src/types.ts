export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'completed';
  deadline?: string;
  estimatedTime?: number; // in minutes
  scheduledTime?: string; // ISO string
  category?: string; // category id
  completedAt?: string; // ISO string
  reminderSent?: boolean;
}

export interface AIPlanResponse {
  tasks: Task[];
  reasoning: string;
}
