/**
 * Client-side Gemini AI Service
 * Dispatches AI calls to Next.js Server Route Handlers (/api/ai/*)
 * Strictly keeps the GEMINI_API_KEY secure on the server.
 */

export class QuizGenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Generate high-quality Cambridge style dialogue questions via Server Route Handler.
 * @param {Array} flashcards
 * @returns {Promise<Array>}
 */
export async function generateQuizWithGemini(flashcards) {
  const usableCards = (flashcards || []).filter(
    (f) =>
      (f.word || f.term || '').trim().length > 0 &&
      (f.meaning || f.definition || '').trim().length > 0
  );

  if (usableCards.length < 10) {
    throw new QuizGenerationError(
      'VOCABULARY_ERROR',
      'Bộ Flashcard chưa có đủ 10 từ/cụm từ hợp lệ để tạo bài kiểm tra.'
    );
  }

  try {
    const res = await fetch('/api/ai/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flashcards: usableCards }),
    });

    const data = await res.json();

    if (!res.ok || !data.questions) {
      throw new QuizGenerationError(
        data.code || 'API_ERROR',
        data.error || 'Không thể tạo bài kiểm tra bằng AI. Vui lòng thử lại sau.'
      );
    }

    return data.questions;
  } catch (err) {
    if (err instanceof QuizGenerationError) {
      throw err;
    }
    console.error('[Gemini Client] Fetch quiz error:', err);
    throw new QuizGenerationError(
      'API_ERROR',
      err?.message || 'Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng và thử lại.'
    );
  }
}

/**
 * Generate IPA pronunciation and Vietnamese meaning for terms via Server Route Handler.
 * @param {Array<string>} terms
 * @returns {Promise<Array>}
 */
export async function generateBulkFlashcardDetails(terms) {
  if (!terms || terms.length === 0) return [];

  try {
    const res = await fetch('/api/ai/details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ terms }),
    });

    const data = await res.json();

    if (Array.isArray(data.results)) {
      return data.results;
    }

    return terms.map((t, idx) => ({
      id: `bulk-${Date.now()}-${idx}`,
      term: t,
      word: t,
      phonetic: '',
      pronunciation: '',
      definition: '',
      meaning: '',
      part_of_speech: t.includes(' ') ? 'phrase' : 'noun',
    }));
  } catch (err) {
    console.error('[Gemini Client] Fetch details error:', err);
    return terms.map((t, idx) => ({
      id: `bulk-${Date.now()}-${idx}`,
      term: t,
      word: t,
      phonetic: '',
      pronunciation: '',
      definition: '',
      meaning: '',
      part_of_speech: t.includes(' ') ? 'phrase' : 'noun',
    }));
  }
}

/**
 * Single item AI suggestion helper.
 * @param {string} term
 * @returns {Promise<Object|null>}
 */
export async function generateSingleFlashcardDetails(term) {
  if (!term || !term.trim()) return null;

  try {
    const list = await generateBulkFlashcardDetails([term.trim()]);
    return list[0] || null;
  } catch (err) {
    console.error('[Gemini Client] Fetch single detail error:', err);
    throw err;
  }
}

const translationCache = new Map();

/**
 * Translate an English dialogue into natural Vietnamese via Server Route Handler.
 * @param {Array|string} dialogue
 * @param {string} correctWord
 * @param {number} qIndex
 * @returns {Promise<Array|null>}
 */
export async function translateDialogueWithGemini(dialogue, correctWord = '', qIndex = 0) {
  if (!dialogue) return null;

  const cacheKey = JSON.stringify({ dialogue, correctWord, qIndex });
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dialogue, correctWord, qIndex }),
    });

    const data = await res.json();

    if (data?.translation) {
      translationCache.set(cacheKey, data.translation);
      return data.translation;
    }

    return null;
  } catch (err) {
    console.warn('[Gemini Client] Fetch translate error:', err);
    return null;
  }
}
