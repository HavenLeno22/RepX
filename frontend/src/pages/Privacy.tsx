/**
 * The privacy terms.
 *
 * Written in the interface's own voice and in plain language, because the people
 * agreeing to it are about to point a camera at themselves and deserve to
 * understand what happens next without a law degree.
 *
 * ⚠️ This is an honest, specific description of what the software actually does,
 * written by engineers. It is **not** a lawyer-reviewed privacy policy, and it
 * has not been checked against GDPR, UK GDPR, CCPA, or the biometric-privacy
 * statutes (Illinois BIPA and its Texas and Washington analogues) that pose
 * estimation can fall under. Have counsel review this before launch — see
 * docs/SECURITY.md.
 */

import { Link } from 'react-router-dom';
import { CONSENT_VERSION } from '@repx/shared';
import { Icon } from '../components/Icon';
import { Panel } from '../components/ui';

interface Section {
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'What the camera does',
    body: [
      'RepX counts your repetitions by estimating the position of your joints while you move. That estimation runs entirely in your browser, on your device, using a pose model downloaded to it.',
      'Your video is never uploaded, never stored, and never seen by us or by your opponent. It does not leave the device it was captured on.',
      'The camera is active only while you are in a match or previewing your framing before one. Closing the arena releases it.',
    ],
  },
  {
    title: 'What we receive',
    body: [
      'During a match your device sends us a stream of joint coordinates — numbers describing where your shoulders, hips, knees and so on are in the frame. These are used to verify that a repetition happened, to score it, and to detect manipulation of the stream.',
      'We keep the outcome of the match: your rep count, the quality score, the result, and your rating change. We do not retain the individual frames after the match settles.',
    ],
  },
  {
    title: 'What we store about you',
    body: [
      'Your email address, your username, and — if you set them — your avatar, bio and country.',
      'Your competitive record: matches, ratings, trophies, missions, streaks and friendships.',
      'Sessions, as hashed tokens. Your password is stored only as a scrypt hash and cannot be read back by anyone, including us.',
    ],
  },
  {
    title: 'Signing in with Google or Apple',
    body: [
      'If you sign in with a provider, we receive the identifier they issue for you and the email address on that account. We do not receive your password, and we hold no ability to act on your provider account.',
      'Apple lets you hide your address behind a relay. That works with RepX — we only ever need something to send account mail to.',
    ],
  },
  {
    title: 'Who else sees it',
    body: [
      'We do not sell or share your data with anyone for their own purposes. A small number of companies process it on our behalf, under contract, only to run the service: our hosting and database provider, our email provider (verification and password-reset mail only), and — if you use them — Google or Apple for sign-in.',
      'Your browser downloads the pose model and its runtime from Google’s and jsDelivr’s content networks. Those requests carry your IP address, the way loading any file from the internet does. They carry no account information and no video.',
      'RepX runs no advertising network, no third-party analytics and no tracking pixels. Nothing on the match screen is talking to anyone but us.',
      'We will hand over data if the law genuinely requires it, and we will tell you when we are allowed to.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Your account and competitive record: for as long as the account exists. Delete it and they go with it.',
      'Joint coordinates from a live match: held in memory for the length of the match and discarded once it settles. They are never written to the database.',
      'Sessions: until they expire or you sign the device out. A password reset revokes every existing session immediately.',
      'Server logs, which contain IP addresses and timestamps: 30 days, then they roll off automatically.',
    ],
  },
  {
    title: 'Deleting everything',
    body: [
      'Settings → Delete account removes your account and every record attached to it: matches, ratings, trophies, friendships, sessions and pending invitations.',
      'It is immediate and irreversible. There is no soft delete and no retention window — when it is gone it is gone.',
      'If you cannot sign in, write to privacy@repx.app from the address on the account and we will do it for you within 30 days.',
    ],
  },
  {
    title: 'Your rights over it',
    body: [
      'Wherever you live, you can ask us for a copy of your data, ask us to correct it, ask us to delete it, or ask us to send it somewhere else in a portable format. Write to privacy@repx.app and we will answer within 30 days.',
      'If you are in the UK, the EU or the EEA: we process your account data to provide a service you asked for, we process match and anti-cheat data because we have a legitimate interest in a game that is not overrun by cheats, and we process the camera-derived coordinates on the basis of the consent you give before your first match. You can withdraw that consent at any time by not playing, and delete the account outright whenever you like. You also have the right to complain to your national data-protection authority.',
      'If you are in California: we do not sell or share personal information as those terms are defined there, and we will not discriminate against you for exercising any of the rights above.',
    ],
  },
  {
    title: 'Where it is processed',
    body: [
      'Our servers and providers may be located outside the country you are in, including in the United States. Where data leaves the UK or the EEA it is transferred under the standard contractual clauses the law provides for.',
      'This does not apply to your video, which is never transferred anywhere because it never leaves your device.',
    ],
  },
  {
    title: 'Children',
    body: [
      'RepX is not for under-13s and we do not knowingly hold data about one. If you believe a child has created an account, tell us at privacy@repx.app and we will delete it.',
    ],
  },
  {
    title: 'What we do not do',
    body: [
      'We do not sell your data. We do not use it to train models. We do not run advertising trackers, and RepX ships with no third-party analytics embedded in the arena.',
      'We do not build a profile of you for anyone else, and we do not use your data to decide anything about you automatically beyond scoring the match you are playing.',
    ],
  },
  {
    title: 'When this changes',
    body: [
      'If we change this in a way that materially affects you, the version number at the top moves and RepX asks you to read and agree to it again before your next match. Agreeing to an earlier version is not agreeing to a later one, and the app enforces that rather than assuming it.',
      'Smaller corrections — a clearer sentence, a renamed screen — we make in place.',
    ],
  },
];

export function Privacy() {
  return (
    <div className="col gap-md" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="head">
        <h1 className="head__t">Privacy</h1>
        <div className="head__actions">
          <span className="chip">Version {CONSENT_VERSION}</span>
        </div>
      </div>

      <Panel>
        <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
          <Icon name="camera" size={20} style={{ color: 'var(--cyan)', marginTop: 2, flexShrink: 0 }} />
          <p className="t-body-lg" style={{ color: 'var(--text)' }}>
            The short version: pose estimation happens on your device, your video never leaves it,
            and we receive joint coordinates rather than images.
          </p>
        </div>
      </Panel>

      {SECTIONS.map((section) => (
        <Panel key={section.title} title={section.title}>
          <div className="col gap-sm">
            {section.body.map((paragraph) => (
              <p key={paragraph} className="t-body dim">
                {paragraph}
              </p>
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="Getting in touch">
        <div className="col gap-sm">
          <p className="t-body dim">
            For anything about your data — a copy of it, a correction, or a complaint — write to
            privacy@repx.app and we will answer.
          </p>
          <p className="t-body dim">
            To erase everything, use <Link to="/delete-account">account deletion</Link> — it works
            whether or not you can still sign in. The rules of play are in the{' '}
            <Link to="/terms">terms</Link>.
          </p>
        </div>
      </Panel>

      <div className="row" style={{ justifyContent: 'center', padding: 'var(--s4) 0' }}>
        <Link to="/" className="btn btn--ghost">
          Back to RepX
        </Link>
      </div>
    </div>
  );
}
