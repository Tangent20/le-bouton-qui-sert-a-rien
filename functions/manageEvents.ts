import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action; // 'list' | 'create' | 'activate' | 'end' | 'auto_check'

    // ── LISTE DES ÉVÉNEMENTS ───────────────────────────────
    if (action === 'list' || !action) {
      const events = await base44.asServiceRole.entities.GameEvent.list();
      const now = new Date().toISOString();
      
      // Auto-activer les événements dont la date est arrivée
      for (const ev of (events || [])) {
        if (ev.status === 'upcoming' && ev.start_date && ev.start_date <= now) {
          await base44.asServiceRole.entities.GameEvent.update(ev.id, { status: 'active' });
          ev.status = 'active';
        }
        if (ev.status === 'active' && ev.end_date && ev.end_date <= now) {
          // Trouver le gagnant
          const clicks = await base44.asServiceRole.entities.ButtonClick.list();
          const winner = (clicks || []).sort((a: any, b: any) => (b.total_clicks||0) - (a.total_clicks||0))[0];
          await base44.asServiceRole.entities.GameEvent.update(ev.id, {
            status: 'ended',
            winner_pseudo: winner?.pseudo || 'Anonyme',
            winner_clicks: winner?.total_clicks || 0,
          });
          ev.status = 'ended';
        }
      }

      return Response.json({ ok: true, events: events || [] });
    }

    // ── CRÉER UN ÉVÉNEMENT ─────────────────────────────────
    if (action === 'create') {
      const { title, description, type, start_date, end_date, multiplier, reward_skin } = body;
      if (!title) return Response.json({ ok: false, error: 'Titre requis' }, { status: 400 });

      const event = await base44.asServiceRole.entities.GameEvent.create({
        title,
        description: description || '',
        type: type || 'competition',
        status: start_date && new Date(start_date) > new Date() ? 'upcoming' : 'active',
        start_date: start_date || new Date().toISOString(),
        end_date: end_date || new Date(Date.now() + 7 * 86400000).toISOString(),
        multiplier: multiplier || 2,
        reward_skin: reward_skin || '',
        participants_count: 0,
      });

      return Response.json({ ok: true, event });
    }

    // ── AUTO CHECK (appelé par automation) ────────────────
    if (action === 'auto_check') {
      const events = await base44.asServiceRole.entities.GameEvent.list();
      const now = new Date().toISOString();
      const updated = [];

      for (const ev of (events || [])) {
        if (ev.status === 'upcoming' && ev.start_date <= now) {
          await base44.asServiceRole.entities.GameEvent.update(ev.id, { status: 'active' });
          updated.push({ id: ev.id, title: ev.title, action: 'activated' });
        }
        if (ev.status === 'active' && ev.end_date && ev.end_date <= now) {
          const clicks = await base44.asServiceRole.entities.ButtonClick.list();
          const winner = (clicks||[]).sort((a:any,b:any)=>(b.total_clicks||0)-(a.total_clicks||0))[0];
          await base44.asServiceRole.entities.GameEvent.update(ev.id, {
            status: 'ended',
            winner_pseudo: winner?.pseudo || '?',
            winner_clicks: winner?.total_clicks || 0,
          });
          updated.push({ id: ev.id, title: ev.title, action: 'ended', winner: winner?.pseudo });
        }
      }

      // Compter les participants actifs (joueurs ayant cliqué)
      const players = await base44.asServiceRole.entities.ButtonClick.list();
      for (const ev of (events||[]).filter((e:any) => e.status === 'active')) {
        await base44.asServiceRole.entities.GameEvent.update(ev.id, {
          participants_count: (players||[]).length,
        });
      }

      return Response.json({ ok: true, updated, checked: (events||[]).length });
    }

    // ── TERMINER MANUELLEMENT ──────────────────────────────
    if (action === 'end') {
      const { event_id } = body;
      if (!event_id) return Response.json({ ok: false, error: 'event_id requis' }, { status: 400 });

      const clicks = await base44.asServiceRole.entities.ButtonClick.list();
      const winner = (clicks||[]).sort((a:any,b:any)=>(b.total_clicks||0)-(a.total_clicks||0))[0];

      await base44.asServiceRole.entities.GameEvent.update(event_id, {
        status: 'ended',
        winner_pseudo: winner?.pseudo || '?',
        winner_clicks: winner?.total_clicks || 0,
      });

      return Response.json({ ok: true, winner: winner?.pseudo, clicks: winner?.total_clicks });
    }

    return Response.json({ ok: false, error: 'Action inconnue' }, { status: 400 });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
