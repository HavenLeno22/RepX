/**
 * @repx/shared — the contract between the RepX client and server.
 *
 * Everything exported here is platform-agnostic: no DOM, no Node, no database.
 * That constraint is what lets the same ELO math and the same exercise rep
 * state machines run identically in the browser (optimistic) and on the server
 * (authoritative). See docs/SYSTEM_ARCHITECTURE.md.
 */

export * from './constants/palette';
export * from './constants/ranks';
export * from './constants/match';
export * from './elo';
export * from './progression';
export * from './exercise-engine/types';
export * from './exercise-engine/geometry';
export * from './exercise-engine/rep-session';
export * from './exercise-engine/registry';
export * from './tournament/bracket';
export * from './schemas';
