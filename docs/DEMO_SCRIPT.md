# ApplyPilot AI — 5-Minute Hackathon Demo Script

This script walks through a fast, bulletproof five-minute demonstration of ApplyPilot AI for judges and reviewers.

---

## ⏱️ Minute-by-Minute Demo Schedule

| Timestamp | Screen / Flow | Primary Talking Points & Actions | Backup / Simulated Fallback |
|---|---|---|---|
| **0:00 - 0:45** | **Login & Workspace Overview** (`/login` & `/dashboard`) | • Sign in to authenticated candidate workspace.<br>• Highlight pipeline stages from draft to offer with user ownership.<br>• Point out honest, audit-trailed event log. | If auth network is slow, switch to Demo Mode banner (`Explore sample workspace`). |
| **0:45 - 1:45** | **Candidate Profile & Resume Intelligence** (`/profile`) | • Open Candidate Profile.<br>• Show uploaded resume with private Supabase Storage isolation.<br>• Click "Analyze Demo Resume" (or upload PDF) to demonstrate Gemini structured profile extraction with editable preview before saving. | If Gemini rate-limits, built-in structured fallback populates Sarah Jenkins candidate fields. |
| **1:45 - 2:45** | **Opportunity Workspace & Form Assistance** (`/applications`) | • View application card (e.g. Platform Engineer).<br>• Show Gemini Match Score & Analysis.<br>• Run **Dify Agent 1 (Application Intelligence)** to generate field mappings and tailored answers for screening questions.<br>• Demonstrate **One-Click Copy** buttons for easy form completion without brittle scraping or bot defenses. | Deterministic mock payload produces structured field mappings and answers. |
| **2:45 - 4:00** | **Recruiter Outreach & Draft Persistence** (`/outreach`) | • Switch to **Outreach** tab.<br>• Select a recruiter contact (e.g. Jane Smith at Stripe).<br>• Generate tailored email draft via **Dify Agent 2**.<br>• **Edit Subject & Body**.<br>• Click **Save Draft to Database**.<br>• **Refresh browser** live to prove exact persistence.<br>• Show that draft belongs strictly to this contact. | Local storage demo provider retains edits across browser reloads. |
| **4:00 - 5:00** | **Human-in-the-Loop Send Safety & Gmail Integration** (`/outreach`) | • Point out **Connected Gmail account** via secure OAuth 2.0.<br>• Show that "Approve & Send via Gmail" button is **disabled by default**.<br>• Demonstrate explicit candidate review and checkbox confirmation.<br>• Explain cryptographic content hash (`approved_content_hash`) and idempotency binding.<br>• Demonstrate Opt-out suppression protection.<br>• Show follow-up scheduling foundation with business-day calculation. | Live send preview modal displays safety verification without requiring a live email receipt. |

---

## 💡 Key Architectural Safety Highlights for Judges

1. **No Dark Automation**: We never scrape LinkedIn, bypass CAPTCHA, or send unapproved bulk emails. Every outreach draft and form response requires explicit human approval.
2. **Server-Side Persisted Approval & Idempotency**: Operation keys are cryptographically bound to the authenticated user ID, recipient email, campaign ID, and content hash. Altering content rejects replay attacks.
3. **Draft Persistence**: Changes survive browser refreshes, contact switching, and sign-outs via atomic Supabase database records.
4. **Resilient Dual-AI Architecture**: Leverages Google Gemini for extraction/matching and specialized Dify agents for multi-step reasoning, backed by graceful deterministic degradation if external APIs are unreachable.
