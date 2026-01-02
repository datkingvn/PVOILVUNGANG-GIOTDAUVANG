"use client";

import { Modal } from "./modal";
import { useConfirmStore } from "@/store/confirmStore";

export function ConfirmModal() {
  const isOpen = useConfirmStore((state) => state.isOpen);
  const message = useConfirmStore((state) => state.message);
  const close = useConfirmStore((state) => state.close);
  const handleConfirm = useConfirmStore((state) => state.handleConfirm);

  return (
    <Modal isOpen={isOpen} onClose={close} title="Xác nhận">
      <div className="space-y-4">
        <p className="text-gray-300">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={close}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </Modal>
  );
}

