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
  CalendarDays,
  Target,
  TrendingUp,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isSameDay, startOfWeek, addDays, subDays } from 'date-fns';
import { Toaster, toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
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
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
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
        { id: '1', name: 'Personal', color: '#9A3412' },
        { id: '2', name: 'Work', color: '#1E293B' },
        { id: '3', name: 'Shopping', color: '#0D9488' }
      ];
    } catch (e) {
      return [];
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
      category: selectedCategory || categories[0]?.id || '1',
      deadline: newTaskDate ? new Date(newTaskDate).toISOString() : undefined,
      scheduledTime: newTaskTime ? new Date(`${newTaskDate || format(new Date(), 'yyyy-MM-dd')}T${newTaskTime}`).toISOString() : undefined,
    };

    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDate('');
    setNewTaskTime('');
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
    .filter(t => !selectedCategory || t.category === selectedCategory)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
      if (a.scheduledTime && b.scheduledTime) {
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      }
      const priorityMap = { high: 0, medium: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });

  const categoryStats = categories.map(cat => ({
    name: cat.name,
    value: tasks.filter(t => t.category === cat.id).length,
    color: cat.color
  })).filter(s => s.value > 0);

  const completionStats = [
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: '#0D9488' },
    { name: 'Pending', value: tasks.filter(t => t.status === 'todo').length, color: '#9A3412' }
  ];

  const priorityStats = [
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: '#ef4444' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: '#f59e0b' },
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: '#10b981' }
  ];

  return (
    <div className="min-h-screen bg-app-bg font-sans text-app-ink selection:bg-app-accent selection:text-white antialiased">
      <Toaster position="top-right" richColors closeButton />
      
      {/* Navigation Rail (Desktop) */}
      <nav className="fixed top-0 left-0 bottom-0 w-24 border-r border-app-line hidden lg:flex flex-col items-center py-12 gap-12 z-50 bg-white/20 backdrop-blur-3xl">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="w-14 h-14 bg-app-ink rounded-full flex items-center justify-center text-white shadow-2xl shadow-slate-300 cursor-pointer"
        >
          <Sparkles className="w-6 h-6" />
        </motion.div>
        
        <div className="flex-1 flex flex-col gap-10">
          <button 
            onClick={() => { setShowStats(false); setShowHistory(false); }} 
            className={cn(
              "p-4 rounded-full transition-all duration-500 relative group",
              !showStats && !showHistory ? "bg-app-ink text-white shadow-xl" : "text-slate-400 hover:text-app-ink hover:bg-slate-100"
            )}
          >
            <CalendarDays className="w-6 h-6" />
            <span className="absolute left-full ml-6 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap uppercase tracking-widest">Timeline</span>
          </button>
          
          <button 
            onClick={() => { setShowStats(!showStats); setShowHistory(false); }} 
            className={cn(
              "p-4 rounded-full transition-all duration-500 relative group",
              showStats ? "bg-app-ink text-white shadow-xl" : "text-slate-400 hover:text-app-ink hover:bg-slate-100"
            )}
          >
            <BarChart2 className="w-6 h-6" />
            <span className="absolute left-full ml-6 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap uppercase tracking-widest">Analytics</span>
          </button>
          
          <button 
            onClick={() => { setShowHistory(!showHistory); setShowStats(false); }} 
            className={cn(
              "p-4 rounded-full transition-all duration-500 relative group",
              showHistory ? "bg-app-ink text-white shadow-xl" : "text-slate-400 hover:text-app-ink hover:bg-slate-100"
            )}
          >
            <RotateCcw className="w-6 h-6" />
            <span className="absolute left-full ml-6 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap uppercase tracking-widest">History</span>
          </button>
        </div>
        
        <button 
          onClick={() => setShowCategoryManager(!showCategoryManager)} 
          className="p-4 text-slate-400 hover:text-app-ink hover:bg-slate-100 rounded-full transition-all relative group"
        >
          <Settings className="w-6 h-6" />
          <span className="absolute left-full ml-6 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap uppercase tracking-widest">Settings</span>
        </button>
      </nav>

      {/* Mobile Navigation (Bottom Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 border-t border-app-line flex lg:hidden items-center justify-around z-50 bg-white/80 backdrop-blur-3xl px-6">
        <button 
          onClick={() => { setShowStats(false); setShowHistory(false); }} 
          className={cn(
            "p-3 rounded-2xl transition-all flex flex-col items-center gap-1",
            !showStats && !showHistory ? "text-app-ink" : "text-slate-400"
          )}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">Timeline</span>
        </button>
        
        <button 
          onClick={() => { setShowStats(!showStats); setShowHistory(false); }} 
          className={cn(
            "p-3 rounded-2xl transition-all flex flex-col items-center gap-1",
            showStats ? "text-app-ink" : "text-slate-400"
          )}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">Stats</span>
        </button>

        <button 
          onClick={() => setShowCategoryManager(!showCategoryManager)} 
          className="w-12 h-12 bg-app-ink rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-300"
        >
          <Plus className="w-6 h-6" />
        </button>
        
        <button 
          onClick={() => { setShowHistory(!showHistory); setShowStats(false); }} 
          className={cn(
            "p-3 rounded-2xl transition-all flex flex-col items-center gap-1",
            showHistory ? "text-app-ink" : "text-slate-400"
          )}
        >
          <RotateCcw className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">History</span>
        </button>

        <button 
          onClick={() => setShowCategoryManager(!showCategoryManager)} 
          className="p-3 text-slate-400 flex flex-col items-center gap-1"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">Setup</span>
        </button>
      </nav>

      <div className="lg:pl-24 flex flex-col lg:flex-row min-h-screen pb-24 lg:pb-0">
        {/* Left Panel: Stats & Context */}
        <aside className="w-full lg:w-[480px] border-r border-app-line p-8 lg:p-12 lg:sticky lg:top-0 lg:h-screen overflow-y-auto space-y-12 lg:space-y-16 bg-white/10 backdrop-blur-sm">
          <header className="space-y-4 lg:space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-[1px] bg-app-ink opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">System v2.5</p>
            </div>
            <h1 className="text-5xl lg:text-7xl font-serif italic font-light tracking-tight leading-[0.85] text-slate-900">
              The Daily<br/>
              <span className="text-app-ink not-italic font-sans font-black tracking-tighter">PROTOCOL.</span>
            </h1>
          </header>

          {/* Stats Widget */}
          <section className="space-y-10">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Momentum</h2>
              <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-900 rounded-full">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                  {Math.round((tasks.filter(t => t.status === 'completed').length / (tasks.length || 1)) * 100)}% Peak
                </span>
              </div>
            </div>
            
            <div className="flex items-end justify-between gap-3 h-40">
              {[...Array(7)].map((_, i) => {
                const date = subDays(new Date(), 6 - i);
                const count = tasks.filter(t => t.status === 'completed' && t.completedAt && isSameDay(parseISO(t.completedAt), date)).length;
                const maxCount = Math.max(...[...Array(7)].map((_, j) => tasks.filter(t => t.status === 'completed' && t.completedAt && isSameDay(parseISO(t.completedAt), subDays(new Date(), 6 - j))).length), 1);
                const height = (count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                    <div className="w-full bg-slate-100/50 rounded-2xl relative overflow-hidden h-full border border-slate-200/50">
                      <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: `${height}%` }} 
                        className="absolute bottom-0 left-0 right-0 bg-app-ink rounded-t-2xl" 
                      />
                    </div>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest group-hover:text-app-ink transition-colors">
                      {format(date, 'EEE')}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* AI Strategy */}
          <AnimatePresence>
            {aiReasoning && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 20 }}
                className="space-y-6"
              >
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Strategy</h2>
                <div className="relative p-10 bg-white border border-app-line rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-app-ink" />
                  <Sparkles className="w-6 h-6 text-app-ink mb-6 opacity-20" />
                  <p className="font-serif italic text-2xl leading-relaxed text-slate-800 relative z-10">
                    {aiReasoning}
                  </p>
                  <button 
                    onClick={() => setAiReasoning(null)} 
                    className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-300" />
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Category Quick Access */}
          <section className="space-y-6 lg:space-y-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Collections</h2>
            <div className="flex lg:grid lg:grid-cols-1 gap-4 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar snap-x">
              <button 
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "flex items-center justify-between p-5 lg:p-6 rounded-[1.5rem] transition-all duration-500 group shrink-0 w-[240px] lg:w-full snap-start",
                  selectedCategory === null 
                    ? "bg-slate-900 text-white shadow-2xl shadow-slate-300" 
                    : "bg-white border border-app-line hover:border-slate-300"
                )}
              >
                <div className="flex items-center gap-4 lg:gap-5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border border-app-line" style={{ backgroundColor: selectedCategory === null ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)' }}>
                    <Sparkles className={cn("w-4 h-4", selectedCategory === null ? "text-white" : "text-slate-400")} />
                  </div>
                  <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em]">All Protocols</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-[9px] lg:text-[10px] font-bold px-3 py-1 rounded-full",
                    selectedCategory === null ? "bg-white/10 text-white/60" : "bg-slate-50 text-slate-400"
                  )}>
                    {tasks.filter(t => t.status === 'todo').length}
                  </span>
                  <ChevronRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", selectedCategory === null ? "text-white/20" : "text-slate-200")} />
                </div>
              </button>

              {categories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center justify-between p-5 lg:p-6 rounded-[1.5rem] transition-all duration-500 group shrink-0 w-[240px] lg:w-full snap-start",
                    selectedCategory === cat.id 
                      ? "bg-slate-900 text-white shadow-2xl shadow-slate-300" 
                      : "bg-white border border-app-line hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-4 lg:gap-5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border border-app-line" style={{ backgroundColor: selectedCategory === cat.id ? 'rgba(255,255,255,0.1)' : `${cat.color}08` }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    </div>
                    <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em]">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[9px] lg:text-[10px] font-bold px-3 py-1 rounded-full",
                      selectedCategory === cat.id ? "bg-white/10 text-white/60" : "bg-slate-50 text-slate-400"
                    )}>
                      {tasks.filter(t => t.category === cat.id && t.status === 'todo').length}
                    </span>
                    <ChevronRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", selectedCategory === cat.id ? "text-white/20" : "text-slate-200")} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        {/* Main Content: Task List */}
        <main className="flex-1 p-8 lg:p-20 space-y-20 max-w-6xl mx-auto w-full">
          {/* Category Context Header */}
          {selectedCategory && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-6 lg:gap-8 pb-8 lg:pb-10 border-b-2 border-app-line"
            >
              <div 
                className="w-16 h-16 lg:w-24 lg:h-24 rounded-[1.5rem] lg:rounded-[2rem] flex items-center justify-center shadow-2xl shrink-0"
                style={{ backgroundColor: categories.find(c => c.id === selectedCategory)?.color }}
              >
                <div className="w-3 h-3 lg:w-4 lg:h-4 bg-white rounded-full shadow-inner" />
              </div>
              <div className="space-y-1 lg:space-y-2 min-w-0">
                <h1 className="text-4xl lg:text-7xl font-black tracking-tighter text-slate-900 uppercase truncate">
                  {categories.find(c => c.id === selectedCategory)?.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Protocol Collection</span>
                  <div className="hidden lg:block w-1 h-1 bg-slate-300 rounded-full" />
                  <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-app-accent">
                    {tasks.filter(t => t.category === selectedCategory && t.status === 'todo').length} Active
                  </span>
                  <div className="hidden lg:block w-1 h-1 bg-slate-300 rounded-full" />
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-app-ink transition-colors flex items-center gap-2"
                  >
                    <X className="w-3 h-3" />
                    Clear Filter
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Header & Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 lg:gap-12">
            <div className="space-y-3 lg:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-app-ink rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Current View</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-black tracking-tighter text-slate-900">
                {showStats ? "Analytics" : showHistory ? "Archive" : "Timeline"}
              </h2>
              <p className="text-slate-400 font-medium text-base lg:text-lg max-w-md">
                {showStats 
                  ? "Quantitative analysis of your protocol execution and resource allocation."
                  : showHistory 
                    ? "A curated collection of your past milestones and completed objectives." 
                    : `Orchestrating ${tasks.filter(t => t.status === 'todo').length} active protocols for optimal output.`
                }
              </p>
            </div>
            
            {!showStats && (
              <div className="flex items-center gap-4 lg:gap-6">
                {!showHistory && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-4 px-6 lg:px-10 py-4 lg:py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] lg:text-[10px] shadow-2xl shadow-slate-300 hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isOptimizing ? "Processing..." : "Optimize Flow"}
                  </motion.button>
                )}
                
                <button 
                  onClick={showHistory ? clearHistory : clearAllTasks}
                  className="p-4 lg:p-5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100 shrink-0"
                  title={showHistory ? "Clear History" : "Clear All"}
                >
                  <Trash2 className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
              </div>
            )}
          </div>

          {/* Analytics View */}
          {showStats && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-10"
            >
              <div className="neo-card p-6 lg:p-10 space-y-6 lg:space-y-8">
                <div className="flex items-center gap-4">
                  <Activity className="w-5 h-5 lg:w-6 lg:h-6 text-app-accent" />
                  <h3 className="text-lg lg:text-xl font-black tracking-tighter text-slate-900 uppercase">Execution Rate</h3>
                </div>
                <div className="h-48 lg:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={completionStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {completionStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 lg:gap-8">
                  {completionStats.map(stat => (
                    <div key={stat.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                      <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="neo-card p-6 lg:p-10 space-y-6 lg:space-y-8">
                <div className="flex items-center gap-4">
                  <Target className="w-5 h-5 lg:w-6 lg:h-6 text-app-accent" />
                  <h3 className="text-lg lg:text-xl font-black tracking-tighter text-slate-900 uppercase">Resource Allocation</h3>
                </div>
                <div className="h-48 lg:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                      />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400">Tasks per Collection</p>
              </div>

              <div className="neo-card p-6 lg:p-10 space-y-6 lg:space-y-8">
                <div className="flex items-center gap-4">
                  <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 text-app-accent" />
                  <h3 className="text-lg lg:text-xl font-black tracking-tighter text-slate-900 uppercase">Priority Distribution</h3>
                </div>
                <div className="h-48 lg:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {priorityStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 lg:gap-6">
                  {priorityStats.map(stat => (
                    <div key={stat.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                      <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Add Task Form */}
          {!showHistory && !showStats && (
            <motion.section 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="neo-card p-8 lg:p-12 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Plus className="w-24 lg:w-32 h-24 lg:h-32 text-app-ink" />
              </div>
              <form onSubmit={addTask} className="space-y-8 lg:space-y-10 relative z-10">
                <div className="space-y-4 lg:space-y-6">
                  <input
                    type="text"
                    placeholder="Define a new objective..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full text-2xl lg:text-4xl font-black bg-transparent border-none focus:ring-0 placeholder:text-slate-200 tracking-tighter"
                  />
                  <textarea
                    placeholder="Elaborate on the details, context, or desired outcome..."
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    className="w-full text-lg lg:text-xl bg-transparent border-none focus:ring-0 placeholder:text-slate-200 resize-none h-24 font-medium text-slate-500 leading-relaxed"
                  />
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-6 lg:gap-8 pt-8 lg:pt-10 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                    <div className="relative group/select">
                      <select
                        value={selectedCategory || categories[0]?.id || ''}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-6 lg:px-8 py-3 lg:py-4 pr-12 lg:pr-14 text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] focus:ring-4 focus:ring-slate-100 cursor-pointer hover:bg-white hover:border-slate-200 transition-all"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <Tag className="w-4 h-4 absolute right-4 lg:right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover/select:text-app-ink transition-colors" />
                    </div>

                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="relative group/date">
                        <input
                          type="date"
                          value={newTaskDate}
                          onChange={(e) => setNewTaskDate(e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-8 py-4 pr-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] focus:ring-4 focus:ring-slate-100 cursor-pointer hover:bg-white hover:border-slate-200 transition-all"
                        />
                        <CalendarIcon className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover/date:text-app-ink transition-colors" />
                      </div>

                      <div className="relative group/time">
                        <input
                          type="time"
                          value={newTaskTime}
                          onChange={(e) => setNewTaskTime(e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-8 py-4 pr-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] focus:ring-4 focus:ring-slate-100 cursor-pointer hover:bg-white hover:border-slate-200 transition-all"
                        />
                        <Clock className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover/time:text-app-ink transition-colors" />
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(!showCategoryManager)}
                      className="p-4 text-slate-300 hover:text-app-ink hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, x: 8 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex items-center gap-4 px-12 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-slate-300 hover:bg-slate-800 transition-all"
                  >
                    <span>Initialize Task</span>
                    <Plus className="w-5 h-5" />
                  </motion.button>
                </div>
              </form>
            </motion.section>
          )}

          {/* Task List */}
          <section className="space-y-12">
          {/* Task List */}
          {!showStats && (
            <AnimatePresence mode="popLayout">
              {(showHistory 
                ? tasks.filter(t => t.status === 'completed' && (!selectedCategory || t.category === selectedCategory)) 
                : sortedTasks
              ).length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-40 neo-card border-dashed border-2 border-slate-200 bg-transparent shadow-none"
                >
                  <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-10 border border-slate-100">
                    <CalendarIcon className="w-12 h-12 text-slate-200" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                    {showHistory ? "Archive Empty" : "Perfect Harmony."}
                  </h3>
                  <p className="text-slate-400 font-medium mt-4 text-lg">
                    {showHistory ? "Your completed objectives will manifest here." : "No active protocols detected. Ready for input."}
                  </p>
                </motion.div>
              ) : (
                <div className="grid gap-8">
                  {(showHistory 
                    ? tasks.filter(t => t.status === 'completed' && (!selectedCategory || t.category === selectedCategory)) 
                    : sortedTasks
                  ).map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "neo-card p-6 lg:p-10 flex items-start gap-6 lg:gap-10 group relative",
                        task.status === 'completed' && "opacity-50 grayscale shadow-none hover:shadow-none translate-y-0 border-slate-100"
                      )}
                    >
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={cn(
                          "mt-1.5 shrink-0 transition-all duration-700 transform active:scale-75",
                          task.status === 'completed' ? "text-app-ink" : "text-slate-100 hover:text-app-ink"
                        )}
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-8 h-8 lg:w-12 lg:h-12" />
                        ) : (
                          <Circle className="w-8 h-8 lg:w-12 lg:h-12" strokeWidth={1.5} />
                        )}
                      </button>

                      <div className="flex-1 min-w-0 space-y-4 lg:space-y-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 lg:gap-6">
                            <h3 className={cn(
                              "text-xl lg:text-3xl font-black text-slate-900 tracking-tighter truncate",
                              task.status === 'completed' && "line-through text-slate-400"
                            )}>
                              {task.title}
                            </h3>
                            {task.priority === 'high' && task.status === 'todo' && (
                              <span className="px-3 lg:px-4 py-1 lg:py-1.5 bg-slate-900 text-white text-[7px] lg:text-[9px] font-black uppercase rounded-full tracking-[0.2em] shrink-0">Alpha</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-slate-500 font-medium text-base lg:text-lg leading-relaxed line-clamp-2 max-w-2xl">{task.description}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 lg:gap-8">
                          {task.category && (
                            <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-1.5 lg:py-2 bg-slate-50 rounded-full border border-slate-100">
                              <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full shadow-sm" style={{ backgroundColor: categories.find(c => c.id === task.category)?.color }} />
                              <span className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                {categories.find(c => c.id === task.category)?.name}
                              </span>
                            </div>
                          )}
                          
                          {task.scheduledTime && (
                            <div className="flex items-center gap-2 lg:gap-3 text-app-ink">
                              <Clock className="w-4 h-4 lg:w-5 lg:h-5 opacity-30" />
                              <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em]">
                                {format(parseISO(task.scheduledTime), 'h:mm a')}
                              </span>
                            </div>
                          )}

                          {task.deadline && (
                            <div className="flex items-center gap-2 lg:gap-3 text-slate-400">
                              <CalendarIcon className="w-4 h-4 lg:w-5 lg:h-5 opacity-30" />
                              <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em]">
                                {format(parseISO(task.deadline), 'MMM d')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:translate-x-4 lg:group-hover:translate-x-0">
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-3 lg:p-4 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent lg:hover:border-red-100"
                        >
                          <Trash2 className="w-5 h-5 lg:w-6 lg:h-6" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          )}
          </section>
        </main>
      </div>

      {/* Floating Category Manager Modal */}
      <AnimatePresence>
        {showCategoryManager && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategoryManager(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] lg:rounded-[3rem] shadow-2xl p-8 lg:p-10 space-y-8 lg:space-y-10 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl lg:text-3xl font-black tracking-tighter text-slate-900 uppercase">Collections</h3>
                <button onClick={() => setShowCategoryManager(false)} className="p-2 lg:p-3 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 lg:w-6 lg:h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3 lg:space-y-4">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 lg:p-5 bg-slate-50 rounded-2xl group">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 lg:w-4 lg:h-4 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} />
                      <span className="font-black text-slate-700 uppercase tracking-widest text-[10px] lg:text-xs">{cat.name}</span>
                    </div>
                    {categories.length > 1 && (
                      <button 
                        onClick={() => setCategories(prev => prev.filter(c => c.id !== cat.id))}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 lg:opacity-100 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-100">
                <input 
                  type="text" 
                  placeholder="Create new collection..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = (e.target as HTMLInputElement).value.trim();
                      if (name) {
                        const colors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                        const color = colors[categories.length % colors.length];
                        setCategories(prev => [...prev, { id: generateId(), name, color }]);
                        (e.target as HTMLInputElement).value = '';
                        toast.success(`Collection "${name}" created`);
                      }
                    }
                  }}
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs lg:text-sm font-black uppercase tracking-widest focus:ring-2 focus:ring-slate-100 placeholder:text-slate-300"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Focus Mode Toggle */}
      <div className="fixed bottom-24 lg:bottom-12 right-6 lg:right-12 z-50">
        <motion.button
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setFocusMode(!focusMode);
            toast.info(focusMode ? "Protocol Interrupted" : "Deep Focus Initiated", {
              icon: focusMode ? <RotateCcw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />
            });
          }}
          className={cn(
            "flex items-center gap-4 px-6 lg:px-10 py-4 lg:py-5 rounded-full font-black uppercase tracking-[0.3em] text-[8px] lg:text-[10px] shadow-2xl transition-all duration-700",
            focusMode 
              ? "bg-slate-900 text-white shadow-slate-400" 
              : "bg-white text-slate-900 border border-app-line shadow-slate-200"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full", focusMode ? "bg-white animate-pulse" : "bg-slate-900")} />
          <span className="hidden sm:inline">{focusMode ? "Focus Active" : "Initiate Focus"}</span>
          <span className="sm:hidden">{focusMode ? "Focus" : "Focus"}</span>
        </motion.button>
      </div>
    </div>
  );
}
