import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const pseudo = body.pseudo || 'Anonyme';

    // Find existing record for this pseudo
    const existing = await base44.asServiceRole.entities.ButtonClick.filter({ pseudo });
    
    if (existing && existing.length > 0) {
      const record = existing[0];
      const newTotal = (record.total_clicks || 0) + 1;
      await base44.asServiceRole.entities.ButtonClick.update(record.id, {
        total_clicks: newTotal,
        last_reaction: body.reaction || ''
      });
      return Response.json({ ok: true, total_clicks: newTotal });
    } else {
      await base44.asServiceRole.entities.ButtonClick.create({
        pseudo,
        total_clicks: 1,
        last_reaction: body.reaction || ''
      });
      return Response.json({ ok: true, total_clicks: 1 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
