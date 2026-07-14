import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const pseudo = body.pseudo || '';

    if (!pseudo) {
      return Response.json({ total_clicks: 0 });
    }

    const existing = await base44.asServiceRole.entities.ButtonClick.filter({ pseudo });

    if (existing && existing.length > 0) {
      return Response.json({ total_clicks: existing[0].total_clicks || 0, found: true });
    } else {
      return Response.json({ total_clicks: 0, found: false });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
