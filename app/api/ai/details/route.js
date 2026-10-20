import { serverGenerateDetails } from '@/src/lib/geminiServerService';

export async function POST(request) {
  try {
    const body = await request.json();
    let terms = [];

    if (Array.isArray(body?.terms)) {
      terms = body.terms;
    } else if (typeof body?.term === 'string' && body.term.trim()) {
      terms = [body.term.trim()];
    }

    if (terms.length === 0) {
      return Response.json({ results: [] });
    }

    const results = await serverGenerateDetails(terms);
    return Response.json({ results });
  } catch (err) {
    console.error('[API /api/ai/details] Error:', err);
    return Response.json(
      { error: err.message || 'Lỗi khi gợi ý nghĩa từ vựng.', results: [] },
      { status: 500 }
    );
  }
}
