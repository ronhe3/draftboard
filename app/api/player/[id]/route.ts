import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

type NewsItem = { NewsID:number; PlayerID:number|null; PlayerID2:number|null; Team:string|null; Title:string; Content:string; Updated:string; TimeAgo:string|null; Source:string|null; Url:string|null };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const team = request.nextUrl.searchParams.get("team") ?? "";
  const runtime = env as unknown as Record<string, string | undefined>;
  const apiKey = runtime.SPORTSDATAIO_API_KEY ?? process.env.SPORTSDATAIO_API_KEY;
  if (!apiKey || !team) return NextResponse.json({ error: "Player news unavailable" }, { status: 400 });
  try {
    const response = await fetch(`https://api.sportsdata.io/v3/nfl/news-rotoballer/json/RotoBallerPremiumNewsByTeam/${team}`, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey }, next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error("RotoBaller request failed");
    const news = (await response.json() as NewsItem[])
      .filter((item) => String(item.PlayerID) === id || String(item.PlayerID2) === id)
      .sort((a,b) => new Date(b.Updated).getTime() - new Date(a.Updated).getTime())
      .slice(0, 5)
      .map((item) => ({ id:item.NewsID, title:item.Title, content:item.Content, updated:item.Updated, timeAgo:item.TimeAgo, source:item.Source, url:item.Url }));
    return NextResponse.json({ news, source:"RotoBaller" });
  } catch {
    return NextResponse.json({ error:"RotoBaller news is unavailable for this player." }, { status:502 });
  }
}
