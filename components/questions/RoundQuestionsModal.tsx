"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/hooks/useToast";
import { Plus, Edit, Trash2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Round } from "@/types/game";

interface Package {
  _id: string;
  number: number;
  questions: string[];
}

interface Question {
  _id: string;
  text: string;
  index: number;
  packageId: string;
}

interface RoundQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  round: Round;
}

export function RoundQuestionsModal({
  isOpen,
  onClose,
  round,
}: RoundQuestionsModalProps) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({ text: "", index: 1 });
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadPackages();
      loadAllQuestions();
    }
  }, [isOpen, round]);

  useEffect(() => {
    if (selectedPackageId) {
      // Reload questions when package changes to ensure fresh data
      loadAllQuestions();
    }
  }, [selectedPackageId]);

  async function loadPackages() {
    try {
      const res = await fetch(`/api/packages?round=${round}`);
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
        if (data.length > 0 && !selectedPackageId) {
          setSelectedPackageId(data[0]._id);
        }
      }
    } catch (error) {
      console.error("Failed to load packages:", error);
    }
  }

  async function loadAllQuestions() {
    try {
      // Load all questions for the round, not just selected package
      const res = await fetch(`/api/questions?round=${round}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (error) {
      console.error("Failed to load questions:", error);
    }
  }

  async function handleCreateQuestion() {
    if (!selectedPackageId || !questionForm.text.trim()) {
      showToast("Vui lòng nhập nội dung câu hỏi", "error");
      return;
    }

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: questionForm.text,
          packageId: selectedPackageId,
          index: questionForm.index,
          round,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Tạo câu hỏi thất bại", "error");
        return;
      }

      showToast("Tạo câu hỏi thành công", "success");
      setIsQuestionModalOpen(false);
      setQuestionForm({ text: "", index: 1 });
      loadAllQuestions();
    } catch (error) {
      showToast("Lỗi kết nối", "error");
    }
  }

  async function handleUpdateQuestion() {
    if (!editingQuestion || !questionForm.text.trim()) {
      return;
    }

    try {
      const res = await fetch(`/api/questions/${editingQuestion._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionForm),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Cập nhật câu hỏi thất bại", "error");
        return;
      }

      showToast("Cập nhật câu hỏi thành công", "success");
      setEditingQuestion(null);
      setQuestionForm({ text: "", index: 1 });
      loadAllQuestions();
    } catch (error) {
      showToast("Lỗi kết nối", "error");
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showToast("Xóa câu hỏi thất bại", "error");
        return;
      }

      showToast("Xóa câu hỏi thành công", "success");
      loadAllQuestions();
    } catch (error) {
      showToast("Lỗi kết nối", "error");
    }
  }

  function openCreateModal() {
    const nextIndex = questions.length > 0 ? questions.length + 1 : 1;
    setQuestionForm({ text: "", index: Math.min(nextIndex, 12) });
    setEditingQuestion(null);
    setIsQuestionModalOpen(true);
  }

  function startEdit(question: Question) {
    setEditingQuestion(question);
    setQuestionForm({ text: question.text, index: question.index });
  }

  function cancelEdit() {
    setEditingQuestion(null);
    setQuestionForm({ text: "", index: 1 });
  }

  const selectedPackage = packages.find((p) => p._id === selectedPackageId);
  const questionCount = questions.filter(
    (q) => q.packageId === selectedPackageId
  ).length;

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={`Quản lý câu hỏi - ${round}`}
        maxWidth="80rem"
      >
        <div className="space-y-6">
          {/* Package selector */}
          <div>
            <label className="block text-white font-semibold mb-3 text-lg">Chọn gói câu hỏi</label>
            <div className="grid grid-cols-4 gap-3">
              {packages.map((pkg) => {
                const pkgQuestionCount = questions.filter(
                  (q) => q.packageId === pkg._id
                ).length;
                const isSelected = selectedPackageId === pkg._id;
                
                return (
                  <button
                    key={pkg._id}
                    onClick={() => setSelectedPackageId(pkg._id)}
                    className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                      isSelected
                        ? "bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-600 border-cyan-400 shadow-lg shadow-cyan-500/50"
                        : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-cyan-500/50 hover:shadow-md"
                    }`}
                  >
                    <div className="font-bold text-white text-lg">Gói {pkg.number}</div>
                    <div className={`text-sm mt-1 ${isSelected ? "text-cyan-100" : "text-gray-400"}`}>
                      {pkgQuestionCount} câu
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Questions list */}
          {selectedPackageId && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  Câu hỏi - Gói {selectedPackage?.number}
                </h3>
                <button
                  onClick={openCreateModal}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Plus size={20} />
                  Thêm câu hỏi
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {questions
                  .filter((q) => q.packageId === selectedPackageId)
                  .sort((a, b) => a.index - b.index)
                  .map((question) => {
                    const isEditing = editingQuestion?._id === question._id;
                    
                    return (
                      <div key={question._id}>
                        <div
                          className={`p-5 bg-gradient-to-br from-gray-800/90 to-gray-900/90 border rounded-xl transition-all shadow-md hover:shadow-lg ${
                            isEditing
                              ? "border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                              : "border-gray-700/50 hover:border-cyan-500/50"
                          }`}
                        >
                          <AnimatePresence mode="wait">
                            {!isEditing ? (
                              <motion.div
                                key="view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex justify-between items-start gap-4"
                              >
                                <div className="flex-1">
                                  <div className="inline-block px-3 py-1 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg mb-2">
                                    <span className="text-sm font-semibold text-cyan-300">
                                      Câu {question.index}
                                    </span>
                                  </div>
                                  <div className="text-white text-base leading-relaxed mt-2">
                                    {question.text}
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => startEdit(question)}
                                    className="p-2.5 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/30 hover:border-blue-400/50 rounded-lg text-blue-300 hover:text-blue-200 transition-all"
                                    title="Chỉnh sửa"
                                  >
                                    <Edit size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(question._id)}
                                    className="p-2.5 bg-gradient-to-br from-red-600/20 to-rose-600/20 hover:from-red-600/40 hover:to-rose-600/40 border border-red-500/30 hover:border-red-400/50 rounded-lg text-red-300 hover:text-red-200 transition-all"
                                    title="Xóa"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="edit"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="space-y-4"
                              >
                              <div className="flex justify-between items-center">
                                <div className="inline-block px-3 py-1 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg">
                                  <span className="text-sm font-semibold text-cyan-300">
                                    Chỉnh sửa Câu {question.index}
                                  </span>
                                </div>
                                <button
                                  onClick={cancelEdit}
                                  className="p-2 text-gray-400 hover:text-white transition-colors"
                                  title="Hủy"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                              
                              <div>
                                <label className="block text-white font-semibold mb-2 text-sm">
                                  Số thứ tự (1-12)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="12"
                                  value={questionForm.index}
                                  onChange={(e) =>
                                    setQuestionForm({
                                      ...questionForm,
                                      index: parseInt(e.target.value) || 1,
                                    })
                                  }
                                  className="w-full px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-white font-semibold mb-2 text-sm">
                                  Nội dung câu hỏi
                                </label>
                                <textarea
                                  value={questionForm.text}
                                  onChange={(e) =>
                                    setQuestionForm({ ...questionForm, text: e.target.value })
                                  }
                                  className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                                  rows={4}
                                  placeholder="Nhập nội dung câu hỏi..."
                                />
                              </div>
                              
                              <div className="flex gap-3">
                                <button
                                  onClick={handleUpdateQuestion}
                                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                >
                                  <Check size={18} />
                                  Lưu
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-6 py-2.5 bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-semibold border border-gray-600 transition-all"
                                >
                                  Hủy
                                </button>
                              </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                {questions.filter((q) => q.packageId === selectedPackageId).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>Chưa có câu hỏi nào. Hãy thêm câu hỏi mới!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Question Create Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => {
          setIsQuestionModalOpen(false);
          setQuestionForm({ text: "", index: 1 });
        }}
        title="Tạo câu hỏi mới"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-white font-semibold mb-2">Số thứ tự (1-12)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={questionForm.index}
              onChange={(e) =>
                setQuestionForm({ ...questionForm, index: parseInt(e.target.value) || 1 })
              }
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-white font-semibold mb-2">Nội dung câu hỏi</label>
            <textarea
              value={questionForm.text}
              onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
              rows={5}
              placeholder="Nhập nội dung câu hỏi..."
            />
          </div>
          <button
            onClick={handleCreateQuestion}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            Tạo câu hỏi
          </button>
        </div>
      </Modal>
    </>
  );
}

