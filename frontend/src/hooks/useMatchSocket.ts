/**
 * Binds server match events to the match store.
 *
 * Mounted once at the app root so an event that arrives while the user is
 * between screens (e.g. mid-navigation from queue to arena) is never dropped.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ChallengeSummary,
  MatchEndedPayload,
  MatchFoundPayload,
  MatchResumedPayload,
  MatchStartedPayload,
  PublicUser,
  QueueStatusPayload,
  RoomState,
} from '@repx/shared';
import { cue } from '../lib/feedback';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/auth';
import { useLobby } from '../store/lobby';
import { useMatch } from '../store/match';
import { useToasts } from '../store/toasts';

export function useMatchSocket(): void {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const onQueued = (payload: QueueStatusPayload) => useMatch.getState().setQueued(payload);

    const onLeft = () => {
      if (useMatch.getState().phase === 'queued') useMatch.getState().reset();
    };

    const onFound = (payload: MatchFoundPayload) => {
      // Fired here rather than on the arena screen: the moment an opponent is
      // found is the moment the player should feel it, which is before the
      // navigation, not after the next screen has mounted.
      cue('match-found');
      useMatch.getState().setFound(payload);
      navigate('/match');
    };

    const onStarted = (payload: MatchStartedPayload) =>
      useMatch.getState().setActive(payload.endsAt, payload.serverNow);

    /**
     * The player dropped and came back while their match was still running.
     * Previously the server sent this and nothing on the client listened, so a
     * reconnecting player sat on the lobby screen while their match played on
     * without them and eventually settled as a forfeit.
     */
    const onResumed = (payload: MatchResumedPayload) => {
      const state = useMatch.getState();
      if (!state.info || state.info.matchId !== payload.matchId) {
        // No local record of this match — the page was reloaded outright. There
        // is not enough here to rebuild the arena, so return them to the lobby
        // rather than into a broken screen.
        state.reset();
        navigate('/play');
        return;
      }
      state.setActive(payload.endsAt, payload.serverNow);
      state.setOpponentDisconnected(false);
      navigate('/match');
    };

    const onRep = (payload: { repCount: number }) => {
      cue('rep');
      useMatch.getState().setMyReps(payload.repCount);
    };

    const onRejected = (payload: { reason: string }) => {
      cue('rep-rejected');
      useMatch.getState().setFeedback(payload.reason);
    };

    const onOpponent = (payload: { repCount: number }) =>
      useMatch.getState().setOpponentReps(payload.repCount);

    const onOpponentLeft = () => useMatch.getState().setOpponentDisconnected(true);
    const onOpponentBack = () => useMatch.getState().setOpponentDisconnected(false);

    const onEnded = (payload: MatchEndedPayload & { opponent: PublicUser | null }) => {
      useMatch.getState().setResult(payload);
      void refreshUser();
      navigate('/result');
    };

    /* ------------------------------------------ challenges and rooms -- */

    const onChallengeIncoming = (payload: ChallengeSummary) => {
      // A challenge is an interruption by design — someone is standing in front
      // of their camera waiting — so it announces itself the way a found match
      // does rather than sliding in silently.
      cue('match-found');
      useLobby.getState().setIncoming(payload);
    };

    const onChallengeSent = (payload: ChallengeSummary) =>
      useLobby.getState().setOutgoing(payload);

    const onChallengeClosed = (payload: { challengeId: string }) =>
      useLobby.getState().clearChallenge(payload.challengeId);

    const onChallengeDeclined = (payload: { challengeId: string }) => {
      useLobby.getState().clearChallenge(payload.challengeId);
      useToasts.getState().push({
        category: 'challenge',
        title: 'Challenge declined',
        body: 'They passed on this one.',
      });
    };

    const onChallengeUnavailable = (payload: { reason: string }) => {
      useLobby.getState().setOutgoing(null);
      useToasts.getState().push({
        category: 'challenge',
        title: 'Challenge not sent',
        body: payload.reason,
      });
    };

    const onRoomState = (payload: RoomState) => {
      useLobby.getState().setRoom(payload);
      useLobby.getState().setError(null);
    };

    const onRoomClosed = () => useLobby.getState().setRoom(null);
    const onRoomLeft = () => useLobby.getState().setRoom(null);
    const onRoomError = (payload: { reason: string }) =>
      useLobby.getState().setError(payload.reason);

    const onTournamentError = (payload: { reason: string }) =>
      useToasts.getState().push({
        category: 'tournament',
        title: 'Cannot start that match',
        body: payload.reason,
      });

    const onTournamentOpponentWaiting = () =>
      useToasts.getState().push({
        category: 'tournament',
        title: 'Your opponent is ready',
        body: 'Open your bracket to start the match.',
        href: '/tournaments',
      });

    // The counterpart to the above. Without it, someone who was told their
    // opponent was ready keeps waiting at a slot the opponent has since left.
    const onTournamentOpponentLeft = () =>
      useToasts.getState().push({
        category: 'tournament',
        title: 'Your opponent stepped away',
        body: 'The slot is still yours — try again when they are back.',
        href: '/tournaments',
      });

    socket.on('matchmaking:queued', onQueued);
    socket.on('matchmaking:left', onLeft);
    socket.on('matchmaking:found', onFound);
    socket.on('challenge:incoming', onChallengeIncoming);
    socket.on('challenge:sent', onChallengeSent);
    socket.on('challenge:cancelled', onChallengeClosed);
    socket.on('challenge:expired', onChallengeClosed);
    socket.on('challenge:declined', onChallengeDeclined);
    socket.on('challenge:unavailable', onChallengeUnavailable);
    socket.on('room:state', onRoomState);
    socket.on('room:closed', onRoomClosed);
    socket.on('room:left', onRoomLeft);
    socket.on('room:error', onRoomError);
    socket.on('tournament:error', onTournamentError);
    socket.on('tournament:opponentWaiting', onTournamentOpponentWaiting);
    socket.on('tournament:opponentLeft', onTournamentOpponentLeft);
    socket.on('match:started', onStarted);
    socket.on('match:resumed', onResumed);
    socket.on('rep:counted', onRep);
    socket.on('rep:rejected', onRejected);
    socket.on('match:opponentProgress', onOpponent);
    socket.on('match:opponentDisconnected', onOpponentLeft);
    socket.on('match:opponentReconnected', onOpponentBack);
    socket.on('match:ended', onEnded);

    return () => {
      socket.off('matchmaking:queued', onQueued);
      socket.off('matchmaking:left', onLeft);
      socket.off('matchmaking:found', onFound);
      socket.off('challenge:incoming', onChallengeIncoming);
      socket.off('challenge:sent', onChallengeSent);
      socket.off('challenge:cancelled', onChallengeClosed);
      socket.off('challenge:expired', onChallengeClosed);
      socket.off('challenge:declined', onChallengeDeclined);
      socket.off('challenge:unavailable', onChallengeUnavailable);
      socket.off('room:state', onRoomState);
      socket.off('room:closed', onRoomClosed);
      socket.off('room:left', onRoomLeft);
      socket.off('room:error', onRoomError);
      socket.off('tournament:error', onTournamentError);
      socket.off('tournament:opponentWaiting', onTournamentOpponentWaiting);
      socket.off('tournament:opponentLeft', onTournamentOpponentLeft);
      socket.off('match:started', onStarted);
      socket.off('match:resumed', onResumed);
      socket.off('rep:counted', onRep);
      socket.off('rep:rejected', onRejected);
      socket.off('match:opponentProgress', onOpponent);
      socket.off('match:opponentDisconnected', onOpponentLeft);
      socket.off('match:opponentReconnected', onOpponentBack);
      socket.off('match:ended', onEnded);
    };
  }, [user, navigate, refreshUser]);
}
