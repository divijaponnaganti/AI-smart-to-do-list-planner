/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  Clock, 
  Calendar as CalendarIcon,
  AlertCircle,
  ChevronRight,
  Loader2,
  X,
  RotateCcw,
  Tag,
  Bell,
  BarChart2,
  Settings,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isSameDay, startOfWeek, addDays, subDays } from 'date-fns';
import { Toaster, toast } from 'sonner';
import { Task, Category } from './types';
import { optimizeTasks } from './services/aiService';
import { cn } from './lib/utils';

// Fallback for random ID generation
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('ai-tasks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load tasks from localStorage", e);
      return [];
    }
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('ai-categories');
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Personal', color: '#6366f1' },
        { id: '2', name: 'Work', color: '#ef4444' },
        { id: '3', name: 'Shopping', color: '#10b981' }
      ];
    } catch (e) {
      return [];
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('1');

  useEffect(() => {
    localStorage.setItem('ai-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('ai-categories', JSON.stringify(categories));
  }, [categories]);

  // Reminder Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTasks(prevTasks => {
        let updated = false;
        const newTasks = prevTasks.map(task => {
          if (task.status === 'completed' || task.reminderSent) return task;

          let shouldRemind = false;
          let message = "";

          if (task.scheduledTime) {
            const scheduled = new Date(task.scheduledTime);
            const diffMinutes = (scheduled.getTime() - now.getTime()) / (1000 * 60);
            if (diffMinutes > 0 && diffMinutes <= 5) {
              shouldRemind = true;
              message = `Reminder: "${task.title}" starts in 5 minutes!`;
            }
          } else if (task.deadline) {
            const deadline = new Date(task.deadline);
            const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 0 && diffDays <= 1) {
              shouldRemind = true;
              message = `Reminder: "${task.title}" is due tomorrow!`;
            }
          }

          if (shouldRemind) {
            toast(message, {
              icon: <Bell className="w-4 h-4 text-indigo-500" />,
              duration: 10000,
            });
            updated = true;
            return { ...task, reminderSent: true };
          }
          return task;
        });
        return updated ? newTasks : prevTasks;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all completed tasks?")) {
      setTasks(prev => prev.filter(t => t.status !== 'completed'));
      toast.info("History cleared");
    }
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error("Task title cannot be empty");
      return;
    }

    const newTask: Task = {
      id: generateId(),
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      priority: 'medium',
      status: 'todo',
      category: selectedCategory,
    };

    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    toast.success("Task added successfully");
  };

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id 
        ? { 
            ...t, 
            status: t.status === 'todo' ? 'completed' : 'todo',
            completedAt: t.status === 'todo' ? new Date().toISOString() : undefined 
          } 
        : t
    ));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.info("Task deleted");
  }, []);

  const clearAllTasks = () => {
    if (window.confirm("Are you sure you want to clear all tasks?")) {
      setTasks([]);
      setAiReasoning(null);
      toast.info("All tasks cleared");
    }
  };

  const handleOptimize = async () => {
    if (tasks.length === 0) {
      toast.error("Add some tasks first!");
      return;
    }
    
    setIsOptimizing(true);
    try {
      const result = await optimizeTasks(tasks);
      setTasks(result.tasks);
      setAiReasoning(result.reasoning);
      toast.success('Schedule optimized!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to optimize tasks. Please check your API key.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const sortedTasks = [...tasks]
    .filter(t => !focusMode || t.status === 'todo')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
      if (a.scheduledTime && b.scheduledTime) {
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      }
      const priorityMap = { high: 0, medium: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">Smart Planner</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">AI Powered</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Weekly Stats"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            {!process.env.GEMINI_API_KEY && (
              <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                <AlertCircle className="w-3 h-3" />
                Key Missing
              </div>
            )}
            {tasks.length > 0 && (
              <button
                onClick={clearAllTasks}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Clear all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleOptimize}
              disabled={isOptimizing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 active:scale-95",
                isOptimizing && "animate-pulse"
              )}
            >
              {isOptimizing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isOptimizing ? "Thinking..." : "Optimize"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Section */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Weekly Completion</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                    <CalendarDays className="w-3 h-3" />
                    Last 7 Days
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2 h-32">
                  {[...Array(7)].map((_, i) => {
                    const date = subDays(new Date(), 6 - i);
                    const count = tasks.filter(t => t.status === 'completed' && t.completedAt && isSameDay(parseISO(t.completedAt), date)).length;
                    const maxCount = Math.max(...[...Array(7)].map((_, j) => tasks.filter(t => t.status === 'completed' && t.completedAt && isSameDay(parseISO(t.completedAt), subDays(new Date(), 6 - j))).length), 1);
                    const height = (count / maxCount) * 100;
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-slate-50 rounded-lg relative overflow-hidden h-full">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-lg"
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">{format(date, 'EEE')}</span>
                        <span className="text-[10px] font-bold text-slate-900">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Reasoning Alert */}
        <AnimatePresence>
          {aiReasoning && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="p-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">AI Strategy</p>
                  </div>
                  <button 
                    onClick={() => setAiReasoning(null)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm font-medium leading-relaxed opacity-90">{aiReasoning}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Task Form */}
        <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 transition-all">
          <form onSubmit={addTask} className="space-y-4">
            <div className="space-y-1">
              <input
                type="text"
                placeholder="What's on your mind?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full text-xl font-bold bg-transparent border-none focus:ring-0 placeholder:text-slate-300"
              />
              <textarea
                placeholder="Add some context..."
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="w-full text-sm bg-transparent border-none focus:ring-0 placeholder:text-slate-300 resize-none h-12"
              />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div className="relative group/cat">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="appearance-none bg-slate-50 border-none rounded-full px-4 py-1.5 pr-8 text-[10px] font-bold text-slate-600 uppercase tracking-wider focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <Tag className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(!showCategoryManager)}
                  className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Manage Categories"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95 group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span>Add Task</span>
              </button>
            </div>
          </form>
        </section>

        {/* Category Manager */}
        <AnimatePresence>
          {showCategoryManager && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-indigo-50/50 rounded-[2rem] p-6 border border-indigo-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Manage Categories</h3>
                  <button onClick={() => setShowCategoryManager(false)} className="text-indigo-400 hover:text-indigo-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-indigo-100 shadow-sm">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] font-bold text-slate-700 uppercase">{cat.name}</span>
                      {categories.length > 1 && (
                        <button 
                          onClick={() => setCategories(prev => prev.filter(c => c.id !== cat.id))}
                          className="text-slate-300 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="New Category..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = (e.target as HTMLInputElement).value.trim();
                        if (name) {
                          const colors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                          const color = colors[categories.length % colors.length];
                          setCategories(prev => [...prev, { id: generateId(), name, color }]);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                    className="flex-1 bg-white border-indigo-100 rounded-xl px-4 py-2 text-xs focus:ring-indigo-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task List */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                {showHistory ? "History" : "Your Timeline"}
              </h2>
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-all",
                  showHistory 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                )}
              >
                {showHistory ? "Back to List" : "Show History"}
              </button>
            </div>
            <div className="flex items-center gap-4">
              {showHistory && tasks.some(t => t.status === 'completed') && (
                <button 
                  onClick={clearHistory}
                  className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
                >
                  Clear History
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {showHistory 
                    ? `${tasks.filter(t => t.status === 'completed').length} Completed`
                    : `${tasks.filter(t => t.status === 'todo').length} Pending`
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {(showHistory 
              ? tasks.filter(t => t.status === 'completed') 
              : sortedTasks
            ).length === 0 ? (
              <div className="text-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-6">
                  <CalendarIcon className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-bold">
                  {showHistory ? "No history yet" : "Your list is empty"}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  {showHistory ? "Completed tasks will appear here." : "Add your first task to start planning."}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {(showHistory 
                  ? tasks.filter(t => t.status === 'completed') 
                  : sortedTasks
                ).map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      "group relative bg-white p-5 rounded-[2rem] border transition-all flex items-start gap-5",
                      task.status === 'completed' 
                        ? "border-slate-100 opacity-50 grayscale" 
                        : "border-slate-200/60 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50"
                    )}
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={cn(
                        "mt-1 shrink-0 transition-all duration-300 transform active:scale-75",
                        task.status === 'completed' ? "text-indigo-600" : "text-slate-200 hover:text-indigo-400"
                      )}
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-7 h-7" />
                      ) : (
                        <Circle className="w-7 h-7" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className={cn(
                          "font-bold text-slate-900 truncate text-base",
                          task.status === 'completed' && "line-through text-slate-400"
                        )}>
                          {task.title}
                        </h3>
                        {task.priority === 'high' && !task.status.includes('completed') && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded-lg tracking-tighter">High Priority</span>
                        )}
                        {task.category && (
                          <span 
                            className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg tracking-tighter"
                            style={{ 
                              backgroundColor: `${categories.find(c => c.id === task.category)?.color}15`,
                              color: categories.find(c => c.id === task.category)?.color 
                            }}
                          >
                            {categories.find(c => c.id === task.category)?.name}
                          </span>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3 font-medium leading-relaxed">{task.description}</p>
                      )}

                      <div className="flex items-center gap-4">
                        {task.scheduledTime && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(task.scheduledTime), 'h:mm a')}
                          </div>
                        )}
                        {task.deadline && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <CalendarIcon className="w-3 h-3" />
                            {format(parseISO(task.deadline), 'MMM d')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Stats Floating Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-30">
        <motion.button 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          onClick={() => {
            setFocusMode(!focusMode);
            toast.info(focusMode ? "Showing all tasks" : "Focus Mode: Showing pending tasks only");
          }}
          className={cn(
            "w-full bg-slate-900/90 backdrop-blur-xl text-white rounded-[2rem] px-8 py-4 flex items-center justify-between shadow-2xl shadow-slate-900/20 border border-white/10 transition-all active:scale-95",
            focusMode && "ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-900"
          )}
        >
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Done</p>
              <p className="text-xl font-black leading-none tracking-tighter">{tasks.filter(t => t.status === 'completed').length}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Total</p>
              <p className="text-xl font-black leading-none tracking-tighter">{tasks.length}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-indigo-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{focusMode ? "Focused" : "Progress"}</span>
              <ChevronRight className={cn("w-4 h-4 transition-transform", focusMode && "rotate-90")} />
            </div>
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
