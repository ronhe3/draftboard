import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

type SportsDataPlayer = {
  PlayerID: number | null;
  Name: string | null;
  Team: string | null;
  Position: string | null;
  AverageDraftPosition: number | null;
  AverageDraftPositionPPR: number | null;
  FantasyPoints: number | null;
  FantasyPointsPPR: number | null;
};
type SportsDataDefense = {
  PlayerID: number | null; TeamID: number | null; Team: string | null;
  AverageDraftPosition: number | null; AverageDraftPositionPPR: number | null;
  FantasyPoints: number | null;
};
type SportsDataTeam = { Key:string; WikipediaLogoUrl:string|null; WikipediaWordMarkUrl:string|null };

function validImage(...urls: Array<string | null | undefined>) {
  return urls.find((url) => typeof url === "string" && /^https:\/\//i.test(url)) ?? "";
}

const fallbackPlayers = [
  { id:"1", rank:1, name:"Ja'Marr Chase", team:"CIN", position:"WR", positionRank:1, tier:1, bye:10, trend:0, note:"Elite target share with week-winning ceiling." },
  { id:"2", rank:2, name:"Bijan Robinson", team:"ATL", position:"RB", positionRank:1, tier:1, bye:12, trend:1, note:"Three-down profile and the safest volume at RB." },
  { id:"3", rank:3, name:"Jahmyr Gibbs", team:"DET", position:"RB", positionRank:2, tier:1, bye:8, trend:2, note:"Explosive efficiency in an elite scoring environment." },
  { id:"4", rank:4, name:"Justin Jefferson", team:"MIN", position:"WR", positionRank:2, tier:1, bye:6, trend:-1, note:"Unmatched route talent keeps the floor exceptionally high." },
  { id:"5", rank:5, name:"CeeDee Lamb", team:"DAL", position:"WR", positionRank:3, tier:2, bye:10, trend:0, note:"A volume anchor who can carry a receiving corps." },
  { id:"6", rank:6, name:"Saquon Barkley", team:"PHI", position:"RB", positionRank:3, tier:2, bye:9, trend:-2, note:"Touchdown access offsets a little workload uncertainty." },
  { id:"7", rank:7, name:"Puka Nacua", team:"LAR", position:"WR", positionRank:4, tier:2, bye:8, trend:3, note:"Physical volume receiver entering his prime." },
  { id:"8", rank:8, name:"Josh Allen", team:"BUF", position:"QB", positionRank:1, tier:3, bye:7, trend:0, note:"The position's defining combination of arm and rushing equity." },
  { id:"9", rank:9, name:"Amon-Ra St. Brown", team:"DET", position:"WR", positionRank:5, tier:3, bye:8, trend:1, note:"Bankable weekly usage from the slot and red zone." },
  { id:"10", rank:10, name:"Brock Bowers", team:"LV", position:"TE", positionRank:1, tier:3, bye:8, trend:2, note:"Difference-making target volume at a scarce position." },
];

function adp(player: SportsDataPlayer, scoring: string) {
  const standard = player.AverageDraftPosition;
  const ppr = player.AverageDraftPositionPPR;
  if (scoring === "Full PPR") return ppr ?? standard ?? 9999;
  if (scoring === "Half PPR" && standard != null && ppr != null) return (standard + ppr) / 2;
  return standard ?? ppr ?? 9999;
}

function normalize(source: SportsDataPlayer[], scoring: string, byeWeeks: Map<number, number>, teamLogos: Map<string, string>) {
  const allowed = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);
  const ranked = source
    .filter((p) => p.PlayerID && p.Name && p.Position && allowed.has(p.Position) && adp(p, scoring) < 9999)
    .sort((a, b) => adp(a, scoring) - adp(b, scoring));
  const positionCounts: Record<string, number> = {};
  return ranked.map((p, index) => {
    const position = p.Position!;
    positionCounts[position] = (positionCounts[position] ?? 0) + 1;
    const points = scoring === "Standard" ? p.FantasyPoints : (p.FantasyPointsPPR ?? p.FantasyPoints);
    return {
      id: String(p.PlayerID), rank: index + 1, name: p.Name!, team: p.Team ?? "FA", position,
      positionRank: positionCounts[position], tier: Math.floor(index / 12) + 1, bye: byeWeeks.get(p.PlayerID!) ?? 0, trend: 0,
      teamLogoUrl: teamLogos.get(p.Team ?? "") ?? null,
      note: points == null ? `Consensus ADP ${adp(p, scoring).toFixed(1)}` : `${points.toFixed(1)} projected points · ADP ${adp(p, scoring).toFixed(1)}`,
    };
  });
}

export async function GET(request: NextRequest) {
  const scoring = request.nextUrl.searchParams.get("scoring") ?? "Half PPR";
  const runtime = env as unknown as Record<string, string | undefined>;
  const apiKey = runtime.SPORTSDATAIO_API_KEY ?? process.env.SPORTSDATAIO_API_KEY;
  const season = runtime.SPORTSDATAIO_SEASON ?? process.env.SPORTSDATAIO_SEASON ?? "2026REG";
  if (!apiKey) return NextResponse.json({ players: fallbackPlayers, scoring, source: "preview" });

  try {
    const requestOptions = { headers: { "Ocp-Apim-Subscription-Key": apiKey }, next: { revalidate: 900 } };
    const [projectionResponse, defenseResponse, teamsResponse] = await Promise.all([
      fetch(`https://api.sportsdata.io/v3/nfl/projections/json/PlayerSeasonProjectionStats/${season}`, requestOptions),
      fetch(`https://api.sportsdata.io/v3/nfl/projections/json/FantasyDefenseProjectionsBySeason/${season}`, requestOptions),
      fetch("https://api.sportsdata.io/v3/nfl/scores/json/Teams", requestOptions),
    ]);
    if (!projectionResponse.ok || !defenseResponse.ok) throw new Error("SportsDataIO request failed");
    const byeWeeks = new Map<number, number>();
    const teamData = teamsResponse.ok ? await teamsResponse.json() as SportsDataTeam[] : [];
    const teamLogos = new Map(teamData.map((item) => [item.Key, validImage(item.WikipediaLogoUrl, item.WikipediaWordMarkUrl)]));
    const defenses = (await defenseResponse.json() as SportsDataDefense[]).map((d) => {
      const id = -(d.PlayerID ?? d.TeamID ?? 0);
      return {
        PlayerID: id, Name: `${d.Team ?? "Unknown"} D/ST`, Team: d.Team, Position: "DST",
        AverageDraftPosition: d.AverageDraftPosition, AverageDraftPositionPPR: d.AverageDraftPositionPPR,
        FantasyPoints: d.FantasyPoints, FantasyPointsPPR: d.FantasyPoints,
      } satisfies SportsDataPlayer;
    });
    const projections = await projectionResponse.json() as SportsDataPlayer[];
    const players = normalize([...projections, ...defenses], scoring, byeWeeks, teamLogos);
    return NextResponse.json({ players, scoring, season, source: "sportsdataio" });
  } catch {
    return NextResponse.json({ players: fallbackPlayers, scoring, source: "fallback" });
  }
}
