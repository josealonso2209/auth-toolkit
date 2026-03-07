import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/40 backdrop-blur-sm",
      }}
    >
      <ModalContent className="bg-content1/95 dark:bg-content1/90 backdrop-blur-xl border border-default-200/50 shadow-2xl">
        <ModalHeader className="flex items-center gap-2 border-b border-default-200/30 pb-3">
          <div className="p-1.5 bg-warning/10 rounded-lg ring-1 ring-warning/20">
            <AlertTriangle size={18} className="text-warning" />
          </div>
          {title}
        </ModalHeader>
        <ModalBody>
          <p className="text-default-600 text-sm">{message}</p>
        </ModalBody>
        <ModalFooter className="border-t border-default-200/30 pt-3">
          <Button variant="flat" onPress={onClose} isDisabled={loading}>
            Cancelar
          </Button>
          <Button color={confirmColor} onPress={onConfirm} isLoading={loading}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
