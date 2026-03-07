import { useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";
import { create } from "zustand";

type ToastType = "success" | "error" | "warning";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type: ToastType) => void;
  remove: (id: number) => void;
}

let nextId = 0;

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string) => useToast.getState().add(msg, "success"),
  error: (msg: string) => useToast.getState().add(msg, "error"),
  warning: (msg: string) => useToast.getState().add(msg, "warning"),
};

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
};

const colors = {
  success: "bg-success-50 border-success-200 text-success-700 dark:bg-success-900/30 dark:border-success-800 dark:text-success-400",
  error: "bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-900/30 dark:border-danger-800 dark:text-danger-400",
  warning: "bg-warning-50 border-warning-200 text-warning-700 dark:bg-warning-900/30 dark:border-warning-800 dark:text-warning-400",
};

export function ToastContainer() {
  const { toasts, remove } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-appearance-in ${colors[t.type]}`}
          >
            <Icon size={18} className="flex-shrink-0" />
            <p className="text-sm flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
