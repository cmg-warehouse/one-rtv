import { useState } from 'react';
import { tr } from '../i18n';
import { ROLE_LABELS } from '../state/session';
import { saveTour, startStory } from '../tour/runner';
import { STORIES, type Story } from '../tour/stories';

export default function Tour() {
  const [busy, setBusy] = useState(false);
  const start = async (id: Story['id']) => {
    setBusy(true);
    try {
      saveTour(await startStory(id));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tour-page">
      <h1>{tr('Demo นำชม', 'Guided demo')}</h1>
      <p className="muted">{tr('เลือกเรื่องแล้วกด “ถัดไป” ทีละขั้น ระบบจะสลับบทบาทให้เอง', 'Pick a story and press “Next” step by step. The system switches roles for you.')}</p>
      <div className="tour-cards">
        {STORIES.map(story => {
          const roles = [...new Set(story.steps.map(s => s.role))].map(r => ROLE_LABELS[r]);
          return (
            <section key={story.id} className="card tour-card">
              <h2>{story.title}</h2>
              <p>{story.summary}</p>
              <p className="muted">{story.steps.length} {tr('ขั้น', 'steps')} · {tr('บทบาท', 'Roles')}: {roles.join(', ')}</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { void start(story.id); }}>{tr('เริ่ม', 'Start')}</button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
