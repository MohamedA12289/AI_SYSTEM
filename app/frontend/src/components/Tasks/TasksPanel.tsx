import { useState, useEffect } from "react";
import { getApiBase } from "@/services/api";

interface Task {
  id: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TasksPanelProps {
  projectPath: string;
}

export function TasksPanel({ projectPath }: TasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [newTaskContent, setNewTaskContent] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [projectPath]);

  const loadTasks = async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/tasks?project_path=${encodeURIComponent(projectPath)}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    }
  };

  const addTask = async () => {
    if (!newTaskContent.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      content: newTaskContent,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const response = await fetch(`${getApiBase()}/api/tasks?project_path=${encodeURIComponent(projectPath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task)
      });

      if (response.ok) {
        setNewTaskContent("");
        setShowInput(false);
        await loadTasks();
      }
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`${getApiBase()}/api/tasks/${taskId}?project_path=${encodeURIComponent(projectPath)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await loadTasks();
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const filteredTasks = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      backgroundColor: "#1e1e1e",
      color: "#CCCCCC",
      fontFamily: "Consolas, monospace",
      fontSize: "13px"
    }}>
      <div style={{
        padding: "10px",
        borderBottom: "1px solid #2d2d2d",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span style={{ fontWeight: "bold" }}>Tasks</span>
        <button
          onClick={() => setShowInput(!showInput)}
          style={{
            padding: "4px 8px",
            backgroundColor: "#6b6b6b",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          + Add Task
        </button>
      </div>

      {showInput && (
        <div style={{ padding: "10px", borderBottom: "1px solid #2d2d2d" }}>
          <input
            type="text"
            value={newTaskContent}
            onChange={(e) => setNewTaskContent(e.target.value)}
            placeholder="Enter task description..."
            onKeyDown={(e) => {
              if (e.key === "Enter") addTask();
              if (e.key === "Escape") setShowInput(false);
            }}
            autoFocus
            style={{
              width: "100%",
              padding: "6px",
              backgroundColor: "#3c3c3c",
              color: "#CCCCCC",
              border: "1px solid #555555",
              fontFamily: "Consolas, monospace",
              fontSize: "13px"
            }}
          />
        </div>
      )}

      <div style={{
        padding: "10px",
        borderBottom: "1px solid #2d2d2d",
        display: "flex",
        gap: "8px"
      }}>
        {["all", "pending", "in_progress", "completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 8px",
              backgroundColor: filter === f ? "#6b6b6b" : "#3c3c3c",
              color: filter === f ? "#ffffff" : "#CCCCCC",
              border: "none",
              cursor: "pointer",
              fontSize: "11px",
              textTransform: "capitalize"
            }}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {filteredTasks.length === 0 ? (
          <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
            No tasks yet
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              style={{
                padding: "10px",
                marginBottom: "8px",
                backgroundColor: "#252526",
                border: "1px solid #3c3c3c",
                borderRadius: "4px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <input
                  type="checkbox"
                  checked={task.status === "completed"}
                  onChange={() => updateTaskStatus(task.id, task.status === "completed" ? "pending" : "completed")}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ flex: 1, textDecoration: task.status === "completed" ? "line-through" : "none" }}>
                  {task.content}
                </span>
                <select
                  value={task.status}
                  onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                  style={{
                    padding: "2px 4px",
                    backgroundColor: "#3c3c3c",
                    color: "#CCCCCC",
                    border: "1px solid #555555",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div style={{ fontSize: "11px", color: "#808080" }}>
                Created: {new Date(task.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
