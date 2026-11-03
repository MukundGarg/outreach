# ApplyPilot AI — Chrome Extension for Job Application Autofill

## Installation & Setup Instructions on macOS

To install the unpacked extension in Google Chrome on macOS:

1. Start the ApplyPilot website locally:
   ```bash
   cd outreach
   npm run dev
   # (or npm run start if already built)
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable the **Developer mode** toggle switch in the top-right corner.
4. Click the **Load unpacked** button.
5. In the file picker dialog, select the **actual folder** that directly contains `manifest.json`.
   
   > **IMPORTANT for macOS:**
   > - Select the folder itself, **NOT** the individual `manifest.json` file.
   > - Do not select the top-level repository folder if your project is nested.
   > 
   > The local absolute folder paths are:
   > - Primary: `/Users/mukundgarg/Projects/Outreach/outreach/outreach/extension`
   > - Root alias: `/Users/mukundgarg/Projects/Outreach/outreach/extension`
   
6. Pin **ApplyPilot AI** to your Chrome toolbar by clicking the puzzle icon in Chrome and pinning the extension.

---

## Verifying the Extension Files

You can quickly verify that the extension manifest and all referenced scripts are present and readable by running:
```bash
cd outreach
node --import tsx tests/validate-extension.ts
```

---

## How to Test the Complete Autofill Workflow

### Step 1: Open ApplyPilot AI
1. Go to `http://localhost:3000/autofill` (or navigate via the sidebar **AI Form Filling**).
2. Choose an active application (e.g. `Linear — Product Engineer`, ID: `sample-1` or a real UUID from your pipeline).
3. Copy or note the Application ID.

### Step 2: Open Job Application Page
1. In another browser tab, open the external job application form (e.g., Greenhouse, Lever, Ashby, or our local test page).
2. Click the pinned **ApplyPilot Extension** icon in Chrome's toolbar.
3. Verify the **Web Origin** is set to `http://localhost:3000`.
4. Enter or confirm the **Application ID**.
5. Click **Extract Fields from This Page**.
   - The extension safely extracts form inputs (text, email, tel, textarea, dropdowns, radios, checkboxes).
   - Passwords, hidden inputs, CAPTCHAs, and file uploads are safely skipped.
   - The extracted fields are transmitted to ApplyPilot's AI mapping pipeline.

### Step 3: Review Answers in ApplyPilot
1. Switch back to `http://localhost:3000/autofill`.
2. Inspect the extracted fields:
   - **Profile Information**: Verified candidate profile facts (Name, Email, Location, LinkedIn, etc.)
   - **Gemini Basic Answers**: Standard questions (notice period, visa status)
   - **Complex Questions**: Behavioral answers marked for candidate review
   - **Sensitive Declarations**: Legal attestations strictly requiring human input
3. Edit any answers as desired and click **Save Autofill Review**.

### Step 4: Autofill the Form
1. Return to the external job application tab.
2. Click the ApplyPilot extension icon and click **Autofill Reviewed Answers**.
3. The extension populates all approved fields and outlines them in green.
4. **Human in the Loop**: The extension never submits forms automatically. Review the form and submit manually.
