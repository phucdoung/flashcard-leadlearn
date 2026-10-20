import { serverTranslateDialogue } from '@/src/lib/geminiServerService';

export async function POST(request) {
  try {
    const body = await request.json();
    const dialogue = body?.dialogue;
    const correctWord = body?.correctWord || '';
    const qIndex = typeof body?.qIndex === 'number' ? body.qIndex : 0;

    if (!dialogue) {
      return Response.json({ translation: null });
    }

    const translation = await serverTranslateDialogue(dialogue, correctWord, qIndex);
    return Response.json({ translation });
  } catch (err) {
    console.error('[API /api/ai/translate] Error:', err);
    return Response.json(
      { error: err.message || 'Lỗi khi dịch hội thoại.', translation: null },
      { status: 500 }
    );
  }
}
