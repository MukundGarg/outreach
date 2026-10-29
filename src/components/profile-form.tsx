'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Save, ShieldCheck } from 'lucide-react';
import { profileSchema, type CandidateProfile } from '@/lib/domain';
import { useDemo } from './demo-provider';
export function ProfileForm() {
  const { data, setProfile } = useDemo();
  const [saved, setSaved] = useState(false);
  const [file, setFile] = useState('');
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
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your story, all in one place.</h1>
          <p className="muted">Build a profile that brings your experience into focus.</p>
        </div>
        <span className="badge">
          <ShieldCheck size={13} /> Sample profile · not verified
        </span>
      </div>
      <form
        className="stack"
        onSubmit={handleSubmit((v) => {
          setProfile(v);
          setSaved(true);
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
                Select a PDF for local metadata preview. Upload and extraction are not enabled.
              </p>
            </div>
          </div>
          <label className="field">
            Choose PDF · maximum 10 MB
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(
                  !f
                    ? ''
                    : f.type !== 'application/pdf' || f.size > 10 * 1024 * 1024
                      ? 'Please choose a PDF under 10 MB.'
                      : `${f.name} · ${Math.ceil(f.size / 1024)} KB · selected locally, not uploaded`,
                );
              }}
            />
          </label>
          {file && (
            <p className="notice" style={{ marginTop: 15 }}>
              {file}
            </p>
          )}
        </section>
        <div className="row">
          <button className="button primary" type="submit">
            <Save size={15} /> Save demo profile
          </button>
          {saved && (
            <span className="success" role="status">
              Saved to this browser session.
            </span>
          )}
        </div>
      </form>
    </>
  );
}
