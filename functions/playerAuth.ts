import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Simple hash (SHA-256 via Web Crypto)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_bouton_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action; // 'register' | 'login' | 'verify_token' | 'update_profile'

    // ── REGISTER ──────────────────────────────────────────
    if (action === 'register') {
      const { pseudo, email, password } = body;
      if (!pseudo || !email || !password) {
        return Response.json({ ok: false, error: 'Pseudo, email et mot de passe requis' }, { status: 400 });
      }
      if (password.length < 6) {
        return Response.json({ ok: false, error: 'Mot de passe trop court (6 chars min)' }, { status: 400 });
      }

      // Vérifier doublon pseudo
      const existingPseudo = await base44.asServiceRole.entities.Player.filter({ pseudo });
      if (existingPseudo && existingPseudo.length > 0) {
        return Response.json({ ok: false, error: 'Ce pseudo est déjà pris 😤' }, { status: 409 });
      }

      // Vérifier doublon email
      const existingEmail = await base44.asServiceRole.entities.Player.filter({ email });
      if (existingEmail && existingEmail.length > 0) {
        return Response.json({ ok: false, error: 'Cet email est déjà utilisé' }, { status: 409 });
      }

      const passwordHash = await hashPassword(password);
      const token = generateToken();
      const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 jours

      // Récupérer les clics existants depuis ButtonClick si pseudo existe
      const existingClicks = await base44.asServiceRole.entities.ButtonClick.filter({ pseudo });
      const existingTotal = existingClicks?.[0]?.total_clicks || 0;

      const player = await base44.asServiceRole.entities.Player.create({
        pseudo,
        email,
        password_hash: passwordHash,
        auth_token: token,
        token_expiry: tokenExpiry,
        total_clicks: existingTotal,
        streak: 0,
        best_combo: 0,
        current_skin: 'classic',
        skin_unlocked: 'classic',
        is_verified: false,
        notifications_enabled: true,
        created_at: new Date().toISOString(),
        device: body.device || 'unknown',
        country: body.country || 'FR',
      });

      return Response.json({
        ok: true,
        token,
        player: { id: player.id, pseudo, email, total_clicks: existingTotal, current_skin: 'classic' }
      });
    }

    // ── LOGIN ──────────────────────────────────────────────
    if (action === 'login') {
      const { email, password, pseudo } = body;
      
      let players: any[] = [];
      if (email) {
        players = await base44.asServiceRole.entities.Player.filter({ email });
      } else if (pseudo) {
        players = await base44.asServiceRole.entities.Player.filter({ pseudo });
      }

      if (!players || players.length === 0) {
        return Response.json({ ok: false, error: 'Compte introuvable 🤔' }, { status: 404 });
      }

      const player = players[0];
      const inputHash = await hashPassword(password);

      if (player.password_hash !== inputHash) {
        return Response.json({ ok: false, error: 'Mot de passe incorrect 🚫' }, { status: 401 });
      }

      // Renouveler le token
      const token = generateToken();
      const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      await base44.asServiceRole.entities.Player.update(player.id, {
        auth_token: token,
        token_expiry: tokenExpiry,
        last_played: new Date().toISOString(),
      });

      // Sync avec ButtonClick
      const bc = await base44.asServiceRole.entities.ButtonClick.filter({ pseudo: player.pseudo });
      const latestClicks = Math.max(player.total_clicks || 0, bc?.[0]?.total_clicks || 0);

      return Response.json({
        ok: true,
        token,
        player: {
          id: player.id,
          pseudo: player.pseudo,
          email: player.email,
          total_clicks: latestClicks,
          streak: player.streak || 0,
          best_combo: player.best_combo || 0,
          current_skin: player.current_skin || 'classic',
          skin_unlocked: player.skin_unlocked || 'classic',
          avatar: player.avatar || '',
        }
      });
    }

    // ── VERIFY TOKEN ───────────────────────────────────────
    if (action === 'verify_token') {
      const { token } = body;
      if (!token) return Response.json({ ok: false, error: 'Token manquant' }, { status: 400 });

      const players = await base44.asServiceRole.entities.Player.filter({ auth_token: token });
      if (!players || players.length === 0) {
        return Response.json({ ok: false, error: 'Session expirée' }, { status: 401 });
      }

      const player = players[0];
      if (new Date(player.token_expiry) < new Date()) {
        return Response.json({ ok: false, error: 'Session expirée' }, { status: 401 });
      }

      const bc = await base44.asServiceRole.entities.ButtonClick.filter({ pseudo: player.pseudo });
      const latestClicks = Math.max(player.total_clicks || 0, bc?.[0]?.total_clicks || 0);

      return Response.json({
        ok: true,
        player: {
          id: player.id,
          pseudo: player.pseudo,
          email: player.email,
          total_clicks: latestClicks,
          streak: player.streak || 0,
          best_combo: player.best_combo || 0,
          current_skin: player.current_skin || 'classic',
          skin_unlocked: player.skin_unlocked || 'classic',
          avatar: player.avatar || '',
        }
      });
    }

    // ── UPDATE PROFILE ─────────────────────────────────────
    if (action === 'update_profile') {
      const { token, updates } = body;
      if (!token) return Response.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

      const players = await base44.asServiceRole.entities.Player.filter({ auth_token: token });
      if (!players || players.length === 0) return Response.json({ ok: false, error: 'Session invalide' }, { status: 401 });

      const player = players[0];
      const allowed = ['current_skin', 'skin_unlocked', 'streak', 'best_combo', 'total_clicks', 'avatar', 'notifications_enabled'];
      const safeUpdates: any = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key];
      }
      safeUpdates.last_played = new Date().toISOString();

      await base44.asServiceRole.entities.Player.update(player.id, safeUpdates);
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Action inconnue' }, { status: 400 });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
