"use client";

import { useEffect, useMemo, useState } from "react";

type Player = {
  id: string; rank: number; name: string; team: string; position: string;
  positionRank: number; tier: number; bye: number; trend: number; note: string; teamLogoUrl?: string | null;
};
type PlayerDetail = { news?: Array<{id:number;title:string;content:string;updated:string;timeAgo:string|null;source:string|null;url:string|null}>; source?:string; error?:string };

const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

export default function Rankings() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [position, setPosition] = useState("ALL");
  const [scoring, setScoring] = useState("Half PPR");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<"rankings" | "setup" | "draft">("rankings");
  const [teamCount, setTeamCount] = useState(12);
  const [draftFormat, setDraftFormat] = useState<"Snake" | "Linear">("Snake");
  const [userSeat, setUserSeat] = useState(1);
  const [currentPick, setCurrentPick] = useState(0);
  const [picks, setPicks] = useState<Array<{ player: Player; team: number; round: number; overall: number }>>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rankings?scoring=${encodeURIComponent(scoring)}`)
      .then((r) => r.json())
      .then((data) => setPlayers(data.players ?? []))
      .finally(() => setLoading(false));
  }, [scoring]);

  const visible = useMemo(() => players.filter((p) =>
    (position === "ALL" || p.position === position) &&
    (`${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase()))
  ), [players, position, query]);

  const teamOnClock = (pick: number) => {
    const round = Math.floor(pick / teamCount);
    const slot = pick % teamCount;
    return draftFormat === "Snake" && round % 2 !== 0 ? teamCount - slot : slot + 1;
  };
  const available = useMemo(() => {
    const drafted = new Set(picks.map((pick) => pick.player.id));
    return players.filter((player) => !drafted.has(player.id));
  }, [players, picks]);

  useEffect(() => {
    if (screen !== "draft" || currentPick >= teamCount * 15 || teamOnClock(currentPick) === userSeat || available.length === 0) return;
    const timer = window.setTimeout(() => {
      const player = available[0];
      setPicks((drafted) => [...drafted, { player, team: teamOnClock(currentPick), round: Math.floor(currentPick / teamCount) + 1, overall: currentPick + 1 }]);
      setCurrentPick((pick) => pick + 1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [screen, currentPick, teamCount, draftFormat, userSeat, available]);

  const startDraft = () => {
    setPicks([]); setCurrentPick(0); setPosition("ALL"); setQuery(""); setScreen("draft");
  };
  const draftPlayer = (player: Player) => {
    if (teamOnClock(currentPick) !== userSeat || currentPick >= teamCount * 15) return;
    setPicks((drafted) => [...drafted, { player, team: userSeat, round: Math.floor(currentPick / teamCount) + 1, overall: currentPick + 1 }]);
    setCurrentPick((pick) => pick + 1);
  };
  const showPlayer = (player: Player) => {
    setSelectedPlayer(player); setPlayerDetail(null); setDetailLoading(true);
    fetch(`/api/player/${encodeURIComponent(player.id)}?team=${encodeURIComponent(player.team)}`)
      .then((response) => response.json()).then(setPlayerDetail).finally(() => setDetailLoading(false));
  };

  const appHeader = (
    <header className="topbar">
      <button className="brand brandButton" onClick={() => setScreen("rankings")} aria-label="Draftboard home"><span className="brandmark">D</span><span>Draftboard</span></button>
      <nav aria-label="Main navigation">
        <button className={screen === "rankings" ? "active" : ""} onClick={() => setScreen("rankings")}>Rankings</button>
        <button className={screen !== "rankings" ? "active" : ""} onClick={() => setScreen("setup")}>Mock Draft</button>
        <span className="soon">Lineup Optimizer <small>SOON</small></span>
      </nav>
      <button className="leagueButton" disabled>Connect league</button>
    </header>
  );

  if (screen === "setup") return <main>{appHeader}<section className="mockSetup">
    <div className="setupIntro"><p className="eyebrow">MOCK DRAFT LAB</p><h1>Build your draft room.</h1><p>Choose the league shape. We’ll run a full 15-round Yahoo-style snake draft against ranking-driven opponents.</p></div>
    <div className="setupCard">
      <div className="setupCardHead"><span>Draft settings</span><small>15 ROUNDS · {draftFormat.toUpperCase()}</small></div>
      <fieldset><legend>Teams</legend><div className="choiceGrid">{[10,12,14].map((count) => <button key={count} className={teamCount === count ? "chosen" : ""} onClick={() => { setTeamCount(count); setUserSeat((seat) => Math.min(seat, count)); }}><strong>{count}</strong><span>teams</span></button>)}</div></fieldset>
      <fieldset><legend>Draft format</legend><div className="choiceGrid formatChoices">{(["Snake","Linear"] as const).map((value) => <button key={value} className={draftFormat === value ? "chosen" : ""} onClick={() => setDraftFormat(value)}><strong>{value}</strong><span>{value === "Snake" ? "Order reverses each round" : "Same order every round"}</span></button>)}</div></fieldset>
      <fieldset><legend>Scoring</legend><div className="choiceGrid scoringChoices">{["Standard","Half PPR","Full PPR"].map((value) => <button key={value} className={scoring === value ? "chosen" : ""} onClick={() => setScoring(value)}><strong>{value}</strong><span>{value === "Standard" ? "No reception points" : value === "Half PPR" ? "0.5 per reception" : "1.0 per reception"}</span></button>)}</div></fieldset>
      <fieldset><legend>Your seat</legend><div className="seatPicker">{Array.from({length:teamCount}).map((_,i) => <button key={i} className={userSeat === i+1 ? "chosen" : ""} onClick={() => setUserSeat(i+1)}>{i+1}</button>)}</div></fieldset>
      <div className="draftSummary"><div><span>Draft size</span><strong>{teamCount * 15} picks</strong></div><div><span>Your seat</span><strong>Pick {userSeat}</strong></div><div><span>Format</span><strong>{draftFormat}</strong></div></div>
      <button className="startDraft" onClick={startDraft} disabled={loading}>{loading ? "Loading rankings…" : "Enter draft room →"}</button>
    </div>
  </section></main>;

  if (screen === "draft") {
    const round = Math.min(15, Math.floor(currentPick / teamCount) + 1);
    const onClock = teamOnClock(currentPick);
    const filteredAvailable = available.filter((p) => position === "ALL" || p.position === position).slice(0, 45);
    const draftComplete = currentPick >= teamCount * 15;
    const reports = Array.from({ length: teamCount }, (_, index) => {
      const team = index + 1;
      const roster = picks.filter((pick) => pick.team === team);
      const counts = roster.reduce<Record<string, number>>((all, pick) => ({ ...all, [pick.player.position]: (all[pick.player.position] ?? 0) + 1 }), {});
      const valueTotal = roster.reduce((sum, pick) => sum + (pick.overall - pick.player.rank), 0);
      const balancePenalty = Math.abs((counts.QB ?? 0) - 2) + Math.abs((counts.RB ?? 0) - 4) + Math.abs((counts.WR ?? 0) - 5) + Math.abs((counts.TE ?? 0) - 2) + Math.abs((counts.K ?? 0) - 1) + Math.abs((counts.DST ?? 0) - 1);
      const score = Math.max(55, Math.min(99, Math.round(84 + valueTotal / 18 - balancePenalty * 1.5)));
      const grade = score >= 94 ? "A+" : score >= 90 ? "A" : score >= 87 ? "A-" : score >= 83 ? "B+" : score >= 80 ? "B" : score >= 77 ? "B-" : score >= 73 ? "C+" : score >= 70 ? "C" : "D";
      const byValue = [...roster].sort((a, b) => (b.overall - b.player.rank) - (a.overall - a.player.rank));
      return { team, roster, counts, valueTotal, balancePenalty, score, grade, best: byValue[0], reach: byValue.at(-1) };
    }).sort((a, b) => b.score - a.score);
    const userReport = reports.find((report) => report.team === userSeat);
    return <main className="draftPage">{appHeader}<section className="draftStatus"><div><p className="eyebrow">ROUND {round} OF 15</p><h1>{currentPick >= teamCount * 15 ? "Draft complete" : onClock === userSeat ? "You’re on the clock." : `Team ${onClock} is picking…`}</h1></div><div className="pickCounter"><span>OVERALL</span><strong>{Math.min(currentPick + 1, teamCount * 15)}</strong><small>OF {teamCount * 15}</small></div></section>
      <section className="draftWorkspace">
        <div className="draftBoard"><div className="draftBoardHead"><strong>Draft board</strong><span>{teamCount} teams · {draftFormat} · {scoring}</span></div><div className={`teamLabels teams${teamCount}`}>{Array.from({length:teamCount}).map((_,i)=><span key={i}>{i+1===userSeat?"YOU":`T${i+1}`}</span>)}</div><div className={`pickGrid teams${teamCount}`}>{Array.from({length:teamCount*15}).map((_,cellIndex)=>{const roundIndex=Math.floor(cellIndex/teamCount); const team=(cellIndex%teamCount)+1; const pickOffset=draftFormat==="Snake"&&roundIndex%2===1?teamCount-team:team-1; const pickIndex=roundIndex*teamCount+pickOffset; const pick=picks[pickIndex]; return <div key={cellIndex} className={`pickCell ${team===userSeat?"yourCell":""} ${pickIndex===currentPick?"onClock":""}`}><small>{roundIndex+1}.{team}</small>{pick&&<><strong>{pick.player.name.split(" ").at(-1)}</strong><span>{pick.player.position} · {pick.player.team}</span></>}</div>})}</div></div>
        <aside className="playerPool"><div className="poolHead"><div><strong>Available players</strong><span>{available.length} remaining</span></div><div className="miniTabs">{positions.map((p)=><button key={p} className={position===p?"selected":""} onClick={()=>setPosition(p)}>{p}</button>)}</div></div><div className="poolRows">{filteredAvailable.map((p)=><div className="poolPlayer" key={p.id}><span className="poolRank">{p.rank}</span>{p.teamLogoUrl?<img className="poolHeadshot teamLogo" src={p.teamLogoUrl} alt={`${p.team} logo`}/>:<div className="poolHeadshot fallback">{p.team||"FA"}</div>}<button className="playerInfo" onClick={()=>showPlayer(p)}><strong>{p.name}</strong><span>{p.team} · {p.position}{p.positionRank}</span></button><button disabled={onClock!==userSeat || currentPick>=teamCount*15} onClick={()=>draftPlayer(p)}>Draft</button></div>)}</div></aside>
      </section>
      {selectedPlayer && <div className="detailBackdrop" onMouseDown={() => setSelectedPlayer(null)}><section className="playerDetail" role="dialog" aria-modal="true" aria-label={`${selectedPlayer.name} news`} onMouseDown={(event)=>event.stopPropagation()}><button className="closeDetail" onClick={()=>setSelectedPlayer(null)} aria-label="Close">×</button><div className="detailTitle">{selectedPlayer.teamLogoUrl?<img className="detailHeadshot teamLogo" src={selectedPlayer.teamLogoUrl} alt={`${selectedPlayer.team} logo`}/>:<div className="avatar">{selectedPlayer.team||"FA"}</div>}<div><p>{selectedPlayer.position}{selectedPlayer.positionRank} · {selectedPlayer.team}</p><h2>{selectedPlayer.name}</h2><span>Overall rank #{selectedPlayer.rank}</span></div></div>{detailLoading?<div className="detailLoading">Loading latest RotoBaller news…</div>:playerDetail?.error?<div className="detailLoading">{playerDetail.error}</div>:playerDetail&&<div className="newsList">{playerDetail.news?.length?playerDetail.news.map((item)=><article key={item.id}><div><span>{item.source??"RotoBaller"}</span><time>{item.timeAgo??new Date(item.updated).toLocaleDateString()}</time></div><h3>{item.title}</h3><p>{item.content}</p>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">Read full update →</a>}</article>):<div className="detailLoading">No recent RotoBaller news for this player.</div>}</div>}</section></div>}
      {draftComplete && userReport && <section className="gradeReport">
        <div className="gradeHero"><div><p className="eyebrow">POST-DRAFT REPORT</p><h2>Your draft grade</h2><p>Seat {userSeat} · {teamCount}-team {scoring} · {draftFormat}</p></div><div className="letterGrade"><strong>{userReport.grade}</strong><span>{userReport.score}/100</span></div></div>
        <div className="gradeMetrics"><div><span>Value score</span><strong>{userReport.valueTotal >= 0 ? "+" : ""}{userReport.valueTotal}</strong><small>vs. consensus rank</small></div><div><span>Roster balance</span><strong>{Math.max(0, 100-userReport.balancePenalty*8)}%</strong><small>positional coverage</small></div><div><span>Best value</span><strong>{userReport.best?.player.name ?? "—"}</strong><small>{userReport.best ? `Pick ${userReport.best.overall} · Rank ${userReport.best.player.rank}` : ""}</small></div><div><span>Biggest reach</span><strong>{userReport.reach?.player.name ?? "—"}</strong><small>{userReport.reach ? `Pick ${userReport.reach.overall} · Rank ${userReport.reach.player.rank}` : ""}</small></div></div>
        <div className="reportGrid"><div className="rosterReport"><h3>Your roster</h3>{userReport.roster.map((pick)=><div key={pick.overall}><span>{pick.round}</span><strong>{pick.player.name}</strong><small>{pick.player.position} · {pick.player.team}</small><em>#{pick.overall}</em></div>)}</div><div className="leagueGrades"><h3>League grades</h3>{reports.map((report,index)=><div key={report.team} className={report.team===userSeat?"isYou":""}><span>{index+1}</span><strong>{report.team===userSeat?"You":`Team ${report.team}`}</strong><small>{report.score} points</small><em>{report.grade}</em></div>)}</div></div>
        <button className="draftAgain" onClick={() => setScreen("setup")}>Start another mock</button>
      </section>}
    </main>;
  }

  return (
    <main>
      {appHeader}

      <section className="hero" id="rankings">
        <div>
          <p className="eyebrow">2026 DRAFT ROOM</p>
          <h1>Know who’s next.</h1>
          <p className="lede">A sharp, no-noise board for making the pick in front of you.</p>
        </div>
        <div className="update"><span className="liveDot" /> Rankings ready <strong>Preseason</strong></div>
      </section>

      <section className="board" aria-label="Player rankings">
        <div className="controls">
          <div className="positionTabs" aria-label="Filter by position">
            {positions.map((p) => <button key={p} className={position === p ? "selected" : ""} onClick={() => setPosition(p)}>{p === "ALL" ? "Overall" : p}</button>)}
          </div>
          <div className="controlRight">
            <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players or teams" aria-label="Search players or teams" /></label>
            <label className="selectLabel">Scoring<select value={scoring} onChange={(e) => setScoring(e.target.value)}><option>Standard</option><option>Half PPR</option><option>Full PPR</option></select></label>
          </div>
        </div>

        <div className="tableHead"><span>RK</span><span>PLAYER</span><span>POS</span><span>BYE</span><span>TREND</span><span>OUTLOOK</span></div>
        <div className="rows" aria-live="polite">
          {loading ? Array.from({length: 7}).map((_, i) => <div className="playerRow skeleton" key={i} />) : visible.map((p, i) => {
            const newTier = i === 0 || visible[i - 1]?.tier !== p.tier;
            return <div key={p.id}>{newTier && <div className="tier"><span>Tier {p.tier}</span></div>}<article className="playerRow">
              <strong className="rank">{p.rank}</strong>
              <div className="player"><div className={`avatar ${p.position.toLowerCase()}`}>{p.name.split(" ").map(n => n[0]).join("").slice(0,2)}</div><div><h2>{p.name}</h2><p>{p.team} · {p.position}{p.positionRank}</p></div></div>
              <span className={`position ${p.position.toLowerCase()}`}>{p.position}{p.positionRank}</span>
              <span className="bye">{p.bye}</span>
              <span className={`trend ${p.trend > 0 ? "up" : p.trend < 0 ? "down" : "flat"}`}>{p.trend > 0 ? `↑ ${p.trend}` : p.trend < 0 ? `↓ ${Math.abs(p.trend)}` : "—"}</span>
              <p className="note">{p.note}</p>
            </article></div>;
          })}
          {!loading && visible.length === 0 && <div className="empty"><strong>No players found.</strong><span>Try another position or search.</span></div>}
        </div>
      </section>
      <footer><span>Draftboard rankings</span><span>Built for decisions, not predictions.</span></footer>
    </main>
  );
}
