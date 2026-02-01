from typing import Annotated, Optional

from llama_index.llms.openai import OpenAI
from llama_index.protocols.ag_ui.router import get_ag_ui_workflow_router


# This tool has a client-side version that is actually called to change the background
# These tools just need a response string to make it look like they are executing
def change_theme_color(
    theme_color: Annotated[str, "The hex color value. i.e. '#123456''"],
) -> str:
    """Change the background color of the chat. Can be any hex color value."""
    return f"Changing background to {theme_color}"


# This is another client-side tool that is actually called to add a proverb to the list
# These tools just need a response string to make it look like they are executing
async def add_proverb(
    proverb: Annotated[str, "The proverb to add. Make it witty, short and concise."],
) -> str:
    """Add a proverb to the list of proverbs."""
    return f"Added proverb: {proverb}"


# This is a backend tool that executes code on the backend server
# For now this is a dummy implementation, but it could very well call a weather API
async def get_weather(
    location: Annotated[str, "The location to get the weather for."],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny and 70 degrees."


async def create_task(
    title: Annotated[str, "Short task title"],
    description: Annotated[str, "Expanded task description"],
    assignee: Annotated[str, "Primary owner"],
    status: Annotated[str, "Status value like todo, in_progress, blocked, or done"],
    priority: Annotated[str, "Priority flag: low, medium, or high"],
    due_date: Annotated[Optional[str], "Optional ISO timestamp for due date"] = None,
) -> str:
    """Return a summary of the task that the client will create."""
    suffix = f"due {due_date}" if due_date else "with no due date provided"
    return f"Scheduling task '{title}' for {assignee} ({status}, {priority}) {suffix}."


async def update_task(
    task_id: Annotated[str, "Task identifier"],
    updates: Annotated[dict, "Fields to update for the task"],
) -> str:
    """Return confirmation for task updates."""
    return f"Applying updates to {task_id}: {updates}"


async def add_task_comment(
    task_id: Annotated[str, "Task identifier"],
    author: Annotated[str, "Comment author"],
    message: Annotated[str, "Comment body"],
) -> str:
    """Return confirmation for a comment."""
    return f"Logging comment on {task_id} from {author}: {message}"


async def update_task_comment(
    task_id: Annotated[str, "Task identifier"],
    comment_id: Annotated[str, "Comment identifier"],
    updates: Annotated[dict, "Fields to update for the comment"],
) -> str:
    """Return confirmation for a comment update."""
    return f"Updating comment {comment_id} on {task_id}: {updates}"


agentic_chat_router = get_ag_ui_workflow_router(
    llm=OpenAI(model="gpt-4.1"),
    # Tools that are executed in the frontend client
    frontend_tools=[
        change_theme_color,
        add_proverb,
        create_task,
        update_task,
        add_task_comment,
        update_task_comment,
    ],  # type: ignore[arg-type]
    # Tools that are executed in the backend server
    backend_tools=[get_weather],  # type: ignore[arg-type]
    system_prompt=(
        "You are a helpful assistant who keeps track of inspirational proverbs, "
        "manages a collaborative task board (including ownership, status, priority, "
        "and comment threads), can update existing comments, describe the weather for a "
        "city, and change the UI theme on request. Make sure tool arguments are valid "
        "JSON and include all required fields."
    ),
    initial_state={
        "proverbs": [
            "CopilotKit may be new, but its the best thing since sliced bread.",
        ],
        "tasks": [
            {
                "id": "T-101",
                "title": "Polish onboarding flow",
                "description": "Review the new onboarding flow, collect stakeholder feedback, and prep a rollout plan.",
                "status": "in_progress",
                "assignee": "Avery Johnson",
                "dueDate": "2026-02-04T11:30:00.000Z",
                "priority": "high",
                "lastUpdated": "2026-02-01T11:30:00.000Z",
                "comments": [
                    {
                        "id": "C-1",
                        "author": "Avery Johnson",
                        "message": "Working through the analytics dashboard copy now.",
                        "timestamp": "2026-02-01T10:45:00.000Z",
                    },
                    {
                        "id": "C-2",
                        "author": "Jordan Lee",
                        "message": "Please confirm the legal review is still on track for Friday.",
                        "timestamp": "2026-02-01T11:05:00.000Z",
                    },
                ],
            },
            {
                "id": "T-102",
                "title": "Set up availability monitoring",
                "description": "Instrument uptime monitors for the new agent endpoints and configure alerts.",
                "status": "todo",
                "assignee": "Priya Singh",
                "dueDate": "2026-02-07T11:30:00.000Z",
                "priority": "medium",
                "lastUpdated": "2026-02-01T09:30:00.000Z",
                "comments": [
                    {
                        "id": "C-3",
                        "author": "Priya Singh",
                        "message": "Need credentials for the status page provider.",
                        "timestamp": "2026-02-01T09:10:00.000Z",
                    }
                ],
            },
        ],
    },
)
