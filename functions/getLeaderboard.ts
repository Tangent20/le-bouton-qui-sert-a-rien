import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const records = await base44.asServiceRole.entities.ButtonClick.list();
    
    // Sort by total_clicks descending
    const sorted = (records || [])
      .sort((a: any, b: any) => (b.total_clicks || 0) - (a.total_clicks || 0))
      .slice(0, 10);
    
    // Count total global clicks
    const globalClicks = (records || []).reduce((sum: number, r: any) => sum + (r.total_clicks || 0), 0);

    return Response.json({ leaderboard: sorted, globalClicks });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
