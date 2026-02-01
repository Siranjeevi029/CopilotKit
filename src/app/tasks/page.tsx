"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import "@/lib/patchCopilotkit";
import { AgentState, Task, TaskComment, initialAgentState } from "@/lib/agentState";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";

const STATUS_OPTIONS: Task["status"][] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

const PRIORITY_OPTIONS: Task["priority"][] = ["low", "medium", "high"];

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function coerceStatus(value: string | Task["status"] | undefined): Task["status"] {
  if (!value) return "todo";
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUS_OPTIONS.includes(normalized as Task["status"])
    ? (normalized as Task["status"])
    : "todo";
}

function coercePriority(value: string | Task["priority"] | undefined): Task["priority"] {
  if (!value) return "medium";
  const normalized = value.trim().toLowerCase();
  return PRIORITY_OPTIONS.includes(normalized as Task["priority"])
    ? (normalized as Task["priority"])
    : "medium";
}

function toIsoFromDateInput(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00+05:30`).toISOString();
}

const dateInputFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDateInputValue(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateInputFormatter.format(date);
}

function parseDueDate(input: string) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return toIsoFromDateInput(trimmed);
  }
  const ordinalSanitized = trimmed.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const parsed = new Date(ordinalSanitized);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return dateFormatter.format(date);
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export default function TasksPage() {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState: initialAgentState,
  });

  const tasks = state?.tasks ?? initialAgentState.tasks;
  const [selectedId, setSelectedId] = useState<string>(tasks[0]?.id ?? "");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: "",
    description: "",
    assignee: "",
    status: "todo" as Task["status"],
    priority: "medium" as Task["priority"],
    dueDate: "",
  });

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? tasks[0],
    [tasks, selectedId]
  );

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedId("");
      return;
    }
    if (!tasks.some((task) => task.id === selectedId)) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const safeSetTasks = (updater: (current: Task[]) => Task[]) => {
    const current = state?.tasks ?? initialAgentState.tasks;
    const nextTasks = updater(current);
    setState({
      proverbs: state?.proverbs ?? initialAgentState.proverbs,
      tasks: nextTasks,
    });
  };

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTaskForm.title.trim()) return;

    const nextTask: Task = {
      id: generateId("T"),
      title: newTaskForm.title.trim(),
      description:
        newTaskForm.description.trim() || "No description provided.",
      assignee: newTaskForm.assignee.trim() || "Unassigned",
      status: coerceStatus(newTaskForm.status),
      priority: coercePriority(newTaskForm.priority),
      dueDate:
        (() => {
          const parsed = parseDueDate(newTaskForm.dueDate);
          if (parsed) return parsed;
          const fallback = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          return fallback.toISOString();
        })(),
      comments: [],
      lastUpdated: new Date().toISOString(),
    };

    safeSetTasks((current) => [nextTask, ...current]);
    setSelectedId(nextTask.id);
    setNewTaskForm({
      title: "",
      description: "",
      assignee: "",
      status: "todo",
      priority: "medium",
      dueDate: "",
    });
    setIsCreateOpen(false);
  };

  useCopilotAction({
    name: "create_task",
    description: "Create a new task with the provided details.",
    parameters: [
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: true },
      { name: "assignee", type: "string", required: true },
      {
        name: "status",
        type: "string",
        description: `One of: ${STATUS_OPTIONS.join(", ")}`,
        required: true,
      },
      {
        name: "priority",
        type: "string",
        description: `One of: ${PRIORITY_OPTIONS.join(", ")}`,
        required: true,
      },
      {
        name: "due_date",
        type: "string",
        description: "ISO8601 date. If omitted, defaults to three days from now.",
        required: false,
      },
    ],
    handler: (payload) => {
      const {
        title,
        description,
        assignee,
        status,
        priority,
        due_date,
      } = payload as Record<string, string | undefined>;
      const titleStr = title ?? "Untitled task";
      const descriptionStr = description ?? "";
      const assigneeStr = assignee ?? "Unassigned";
      const statusStr = status ?? "todo";
      const priorityStr = priority ?? "medium";
      const rawDueInput = due_date ?? (payload as Record<string, string | undefined>).dueDate ?? "";
      const nextTask: Task = {
        id: generateId("T"),
        title: titleStr,
        description: descriptionStr,
        assignee: assigneeStr,
        status: coerceStatus(statusStr),
        priority: coercePriority(priorityStr),
        dueDate:
          (() => {
            const parsed = parseDueDate(rawDueInput ?? "");
            if (parsed) return parsed;
            const fallback = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            return fallback.toISOString();
          })(),
        comments: [],
        lastUpdated: new Date().toISOString(),
      };
      safeSetTasks((current) => [nextTask, ...current]);
      setSelectedId(nextTask.id);
    },
  });

  useCopilotAction({
    name: "update_task",
    description: "Update fields on an existing task.",
    parameters: [
      { name: "task_id", type: "string", required: true },
      {
        name: "updates",
        type: "object",
        description: "Fields to update on the task.",
        required: true,
        attributes: [
          { name: "title", type: "string", required: false },
          { name: "description", type: "string", required: false },
          { name: "assignee", type: "string", required: false },
          {
            name: "status",
            type: "string",
            required: false,
            description: `One of: ${STATUS_OPTIONS.join(", ")}`,
          },
          {
            name: "priority",
            type: "string",
            required: false,
            description: `One of: ${PRIORITY_OPTIONS.join(", ")}`,
          },
          {
            name: "due_date",
            type: "string",
            required: false,
          },
          {
            name: "dueDate",
            type: "string",
            required: false,
          },
        ],
      },
    ],
    handler: ({ task_id, updates }) => {
      const normalized = (updates ?? {}) as Record<string, unknown>;
      const rawStatus = normalized.status as string | undefined;
      const requestedStatus = coerceStatus(rawStatus);
      const statusProvided = typeof rawStatus === "string";
      const rawPriority = normalized.priority as string | undefined;
      const requestedPriority = coercePriority(rawPriority);
      const priorityProvided = typeof rawPriority === "string";
      const rawDueDate =
        typeof normalized.due_date === "string"
          ? (normalized.due_date as string)
          : typeof normalized.dueDate === "string"
            ? (normalized.dueDate as string)
            : "";
      const dueCandidate = rawDueDate;
      const parsedDueDate = parseDueDate(dueCandidate);

      safeSetTasks((current) =>
        current.map((task) => {
          if (task.id !== task_id) return task;

          const nextTask: Task = {
            ...task,
            ...(typeof normalized.title === "string"
              ? { title: normalized.title }
              : {}),
            ...(typeof normalized.description === "string"
              ? { description: normalized.description }
              : {}),
            ...(typeof normalized.assignee === "string"
              ? { assignee: normalized.assignee }
              : {}),
            ...(statusProvided
              ? {
                  status: requestedStatus,
                }
              : {}),
            ...(priorityProvided
              ? {
                  priority: requestedPriority,
                }
              : {}),
            ...(parsedDueDate ? { dueDate: parsedDueDate } : {}),
            lastUpdated: new Date().toISOString(),
          };
          return nextTask;
        })
      );
    },
  });

  useCopilotAction({
    name: "add_task_comment",
    description: "Add a comment to a specific task.",
    parameters: [
      { name: "task_id", type: "string", required: true },
      { name: "author", type: "string", required: true },
      { name: "message", type: "string", required: true },
    ],
    handler: ({ task_id, author, message }) => {
      safeSetTasks((current) =>
        current.map((task) => {
          if (task.id !== task_id) return task;
          const nextComment: TaskComment = {
            id: generateId("C"),
            author,
            message,
            timestamp: new Date().toISOString(),
          };
          return {
            ...task,
            comments: [nextComment, ...task.comments],
            lastUpdated: new Date().toISOString(),
          };
        })
      );
    },
  });

  useCopilotAction({
    name: "update_task_comment",
    description: "Update an existing comment on a task.",
    parameters: [
      { name: "task_id", type: "string", required: true },
      { name: "comment_id", type: "string", required: true },
      {
        name: "updates",
        type: "object",
        required: true,
        attributes: [
          { name: "author", type: "string", required: false },
          { name: "message", type: "string", required: false },
        ],
      },
    ],
    handler: ({ task_id, comment_id, updates }) => {
      const normalized = updates ?? {};
      handleUpdateComment(task_id, comment_id, {
        ...(typeof normalized.author === "string" ? { author: normalized.author } : {}),
        ...(typeof normalized.message === "string" ? { message: normalized.message } : {}),
      });
    },
  });

  const handleFieldChange = <K extends keyof Task>(
    taskId: string,
    key: K,
    value: Task[K]
  ) => {
    safeSetTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              [key]: value,
              lastUpdated: new Date().toISOString(),
            }
          : task
      )
    );
  };

  const handleBulkUpdate = (taskId: string, updates: Partial<Task>) => {
    safeSetTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;

        const next: Task = { ...task };

        if (updates.title !== undefined) next.title = updates.title;
        if (updates.description !== undefined) next.description = updates.description;
        if (updates.assignee !== undefined) next.assignee = updates.assignee;
        if (updates.status !== undefined) next.status = coerceStatus(updates.status);
        if (updates.priority !== undefined)
          next.priority = coercePriority(updates.priority);
        if (updates.dueDate !== undefined) {
          const parsed = parseDueDate(updates.dueDate);
          if (parsed) next.dueDate = parsed;
        }
        if (updates.comments !== undefined) next.comments = updates.comments;

        next.lastUpdated = new Date().toISOString();
        return next;
      })
    );
  };

  const handleAddComment = (taskId: string, author: string, message: string) => {
    if (!message.trim()) return;
    const sanitizedAuthor = author.trim();
    safeSetTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const nextComment: TaskComment = {
          id: generateId("C"),
          author: sanitizedAuthor || "Anonymous",
          message: message.trim(),
          timestamp: new Date().toISOString(),
        };
        return {
          ...task,
          comments: [nextComment, ...task.comments],
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  };

  function handleUpdateComment(
    taskId: string,
    commentId: string,
    updates: Partial<TaskComment>
  ) {
    safeSetTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          comments: task.comments.map((comment) => {
            if (comment.id !== commentId) return comment;
            const nextComment: TaskComment = { ...comment };
            if (updates.author !== undefined) {
              const trimmedAuthor = updates.author?.trim() ?? "";
              nextComment.author = trimmedAuthor || "Anonymous";
            }
            if (updates.message !== undefined) {
              const trimmedMessage = updates.message?.trim();
              if (trimmedMessage) {
                nextComment.message = trimmedMessage;
              }
            }
            if (updates.timestamp !== undefined) {
              nextComment.timestamp = updates.timestamp;
            }
            return nextComment;
          }),
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }

  return (
    <main className="relative flex min-h-screen bg-slate-950 text-slate-50">
      <div className="flex w-full flex-col gap-6 px-6 py-10 lg:px-12">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Mission Control
            <span className="ml-2 text-[10px] lowercase text-slate-500">
              tasks &amp; collaboration
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold text-slate-50">Task Command Center</h1>
              <p className="max-w-2xl text-sm text-slate-300">
                Track work, capture context, and collaborate with your copilot. Ask the
                assistant to create tasks, update owners, or summarize discussions.
              </p>
            </div>
            <button
              onClick={() => setIsCreateOpen((prev) => !prev)}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              {isCreateOpen ? "Close" : "New Task"}
            </button>
          </div>
        </header>

        {isCreateOpen && (
          <form
            onSubmit={handleCreateTask}
            className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-200 lg:grid-cols-[repeat(6,minmax(0,1fr))]"
          >
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
              Title
              <input
                value={newTaskForm.title}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
                placeholder="Write a clear task title"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400 lg:col-span-3">
              Description
              <input
                value={newTaskForm.description}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
                placeholder="Add a quick summary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
              Owner
              <input
                value={newTaskForm.assignee}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({ ...prev, assignee: event.target.value }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
                placeholder="Assignee"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
              Status
              <select
                value={newTaskForm.status}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({
                    ...prev,
                    status: coerceStatus(event.target.value),
                  }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
              Priority
              <select
                value={newTaskForm.priority}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({
                    ...prev,
                    priority: coercePriority(event.target.value),
                  }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
              Due Date
              <input
                type="date"
                value={newTaskForm.dueDate}
                onChange={(event) =>
                  setNewTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              />
            </label>
            <div className="lg:col-span-6 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
              >
                Add Task
              </button>
            </div>
          </form>
        )}

        <section className="grid flex-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="flex h-[calc(100vh-8rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Active Tasks
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ul className="flex flex-col">
                {tasks.map((task) => {
                  const isActive = task.id === selectedTask?.id;
                  return (
                    <li key={task.id}>
                      <button
                        onClick={() => setSelectedId(task.id)}
                        className={`flex w-full flex-col items-start gap-1 px-5 py-4 text-left transition ${
                          isActive
                            ? "bg-slate-800/80 shadow-inner"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-sm font-semibold text-slate-100">
                            {task.title}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${statusBadge(task.status)}`}
                          >
                            {task.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Owner: {task.assignee || "Unassigned"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Updated {formatDate(task.lastUpdated)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          <section className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            {selectedTask ? (
              <TaskDetail
                task={selectedTask}
                onFieldChange={handleFieldChange}
                onUpdateTask={handleBulkUpdate}
                onCreateComment={handleAddComment}
                onUpdateComment={handleUpdateComment}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-500">
                Select a task to see details
              </div>
            )}
          </section>
        </section>
      </div>

      <CopilotSidebar
        clickOutsideToClose={false}
        defaultOpen={false}
        labels={{
          title: "Task Assistant",
          initial:
            "Hello! Ask me to triage tasks, draft updates, or log meeting notes. Try: 'Create a task for a staging smoke test' or 'Add a comment asking Jordan for QA sign-off.'",
        }}
      />
    </main>
  );
}

function statusBadge(status: Task["status"]) {
  switch (status) {
    case "todo":
      return "bg-sky-500/20 text-sky-300 border border-sky-500/30";
    case "in_progress":
      return "bg-amber-500/20 text-amber-200 border border-amber-500/30";
    case "blocked":
      return "bg-rose-500/20 text-rose-200 border border-rose-500/30";
    case "done":
      return "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30";
    default:
      return "bg-slate-700/40 text-slate-300 border border-slate-600/40";
  }
}

type TaskDetailProps = {
  task: Task;
  onFieldChange: <K extends keyof Task>(taskId: string, key: K, value: Task[K]) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onCreateComment: (taskId: string, author: string, message: string) => void;
  onUpdateComment: (taskId: string, commentId: string, updates: Partial<TaskComment>) => void;
};

function TaskDetail({
  task,
  onFieldChange,
  onUpdateTask,
  onCreateComment,
  onUpdateComment,
}: TaskDetailProps) {
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    status: task.status,
    priority: task.priority,
    dueDate: toDateInputValue(task.dueDate),
  });
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditAuthor, setCommentEditAuthor] = useState("");
  const [commentEditMessage, setCommentEditMessage] = useState("");

  useEffect(() => {
    setDraft({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      status: task.status,
      priority: task.priority,
      dueDate: toDateInputValue(task.dueDate),
    });
    setIsEditing(false);
    setEditingCommentId(null);
    setCommentEditAuthor("");
    setCommentEditMessage("");
  }, [task.id, task.lastUpdated]);

  const beginCommentEdit = (comment: TaskComment) => {
    setEditingCommentId(comment.id);
    setCommentEditAuthor(comment.author);
    setCommentEditMessage(comment.message);
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setCommentEditAuthor("");
    setCommentEditMessage("");
  };

  const submitCommentEdit = () => {
    if (!editingCommentId) return;
    const trimmedMessage = commentEditMessage.trim();
    if (!trimmedMessage) return;
    onUpdateComment(task.id, editingCommentId, {
      author: commentEditAuthor.trim() || "Anonymous",
      message: trimmedMessage,
      timestamp: new Date().toISOString(),
    });
    cancelCommentEdit();
  };

  const handleSave = () => {
    const nextDueDate = draft.dueDate
      ? parseDueDate(draft.dueDate) || task.dueDate
      : task.dueDate;
    onUpdateTask(task.id, {
      title: draft.title,
      description: draft.description,
      assignee: draft.assignee,
      status: draft.status,
      priority: draft.priority,
      dueDate: nextDueDate,
    });
    setDraft((prev) => ({
      ...prev,
      dueDate: toDateInputValue(nextDueDate),
    }));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      status: task.status,
      priority: task.priority,
      dueDate: toDateInputValue(task.dueDate),
    });
    setIsEditing(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          {isEditing ? (
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xl font-semibold text-slate-50 focus:border-slate-500 focus:outline-none"
            />
          ) : (
            <h2 className="text-2xl font-semibold text-slate-50">{task.title}</h2>
          )}
          {isEditing ? (
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-slate-300">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={isEditing ? draft.status : task.status}
            onChange={(event) => {
              const value = event.target.value as Task["status"];
              if (isEditing) {
                setDraft((prev) => ({ ...prev, status: value }));
              } else {
                onFieldChange(task.id, "status", value);
              }
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={isEditing ? draft.priority : task.priority}
            onChange={(event) => {
              const value = event.target.value as Task["priority"];
              if (isEditing) {
                setDraft((prev) => ({ ...prev, priority: value }));
              } else {
                onFieldChange(task.id, "priority", value);
              }
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
          Assignee
          <input
            value={isEditing ? draft.assignee : task.assignee}
            onChange={(event) => {
              if (isEditing) {
                setDraft((prev) => ({ ...prev, assignee: event.target.value }));
              } else {
                onFieldChange(task.id, "assignee", event.target.value);
              }
            }}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
            placeholder="Add an owner"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
          Due Date
          <input
            type="date"
            value={isEditing ? draft.dueDate : toDateInputValue(task.dueDate)}
            onChange={(event) => {
              const value = event.target.value;
              if (isEditing) {
                setDraft((prev) => ({ ...prev, dueDate: value }));
              } else {
                if (!value) return;
                const iso = parseDueDate(value);
                if (iso) {
                  onFieldChange(task.id, "dueDate", iso);
                }
              }
            }}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
          />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400">
          Summary
          <textarea
            value={isEditing ? draft.description : task.description}
            onChange={(event) => {
              if (isEditing) {
                setDraft((prev) => ({ ...prev, description: event.target.value }));
              } else {
                onFieldChange(task.id, "description", event.target.value);
              }
            }}
            rows={3}
            className="min-h-[96px] rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
            placeholder="Add more context for collaborators"
          />
        </label>
        <p className="text-xs text-slate-500">
          Last updated {formatDate(task.lastUpdated)}
        </p>
      </div>

      <div className="flex min-h-[360px] flex-1 flex-col gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Activity & Comments
          </h3>
        </header>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <input
              value={commentAuthor}
              onChange={(event) => setCommentAuthor(event.target.value)}
              placeholder="Your name"
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add a note for the team"
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
              />
              <button
                type="button"
                disabled={!commentText.trim()}
                onClick={() => {
                  onCreateComment(task.id, commentAuthor, commentText);
                  setCommentText("");
                  setCommentAuthor("");
                }}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Post
              </button>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 w-full flex-col gap-4 overflow-y-auto pr-2 pb-2">
          {task.comments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No comments yet. Ask the assistant to add an update or leave one yourself.
            </p>
          ) : (
            task.comments.map((comment) => {
              const isCommentEditing = editingCommentId === comment.id;
              return (
                <article
                  key={comment.id}
                  className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/90 px-6 py-5 shadow-lg shadow-slate-900/30"
                >
                  <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-50 uppercase tracking-wide">
                        {isCommentEditing ? commentEditAuthor || "Anonymous" : comment.author}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {formatDate(comment.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCommentEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={!commentEditMessage.trim()}
                            onClick={submitCommentEdit}
                            className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelCommentEdit}
                            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginCommentEdit(comment)}
                          className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </header>
                  {isCommentEditing ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <input
                        value={commentEditAuthor}
                        onChange={(event) => setCommentEditAuthor(event.target.value)}
                        placeholder="Author"
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
                      />
                      <textarea
                        value={commentEditMessage}
                        onChange={(event) => setCommentEditMessage(event.target.value)}
                        rows={3}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
                        placeholder="Update the comment"
                      />
                    </div>
                  ) : (
                    <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-100">
                      {comment.message}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
