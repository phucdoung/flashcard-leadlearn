import { serverGenerateQuiz, QuizGenerationError } from '@/src/lib/geminiServerService';

export async function POST(request) {
  try {
    const body = await request.json();
    const flashcards = body?.flashcards;

    if (!Array.isArray(flashcards)) {
      return Response.json(
        { error: 'Danh sách flashcard không hợp lệ.', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const questions = await serverGenerateQuiz(flashcards);
    return Response.json({ questions });
  } catch (err) {
    console.error('[API /api/ai/quiz] Error:', err);
    const code = err instanceof QuizGenerationError ? err.code : 'API_ERROR';
    return Response.json(
      { error: err.message || 'Lỗi khi tạo bài kiểm tra bằng AI.', code },
      { status: 500 }
    );
  }
}
