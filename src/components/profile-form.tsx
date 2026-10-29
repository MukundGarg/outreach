'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download, FileUp, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { profileSchema, type CandidateProfile } from '@/lib/domain';
import { useWorkspace } from './use-workspace';

export function ProfileForm() {
  const { isDemo, data, setProfile, uploadResumeFile, deleteUserResume } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CandidateProfile>({ resolver: zodResolver(profileSchema), values: data.profile });

  const fields = [
    ['name', 'Full name'],
    ['email', 'Email address'],
    ['headline', 'Professional headline'],
    ['location', 'Location'],
    ['portfolio', 'Portfolio URL'],
    ['github', 'GitHub URL'],
    ['linkedin', 'LinkedIn URL'],
  ] as const;

  const currentResume = !isDemo ? data.resume : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your story, all in one place.</h1>
          <p className="muted">Build a profile that brings your experience into focus.</p>
        </div>
        <span className="badge">
          <ShieldCheck size={13} />{' '}
          {isDemo ? 'Sample profile · not verified' : 'Authenticated profile · Supabase'}
        </span>
      </div>
      <form
        className="stack"
        onSubmit={handleSubmit(async (v) => {
          setSaving(true);
          setStatusMessage('');
          try {
            await setProfile(v);
            setSaved(true);
            setStatusMessage(
              isDemo ? 'Saved to this browser session.' : 'Profile updated in database.',
            );
          } catch (err: unknown) {
            setStatusMessage(err instanceof Error ? err.message : 'Failed to save profile');
          } finally {
            setSaving(false);
          }
        })}
      >
        <section className="card">
          <h2>Personal details</h2>
          <div className="form-grid">
            {fields.map(([key, title]) => (
              <label className="field" key={key}>
                {title}
                <input
                  {...register(key)}
                  type={
                    key === 'email'
                      ? 'email'
                      : key === 'portfolio' || key === 'github' || key === 'linkedin'
                        ? 'url'
                        : 'text'
                  }
                />
                {errors[key] && <small>{errors[key]?.message}</small>}
              </label>
            ))}
          </div>
        </section>
        <div className="grid2">
          {(
            [
              ['skills', 'Skills', 'Separate skills with commas'],
              ['education', 'Education', 'Degrees, institutions, and dates'],
              ['experience', 'Experience', 'Roles, achievements, and impact'],
              ['projects', 'Projects', 'What you built and why it matters'],
            ] as const
          ).map(([key, title, hint]) => (
            <section className="card" key={key}>
              <h2>{title}</h2>
              <label className="field">
                {hint}
                <textarea {...register(key)} />
                {errors[key] && <small>{errors[key]?.message}</small>}
              </label>
            </section>
          ))}
        </div>
        <section className="card">
          <div className="row">
            <FileUp size={23} />
            <div>
              <h2 style={{ marginBottom: 6 }}>Your resume</h2>
              <p className="muted" style={{ fontSize: 12 }}>
                {isDemo
                  ? 'Select a PDF for local metadata preview. Upload and extraction are not enabled.'
                  : 'Upload your PDF resume to private Supabase Storage. Short-lived signed URLs are generated on demand.'}
              </p>
            </div>
          </div>

          {currentResume && (
            <div
              className="between"
              style={{
                background: '#f2f6ee',
                padding: '12px 16px',
                borderRadius: '8px',
                marginTop: '16px',
                marginBottom: '16px',
              }}
            >
              <div>
                <strong>{currentResume.resume.fileName}</strong>
                <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>
                  {Math.ceil(currentResume.resume.sizeBytes / 1024)} KB · Uploaded{' '}
                  {new Date(currentResume.resume.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="row">
                <a
                  className="button"
                  href={currentResume.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11 }}
                >
                  <Download size={13} /> View private PDF
                </a>
                {deleteUserResume && (
                  <button
                    type="button"
                    className="button"
                    style={{ fontSize: 11, color: '#a85649' }}
                    onClick={async () => {
                      try {
                        await deleteUserResume(currentResume.resume.id);
                        setFileMessage('Resume removed.');
                      } catch {
                        setFileMessage('Failed to remove resume.');
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          <label className="field">
            {currentResume ? 'Replace PDF · maximum 10 MB' : 'Choose PDF · maximum 10 MB'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) {
                  setFileMessage('');
                  return;
                }
                if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
                  setFileMessage('Please choose a valid PDF file.');
                  return;
                }
                if (f.size > 10 * 1024 * 1024) {
                  setFileMessage('Please choose a PDF under 10 MB.');
                  return;
                }

                if (isDemo) {
                  setFileMessage(
                    `${f.name} · ${Math.ceil(f.size / 1024)} KB · selected locally, not uploaded`,
                  );
                } else if (uploadResumeFile) {
                  setUploading(true);
                  setFileMessage('Uploading to private storage…');
                  try {
                    await uploadResumeFile(f);
                    setFileMessage('Resume securely uploaded.');
                  } catch (err: unknown) {
                    setFileMessage(
                      err instanceof Error ? err.message : 'Failed to upload resume.',
                    );
                  } finally {
                    setUploading(false);
                  }
                }
              }}
            />
          </label>
          {fileMessage && (
            <p className="notice" style={{ marginTop: 15 }} role="status">
              {fileMessage}
            </p>
          )}
        </section>
        <div className="row">
          <button className="button primary" type="submit" disabled={saving}>
            <Save size={15} />{' '}
            {saving ? 'Saving…' : isDemo ? 'Save demo profile' : 'Save profile'}
          </button>
          {saved && (
            <span className="success" role="status">
              {statusMessage || (isDemo ? 'Saved to this browser session.' : 'Saved to database.')}
            </span>
          )}
        </div>
      </form>
    </>
  );
}

