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
  success: "bg-success/10 border-success/30 text-success",
  error: "bg-danger/10 border-danger/30 text-danger",
  warning: "bg-warning/10 border-warning/30 text-warning",
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
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-[fadeIn_0.2s_ease-out] ${colors[t.type]}`}
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
