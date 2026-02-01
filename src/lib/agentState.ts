export type TaskComment = {
  id: string;
  author: string;
  message: string;
  timestamp: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  assignee: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  comments: TaskComment[];
  lastUpdated: string;
};

export type AgentState = {
  proverbs: string[];
  tasks: Task[];
};

export const initialAgentState: AgentState = {
  proverbs: [
    "CopilotKit may be new, but its the best thing since sliced bread.",
  ],
  tasks: [
    {
      id: "T-101",
      title: "Polish onboarding flow",
      description:
        "Review the new onboarding flow, collect stakeholder feedback, and prep a rollout plan.",
      status: "in_progress",
      assignee: "Avery Johnson",
      dueDate: "2026-02-04T11:30:00.000Z",
      priority: "high",
      lastUpdated: "2026-02-01T11:30:00.000Z",
      comments: [
        {
          id: "C-1",
          author: "Avery Johnson",
          message: "Working through the analytics dashboard copy now.",
          timestamp: "2026-02-01T10:45:00.000Z",
        },
        {
          id: "C-2",
          author: "Jordan Lee",
          message: "Please confirm the legal review is still on track for Friday.",
          timestamp: "2026-02-01T11:05:00.000Z",
        },
      ],
    },
    {
      id: "T-102",
      title: "Set up availability monitoring",
      description:
        "Instrument uptime monitors for the new agent endpoints and configure alerts.",
      status: "todo",
      assignee: "Priya Singh",
      dueDate: "2026-02-07T11:30:00.000Z",
      priority: "medium",
      lastUpdated: "2026-02-01T09:30:00.000Z",
      comments: [
        {
          id: "C-3",
          author: "Priya Singh",
          message: "Need credentials for the status page provider.",
          timestamp: "2026-02-01T09:10:00.000Z",
        },
      ],
    },
  ],
};
