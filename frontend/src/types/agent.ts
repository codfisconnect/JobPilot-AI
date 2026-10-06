export interface AgentMessage {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: any;
  createdAt: string;
}

export interface AgentAction {
  id: string;
  sessionId: string;
  actionType: 'RECOMMENDATION' | 'TAILOR_RESUME' | 'PREPARE_INTERVIEW' | 'CREATE_APPLICATION_DRAFT' | 'UPDATE_LEARNING_PLAN';
  description: string;
  payload: any;
  status: 'PROPOSED' | 'WAITING_FOR_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  creditCost: number;
  executedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSession {
  id: string;
  candidateProfileId: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  summaryContext?: any;
  messages: AgentMessage[];
  actions: AgentAction[];
  createdAt: string;
  updatedAt: string;
}
