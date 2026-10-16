/**
 * LeafLearn Shared Speech Service (Web Speech API)
 * Optimized for Desktop and iOS Safari.
 * Ensures English text is NEVER spoken by a Vietnamese voice.
 */
import { normalizeDialogue } from './speakerUtils';

let cachedVoices = [];
let isVoiceListenerAttached = false;

// Initialize voice listener for asynchronous voice loading on iOS Safari & Chrome
function initVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  const load = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
      }
    } catch (e) {
      console.warn('[speechService] Error loading voices:', e);
    }
  };

  load();

  if (!isVoiceListenerAttached && 'speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', load);
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
    isVoiceListenerAttached = true;
  }
}

// Auto-run init in browser
if (typeof window !== 'undefined') {
  initVoices();
}

/**
 * Get available voices, refreshing from window.speechSynthesis if needed
 */
export function getAvailableVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const live = window.speechSynthesis.getVoices();
  if (live && live.length > 0) {
    cachedVoices = live;
    return live;
  }
  return cachedVoices;
}

/**
 * Check if the text contains Vietnamese diacritics
 */
export function isVietnameseText(text) {
  if (!text) return false;
  return /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
    String(text)
  );
}

/**
 * Resolve the best voice for a given target language
 */
function resolveVoice(isVietnamese = false) {
  const voices = getAvailableVoices();

  if (isVietnamese) {
    const viVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('vi')
    );
    return {
      voice: viVoice || null,
      lang: viVoice?.lang || 'vi-VN',
      error: null,
    };
  }

  // English Target
  // Priority: en-US > en-GB > any English voice
  const enUSVoice = voices.find((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    return l === 'en-us';
  });

  const enGBVoice = voices.find((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    return l === 'en-gb';
  });

  const anyEnVoice = voices.find((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    return l.startsWith('en');
  });

  const selectedEnVoice = enUSVoice || enGBVoice || anyEnVoice;

  if (selectedEnVoice) {
    return {
      voice: selectedEnVoice,
      lang: selectedEnVoice.lang || 'en-US',
      error: null,
    };
  }

  // If voices have loaded but no English voice was found at all:
  if (voices.length > 0) {
    return {
      voice: null,
      lang: 'en-US',
      error: 'NO_ENGLISH_VOICE',
    };
  }

  // Voices not yet exposed by the browser, fallback to default en-US
  return {
    voice: null,
    lang: 'en-US',
    error: null,
  };
}

/**
 * Stop any current speech playback
 */
export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn('[speechService] stopSpeech error:', e);
    }
  }
}

/**
 * Speak a single text phrase (used for Vocabulary flashcards)
 */
export function speakText(text, options = {}) {
  const {
    rate = 0.9,
    pitch = 1.0,
    volume = 1.0,
    forceVietnamese = false,
    onStart,
    onEnd,
    onError,
  } = options;

  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError('SPEECH_NOT_SUPPORTED');
    return;
  }

  try {
    stopSpeech();

    const isVi = forceVietnamese || isVietnameseText(text);
    const { voice, lang, error } = resolveVoice(isVi);

    if (error === 'NO_ENGLISH_VOICE') {
      if (onError) onError('NO_ENGLISH_VOICE');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || lang;
    } else {
      utterance.lang = lang;
    }

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onError) {
      utterance.onerror = (e) => {
        // 'canceled' or 'interrupted' is normal when user switches question or stops
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          onError(e);
        } else if (onEnd) {
          onEnd();
        }
      };
    }

    // 25ms timeout avoids iOS WebKit cancel/speak collision
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[speechService] speak error:', err);
        if (onError) onError(err);
      }
    }, 25);
  } catch (err) {
    console.error('[speechService] speakText error:', err);
    if (onError) onError(err);
  }
}

/**
 * Speak a dialogue question cleanly without reading blanks or revealing the answer.
 * Blanks (e.g. "______") are replaced with a natural pause (comma/pause).
 * Generic labels (Speaker A, Speaker B) are normalized to natural character names.
 * @param {Array|string} dialogue - Array of { speaker, text } or string
 * @param {Object} options - { rate, pitch, volume, qIndex, onStart, onEnd, onError }
 */
export function speakDialogue(dialogue, options = {}) {
  const {
    rate = 0.88,
    pitch = 1.0,
    volume = 1.0,
    qIndex = 0,
    onStart,
    onEnd,
    onError,
  } = options;

  if (!dialogue || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError('SPEECH_NOT_SUPPORTED');
    return;
  }

  // Format lines with natural speaker names and replace blanks with natural pause
  const normalized = normalizeDialogue(dialogue, qIndex);
  let spokenLines = [];

  if (Array.isArray(normalized) && normalized.length > 0) {
    spokenLines = normalized.map((line) => {
      const speaker = line.speaker ? `${line.speaker}: ` : '';
      // Replace underscores and surrounding spaces with a natural comma pause
      const cleanText = (line.text || '').replace(/\s*_{2,}\s*/g, ', ');
      return `${speaker}${cleanText}`;
    });
  } else if (typeof dialogue === 'string') {
    spokenLines = [dialogue.replace(/\s*_{2,}\s*/g, ', ')];
  }

  const fullTextToSpeak = spokenLines.join('\n\n');

  if (!fullTextToSpeak.trim()) {
    if (onError) onError('EMPTY_DIALOGUE');
    return;
  }

  speakText(fullTextToSpeak, {
    rate,
    pitch,
    volume,
    forceVietnamese: false, // Dialogues in English quiz are strictly English
    onStart,
    onEnd,
    onError,
  });
}
