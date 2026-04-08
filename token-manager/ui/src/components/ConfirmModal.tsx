import { Button, Modal } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: "danger" | "primary" | "warning";
  loading?: boolean;
}

const variantMap = {
  danger: "danger",
  primary: "primary",
  warning: "primary",
} as const;

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  confirmColor = "danger",
  loading = false,
}: Props) {
  if (!isOpen) return null;

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header className="flex items-center gap-2 border-b border-border pb-3">
              <div className="p-1.5 bg-warning/10 rounded-lg ring-1 ring-warning/20">
                <AlertTriangle size={18} className="text-warning" />
              </div>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted text-sm">{message}</p>
            </Modal.Body>
            <Modal.Footer className="border-t border-border pt-3">
              <Button variant="secondary" onPress={onClose} isDisabled={loading}>
                Cancelar
              </Button>
              <Button variant={variantMap[confirmColor]} onPress={onConfirm} isPending={loading}>
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
