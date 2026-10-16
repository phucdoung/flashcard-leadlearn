/**
 * Character name pools for dialogues.
 * Provides natural, common, friendly English and contextual character names.
 */
export const NATURAL_SPEAKER_PAIRS = [
  ['Anna', 'John'],
  ['David', 'Emma'],
  ['Michael', 'Sarah'],
  ['Alex', 'Lisa'],
  ['Tom', 'Emily'],
  ['Daniel', 'Jessica'],
  ['James', 'Sophie'],
  ['Ryan', 'Olivia'],
  ['Chris', 'Hoa'],
  ['Ben', 'Chloe'],
];

const EXTRA_NAMES = ['Peter', 'Lucas', 'Mia', 'Henry', 'Ella', 'Kevin', 'Grace'];

/**
 * Checks if a speaker string is a generic placeholder like "Speaker A", "SpeakerB", "Speaker 1", etc.
 * @param {string} speaker
 * @returns {boolean}
 */
export function isGenericSpeaker(speaker) {
  if (!speaker || typeof speaker !== 'string') return true;
  const s = speaker.trim().toLowerCase();
  return (
    /^speaker(\s*[a-z0-9])?$/i.test(s) ||
    /^speaker_[a-z0-9]$/i.test(s) ||
    /^speaker$/i.test(s) ||
    /^người\s*nói(\s*[a-z0-9])?$/i.test(s) ||
    /^nhân\s*vật(\s*[a-z0-9])?$/i.test(s) ||
    s === 'a' ||
    s === 'b'
  );
}

/**
 * Returns a deterministic pair/list of natural names for a given question index or identifier.
 * @param {number|string} qIndex
 * @returns {string[]}
 */
export function getNaturalNamePool(qIndex = 0) {
  let seed = 0;
  if (typeof qIndex === 'number') {
    seed = Math.abs(qIndex);
  } else if (typeof qIndex === 'string') {
    seed = Math.abs(qIndex.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  }
  const pair = NATURAL_SPEAKER_PAIRS[seed % NATURAL_SPEAKER_PAIRS.length];
  return [...pair, ...EXTRA_NAMES];
}

/**
 * Builds a consistent speaker mapping for a dialogue so that
 * Speaker A -> Name 1, Speaker B -> Name 2 consistently within the question.
 * @param {string[]} rawSpeakers
 * @param {number|string} qIndex
 * @returns {Record<string, string>}
 */
export function buildSpeakerMap(rawSpeakers = [], qIndex = 0) {
  const namePool = getNaturalNamePool(qIndex);
  const speakerMap = {};
  let genericIndex = 0;

  rawSpeakers.forEach((spk) => {
    if (!spk) return;
    const clean = String(spk).trim();
    if (speakerMap[clean]) return;

    if (isGenericSpeaker(clean)) {
      speakerMap[clean] = namePool[genericIndex % namePool.length];
      genericIndex++;
    } else {
      // Already a natural name (e.g. "Anna", "Doctor", "Waiter")
      speakerMap[clean] = clean;
    }
  });

  return speakerMap;
}

/**
 * Normalizes a dialogue object or array:
 * Converts generic "Speaker A", "Speaker B" into natural character names.
 * Ensures 100% consistency within the dialogue.
 *
 * @param {Array|string} dialogue - Array of { speaker, text } or string lines
 * @param {number|string} qIndex - Question index or ID for deterministic naming
 * @returns {Array<{ speaker: string, text: string }>} Normalized dialogue array
 */
export function normalizeDialogue(dialogue, qIndex = 0) {
  if (!dialogue) return [];

  // If string, parse lines
  let rawList = [];
  if (typeof dialogue === 'string') {
    const lines = dialogue.split('\n').filter((l) => l.trim().length > 0);
    rawList = lines.map((l) => {
      const match = l.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        return { speaker: match[1].trim(), text: match[2].trim() };
      }
      return { speaker: '', text: l.trim() };
    });
  } else if (Array.isArray(dialogue)) {
    rawList = dialogue.map((item) => {
      if (typeof item === 'string') {
        const match = item.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          return { speaker: match[1].trim(), text: match[2].trim() };
        }
        return { speaker: '', text: item.trim() };
      }
      return {
        speaker: item?.speaker ? String(item.speaker).trim() : '',
        text: item?.text ? String(item.text).trim() : '',
      };
    });
  }

  // Collect raw speakers
  const rawSpeakers = rawList.map((item) => item.speaker).filter(Boolean);
  const speakerMap = buildSpeakerMap(rawSpeakers, qIndex);

  // Apply mapping
  return rawList.map((item) => {
    let finalSpeaker = item.speaker;
    if (item.speaker && speakerMap[item.speaker]) {
      finalSpeaker = speakerMap[item.speaker];
    } else if (isGenericSpeaker(item.speaker)) {
      const pool = getNaturalNamePool(qIndex);
      finalSpeaker = pool[0];
    }

    // Also clean text if speaker tag is duplicated inside text
    let finalText = item.text || '';
    Object.keys(speakerMap).forEach((genSpk) => {
      if (isGenericSpeaker(genSpk)) {
        const regex = new RegExp(`^${genSpk}\\s*:\\s*`, 'i');
        finalText = finalText.replace(regex, '');
      }
    });

    return {
      speaker: finalSpeaker,
      text: finalText,
    };
  });
}

/**
 * Normalizes Vietnamese translation lines/string so that speaker labels
 * match the normalized names of the English dialogue.
 * @param {Array|string} translation
 * @param {Record<string, string>} speakerMap
 * @param {number|string} qIndex
 * @returns {Array<{ speaker: string, text: string }>|string|null}
 */
export function normalizeVietnameseTranslation(translation, speakerMap = {}, qIndex = 0) {
  if (!translation) return null;

  const pool = getNaturalNamePool(qIndex);

  if (Array.isArray(translation)) {
    return translation.map((item, idx) => {
      let rawSpeaker = typeof item === 'object' ? item?.speaker : '';
      let rawText = typeof item === 'object' ? item?.text : String(item);

      let finalSpeaker = rawSpeaker;
      if (rawSpeaker && speakerMap[rawSpeaker]) {
        finalSpeaker = speakerMap[rawSpeaker];
      } else if (isGenericSpeaker(rawSpeaker)) {
        finalSpeaker = pool[idx % pool.length];
      }

      // Replace generic speaker mentions inside text
      let finalText = rawText || '';
      Object.entries(speakerMap).forEach(([genSpk, natName]) => {
        if (isGenericSpeaker(genSpk)) {
          finalText = finalText.replace(new RegExp(`^${genSpk}\\s*:\\s*`, 'i'), '');
        }
      });

      return {
        speaker: finalSpeaker,
        text: finalText,
      };
    });
  }

  if (typeof translation === 'string') {
    let result = translation;
    Object.entries(speakerMap).forEach(([genSpk, natName]) => {
      if (isGenericSpeaker(genSpk)) {
        result = result.replace(new RegExp(`${genSpk}\\s*:`, 'gi'), `${natName}:`);
      }
    });
    // Also replace default Speaker A / B regex
    result = result.replace(/Speaker\s*A\s*:/gi, `${pool[0]}:`);
    result = result.replace(/Speaker\s*B\s*:/gi, `${pool[1]}:`);
    result = result.replace(/Người nói\s*A\s*:/gi, `${pool[0]}:`);
    result = result.replace(/Người nói\s*B\s*:/gi, `${pool[1]}:`);
    return result;
  }

  return translation;
}
