import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const reportEmail = body.email || 'terrible3311@outlook.fr';

    // ── Récupérer toutes les données ──
    const [clicks, players, events, visitors] = await Promise.all([
      base44.asServiceRole.entities.ButtonClick.list(),
      base44.asServiceRole.entities.Player.list(),
      base44.asServiceRole.entities.GameEvent.list(),
      base44.asServiceRole.entities.VisitorLog.list(),
    ]);

    const totalClicks = (clicks || []).reduce((s: number, r: any) => s + (r.total_clicks || 0), 0);
    const totalPlayers = (players || []).length;
    const registeredPlayers = (players || []).filter((p: any) => p.email).length;

    // Top 5 joueurs
    const top5 = [...(clicks || [])]
      .sort((a: any, b: any) => (b.total_clicks || 0) - (a.total_clicks || 0))
      .slice(0, 5)
      .map((r: any, i: number) => `${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${r.pseudo}: ${(r.total_clicks||0).toLocaleString('fr')} clics`)
      .join('\n');

    // Stats 24h
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const recentVisitors = (visitors || []).filter((v: any) => v.created_date > yesterday);
    const recentPlayers = (players || []).filter((p: any) => p.created_at > yesterday);

    // Événements actifs
    const activeEvents = (events || []).filter((e: any) => e.status === 'active');

    // ── Email HTML ──
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;margin:0;padding:20px;}
  .container{max-width:600px;margin:0 auto;background:#111;border-radius:12px;overflow:hidden;}
  .header{background:linear-gradient(135deg,#ff2222,#ff6600);padding:24px;text-align:center;}
  .header h1{margin:0;font-size:1.8rem;}
  .body{padding:24px;}
  .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;}
  .stat-box{background:#1a1a1a;border-radius:8px;padding:16px;text-align:center;}
  .stat-val{font-size:2rem;font-weight:bold;color:#ff4444;}
  .stat-label{color:#888;font-size:.85rem;margin-top:4px;}
  .section{margin:20px 0;}
  .section h2{color:#ff6600;border-bottom:1px solid #222;padding-bottom:8px;}
  .top-list{background:#1a1a1a;border-radius:8px;padding:16px;}
  .top-list p{margin:6px 0;font-family:monospace;}
  .new-badge{background:#ff2222;color:#fff;border-radius:20px;padding:2px 8px;font-size:.75rem;}
  .event-card{background:#1a1a1a;border-left:4px solid #ff6600;padding:12px;border-radius:0 8px 8px 0;margin:8px 0;}
  .footer{background:#0a0a0a;padding:16px;text-align:center;color:#555;font-size:.8rem;}
  a{color:#ff6600;}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🔴 Rapport Quotidien</h1>
    <p style="margin:4px 0;opacity:.8">Le Bouton Qui Sert À Rien — ${new Date().toLocaleDateString('fr-FR', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
  </div>
  <div class="body">
    
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-val">${totalClicks.toLocaleString('fr')}</div>
        <div class="stat-label">🖱️ Clics totaux</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${(clicks||[]).length.toLocaleString('fr')}</div>
        <div class="stat-label">👥 Joueurs uniques</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${registeredPlayers}</div>
        <div class="stat-label">📧 Comptes créés</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${recentVisitors.length}</div>
        <div class="stat-label">📊 Sessions 24h</div>
      </div>
    </div>

    <div class="section">
      <h2>🏆 Top 5 Joueurs</h2>
      <div class="top-list">
        ${top5.split('\n').map(l => `<p>${l}</p>`).join('')}
      </div>
    </div>

    <div class="section">
      <h2>🆕 Activité 24h</h2>
      <p>• <strong>${recentPlayers.length}</strong> nouveau${recentPlayers.length>1?'x':''} compte${recentPlayers.length>1?'s':''} créé${recentPlayers.length>1?'s':''}</p>
      <p>• <strong>${recentVisitors.length}</strong> session${recentVisitors.length>1?'s':''} de jeu</p>
      <p>• <strong>${activeEvents.length}</strong> événement${activeEvents.length>1?'s':''} actif${activeEvents.length>1?'s':''}</p>
    </div>

    ${activeEvents.length > 0 ? `
    <div class="section">
      <h2>🎯 Événements en cours</h2>
      ${activeEvents.map((e: any) => `
        <div class="event-card">
          <strong>${e.title}</strong><br>
          <small style="color:#888">${e.description || ''}</small><br>
          <small>x${e.multiplier || 2} — Fin: ${e.end_date ? new Date(e.end_date).toLocaleDateString('fr-FR') : 'N/A'}</small>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section" style="background:#1a1a1a;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;color:#888;">Gérer le jeu depuis :</p>
      <a href="https://tangent20.github.io/le-bouton-qui-sert-a-rien/" style="font-size:1.1rem;font-weight:bold;">🔴 Le Bouton Qui Sert À Rien</a>
    </div>

  </div>
  <div class="footer">
    Rapport généré automatiquement • Le Bouton Qui Sert À Rien © 2026<br>
    Édité par Charly Soudan — <a href="mailto:terrible3311@outlook.fr">terrible3311@outlook.fr</a>
  </div>
</div>
</body></html>`;

    // Envoyer via Base44 email (SendGrid intégré)
    const emailResult = await fetch('https://api.base44.com/api/apps/6a25fda89561913dceec4ffc/functions/sendEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
      body: JSON.stringify({
        to: reportEmail,
        subject: `📊 Rapport Le Bouton — ${new Date().toLocaleDateString('fr-FR')} | ${totalClicks.toLocaleString('fr')} clics | ${(clicks||[]).length} joueurs`,
        html,
      })
    }).catch(() => null);

    return Response.json({
      ok: true,
      stats: { totalClicks, totalPlayers: (clicks||[]).length, registeredPlayers, sessions24h: recentVisitors.length, newPlayers24h: recentPlayers.length },
      emailSent: emailResult?.ok || false,
    });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
