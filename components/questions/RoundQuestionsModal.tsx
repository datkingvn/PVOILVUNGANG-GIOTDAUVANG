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
  points?: number;
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
  const [activePointTab, setActivePointTab] = useState<10 | 20 | 30>(10);
  const [questionForm, setQuestionForm] = useState({
    text: "",
    index: 1,
    type: "reasoning" as "reasoning" | "video" | "arrange",
    videoFile: null as File | null,
    arrangeSteps: [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ],
    answerText: "",
    acceptedAnswers: [] as string[],
    points: undefined as 10 | 20 | 30 | undefined,
  });
  const [newAcceptedAnswer, setNewAcceptedAnswer] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      if (round === "ROUND3") {
        // Round 3: tự động tạo/lấy gói mặc định
        ensureRound3Package();
      } else {
        loadPackages();
      }
      loadAllQuestions();
    }
  }, [isOpen, round]);

  useEffect(() => {
    if (selectedPackageId) {
      // Reload questions when package changes to ensure fresh data
      loadAllQuestions();
    }
  }, [selectedPackageId]);

  async function ensureRound3Package() {
    try {
      // Tìm gói Round 3 số 1
      const res = await fetch(`/api/packages?round=ROUND3`);
      const packages = await res.json();
      
      let pkg = packages.find((p: any) => p.number === 1);
      
      if (!pkg) {
        // Tự động tạo gói Round 3 số 1 nếu chưa có
        const createRes = await fetch("/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: 1,
            round: "ROUND3",
          }),
        });
        
        if (createRes.ok) {
          pkg = await createRes.json();
        } else {
          const error = await createRes.json();
          showToast(error.error || "Lỗi khi tạo gói câu hỏi Round 3", "error");
          return;
        }
      }
      
      setSelectedPackageId(pkg._id);
      setPackages([pkg]);
    } catch (error) {
      console.error("Failed to ensure Round 3 package:", error);
      showToast("Lỗi khi tải gói câu hỏi Round 3", "error");
    }
  }

  async function loadPackages() {
    try {
      // ROUND4: không dùng Package, chỉ dùng Question Bank
      if (round === "ROUND4") {
        setPackages([]);
        setSelectedPackageId("ROUND4_BANK");
        return;
      }

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

  async function handleCreatePackage() {
    try {
      // Tìm số gói lớn nhất hiện tại để +1
      const nextNumber =
        packages.length > 0
          ? Math.max(...packages.map((p) => p.number)) + 1
          : 1;

      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: nextNumber,
          round,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Tạo gói câu hỏi thất bại", "error");
        return;
      }

      const newPkg = data as Package;
      const updated = [...packages, newPkg].sort((a, b) => a.number - b.number);
      setPackages(updated);
      setSelectedPackageId(newPkg._id);
      showToast(`Đã tạo gói ${newPkg.number} cho ${round}`, "success");
    } catch (error) {
      console.error("Failed to create package:", error);
      showToast("Lỗi khi tạo gói câu hỏi", "error");
    }
  }

  async function loadAllQuestions() {
    try {
      // For Round 3, load questions from the default package
      // For other rounds, load all questions
      if (round === "ROUND3" && selectedPackageId) {
        const res = await fetch(`/api/questions?packageId=${selectedPackageId}&round=ROUND3`);
        if (res.ok) {
          const data = await res.json();
          // Debug: Log loaded questions to check if answerText and acceptedAnswers are present
          if (round === "ROUND3") {
            console.log("Loaded Round 3 questions:", data);
            data.forEach((q: any, idx: number) => {
              console.log(`Question ${idx + 1}:`, {
                text: q.text,
                answerText: q.answerText,
                acceptedAnswers: q.acceptedAnswers,
              });
            });
          }
          setQuestions(data);
        }
      } else {
        const res = await fetch(`/api/questions?round=${round}`);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data);
        }
      }
    } catch (error) {
      console.error("Failed to load questions:", error);
    }
  }

  async function handleCreateQuestion() {
    if (!questionForm.text.trim()) {
      showToast("Vui lòng nhập nội dung câu hỏi", "error");
      return;
    }

    if (round === "ROUND4" && !questionForm.points) {
      showToast("Vui lòng chọn mức điểm (10 / 20 / 30)", "error");
      return;
    }

    if (round === "ROUND3" && questionForm.type === "arrange") {
      const hasEmptyStep = questionForm.arrangeSteps.some(step => !step.text.trim());
      if (hasEmptyStep) {
        showToast("Vui lòng điền đầy đủ các bước A, B, C, D", "error");
        return;
      }
    }

    try {
      // Create question first
      const questionData: any = {
        text: questionForm.text,
        packageId: selectedPackageId === "ROUND4_BANK" ? "000000000000000000000000" : selectedPackageId,
        index: questionForm.index,
        round,
      };

      if (round === "ROUND3") {
        questionData.type = questionForm.type;
        if (questionForm.type === "arrange") {
          questionData.arrangeSteps = questionForm.arrangeSteps;
        }
        // Thêm đáp án đúng cho Round 3
        if (questionForm.answerText.trim()) {
          questionData.answerText = questionForm.answerText.trim();
        }
        if (questionForm.acceptedAnswers.length > 0) {
          questionData.acceptedAnswers = questionForm.acceptedAnswers.filter(a => a.trim());
        }
      }

      if (round === "ROUND4" && questionForm.points) {
        questionData.points = questionForm.points;
      }

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionData),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Tạo câu hỏi thất bại", "error");
        return;
      }

      const questionId = data._id || data.id;

      // Upload video if needed
      if (round === "ROUND3" && questionForm.type === "video" && questionForm.videoFile) {
        setUploadingVideo(true);
        try {
          const formData = new FormData();
          formData.append("video", questionForm.videoFile);

          const videoRes = await fetch(`/api/questions/${questionId}/upload-video`, {
            method: "POST",
            body: formData,
          });

          if (!videoRes.ok) {
            const videoError = await videoRes.json();
            showToast(videoError.error || "Lỗi upload video", "error");
          }
        } catch (error) {
          showToast("Lỗi upload video", "error");
        } finally {
          setUploadingVideo(false);
        }
      }

      showToast("Tạo câu hỏi thành công", "success");
      setIsQuestionModalOpen(false);
      setQuestionForm({
        text: "",
        index: 1,
        type: "reasoning",
        videoFile: null,
        arrangeSteps: [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ],
        answerText: "",
        acceptedAnswers: [],
        // ROUND4: reset về tab hiện tại để mặc định điểm đúng tab
        points: round === "ROUND4" ? activePointTab : undefined,
      });
      setNewAcceptedAnswer("");
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
      // Prepare update data
      const updateData: any = {
        text: questionForm.text,
        index: questionForm.index,
      };

      if (round === "ROUND3") {
        updateData.type = questionForm.type;
        if (questionForm.type === "arrange") {
          updateData.arrangeSteps = questionForm.arrangeSteps;
        }
        // Cập nhật đáp án đúng cho Round 3
        if (questionForm.answerText.trim()) {
          updateData.answerText = questionForm.answerText.trim();
        }
        if (questionForm.acceptedAnswers.length > 0) {
          updateData.acceptedAnswers = questionForm.acceptedAnswers.filter(a => a.trim());
        }
      }

      if (round === "ROUND4" && questionForm.points) {
        updateData.points = questionForm.points;
      }

      const res = await fetch(`/api/questions/${editingQuestion._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Cập nhật câu hỏi thất bại", "error");
        return;
      }

      // Upload video if needed (for Round 3 video questions)
      if (round === "ROUND3" && questionForm.type === "video" && questionForm.videoFile) {
        setUploadingVideo(true);
        try {
          const formData = new FormData();
          formData.append("video", questionForm.videoFile);

          const videoRes = await fetch(`/api/questions/${editingQuestion._id}/upload-video`, {
            method: "POST",
            body: formData,
          });

          if (!videoRes.ok) {
            const videoError = await videoRes.json();
            showToast(videoError.error || "Lỗi upload video", "error");
          } else {
            showToast("Cập nhật câu hỏi và upload video thành công", "success");
          }
        } catch (error) {
          showToast("Lỗi upload video", "error");
        } finally {
          setUploadingVideo(false);
        }
      } else {
        showToast("Cập nhật câu hỏi thành công", "success");
      }

      setIsQuestionModalOpen(false);
      setEditingQuestion(null);
      setQuestionForm({
        text: "",
        index: 1,
        type: "reasoning",
        videoFile: null,
        arrangeSteps: [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ],
        answerText: "",
        acceptedAnswers: [],
        // ROUND4: reset theo tab đang mở để modal kế tiếp hiển thị đúng mặc định
        points: round === "ROUND4" ? activePointTab : undefined,
      });
      setNewAcceptedAnswer("");
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
    let nextIndex = 1;

    if (round === "ROUND3") {
      // Tìm index đầu tiên chưa được sử dụng (1-4)
      const usedIndices = new Set(
        questions
          .filter((q) => q.packageId === selectedPackageId)
          .map((q) => q.index)
      );
      for (let i = 1; i <= 4; i++) {
        if (!usedIndices.has(i)) {
          nextIndex = i;
          break;
        }
      }
    } else if (round === "ROUND4") {
      // ROUND4 không giới hạn, nên lấy index cao nhất + 1 trong ngân hàng
      const maxExisting = questions.length
        ? Math.max(...questions.map((q) => q.index))
        : 0;
      nextIndex = maxExisting + 1;
    } else {
      // ROUND1/2: vẫn ưu tiên gợi ý tiếp nối, nhưng giới hạn 12 ở input
      nextIndex = questions.filter((q) => q.packageId === selectedPackageId).length + 1;
    }

    setQuestionForm({
      text: "",
      index: nextIndex,
      type: "reasoning",
      videoFile: null,
      arrangeSteps: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
      answerText: "",
      acceptedAnswers: [],
      // ROUND4: mặc định theo tab đang mở (10/20/30)
      points: round === "ROUND4" ? activePointTab : undefined,
    });
    setNewAcceptedAnswer("");
    setEditingQuestion(null);
    setIsQuestionModalOpen(true);
  }

  async function startEdit(question: Question) {
    setEditingQuestion(question);
    
    // Fetch full question data from API to ensure we have all fields
    try {
      const res = await fetch(`/api/questions/${question._id}`);
      if (res.ok) {
        const fullQuestion = await res.json();
        const q = fullQuestion as any;
        
        // Debug: Log question data to see what we're getting
        console.log("Edit question - Full question data from API:", q);
        console.log("Edit question - answerText:", q.answerText);
        console.log("Edit question - acceptedAnswers:", q.acceptedAnswers);
        
        setQuestionForm({
          text: q.text || question.text,
          index: q.index ?? question.index,
          type: round === "ROUND3" ? (q.type || "reasoning") : "reasoning",
          videoFile: null,
          arrangeSteps:
            round === "ROUND3" && q.arrangeSteps
              ? q.arrangeSteps
              : [
                  { label: "A", text: "" },
                  { label: "B", text: "" },
                  { label: "C", text: "" },
                  { label: "D", text: "" },
                ],
          answerText: q.answerText || "",
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
          points: round === "ROUND4" ? (q.points as 10 | 20 | 30 | undefined) : undefined,
        });
        setNewAcceptedAnswer("");
        // Don't open modal - form edit inline is shown below
      } else {
        // Fallback to using question from array if API fails
        const q = question as any;
        setQuestionForm({
          text: question.text,
          index: question.index,
          type: round === "ROUND3" ? (q.type || "reasoning") : "reasoning",
          videoFile: null,
          arrangeSteps:
            round === "ROUND3" && q.arrangeSteps
              ? q.arrangeSteps
              : [
                  { label: "A", text: "" },
                  { label: "B", text: "" },
                  { label: "C", text: "" },
                  { label: "D", text: "" },
                ],
          answerText: q.answerText || "",
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
          points: round === "ROUND4" ? (q.points as 10 | 20 | 30 | undefined) : undefined,
        });
        setNewAcceptedAnswer("");
        // Don't open modal - form edit inline is shown below
      }
    } catch (error) {
      console.error("Error fetching question for edit:", error);
      // Fallback to using question from array if API fails
      const q = question as any;
      setQuestionForm({
        text: question.text,
        index: question.index,
        type: round === "ROUND3" ? (q.type || "reasoning") : "reasoning",
        videoFile: null,
        arrangeSteps:
          round === "ROUND3" && q.arrangeSteps
            ? q.arrangeSteps
            : [
                { label: "A", text: "" },
                { label: "B", text: "" },
                { label: "C", text: "" },
                { label: "D", text: "" },
              ],
        answerText: q.answerText || "",
        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
        points: round === "ROUND4" ? (q.points as 10 | 20 | 30 | undefined) : undefined,
      });
      setNewAcceptedAnswer("");
      // Don't open modal - form edit inline is shown below
    }
  }

  function cancelEdit() {
    setEditingQuestion(null);
    setQuestionForm({
      text: "",
      index: 1,
      type: "reasoning",
      videoFile: null,
      arrangeSteps: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
      answerText: "",
      acceptedAnswers: [],
      points: round === "ROUND4" ? 10 : undefined,
    });
    setNewAcceptedAnswer("");
  }

  function renderQuestionItem(question: Question) {
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
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className="inline-block px-3 py-1 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg">
                      <span className="text-sm font-semibold text-cyan-300">
                        Câu {question.index}
                      </span>
                    </div>
                    {round === "ROUND3" && (question as any).type && (
                      <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        (question as any).type === "video" 
                          ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-300"
                          : (question as any).type === "arrange"
                          ? "bg-gradient-to-r from-orange-600/20 to-amber-600/20 border border-orange-500/30 text-orange-300"
                          : "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-300"
                      }`}>
                        {(question as any).type === "video" && "🎥 Đoạn băng"}
                        {(question as any).type === "arrange" && "📋 Sắp xếp"}
                        {(question as any).type === "reasoning" && "💭 Suy luận"}
                      </div>
                    )}
                  </div>
                  <div className="text-white text-base leading-relaxed mt-2">
                    {question.text}
                  </div>
                  {round === "ROUND3" && (question as any).type === "video" && (question as any).videoUrl && (
                    <div className="mt-3">
                      <video
                        src={(question as any).videoUrl}
                        controls
                        className="w-full max-w-md rounded-lg border border-gray-700"
                        style={{ maxHeight: "200px" }}
                      >
                        Trình duyệt không hỗ trợ video.
                      </video>
                    </div>
                  )}
                  {round === "ROUND3" && (question as any).type === "arrange" && (question as any).arrangeSteps && (
                    <div className="mt-3 space-y-2">
                      {(question as any).arrangeSteps.map((step: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                            {step.label}
                          </div>
                          <span className="text-gray-300">{step.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
                    {round === "ROUND3"
                      ? "Số thứ tự (1-4)"
                      : round === "ROUND4"
                      ? "Số thứ tự (>= 1, không giới hạn)"
                      : "Số thứ tự (1-12)"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    // ROUND3: giới hạn 4; ROUND1/2: 12; ROUND4: không đặt max
                    max={round === "ROUND3" ? 4 : round === "ROUND4" ? undefined : 12}
                    value={questionForm.index}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        index: Number.isNaN(parseInt(e.target.value))
                          ? 1
                          : parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
                
                {round === "ROUND3" && (
                  <div>
                    <label className="block text-white font-semibold mb-3 text-sm">Loại câu hỏi</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionForm({
                            ...questionForm,
                            type: "reasoning",
                            videoFile: null,
                          })
                        }
                        className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                          questionForm.type === "reasoning"
                            ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 border-blue-400 shadow-lg shadow-blue-500/50"
                            : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500/50 hover:shadow-md"
                        }`}
                      >
                        <div className="text-2xl mb-2">💭</div>
                        <div className={`font-semibold text-sm ${
                          questionForm.type === "reasoning" ? "text-white" : "text-gray-300"
                        }`}>
                          Suy luận
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionForm({
                            ...questionForm,
                            type: "video",
                            videoFile: null,
                          })
                        }
                        className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                          questionForm.type === "video"
                            ? "bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 border-purple-400 shadow-lg shadow-purple-500/50"
                            : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500/50 hover:shadow-md"
                        }`}
                      >
                        <div className="text-2xl mb-2">🎥</div>
                        <div className={`font-semibold text-sm ${
                          questionForm.type === "video" ? "text-white" : "text-gray-300"
                        }`}>
                          Đoạn băng
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionForm({
                            ...questionForm,
                            type: "arrange",
                            videoFile: null,
                          })
                        }
                        className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                          questionForm.type === "arrange"
                            ? "bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 border-orange-400 shadow-lg shadow-orange-500/50"
                            : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-orange-500/50 hover:shadow-md"
                        }`}
                      >
                        <div className="text-2xl mb-2">📋</div>
                        <div className={`font-semibold text-sm ${
                          questionForm.type === "arrange" ? "text-white" : "text-gray-300"
                        }`}>
                          Sắp xếp
                        </div>
                      </button>
                    </div>
                  </div>
                )}

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

                {round === "ROUND3" && (
                  <>
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm">
                        ✓ Đáp án đúng <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={questionForm.answerText || ""}
                        onChange={(e) =>
                          setQuestionForm({ ...questionForm, answerText: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        placeholder="Nhập đáp án đúng..."
                      />
                      <div className="mt-1 text-xs text-gray-400">
                        Đáp án này sẽ được dùng để tự động chấm điểm
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm">
                        Đáp án chấp nhận (tùy chọn)
                      </label>
                      <div className="space-y-2">
                        {(questionForm.acceptedAnswers || []).map((answer, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={answer}
                              onChange={(e) => {
                                const newAnswers = [...(questionForm.acceptedAnswers || [])];
                                newAnswers[idx] = e.target.value;
                                setQuestionForm({ ...questionForm, acceptedAnswers: newAnswers });
                              }}
                              className="flex-1 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
                              placeholder="Đáp án chấp nhận..."
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newAnswers = (questionForm.acceptedAnswers || []).filter((_, i) => i !== idx);
                                setQuestionForm({ ...questionForm, acceptedAnswers: newAnswers });
                              }}
                              className="p-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg text-red-300 hover:text-red-200 transition-all"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newAcceptedAnswer}
                            onChange={(e) => setNewAcceptedAnswer(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && newAcceptedAnswer.trim()) {
                                setQuestionForm({
                                  ...questionForm,
                                  acceptedAnswers: [...(questionForm.acceptedAnswers || []), newAcceptedAnswer.trim()],
                                });
                                setNewAcceptedAnswer("");
                              }
                            }}
                            className="flex-1 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
                            placeholder="Nhập đáp án chấp nhận và nhấn Enter..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newAcceptedAnswer.trim()) {
                                setQuestionForm({
                                  ...questionForm,
                                  acceptedAnswers: [...(questionForm.acceptedAnswers || []), newAcceptedAnswer.trim()],
                                });
                                setNewAcceptedAnswer("");
                              }
                            }}
                            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-lg text-green-300 hover:text-green-200 transition-all text-sm font-medium"
                          >
                            Thêm
                          </button>
                        </div>
                        <div className="text-xs text-gray-400">
                          Các đáp án này cũng được coi là đúng khi chấm điểm
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {round === "ROUND3" && questionForm.type === "video" && (
                  <div>
                    <label className="block text-white font-semibold mb-2 text-sm">
                      Video
                    </label>
                    {(question as any).videoUrl && !questionForm.videoFile && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-400 mb-2">Video hiện tại:</div>
                        <video
                          src={(question as any).videoUrl}
                          controls
                          className="w-full max-w-md rounded-lg border border-gray-700"
                          style={{ maxHeight: "200px" }}
                        >
                          Trình duyệt không hỗ trợ video.
                        </video>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setQuestionForm({ ...questionForm, videoFile: file });
                        }
                      }}
                      className="w-full px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                    />
                    {questionForm.videoFile && (
                      <div className="mt-2 text-sm text-purple-300 flex items-center gap-2">
                        <span>✓</span>
                        <span>Đã chọn: {questionForm.videoFile.name}</span>
                        <span className="text-gray-400">
                          ({(questionForm.videoFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    )}
                    {!questionForm.videoFile && !(question as any).videoUrl && (
                      <div className="mt-2 text-sm text-gray-400">
                        Vui lòng chọn file video để upload
                      </div>
                    )}
                  </div>
                )}

                {round === "ROUND3" && questionForm.type === "arrange" && (
                  <div>
                    <label className="block text-white font-semibold mb-2 text-sm">
                      Các bước sắp xếp
                    </label>
                    <div className="space-y-3">
                      {questionForm.arrangeSteps.map((step, index) => (
                        <div key={step.label} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0">
                            {step.label}
                          </div>
                          <input
                            type="text"
                            value={step.text}
                            onChange={(e) => {
                              const newSteps = [...questionForm.arrangeSteps];
                              newSteps[index].text = e.target.value;
                              setQuestionForm({ ...questionForm, arrangeSteps: newSteps });
                            }}
                            className="flex-1 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                            placeholder={`Nhập nội dung bước ${step.label}...`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
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
          {/* Package selector - Ẩn cho Round 3 và Round 4 (Round 4 dùng Question Bank) */}
          {round !== "ROUND3" && round !== "ROUND4" && (
            <div>
              <label className="block text-white font-semibold mb-3 text-lg">
                Chọn gói câu hỏi
              </label>
              {packages.length === 0 ? (
                <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/60 text-sm text-gray-200 space-y-3">
                  <p>Chưa có gói câu hỏi cho vòng này.</p>
                  <button
                    type="button"
                    onClick={handleCreatePackage}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-lg font-semibold text-white transition-colors"
                  >
                    Tạo gói câu hỏi đầu tiên
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm text-gray-300">
                      Đã có {packages.length} gói cho {round}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreatePackage}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-100 border border-gray-600"
                    >
                      + Thêm gói
                    </button>
                  </div>
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
                          <div className="font-bold text-white text-lg">
                            Gói {pkg.number}
                          </div>
                          <div
                            className={`text-sm mt-1 ${
                              isSelected ? "text-cyan-100" : "text-gray-400"
                            }`}
                          >
                            {pkgQuestionCount} câu
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Round 3 Info */}
          {round === "ROUND3" && (
            <div className="p-4 rounded-xl border border-lime-500/50 bg-gradient-to-br from-lime-900/20 to-green-900/20">
              <div className="text-lime-300 font-semibold mb-1">Vòng 3 - Tăng tốc vận hành</div>
              <div className="text-sm text-gray-300">
                Tạo 4 câu hỏi cho vòng thi tốc độ. Mỗi câu hỏi có thể là: Suy luận, Đoạn băng (video), hoặc Sắp xếp.
              </div>
            </div>
          )}

          {/* ROUND4: Question bank theo điểm */}
          {round === "ROUND4" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Ngân hàng câu hỏi - ROUND4
                  </h3>
                  <div className="inline-flex rounded-xl bg-gray-900/60 border border-gray-700 p-1">
                    {[10, 20, 30].map((pts) => {
                      const count = questions.filter((q) => q.points === pts).length;
                      const isActive = activePointTab === pts;
                      const activeClasses =
                        pts === 10
                          ? "bg-sky-500 text-black"
                          : pts === 20
                          ? "bg-amber-500 text-black"
                          : "bg-violet-500 text-black";
                      return (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => setActivePointTab(pts as 10 | 20 | 30)}
                          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                            isActive
                              ? `${activeClasses} shadow`
                              : "text-gray-300 hover:text-amber-200"
                          }`}
                        >
                          {pts} điểm ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={openCreateModal}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Plus size={20} />
                  Thêm câu hỏi
                </button>
              </div>

              {(() => {
                const pts = activePointTab;
                const list = questions
                  .filter((q) => q.points === pts)
                  .sort((a, b) => a.index - b.index);
                return (
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-lg font-semibold text-amber-300">
                        Câu hỏi {pts} điểm ({list.length})
                      </div>
                    </div>
                    {list.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-gray-700 text-sm text-gray-400">
                        Chưa có câu hỏi {pts} điểm.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {list.map((q) => renderQuestionItem(q))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Questions list cho Round khác */}
          {round !== "ROUND4" && selectedPackageId && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  {round === "ROUND3" ? "4 Câu hỏi Vòng 3" : `Câu hỏi - Gói ${selectedPackage?.number}`}
                </h3>
                {round === "ROUND3" ? (
                  questions.length < 4 ? (
                    <button
                      onClick={openCreateModal}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                    >
                      <Plus size={20} />
                      Thêm câu hỏi ({questions.length}/4)
                    </button>
                  ) : (
                    <div className="px-4 py-2 bg-green-600/20 text-green-400 rounded-xl text-sm font-medium border border-green-500/30">
                      Đã đủ 4 câu hỏi
                    </div>
                  )
                ) : (
                  <button
                    onClick={openCreateModal}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Thêm câu hỏi
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {/* Round 3: Hiển thị 4 ô (có thể trống) */}
                {round === "ROUND3" ? (
                  Array.from({ length: 4 }, (_, i) => {
                    const questionIndex = i + 1;
                    const question = questions
                      .filter((q) => q.packageId === selectedPackageId)
                      .find((q) => q.index === questionIndex);
                    
                    return question ? (
                      <div key={question._id}>
                        {renderQuestionItem(question)}
                      </div>
                    ) : (
                      <div
                        key={`empty-${questionIndex}`}
                        className="p-5 bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-dashed border-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center font-bold text-gray-400">
                              {questionIndex}
                            </div>
                            <div className="text-gray-400 italic">Chưa có câu hỏi</div>
                          </div>
                          {questions.length < 4 && (
                            <button
                              onClick={() => {
                                setQuestionForm({
                                  text: "",
                                  index: questionIndex,
                                  type: "reasoning",
                                  videoFile: null,
                                  arrangeSteps: [
                                    { label: "A", text: "" },
                                    { label: "B", text: "" },
                                    { label: "C", text: "" },
                                    { label: "D", text: "" },
                                  ],
                                  answerText: "",
                                  acceptedAnswers: [],
                                  points: undefined, // ROUND3 doesn't use points
                                });
                                setNewAcceptedAnswer("");
                                setIsQuestionModalOpen(true);
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/40 hover:to-teal-500/40 border border-emerald-500/30 rounded-lg text-emerald-300 hover:text-emerald-200 transition-all text-sm font-medium"
                            >
                              <Plus size={16} className="inline mr-1" />
                              Tạo câu hỏi
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  questions
                    .filter((q) => q.packageId === selectedPackageId)
                    .sort((a, b) => a.index - b.index)
                    .map((question) => renderQuestionItem(question))
                )}
                {round !== "ROUND3" && questions.filter((q) => q.packageId === selectedPackageId).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>Chưa có câu hỏi nào. Hãy thêm câu hỏi mới!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Question Create/Edit Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => {
          setIsQuestionModalOpen(false);
          setEditingQuestion(null);
          setQuestionForm({ 
            text: "", 
            index: 1,
            type: "reasoning",
            videoFile: null,
            arrangeSteps: [
              { label: "A", text: "" },
              { label: "B", text: "" },
              { label: "C", text: "" },
              { label: "D", text: "" },
            ],
            answerText: "",
            acceptedAnswers: [],
            points: round === "ROUND4" ? activePointTab : undefined,
          });
          setNewAcceptedAnswer("");
        }}
        title={editingQuestion ? "Chỉnh sửa câu hỏi" : "Tạo câu hỏi mới"}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-white font-semibold mb-2">
              {round === "ROUND3"
                ? "Số thứ tự (1-4)"
                : round === "ROUND4"
                ? "Số thứ tự (>= 1, không giới hạn)"
                : "Số thứ tự (1-12)"}
            </label>
            <input
              type="number"
              min="1"
              // ROUND3 vẫn giới hạn 4, ROUND1/2 giới hạn 12, ROUND4 không set max để không giới hạn
              max={round === "ROUND3" ? 4 : round === "ROUND4" ? undefined : 12}
              value={questionForm.index}
              onChange={(e) =>
                setQuestionForm({
                  ...questionForm,
                  index: Number.isNaN(parseInt(e.target.value))
                    ? 1
                    : parseInt(e.target.value),
                })
              }
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            />
          </div>

          {round === "ROUND4" && (
            <div>
              <label className="block text-white font-semibold mb-2">
                Mức điểm câu hỏi
              </label>
              <div className="flex gap-3">
                {[10, 20, 30].map((pts) => {
                  const isActive = questionForm.points === pts;
                  return (
                    <button
                      key={pts}
                      type="button"
                      onClick={() =>
                        setQuestionForm({
                          ...questionForm,
                          points: pts as 10 | 20 | 30,
                        })
                      }
                      className={`flex-1 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-amber-500 to-yellow-500 border-amber-300 text-black shadow-lg"
                          : "bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700 text-gray-200 hover:border-amber-400 hover:text-amber-200"
                      }`}
                    >
                      {pts} điểm
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {round === "ROUND3" && (
            <div>
              <label className="block text-white font-semibold mb-3">Loại câu hỏi</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setQuestionForm({
                      ...questionForm,
                      type: "reasoning",
                      videoFile: null,
                    })
                  }
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    questionForm.type === "reasoning"
                      ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 border-blue-400 shadow-lg shadow-blue-500/50"
                      : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500/50 hover:shadow-md"
                  }`}
                >
                  <div className="text-2xl mb-2">💭</div>
                  <div className={`font-semibold text-sm ${
                    questionForm.type === "reasoning" ? "text-white" : "text-gray-300"
                  }`}>
                    Suy luận
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setQuestionForm({
                      ...questionForm,
                      type: "video",
                      videoFile: null,
                    })
                  }
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    questionForm.type === "video"
                      ? "bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 border-purple-400 shadow-lg shadow-purple-500/50"
                      : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500/50 hover:shadow-md"
                  }`}
                >
                  <div className="text-2xl mb-2">🎥</div>
                  <div className={`font-semibold text-sm ${
                    questionForm.type === "video" ? "text-white" : "text-gray-300"
                  }`}>
                    Đoạn băng
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setQuestionForm({
                      ...questionForm,
                      type: "arrange",
                      videoFile: null,
                    })
                  }
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    questionForm.type === "arrange"
                      ? "bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 border-orange-400 shadow-lg shadow-orange-500/50"
                      : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-orange-500/50 hover:shadow-md"
                  }`}
                >
                  <div className="text-2xl mb-2">📋</div>
                  <div className={`font-semibold text-sm ${
                    questionForm.type === "arrange" ? "text-white" : "text-gray-300"
                  }`}>
                    Sắp xếp
                  </div>
                </button>
              </div>
            </div>
          )}

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

          {round === "ROUND3" && (
            <>
              <div>
                <label className="block text-white font-semibold mb-2">
                  ✓ Đáp án đúng <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={questionForm.answerText || ""}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, answerText: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Nhập đáp án đúng..."
                />
                <div className="mt-1 text-xs text-gray-400">
                  Đáp án này sẽ được dùng để tự động chấm điểm
                </div>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">
                  Đáp án chấp nhận (tùy chọn)
                </label>
                <div className="space-y-2">
                  {(questionForm.acceptedAnswers || []).map((answer, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={answer}
                        onChange={(e) => {
                          const newAnswers = [...(questionForm.acceptedAnswers || [])];
                          newAnswers[idx] = e.target.value;
                          setQuestionForm({ ...questionForm, acceptedAnswers: newAnswers });
                        }}
                        className="flex-1 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
                        placeholder="Đáp án chấp nhận..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newAnswers = (questionForm.acceptedAnswers || []).filter((_, i) => i !== idx);
                          setQuestionForm({ ...questionForm, acceptedAnswers: newAnswers });
                        }}
                        className="p-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg text-red-300 hover:text-red-200 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAcceptedAnswer}
                      onChange={(e) => setNewAcceptedAnswer(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newAcceptedAnswer.trim()) {
                          setQuestionForm({
                            ...questionForm,
                            acceptedAnswers: [...(questionForm.acceptedAnswers || []), newAcceptedAnswer.trim()],
                          });
                          setNewAcceptedAnswer("");
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
                      placeholder="Nhập đáp án chấp nhận và nhấn Enter..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newAcceptedAnswer.trim()) {
                          setQuestionForm({
                            ...questionForm,
                            acceptedAnswers: [...(questionForm.acceptedAnswers || []), newAcceptedAnswer.trim()],
                          });
                          setNewAcceptedAnswer("");
                        }
                      }}
                      className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-lg text-green-300 hover:text-green-200 transition-all text-sm font-medium"
                    >
                      Thêm
                    </button>
                  </div>
                  <div className="text-xs text-gray-400">
                    Các đáp án này cũng được coi là đúng khi chấm điểm
                  </div>
                </div>
              </div>
            </>
          )}

          {round === "ROUND3" && questionForm.type === "video" && (
            <div>
              <label className="block text-white font-semibold mb-2">
                🎥 Upload video
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setQuestionForm({ ...questionForm, videoFile: file });
                    }
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                />
              </div>
              {questionForm.videoFile && (
                <div className="mt-3 p-3 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mb-2">
                    <span>✓</span>
                    <span>Đã chọn file:</span>
                  </div>
                  <div className="text-white text-sm">{questionForm.videoFile.name}</div>
                  <div className="text-gray-400 text-xs mt-1">
                    Kích thước: {(questionForm.videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  {questionForm.videoFile.type && (
                    <div className="text-gray-400 text-xs">
                      Định dạng: {questionForm.videoFile.type}
                    </div>
                  )}
                </div>
              )}
              {!questionForm.videoFile && (
                <div className="mt-2 text-sm text-gray-400 italic">
                  Chọn file video để upload lên Cloudflare R2
                </div>
              )}
            </div>
          )}

          {round === "ROUND3" && questionForm.type === "arrange" && (
            <div>
              <label className="block text-white font-semibold mb-2">Các bước sắp xếp</label>
              <div className="space-y-3">
                {questionForm.arrangeSteps.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
                      {step.label}
                    </div>
                    <input
                      type="text"
                      value={step.text}
                      onChange={(e) => {
                        const newSteps = [...questionForm.arrangeSteps];
                        newSteps[index].text = e.target.value;
                        setQuestionForm({ ...questionForm, arrangeSteps: newSteps });
                      }}
                      className="flex-1 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      placeholder={`Nhập nội dung bước ${step.label}...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={editingQuestion ? handleUpdateQuestion : handleCreateQuestion}
            disabled={uploadingVideo}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingVideo 
              ? "Đang upload video..." 
              : editingQuestion 
                ? "Cập nhật câu hỏi" 
                : "Tạo câu hỏi"}
          </button>
        </div>
      </Modal>
    </>
  );
}

