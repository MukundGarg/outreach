'use client';
import { useState } from 'react';
import { preferencesSchema } from '@/lib/domain';
import { useWorkspace } from './use-workspace';
export function PreferencesForm() {
  const { isDemo, data, setPreferences } = useWorkspace();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Define your next move.</h1>
          <p className="muted">The right fit starts with what matters to you.</p>
        </div>
      </div>
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const parsed = preferencesSchema.safeParse({
            roles: f.get('roles'),
            locations: f.get('locations'),
            workMode: f.get('workMode'),
            relocation: f.get('relocation') === 'on',
            employmentType: f.get('employmentType'),
            expectedCompensation: Number(f.get('expectedCompensation')),
            currentCompensation: f.get('currentCompensation')
              ? Number(f.get('currentCompensation'))
              : null,
            currency: f.get('currency'),
            industries: f.get('industries'),
          });
          if (!parsed.success) {
            setMessage(parsed.error.issues[0].message);
            return;
          }
          setBusy(true);
          try {
            await setPreferences(parsed.data);
            setMessage(
              isDemo
                ? 'Demo preferences saved to this browser session.'
                : 'Preferences successfully saved to your account.',
            );
          } catch (err: unknown) {
            setMessage(err instanceof Error ? err.message : 'Failed to save preferences.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Your ideal opportunity</h2>
        <div className="form-grid">
          {(
            [
              ['roles', 'Preferred roles'],
              ['locations', 'Preferred locations'],
              ['industries', 'Preferred industries'],
            ] as const
          ).map(([key, title]) => (
            <label className="field" key={key}>
              {title}
              <input name={key} defaultValue={data.preferences[key]} required={key === 'roles'} />
            </label>
          ))}
          <label className="field">
            Work arrangement
            <select name="workMode" defaultValue={data.preferences.workMode}>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on_site">On-site</option>
            </select>
          </label>
          <label className="field">
            Employment type
            <select name="employmentType" defaultValue={data.preferences.employmentType}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          <label className="field">
            Currency
            <select name="currency" defaultValue={data.preferences.currency}>
              {['USD', 'INR', 'EUR', 'GBP'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Expected annual compensation
            <input
              name="expectedCompensation"
              type="number"
              min="0"
              required
              defaultValue={data.preferences.expectedCompensation}
            />
          </label>
          <label className="field">
            Current annual compensation · optional
            <input
              name="currentCompensation"
              type="number"
              min="0"
              defaultValue={data.preferences.currentCompensation ?? ''}
            />
          </label>
        </div>
        <label className="check">
          <input name="relocation" type="checkbox" defaultChecked={data.preferences.relocation} />{' '}
          Open to relocation
        </label>
        <div>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Saving…' : isDemo ? 'Save demo preferences' : 'Save preferences'}
          </button>
        </div>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </form>
    </>
  );
}
