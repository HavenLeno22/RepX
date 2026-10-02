/**
 * The terms of use.
 *
 * Same voice as the privacy terms: plain language, specific about what the
 * software actually does, no clauses that exist only to look like a contract.
 *
 * The section that earns its place more than any other is "Your body is your
 * responsibility". RepX is a competitive timer pointed at someone doing burpees
 * as fast as they can, in a room we cannot see, with a stranger beating them on
 * a scoreboard. Every incentive in the product pushes toward one more rep. That
 * is the point of it, and it is also the risk, and a fitness product that does
 * not say so plainly is being dishonest about what it is.
 *
 * ⚠️ Written by engineers, not lawyers. This is an accurate description of the
 * rules the software enforces and the position RepX takes — it is **not** a
 * counsel-reviewed agreement, and the liability, warranty and governing-law
 * sections in particular are placeholders that a lawyer must replace before
 * launch. See docs/DEPLOYMENT.md → "Legal review".
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
    title: 'Who can play',
    body: [
      'You need to be 13 or older to hold a RepX account. If you are between 13 and the age of majority where you live, you need a parent or guardian to agree to these terms on your behalf.',
      'One person, one account. You are responsible for what happens under yours, so keep your password to yourself — and if you think someone else has it, change it and sign out every other device from Settings.',
    ],
  },
  {
    title: 'Your body is your responsibility',
    body: [
      'RepX is a game, not a coach, a physiotherapist or a doctor. Nothing in it is medical advice, and no part of it knows anything about your health, your history or your limits.',
      'Talk to a doctor before starting if you are pregnant, recovering from injury or surgery, managing a heart, joint or blood-pressure condition, or have simply not trained in a long time.',
      'The scoreboard will always ask for one more rep. It is a piece of software and it does not know when you should stop — you do. Stop if you feel pain, dizziness, chest tightness or shortness of breath, and get medical help if it does not pass. Losing a match costs you a few rating points; an injury costs considerably more.',
      'Clear the space around you before a match. Check your footing, your ceiling height, and that whatever you are pulling up on will hold you. You take part at your own risk.',
    ],
  },
  {
    title: 'Fair play',
    body: [
      'Every repetition is scored on our servers from the joint coordinates your device sends, and the stream is screened for manipulation. Your device is never the authority on your score.',
      'These will end an account: feeding the app recorded or synthetic video, tampering with the coordinate stream or the match clock, scripting or automating play, playing on someone else’s behalf, deliberately losing to move a rating, running several accounts to farm wins, or exploiting a bug instead of reporting it.',
      'We may void matches, reset a rating, or suspend or delete an account when we find this. Ratings and ranks are a score inside a game — they are not property, not a balance, and not something we owe you.',
      'If you find a way to cheat, report it to security@repx.app rather than using it. We would rather fix it, and we would rather hear it from you.',
    ],
  },
  {
    title: 'How you behave toward other players',
    body: [
      'You are on camera in front of another person. Do not point it at anyone who has not agreed to be there, and do not expose yourself to an opponent.',
      'Usernames, avatars and bios are visible to everyone. Keep them free of harassment, slurs, sexual content, impersonation and anything illegal. We can change or remove any of them.',
      'Report anything that breaches this to abuse@repx.app.',
    ],
  },
  {
    title: 'What RepX owes you',
    body: [
      'We will run the service with reasonable care, and we will tell you before we make a change that takes something away from you.',
      'We do not promise it will always be available. It is an online game with live opponents: servers go down, deploys go wrong, and a match can be lost to a dropped connection. Where a match ends because of a fault on our side, we void it rather than settle it.',
      'The service is provided as it is. To the extent the law where you live allows it, we are not liable for indirect or consequential loss arising from using RepX.',
    ],
  },
  {
    title: 'Ending it',
    body: [
      'You can delete your account at any moment from Settings, or from the deletion page if you cannot sign in. It is immediate and irreversible.',
      'We may suspend or close an account that breaks these terms. Where it is not a serious or repeated breach, we will say what happened and give you a chance to respond.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: [
      'When these terms change materially, the version number below moves and RepX asks you to agree again before your next match. Continuing to play after that is how you accept the new version.',
    ],
  },
];

export function Terms() {
  return (
    <div className="col gap-md" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="head">
        <h1 className="head__t">Terms</h1>
        <div className="head__actions">
          <span className="chip">Version {CONSENT_VERSION}</span>
        </div>
      </div>

      <Panel>
        <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
          <Icon
            name="shield"
            size={20}
            style={{ color: 'var(--brand)', marginTop: 2, flexShrink: 0 }}
          />
          <p className="t-body-lg" style={{ color: 'var(--text)' }}>
            The short version: play honestly, be decent to your opponent, and know that the
            scoreboard has no idea when your body has had enough — that judgement is yours alone.
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
        <p className="t-body dim">
          Questions about these terms go to support@repx.app. How we handle your data is a separate
          document — read the <Link to="/privacy">privacy terms</Link>, which covers the camera in
          detail.
        </p>
      </Panel>

      <div className="row" style={{ justifyContent: 'center', padding: 'var(--s4) 0' }}>
        <Link to="/" className="btn btn--ghost">
          Back to RepX
        </Link>
      </div>
    </div>
  );
}
