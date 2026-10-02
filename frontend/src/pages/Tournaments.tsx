/**
 * Tournaments.
 *
 * Two states in one screen: a list of tournaments, and the bracket of whichever
 * one you opened. They are not separate routes because a bracket is only ever
 * read in the context of the tournament it belongs to, and a back button that
 * loses your scroll position through a 32-slot draw is worse than a panel that
 * swaps.
 *
 * The bracket is laid out as columns of rounds, scrolled horizontally. That is
 * how every knockout draw in the world is printed, and inventing a different
 * arrangement to avoid a scrollbar would make a familiar object unfamiliar.
 */

import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import {
  type TournamentDetail,
  type TournamentMatchSummary,
  type TournamentSummary,
  roundName,
} from '@repx/shared';
import { Avatar } from '../components/Avatar';
import { ExerciseArt } from '../components/ExerciseArt';
import { Icon } from '../components/Icon';
import { Reveal } from '../components/motion';
import { Empty, ErrorState, Panel, SkeletonRows } from '../components/ui';
import { del, get, post } from '../lib/api';
import { cue } from '../lib/feedback';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/auth';
import { useToasts } from '../store/toasts';

export function Tournaments() {
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    void get<TournamentSummary[]>('/tournaments')
      .then(setList)
      .catch(() => {
        setList([]);
        setFailed(true);
      });
  }, []);

  useEffect(load, [load]);

  if (openId) {
    return <Bracket id={openId} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="col gap-md">
      <div className="head">
        <h1 className="head__t">Tournaments</h1>
        <div className="head__actions">
          <CreateButton onCreated={load} />
        </div>
      </div>

      {failed ? (
        <ErrorState message="Could not load tournaments" onRetry={load} />
      ) : list === null ? (
        <Panel flush>
          <SkeletonRows count={3} height={92} />
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <Empty
            icon="medal"
            title="No tournaments yet"
            hint="Open one and invite the ladder"
          />
        </Panel>
      ) : (
        <div className="grid grid--cards">
          {list.map((tournament, i) => (
            <Reveal key={tournament.id} delay={Math.min(i * 0.04, 0.2)}>
              <TournamentCard tournament={tournament} onOpen={() => setOpenId(tournament.id)} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- card -- */

const STATUS_CHIP: Record<TournamentSummary['status'], string> = {
  open: 'chip--ok',
  live: 'chip--brand',
  finished: 'chip--gold',
  cancelled: 'chip--bad',
};

const STATUS_LABEL: Record<TournamentSummary['status'], string> = {
  open: 'Registering',
  live: 'Under way',
  finished: 'Finished',
  cancelled: 'Cancelled',
};

function TournamentCard({
  tournament,
  onOpen,
}: {
  tournament: TournamentSummary;
  onOpen: () => void;
}) {
  return (
    <button className="panel panel--tap" onClick={onOpen} style={{ textAlign: 'left', width: '100%' }}>
      <div
        className="pick__stage"
        style={{ color: tournament.status === 'live' ? 'var(--brand)' : 'var(--text-3)' }}
      >
        <ExerciseArt slug={tournament.exerciseSlug} size={92} />
      </div>
      <div className="panel__body">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className={`chip ${STATUS_CHIP[tournament.status]}`}>
            {tournament.status === 'live' && <span className="chip__dot chip__dot--pulse" />}
            {STATUS_LABEL[tournament.status]}
          </span>
          <span className="mono mute" style={{ fontSize: 12, fontWeight: 700 }}>
            {tournament.entrantCount}/{tournament.maxEntrants}
          </span>
        </div>
        <div className="t-h3">{tournament.name}</div>
        <div className="t-sm mute" style={{ marginTop: 2, textTransform: 'capitalize' }}>
          {tournament.exerciseSlug.replace('-', ' ')}
        </div>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------- create -- */

function CreateButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<{ slug: string; displayName: string }[]>([]);
  const [slug, setSlug] = useState('push-up');
  const [size, setSize] = useState(8);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void get<{ slug: string; displayName: string; enabled?: boolean }[]>('/exercises')
      .then((list) => {
        setExercises(list);
        if (list[0]) setSlug((current) => current || list[0].slug);
      })
      .catch(() => setExercises([]));
  }, [open]);

  async function submit() {
    if (name.trim().length < 3) return;
    setBusy(true);
    try {
      await post('/tournaments', { name: name.trim(), exerciseSlug: slug, maxEntrants: size });
      setOpen(false);
      setName('');
      onCreated();
    } catch {
      useToasts.getState().push({
        category: 'tournament',
        title: 'Could not create that tournament',
        body: 'Check the name and try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        New tournament
      </button>

      {open && (
        <div className="modal-scrim" onClick={() => setOpen(false)} role="presentation">
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="New tournament"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="panel__head">
              <span className="panel__title">New tournament</span>
            </header>
            <div className="panel__body">
              <div className="field">
                <label className="field__label" htmlFor="t-name">Name</label>
                <input
                  id="t-name"
                  className="input"
                  placeholder="Friday Night Push"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="field">
                <span className="field__label">Exercise</span>
                <div className="grid grid--picks">
                  {exercises.map((exercise) => (
                    <button
                      key={exercise.slug}
                      className="pick pick--exercise"
                      aria-pressed={slug === exercise.slug}
                      onClick={() => setSlug(exercise.slug)}
                    >
                      <span className="pick__stage">
                        <ExerciseArt slug={exercise.slug} size={78} />
                      </span>
                      <span className="pick__label">
                        <span className="pick__name">{exercise.displayName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field__label">Bracket size</span>
                <div className="seg" role="group" aria-label="Bracket size">
                  {[4, 8, 16, 32].map((n) => (
                    <button
                      key={n}
                      className="seg__opt"
                      aria-pressed={size === n}
                      onClick={() => setSize(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="field__hint">
                  The draw is built from whoever actually registers — a short field
                  simply means byes for the top seeds.
                </span>
              </div>

              <div className="row gap-sm">
                <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  style={{ flex: 1 }}
                  disabled={name.trim().length < 3 || busy}
                  onClick={() => void submit()}
                >
                  {busy ? <span className="spinner" /> : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- bracket -- */

function Bracket({ id, onBack }: { id: string; onBack: () => void }) {
  const me = useAuth((s) => s.user);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    void get<TournamentDetail>(`/tournaments/${id}`)
      .then(setDetail)
      .catch(() => setFailed(true));
  }, [id]);

  useEffect(load, [load]);

  // A result anywhere in the draw changes this screen, and the player watching
  // it did not necessarily play the match that produced it.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('tournament:updated', load);
    return () => {
      socket.off('tournament:updated', load);
    };
  }, [load]);

  async function act(fn: () => Promise<TournamentDetail>) {
    setBusy(true);
    try {
      setDetail(await fn());
      cue('select');
    } catch (error) {
      useToasts.getState().push({
        category: 'tournament',
        title: 'That did not work',
        body: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <ErrorState message="Could not load that tournament" onRetry={load} />;
  if (!detail) {
    return (
      <Panel flush>
        <SkeletonRows count={4} height={72} />
      </Panel>
    );
  }

  const byId = new Map(detail.entrants.map((e) => [e.userId, e]));
  const rounds: TournamentMatchSummary[][] = [];
  for (const match of detail.matches) {
    (rounds[match.round] ??= []).push(match);
  }

  const champion = detail.championId ? byId.get(detail.championId) : null;

  return (
    <div className="col gap-md">
      <div className="head">
        <h1 className="head__t">{detail.name}</h1>
        <div className="head__actions">
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            <Icon name="chevron-left" size={16} />
            All tournaments
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- status */}
      <Panel>
        <div className="row between wrap-row" style={{ gap: 'var(--s4)' }}>
          <div className="row" style={{ gap: 'var(--s4)' }}>
            <span className="pick__stage" style={{ borderRadius: 'var(--r-card)', padding: 'var(--s2) var(--s4)' }}>
              <ExerciseArt slug={detail.exerciseSlug} size={80} />
            </span>
            <div>
              <span className={`chip ${STATUS_CHIP[detail.status]}`}>
                {detail.status === 'live' && <span className="chip__dot chip__dot--pulse" />}
                {STATUS_LABEL[detail.status]}
              </span>
              <div className="t-h3" style={{ marginTop: 6, textTransform: 'capitalize' }}>
                {detail.exerciseSlug.replace('-', ' ')}
              </div>
              <div className="t-sm mute">
                {detail.entrantCount} entrant{detail.entrantCount === 1 ? '' : 's'}
                {detail.rounds > 0 && ` · ${detail.rounds} rounds`}
              </div>
            </div>
          </div>

          <div className="row gap-sm wrap-row">
            {detail.status === 'open' && !detail.joined && (
              <button
                className="btn btn--primary"
                disabled={busy || detail.entrantCount >= detail.maxEntrants}
                onClick={() => void act(() => post<TournamentDetail>(`/tournaments/${id}/join`, {}))}
              >
                {detail.entrantCount >= detail.maxEntrants ? 'Full' : 'Enter tournament'}
              </button>
            )}
            {detail.status === 'open' && detail.joined && (
              <>
                <button
                  className="btn btn--outline"
                  disabled={busy}
                  onClick={() => void act(() => del<TournamentDetail>(`/tournaments/${id}/join`))}
                >
                  Withdraw
                </button>
                <button
                  className="btn btn--primary"
                  disabled={busy || detail.entrantCount < 2}
                  onClick={() => void act(() => post<TournamentDetail>(`/tournaments/${id}/start`, {}))}
                  title={detail.entrantCount < 2 ? 'Needs at least two entrants' : undefined}
                >
                  <Icon name="swords" size={17} />
                  Make the draw
                </button>
              </>
            )}
            {detail.yourMatchId && (
              <button
                className="btn btn--play"
                onClick={() => {
                  getSocket()?.emit('tournament:enter', { tournamentMatchId: detail.yourMatchId });
                  cue('select');
                  useToasts.getState().push({
                    category: 'tournament',
                    title: 'Waiting for your opponent',
                    body: 'The match starts the moment they enter too.',
                  });
                }}
              >
                <Icon name="swords" size={19} strokeWidth={2.2} />
                Play your match
              </button>
            )}
          </div>
        </div>

        {champion && (
          <>
            <div className="divider" />
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <Avatar username={champion.username} src={champion.avatarUrl} size={48} ring="var(--gold)" />
              <div>
                <div className="t-caption" style={{ color: 'var(--gold)' }}>Champion</div>
                <div className="t-h3">{champion.username}</div>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* ------------------------------------------------------ bracket */}
      {detail.status === 'open' ? (
        <Panel title="Entrants" flush>
          {detail.entrants.length === 0 ? (
            <Empty icon="users" title="Nobody has entered yet" hint="Be the first on the sheet" />
          ) : (
            <div className="list">
              {detail.entrants.map((entrant) => (
                <div key={entrant.userId} className="listrow">
                  <Avatar username={entrant.username} src={entrant.avatarUrl} size={34} />
                  <span className="listrow__main">
                    <span className="listrow__name">{entrant.username}</span>
                    <span className="listrow__sub">{entrant.rating}</span>
                  </span>
                  {entrant.userId === me?.id && <span className="chip chip--brand">You</span>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="Draw" flush>
          <div className="bracket">
            {rounds.map((matches, round) => (
              <div className="bracket__round" key={round}>
                <div className="bracket__label">{roundName(round, detail.rounds)}</div>
                <div className="bracket__slots">
                  {matches
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((match) => (
                      <BracketSlot
                        key={match.id}
                        match={match}
                        byId={byId}
                        meId={me?.id}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function BracketSlot({
  match,
  byId,
  meId,
}: {
  match: TournamentMatchSummary;
  byId: Map<string, { username: string; avatarUrl: string | null; seed: number | null }>;
  meId?: string;
}) {
  const side = (userId: string | null) => {
    if (!userId) {
      // An empty side in a decided match was a walkover; an empty side in a
      // pending one is still waiting on a feeder. Saying which is the difference
      // between an explanation and a blank.
      return (
        <div className="bracket__player bracket__player--empty">
          <span className="t-sm mute">{match.status === 'done' ? 'Bye' : 'To be decided'}</span>
        </div>
      );
    }
    const entrant = byId.get(userId);
    const won = match.winnerId === userId;
    const lost = match.winnerId !== null && !won;
    return (
      <div
        className={`bracket__player${won ? ' bracket__player--won' : ''}${lost ? ' bracket__player--lost' : ''}`}
      >
        {entrant?.seed && <span className="bracket__seed">{entrant.seed}</span>}
        <Avatar username={entrant?.username ?? '?'} src={entrant?.avatarUrl ?? null} size={24} />
        <span className="bracket__name">{entrant?.username ?? 'Unknown'}</span>
        {userId === meId && <span className="bracket__you">You</span>}
        {won && <Icon name="check" size={14} strokeWidth={3} />}
      </div>
    );
  };

  return (
    <div className={`bracket__match bracket__match--${match.status}`}>
      {side(match.aUserId)}
      {side(match.bUserId)}
    </div>
  );
}
