'use client';
import { useState, useEffect } from 'react';
import {
  Compass,
  Check,
  Plus,
  ExternalLink,
  ShieldCheck,
  Building,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import type { RecruiterRecommendation } from '@/services/recruiter-directory';
import type { RecruiterContact } from '@/lib/domain';

interface DiscoverRecruitersProps {
  onAddContact: (contact: { name: string; email: string; company?: string; role?: string }) => Promise<RecruiterContact>;
  onPrepareOutreach: (contact: RecruiterContact) => void;
  existingContacts: RecruiterContact[];
  isDemo?: boolean;
}

export function DiscoverRecruiters({
  onAddContact,
  onPrepareOutreach,
  existingContacts,
}: DiscoverRecruitersProps) {
  const [recommendations, setRecommendations] = useState<RecruiterRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  // Set of existing emails to indicate already added
  const existingEmails = new Set(existingContacts.map((c) => c.email.toLowerCase()));

  useEffect(() => {
    let cancelled = false;
    async function fetchRecommendations() {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/outreach/directory?mode=recommendations${
            searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''
          }`,
        );
        const json = await r.json();
        if (!cancelled) {
          if (json.ok && json.data) {
            setRecommendations(json.data.recommendations || []);
          } else {
            setError(json.error || 'Failed to load recommendations');
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Network error';
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchRecommendations();

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  function handleToggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleAddSingle(rec: RecruiterRecommendation) {
    setAddingIds((prev) => new Set(prev).add(rec.id));
    try {
      const created = await onAddContact({
        name: rec.fullName,
        email: rec.normalizedEmail,
        company: rec.company || undefined,
        role: rec.jobTitle || undefined,
      });
      // Optionally prepare outreach
      onPrepareOutreach(created);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add recruiter');
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  }

  async function handleAddSelected() {
    const toAdd = recommendations.filter((r) => selectedIds.has(r.id) && !existingEmails.has(r.normalizedEmail));
    if (toAdd.length === 0) return;

    setBulkAdding(true);
    let lastCreated: RecruiterContact | null = null;
    for (const rec of toAdd) {
      try {
        const created = await onAddContact({
          name: rec.fullName,
          email: rec.normalizedEmail,
          company: rec.company || undefined,
          role: rec.jobTitle || undefined,
        });
        lastCreated = created;
      } catch {
        // Continue adding rest
      }
    }
    setBulkAdding(false);
    setSelectedIds(new Set());
    if (lastCreated) {
      onPrepareOutreach(lastCreated);
    }
  }

  return (
    <div className="card stack" style={{ gap: 16 }}>
      <div className="between">
        <div className="row" style={{ gap: 8 }}>
          <Compass size={20} style={{ color: '#27694e' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Discover Verified Recruiters</h2>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Ranked recommendations tailored to your profile skills, target roles, and preferred locations.
            </p>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <button
            type="button"
            className="button primary"
            disabled={bulkAdding}
            onClick={handleAddSelected}
            style={{ fontSize: 12 }}
          >
            <Plus size={13} /> {bulkAdding ? 'Adding…' : `Add Selected (${selectedIds.size}) to My List`}
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="row" style={{ gap: 8 }}>
        <input
          type="text"
          placeholder="Filter by name, company, or specialty…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
        />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 24, fontSize: 13 }} className="muted">
          Matching verified recruiters to your career preferences…
        </div>
      )}

      {error && (
        <div className="card" style={{ background: '#fff5f5', border: '1px solid #d32f2f', color: '#d32f2f', fontSize: 12, padding: 10 }}>
          <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
          {error}
        </div>
      )}

      {!loading && recommendations.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32 }} className="muted">
          No verified recruiters found matching your search. Try broadening your keywords.
        </div>
      )}

      {!loading && recommendations.length > 0 && (
        <div className="stack" style={{ gap: 12 }}>
          {recommendations.map((rec) => {
            const isAlreadyAdded = existingEmails.has(rec.normalizedEmail.toLowerCase());
            const isSelected = selectedIds.has(rec.id);
            const isAdding = addingIds.has(rec.id);

            return (
              <div
                key={rec.id}
                className="card between"
                style={{
                  background: isAlreadyAdded ? '#fbfbfb' : 'white',
                  border: isSelected ? '1px solid #27694e' : '1px solid #e2e8f0',
                  padding: '12px 16px',
                }}
              >
                <div className="row" style={{ gap: 12, alignItems: 'flex-start', flex: 1 }}>
                  {!isAlreadyAdded && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(rec.id)}
                      style={{ marginTop: 4 }}
                    />
                  )}
                  <div className="stack" style={{ gap: 4, flex: 1 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{rec.fullName}</strong>
                      <span className="badge submitted" style={{ fontSize: 10 }}>
                        <ShieldCheck size={11} style={{ marginRight: 2 }} /> Verified Recruiter
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: 10,
                          background: rec.relevanceScore >= 70 ? '#dcfce7' : '#f1f5f9',
                          color: rec.relevanceScore >= 70 ? '#166534' : '#334155',
                          fontWeight: 600,
                        }}
                      >
                        {rec.relevanceScore}% Match
                      </span>
                    </div>

                    <div className="row muted" style={{ gap: 12, fontSize: 12 }}>
                      {rec.jobTitle && <span>{rec.jobTitle}</span>}
                      {rec.company && (
                        <span className="row" style={{ gap: 3 }}>
                          <Building size={12} /> {rec.company}
                        </span>
                      )}
                      {rec.location && (
                        <span className="row" style={{ gap: 3 }}>
                          <MapPin size={12} /> {rec.location}
                        </span>
                      )}
                    </div>

                    {/* Transparent Match Reasons */}
                    {rec.matchReasons.length > 0 && (
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {rec.matchReasons.map((reason, rIdx) => (
                          <span
                            key={rIdx}
                            style={{
                              fontSize: 11,
                              color: '#27694e',
                              background: '#f4f7f0',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            • {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Specialties */}
                    {rec.recruitingSpecialties.length > 0 && (
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        {rec.recruitingSpecialties.map((s, sIdx) => (
                          <span key={sIdx} className="badge" style={{ fontSize: 10 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  {rec.linkedinUrl && (
                    <a
                      href={rec.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      title="View LinkedIn Profile"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {isAlreadyAdded ? (
                    <span className="badge" style={{ fontSize: 11 }}>
                      <Check size={12} style={{ marginRight: 2 }} /> In Your Contacts
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button primary"
                      disabled={isAdding}
                      onClick={() => handleAddSingle(rec)}
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      <Plus size={12} /> {isAdding ? 'Adding…' : 'Add to My List'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
