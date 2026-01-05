"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { countLetters } from "@/lib/utils/round2-engine";
import { Upload, RefreshCw, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface HorizontalQuestion {
  questionText: string;
  answerText: string;
  acceptedAnswers: string[];
}

export default function Round2SetupPage() {
  const router = useRouter();
  const params = useParams();
  const packageId = params?.packageId as string;
  const { showToast } = useToast();

  const [packageData, setPackageData] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePieces, setImagePieces] = useState<any>(null);

  const [cnvAnswer, setCnvAnswer] = useState("");
  const [horizontalQuestions, setHorizontalQuestions] = useState<HorizontalQuestion[]>([
    { questionText: "", answerText: "", acceptedAnswers: [] },
    { questionText: "", answerText: "", acceptedAnswers: [] },
    { questionText: "", answerText: "", acceptedAnswers: [] },
    { questionText: "", answerText: "", acceptedAnswers: [] },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/mc", { method: "GET" });
        if (!res.ok) {
          router.push("/login/mc");
        }
      } catch {
        router.push("/login/mc");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (packageId) {
      // Load package data
      fetch(`/api/packages/${packageId}`)
        .then((res) => res.json())
        .then((data) => {
          setPackageData(data);
          if (data.round2Meta?.image) {
            setImagePieces(data.round2Meta.image);
          }
          if (data.round2Meta?.cnvAnswer) {
            setCnvAnswer(data.round2Meta.cnvAnswer);
          }
        })
        .catch(console.error);

      // Load existing questions
      fetch(`/api/questions?packageId=${packageId}&round=ROUND2`)
        .then((res) => res.json())
        .then((questions) => {
          if (Array.isArray(questions) && questions.length > 0) {
            // Filter horizontal questions and sort by index
            const horizontals = questions
              .filter((q: any) => q.type === "horizontal")
              .sort((a: any, b: any) => a.index - b.index);

            // Populate horizontalQuestions state
            if (horizontals.length > 0) {
              const loadedQuestions: HorizontalQuestion[] = [];
              for (let i = 0; i < 4; i++) {
                const q = horizontals.find((h: any) => h.index === i + 1);
                if (q) {
                  loadedQuestions.push({
                    questionText: q.text || "",
                    answerText: q.answerText || "",
                    acceptedAnswers: q.acceptedAnswers || [],
                  });
                } else {
                  loadedQuestions.push({
                    questionText: "",
                    answerText: "",
                    acceptedAnswers: [],
                  });
                }
              }
              setHorizontalQuestions(loadedQuestions);
            }
          }
        })
        .catch(console.error);
    }
  }, [packageId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadImage = async () => {
    if (!imageFile || !packageId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const res = await fetch(`/api/packages/${packageId}/upload-image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        showToast(error.error || "Lỗi upload ảnh", "error");
        return;
      }

      const data = await res.json();
      setImagePieces(data.image);

      showToast("Upload ảnh thành công!", "success");
    } catch (error) {
      console.error("Error uploading image:", error);
      showToast("Lỗi upload ảnh", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSetup = async () => {
    if (!cnvAnswer.trim()) {
      alert("Vui lòng nhập đáp án CNV");
      return;
    }

    for (let i = 0; i < 4; i++) {
      if (!horizontalQuestions[i].questionText.trim() || !horizontalQuestions[i].answerText.trim()) {
        alert(`Vui lòng nhập đầy đủ câu hỏi hàng ngang ${i + 1}`);
        return;
      }
    }

    if (!imagePieces) {
      alert("Vui lòng upload ảnh trước");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/game-control/round2/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          cnvAnswer,
          horizontalQuestions,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        showToast(error.error || "Lỗi setup Round 2", "error");
        return;
      }

      showToast("Setup Round 2 thành công!", "success");
      router.push("/mc/dashboard");
    } catch (error) {
      console.error("Error setting up Round 2:", error);
      showToast("Lỗi setup Round 2", "error");
    } finally {
      setSaving(false);
    }
  };

  const cnvLetterCount = cnvAnswer ? countLetters(cnvAnswer) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Setup Round 2 - Gói {packageData?.number}</h1>

        {/* Image Upload Section */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Upload Ảnh CNV</h2>
          
          {!imagePieces ? (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="mb-4 text-white"
              />
              {imagePreview && (
                <div className="mb-4">
                  <img src={imagePreview} alt="Preview" className="max-w-md rounded" />
                </div>
              )}
              <button
                onClick={handleUploadImage}
                disabled={!imageFile || uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Đang upload..." : "Upload Ảnh"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left: Current image pieces */}
              <div className="lg:w-[48%] flex-shrink-0">
                <div className="h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Ảnh hiện tại</h3>
                  </div>
                  <p className="text-gray-400 mb-4 text-sm">
                    4 mảnh ảnh đã được upload và chia thành các phần.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {imagePieces.pieces
                      ?.sort((a: any, b: any) => {
                        // Display order: 1, 2, 4, 3
                        const order = [1, 2, 4, 3];
                        return order.indexOf(a.index) - order.indexOf(b.index);
                      })
                      .map((piece: any) => (
                        <div key={piece.index} className="border border-gray-600 rounded p-2 bg-gray-900/50">
                          <img src={piece.url} alt={`Piece ${piece.index}`} className="w-full rounded" />
                          <p className="text-white text-center mt-2 text-sm">Mảnh {piece.index}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Right: Upload new image section */}
              <div className="lg:w-[50%] flex-shrink-0">
                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-lg p-5 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <RefreshCw className="w-5 h-5 text-orange-400" />
                    <h3 className="text-lg font-semibold text-white">Thay đổi ảnh</h3>
                  </div>
                  <p className="text-gray-400 mb-4 text-sm">
                    Chọn ảnh mới để thay thế ảnh hiện tại. Ảnh sẽ được tự động chia thành 4 mảnh.
                  </p>
                  <label className="block mb-4">
                    <div className="flex items-center justify-center w-full px-4 py-3 bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-orange-500/50 hover:bg-gray-800 transition-colors">
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                        <span className="text-sm text-gray-300">
                          {imageFile ? imageFile.name : "Chọn file ảnh mới"}
                        </span>
                        <span className="text-xs text-gray-500">PNG, JPG, GIF (tối đa 10MB)</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </div>
                  </label>
                  {imagePreview && (
                    <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                      <p className="text-sm text-gray-400 mb-2">Preview ảnh mới:</p>
                      <img src={imagePreview} alt="Preview ảnh mới" className="w-full rounded border border-gray-700" />
                    </div>
                  )}
                  <button
                    onClick={handleUploadImage}
                    disabled={!imageFile || uploading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white font-medium rounded-lg hover:from-orange-700 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang upload...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Ảnh Mới</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* CNV Answer */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Đáp Án CNV</h2>
          <input
            type="text"
            value={cnvAnswer}
            onChange={(e) => setCnvAnswer(e.target.value)}
            placeholder="Nhập đáp án CNV"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded mb-2"
          />
          <p className="text-gray-400">Số chữ cái: {cnvLetterCount}</p>
        </Card>

        {/* Horizontal Questions - 4 questions */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">4 Câu Hỏi Hàng Ngang</h2>
          {horizontalQuestions.map((q, idx) => (
            <div key={idx} className="mb-4 p-4 bg-gray-800 rounded">
              <h3 className="text-lg font-semibold text-white mb-2">Hàng ngang {idx + 1}</h3>
              <textarea
                value={q.questionText}
                onChange={(e) => {
                  const newQs = [...horizontalQuestions];
                  newQs[idx].questionText = e.target.value;
                  setHorizontalQuestions(newQs);
                }}
                placeholder="Câu hỏi"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded mb-2"
                rows={3}
              />
              <input
                type="text"
                value={q.answerText}
                onChange={(e) => {
                  const newQs = [...horizontalQuestions];
                  newQs[idx].answerText = e.target.value;
                  setHorizontalQuestions(newQs);
                }}
                placeholder="Đáp án"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded mb-2"
              />
              <input
                type="text"
                value={q.acceptedAnswers.join(", ")}
                onChange={(e) => {
                  const newQs = [...horizontalQuestions];
                  newQs[idx].acceptedAnswers = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s);
                  setHorizontalQuestions(newQs);
                }}
                placeholder="Đáp án chấp nhận (tùy chọn, cách nhau bởi dấu phẩy)"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded"
              />
            </div>
          ))}
        </Card>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSaveSetup}
            disabled={saving}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold text-lg"
          >
            {saving ? "Đang lưu..." : "Lưu Setup Round 2"}
          </button>
          <button
            onClick={() => router.push("/mc/dashboard")}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
