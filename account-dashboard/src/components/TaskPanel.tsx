import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Task, ManualTask } from '../types';
import {
  GitBranch,
  Plus,
  ExternalLink,
  CircleDot,
  CircleCheck,
  X,
  Loader2,
} from 'lucide-react';

interface TaskPanelProps {
  tasks: Task[];
  manualTasks: ManualTask[];
  accountId: string;
  accountName: string;
}

export function TaskPanel({ tasks, manualTasks, accountId, accountName }: TaskPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; priority: 'High' | 'Medium' | 'Low' }>({ title: '', description: '', priority: 'Medium' });

  // Use project status (Generated/Blocked/Backlog/Done) as primary, fall back to GitHub state
  const isTaskDone = (t: Task) => {
    const status = t.status.toLowerCase();
    if (status === 'done') return true;
    if (status && status !== 'done') return false;
    // Fallback to GitHub issue state if no project status
    return t.state !== 'OPEN';
  };
  const openTasks = tasks.filter((t) => !isTaskDone(t));
  const closedTasks = tasks.filter((t) => isTaskDone(t));
  const [showClosed, setShowClosed] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      // Call Apps Script webhook to create GitHub issue
      const webhookUrl = import.meta.env.VITE_APPS_SCRIPT_WEBHOOK_URL;
      let githubData = null;

      if (webhookUrl) {
        try {
          const res = await fetch(`${webhookUrl}?type=create_task`, {
            method: 'POST',
            body: JSON.stringify({
              title: form.title,
              description: form.description,
              priority: form.priority,
              accountName,
              accountId,
            }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.success) {
              githubData = result;
            }
          }
        } catch (webhookErr) {
          console.warn('GitHub issue creation failed, saving task locally:', webhookErr);
        }
      }

      await addDoc(collection(db, 'accounts', accountId, 'manualTasks'), {
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: 'Open',
        accountId,
        accountName,
        githubIssueId: githubData?.issueNodeId || null,
        githubIssueNumber: githubData?.issueNumber || null,
        githubIssueUrl: githubData?.issueUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setForm({ title: '', description: '', priority: 'Medium' });
      setShowCreate(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-dark-200">
            Tasks
            <span className="text-dark-500 font-normal ml-1.5">
              {openTasks.length} open
            </span>
          </h2>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Task
        </button>
      </div>

      {showCreate && (
        <div className="p-3 border-b border-dark-700/50 bg-dark-850/50 space-y-2">
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent/50"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as 'High' | 'Medium' | 'Low' })}
              className="bg-dark-800 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-dark-200 focus:outline-none"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs text-dark-400 hover:text-dark-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.title.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto">
        {openTasks.length === 0 && manualTasks.length === 0 && (
          <div className="px-4 py-6 text-center text-dark-500 text-sm">No open tasks</div>
        )}

        {manualTasks
          .filter((t) => t.status !== 'Done')
          .map((task) => (
            <div key={task.id} className="px-4 py-2.5 border-b border-dark-700/30 hover:bg-dark-800/50">
              <div className="flex items-start gap-2">
                <CircleDot className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-dark-100 truncate">{task.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent shrink-0">
                      Manual
                    </span>
                    {task.priority === 'High' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 shrink-0">
                        High
                      </span>
                    )}
                  </div>
                  {task.githubIssueUrl && (
                    <a
                      href={task.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-dark-500 hover:text-accent flex items-center gap-1 mt-0.5"
                    >
                      #{task.githubIssueNumber} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

        {openTasks.map((task) => (
          <div key={task.taskId} className="px-4 py-2.5 border-b border-dark-700/30 hover:bg-dark-800/50">
            <div className="flex items-start gap-2">
              <CircleDot className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-dark-100 truncate">{task.title}</span>
                  {task.status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-dark-300 shrink-0">
                      {task.status}
                    </span>
                  )}
                  {task.priority && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        task.priority === 'Critical'
                          ? 'bg-red-500/10 text-red-400'
                          : task.priority === 'High'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-dark-700 text-dark-400'
                      }`}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>
                {task.url && (
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-dark-500 hover:text-accent flex items-center gap-1 mt-0.5"
                  >
                    View on GitHub <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {closedTasks.length > 0 && (
          <>
            <button
              onClick={() => setShowClosed(!showClosed)}
              className="w-full px-4 py-2 text-xs text-dark-500 hover:text-dark-300 text-left hover:bg-dark-800/30"
            >
              {showClosed ? 'Hide' : 'Show'} {closedTasks.length} closed tasks
            </button>
            {showClosed &&
              closedTasks.map((task) => (
                <div key={task.taskId} className="px-4 py-2 border-b border-dark-700/30 opacity-50">
                  <div className="flex items-start gap-2">
                    <CircleCheck className="w-4 h-4 text-dark-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-dark-400 truncate line-through">
                      {task.title}
                    </span>
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
