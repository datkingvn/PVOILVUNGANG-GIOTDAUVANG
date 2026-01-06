"use client";

interface QuestionDisplayProps {
  question: {
    text: string;
    type?: "reasoning" | "video" | "arrange";
    videoUrl?: string;
    arrangeSteps?: Array<{ label: string; text: string }>;
  };
}

export function QuestionDisplay({ question }: QuestionDisplayProps) {
  if (question.type === "video" && question.videoUrl) {
    return (
      <div className="space-y-4">
        <div className="text-lg font-semibold">{question.text}</div>
        <div className="w-full">
          <video
            src={question.videoUrl}
            controls
            className="w-full max-w-4xl mx-auto rounded-lg shadow-lg"
          >
            Trình duyệt của bạn không hỗ trợ video.
          </video>
        </div>
      </div>
    );
  }

  if (question.type === "arrange" && question.arrangeSteps) {
    return (
      <div className="space-y-4">
        <div className="text-lg font-semibold">{question.text}</div>
        <div className="space-y-3">
          {question.arrangeSteps.map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
                {step.label}
              </div>
              <div className="flex-1 text-gray-200">{step.text}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: reasoning or text question
  return (
    <div className="text-lg font-semibold">{question.text}</div>
  );
}

