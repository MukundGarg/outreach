# ApplyPilot AI — Chrome Extension for Job Application Autofill

## Installation & Setup Instructions

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `extension` folder located inside the `outreach` project directory:
   `/Users/mukundgarg/Projects/Outreach/outreach/outreach/extension`
5. The **ApplyPilot AI — Job Application Autofill** extension will now appear in your browser toolbar.

---

## How to Test the Complete Autofill Workflow

### Step 1: In ApplyPilot Web App
1. Navigate to any opportunity in **Applications** (e.g. `http://localhost:3000/applications/<applicationId>`).
2. In the **AI Application Autofill** panel:
   - Paste an application form URL (e.g., a Greenhouse or Lever job posting).
   - Click **Analyze & Save Application URL**.
   - Note the **Application ID** displayed in the panel or address bar.

### Step 2: Open External Job Application
1. Click **Open External Application Page** to open the job posting in another browser tab.
2. Click the **ApplyPilot Extension** icon in Chrome's toolbar.
3. Paste the **Application ID** and confirm the web origin (`http://localhost:3000` or production URL).
4. Click **Extract Fields from This Page**.
   - The extension extracts all accessible inputs, labels, and question text.
   - It securely transmits them to ApplyPilot's authenticated API.
   - Profile values are mapped automatically, sensitive questions are isolated for user input, and Gemini answers standard & complex questions.

### Step 3: Review Answers in ApplyPilot
1. Return to the ApplyPilot opportunity page.
2. The **Reviewed Autofill Form Fields** table shows fields grouped by:
   - **Profile Information** (First Name, Last Name, Email, LinkedIn, etc.)
   - **Gemini Basic Answers** (Why are you interested, Tell me about yourself)
   - **Complex Questions (Requiring Review)** (Technical challenges, leadership)
   - **Sensitive Questions (User Input Required)** (Work authorization, legal attestations)
3. Edit or adjust any values as desired and click **Save Reviewed Autofill Answers**.

### Step 4: Autofill the Form
1. Switch back to the open job application tab.
2. In the extension popup, click **Autofill Reviewed Answers**.
3. The extension populates all inputs, fires proper DOM `input` and `change` events, and outlines filled elements in green.
4. **Final submission remains 100% in your control**: The extension never submits forms automatically.

