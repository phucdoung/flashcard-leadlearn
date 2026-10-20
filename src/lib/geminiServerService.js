import { GoogleGenAI } from '@google/genai';
import {
  normalizeDialogue,
  normalizeVietnameseTranslation,
} from './speakerUtils';

const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Custom Error class for classified quiz generation errors
 */
export class QuizGenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Retrieves Gemini API key from server environment.
 * NEVER exposed to the client.
 */
export function getServerGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (
    !apiKey ||
    typeof apiKey !== 'string' ||
    apiKey.trim() === '' ||
    apiKey === 'YOUR_GEMINI_API_KEY'
  ) {
    console.error(
      '[Gemini Server Error] GEMINI_API_KEY / VITE_GEMINI_API_KEY is undefined, empty, or placeholder in server environment!'
    );
    return null;
  }

  return apiKey.trim();
}

/**
 * Shuffle array in-place / copy
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Lightweight validator for generated batch dialogue questions.
 */
function validateLightweightQuestion(q, targetCard, seenDialogues, qIdx = 0) {
  if (!q) return null;

  const targetWord = (targetCard.word || targetCard.term || '').trim();
  const targetMeaning = (targetCard.meaning || targetCard.definition || '').trim();
  const cleanTarget = targetWord.toLowerCase();

  if (!cleanTarget) return null;

  if (!Array.isArray(q.dialogue) || q.dialogue.length < 2) {
    return null;
  }

  const normalizedDiag = normalizeDialogue(q.dialogue, qIdx);

  const dialogueText = normalizedDiag
    .map((d) => `${d.speaker || ''}: ${d.text || ''}`)
    .join('\n');
  const fullTextStr = normalizedDiag.map((d) => d.text || '').join(' ');

  const blankMatches = fullTextStr.match(/_{2,}/g);
  if (!blankMatches || blankMatches.length !== 1) {
    return null;
  }

  const normDialogue = dialogueText.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seenDialogues.has(normDialogue)) {
    return null;
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    return null;
  }

  const cleanOpts = q.options.map((o) => String(o || '').trim()).filter(Boolean);
  if (cleanOpts.length !== 4) {
    return null;
  }

  const uniqueOptsSet = new Set(cleanOpts.map((o) => o.toLowerCase()));
  if (uniqueOptsSet.size !== 4) {
    return null;
  }

  const matchIdx = cleanOpts.findIndex((opt) => opt.toLowerCase() === cleanTarget);
  if (matchIdx === -1) {
    return null;
  }

  const matchedTargetWord = cleanOpts[matchIdx];
  const shuffledOpts = shuffleArray(cleanOpts);
  const correctIndex = shuffledOpts.indexOf(matchedTargetWord);

  seenDialogues.add(normDialogue);

  const normalizedTrans = q.vietnameseTranslation
    ? normalizeVietnameseTranslation(q.vietnameseTranslation, {}, qIdx)
    : null;

  return {
    id: `q-${Date.now()}-${Math.random()}`,
    word: matchedTargetWord,
    answer: matchedTargetWord,
    type: 'dialogue',
    dialogue: normalizedDiag,
    vietnameseTranslation: normalizedTrans,
    options: shuffledOpts,
    correctAnswerIndex: correctIndex,
    explanation: {
      correctWord: matchedTargetWord,
      correctMeaning: targetMeaning,
      contextReason:
        q.explanation?.contextReason ||
        `Trong ngữ cảnh này, "${matchedTargetWord}" (${targetMeaning}) là đáp án phù hợp nhất.`,
      wrongReason:
        q.explanation?.wrongReason ||
        `Các phương án khác không phù hợp với ý nghĩa "${targetMeaning}" trong ngữ cảnh này.`,
      memoryTip: q.explanation?.memoryTip || `${matchedTargetWord} = ${targetMeaning}`,
    },
  };
}

/**
 * Server-side batch dialogue quiz generation with Gemini API.
 */
export async function serverGenerateQuiz(flashcards) {
  const apiKey = getServerGeminiApiKey();

  if (!apiKey) {
    throw new QuizGenerationError(
      'API_ERROR',
      'Không thể kết nối với Gemini AI. Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY trong môi trường.'
    );
  }

  const usableCards = flashcards.filter(
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

  let ai;
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error('[Gemini API Server] Failed to initialize GoogleGenAI SDK:', err);
    throw new QuizGenerationError(
      'API_ERROR',
      'Không thể kết nối với Gemini AI. Vui lòng thử lại.'
    );
  }

  const formattedItems = usableCards.map((c, idx) => ({
    id: `card-${idx}`,
    word: (c.word || c.term || '').trim(),
    meaning: (c.meaning || c.definition || '').trim(),
    pronunciation: (c.pronunciation || c.phonetic || '').trim(),
    part_of_speech:
      (c.part_of_speech || '').trim() || (c.word?.includes(' ') ? 'phrase' : 'noun'),
  }));

  const promptText = `You are a Cambridge English exam author. Create ONE natural contextual dialogue question for EACH vocabulary item in the list below.

VOCABULARY ITEMS TO TEST (${formattedItems.length} items):
${JSON.stringify(formattedItems, null, 2)}

DISTRACTOR SELECTION STRATEGY & RULES FOR EACH QUESTION:
1. TARGET WORD & DIALOGUE:
   - Target word MUST be the exact word/phrase from the list.
   - Create a realistic 2-line English dialogue between two natural characters using common English names (e.g., Anna, John, David, Emma, Michael, Sarah, Tom, Emily, Hoa).
   - NEVER use generic labels like 'Speaker A', 'Speaker B', 'Speaker 1', or 'Speaker'. Always use natural character names.
   - Replace the EXACT target word or multi-word phrase with ONE single blank "______".
   - Design the sentence structure so that the blank "______" accepts the exact dictionary form of the target word/phrase without requiring grammatical inflection changes.
   - DO NOT expose the target word or phrase anywhere in the dialogue text.
   - NO VIETNAMESE in dialogue. 100% natural English.

2. DISTRACTOR SELECTION (3 WRONG OPTIONS):
   - For distractors, first inspect the provided vocabulary list above.
   - PREFER distractors from the SAME Flashcard Set when they:
     a) Have the same or compatible part of speech (e.g. verb for verb, noun for noun).
     b) Fit the grammatical structure of the sentence.
     c) Are plausible enough that the learner must understand the meaning to choose correctly.
   - DO NOT pick a distractor merely because it exists in the set if it creates an obvious part-of-speech or grammatical mismatch.
   - FALLBACK: If the set does not contain 3 suitable matching distractors, generate the missing distractors yourself. Ensure AI-generated distractors match the same part of speech and grammatical structure.
   - All 4 options must be unique English words/phrases.

3. EXPLANATION:
   - Provide concise explanation in Vietnamese:
     a) "contextReason": 1-2 sentences explaining why the correct word fits the context.
     b) "wrongReason": 1-2 sentences explaining why other options do not fit this context.
     c) "memoryTip": 1 short memory tip (e.g. "recommend = tiến cử, đề xuất").

4. VIETNAMESE TRANSLATION:
   - Provide full, natural Vietnamese translation for the COMPLETE dialogue with the correct word already filled into the blank.
   - Do NOT translate blanks as "chỗ trống" or "gạch dưới" - translate the complete, natural meaning.
   - Match structure: Array of { "speaker": "Name", "text": "Vietnamese translated line" }.

RETURN ONLY A JSON ARRAY matching this exact JSON schema (no markdown, no code blocks):
[
  {
    "word": "exact target word/phrase from list",
    "answer": "exact target word/phrase from list",
    "dialogue": [
      { "speaker": "Anna", "text": "Why don't you drive through the city center?" },
      { "speaker": "Ben", "text": "I usually ______ that area during rush hour." }
    ],
    "vietnameseTranslation": [
      { "speaker": "Anna", "text": "Tại sao bạn không lái xe qua trung tâm thành phố?" },
      { "speaker": "Ben", "text": "Tôi thường tránh khu vực đó vào giờ cao điểm." }
    ],
    "options": ["enter", "avoid", "cross", "follow"],
    "explanation": {
      "contextReason": "Trong ngữ cảnh này, 'avoid' (tránh) là từ phù hợp nhất...",
      "wrongReason": "Các từ khác không thể hiện đúng hành động né tránh khu vực đông đúc.",
      "memoryTip": "avoid = tránh"
    }
  }
]`;

  let parsedList = [];
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text;
    let parsed = JSON.parse(responseText);
    if (Array.isArray(parsed)) {
      parsedList = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const arr =
        parsed.questions ||
        parsed.items ||
        parsed.data ||
        Object.values(parsed).find(Array.isArray);
      if (Array.isArray(arr)) parsedList = arr;
    }
  } catch (err) {
    console.error('[Gemini Server] Raw API error:', err);
    const errStr = String(err?.message || err);

    if (
      err?.status === 404 ||
      errStr.includes('404') ||
      errStr.toLowerCase().includes('not found') ||
      errStr.toLowerCase().includes('no longer available')
    ) {
      throw new QuizGenerationError(
        'MODEL_NOT_FOUND',
        'Model AI hiện tại không còn khả dụng. Vui lòng cập nhật model Gemini.'
      );
    }

    if (
      err?.status === 429 ||
      errStr.includes('429') ||
      errStr.includes('RESOURCE_EXHAUSTED') ||
      errStr.toLowerCase().includes('quota')
    ) {
      throw new QuizGenerationError(
        'RESOURCE_EXHAUSTED',
        'AI hiện đã đạt giới hạn sử dụng. Vui lòng thử lại sau.'
      );
    }

    throw new QuizGenerationError(
      'API_ERROR',
      `Không thể kết nối với Gemini AI: ${err?.message || 'Vui lòng thử lại sau.'}`
    );
  }

  const validQuestions = [];
  const seenDialogues = new Set();

  usableCards.forEach((card, idx) => {
    const cleanWord = (card.word || card.term || '').trim().toLowerCase();
    const matchedQ =
      parsedList.find((q) => {
        if (!q) return false;
        const qWord = String(q.word || q.answer || '').trim().toLowerCase();
        return qWord === cleanWord;
      }) || parsedList[idx];

    const validated = validateLightweightQuestion(matchedQ, card, seenDialogues, idx);
    if (validated) {
      validQuestions.push(validated);
    }
  });

  if (validQuestions.length < 10) {
    throw new QuizGenerationError(
      'VALIDATION_ERROR',
      'AI chưa tạo đủ 10 câu hỏi đạt yêu cầu. Vui lòng thử lại.'
    );
  }

  return validQuestions.map((q, idx) => ({ ...q, id: `q${idx + 1}` }));
}

/**
 * Server-side batch word definition and IPA generation.
 */
export async function serverGenerateDetails(terms) {
  if (!terms || terms.length === 0) return [];

  const apiKey = getServerGeminiApiKey();

  if (!apiKey) {
    console.warn('[Gemini Server] API key missing. Returning fallback items.');
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

  try {
    const ai = new GoogleGenAI({ apiKey });
    const termsText = terms.map((t) => `- ${t}`).join('\n');

    const prompt = `You are an expert English dictionary assistant. For each English word or multi-word phrase in the list below, provide:
1. IPA pronunciation (e.g. /kɑːm/ for calm, /teɪk keər əv/ for take care of, /lʊk ˈfɔː.wəd tuː/ for look forward to).
2. Concise natural Vietnamese meaning matching the English word or phrase (e.g. "bình tĩnh" for calm, "chăm sóc" for take care of, "mong chờ" for look forward to).
3. Part of speech. Strictly choose ONE of: "noun", "verb", "adjective", "adverb", "phrasal verb", "phrase", "preposition", "conjunction", "other".

LIST OF WORDS/PHRASES TO LOOK UP:
${termsText}

RETURN ONLY A JSON ARRAY matching this exact schema (no markdown formatting, no code blocks):
[
  {
    "word": "exact English word or phrase",
    "meaning": "Nghĩa tiếng Việt ngắn gọn chuẩn xác",
    "pronunciation": "/IPA/",
    "part_of_speech": "noun | verb | adjective | adverb | phrasal verb | phrase | preposition | conjunction | other"
  }
]`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let parsed = null;
    try {
      parsed = JSON.parse(response.text);
    } catch (parseErr) {
      console.error('[Gemini Server] JSON parse error:', parseErr);
    }

    let listArray = [];
    if (Array.isArray(parsed)) {
      listArray = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const possibleArray =
        parsed.words ||
        parsed.items ||
        parsed.vocabulary ||
        parsed.flashcards ||
        parsed.data ||
        parsed.results ||
        Object.values(parsed).find(Array.isArray);

      if (Array.isArray(possibleArray)) {
        listArray = possibleArray;
      }
    }

    if (listArray.length > 0) {
      return terms.map((t, idx) => {
        const match =
          listArray.find((p) => {
            if (!p) return false;
            const itemStr = String(p.word || p.term || p.phrase || p.vocabulary || '').toLowerCase().trim();
            const targetStr = t.toLowerCase().trim();
            return itemStr === targetStr || itemStr.includes(targetStr) || targetStr.includes(itemStr);
          }) || listArray[idx] || {};

        const foundMeaning =
          match.meaning ||
          match.definition ||
          match.vietnamese ||
          match.translation ||
          match.vietnamese_meaning ||
          match.vietnameseMeaning ||
          match.meaning_vi ||
          '';

        const foundIPA =
          match.pronunciation ||
          match.phonetic ||
          match.ipa ||
          match.transcription ||
          '';

        const foundPOS =
          match.part_of_speech ||
          match.partOfSpeech ||
          match.pos ||
          match.type ||
          (t.includes(' ') ? 'phrase' : 'noun');

        return {
          id: `bulk-${Date.now()}-${idx}`,
          term: t,
          word: t,
          phonetic: foundIPA,
          pronunciation: foundIPA,
          definition: foundMeaning,
          meaning: foundMeaning,
          part_of_speech: foundPOS,
        };
      });
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
    console.error('[Gemini Server] Error generating details:', err);
    throw err;
  }
}

/**
 * Server-side dialogue translation with Gemini API.
 */
export async function serverTranslateDialogue(dialogue, correctWord = '', qIndex = 0) {
  if (!dialogue) return null;

  const normalizedDialogue = normalizeDialogue(dialogue, qIndex);

  let linesToTranslate = [];
  if (Array.isArray(normalizedDialogue) && normalizedDialogue.length > 0) {
    linesToTranslate = normalizedDialogue.map((line) => {
      const cleanText = (line.text || '').replace(/_{2,}/g, correctWord || '');
      return { speaker: line.speaker || 'Person', text: cleanText };
    });
  } else if (typeof dialogue === 'string') {
    const cleanText = dialogue.replace(/_{2,}/g, correctWord || '');
    linesToTranslate = [{ speaker: '', text: cleanText }];
  }

  const apiKey = getServerGeminiApiKey();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Translate this English conversational dialogue into natural, contextually accurate Vietnamese.
The correct answer has already been filled in. 
Input dialogue:
${JSON.stringify(linesToTranslate, null, 2)}

Return ONLY a JSON array of objects with the exact structure [{ "speaker": "...", "text": "..." }] with Vietnamese translated lines. No markdown, no code blocks:`;

    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(res.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return normalizeVietnameseTranslation(parsed, {}, qIndex);
    }
    return null;
  } catch (err) {
    console.warn('[Gemini Server] Error during translation:', err);
    return null;
  }
}
