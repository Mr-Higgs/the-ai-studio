// ============================================================================
//  THE STEP-BY-STEP GUIDE — plain words for people who have never done this.
//  Rendered in two places: the in-app Help page (#help, full detail) and the
//  public /guide page (short version). Pure data, no React.
//
//  Writing rules (keep them when you edit):
//   - One action per line. Start with the verb: "Click", "Type", "Wait".
//   - Name buttons exactly as they appear on screen, in **bold**.
//   - No tech words. Not "authenticate" — "sign in". Not "credentials" — "key".
//   - Every chapter: what you'll see (picture), what to do, what happens next,
//     what to do if it doesn't look like that.
//   - Pictures live in ui/web/public/guide/. `marks` match the red numbered
//     circles baked into each picture (1 = first mark).
//   - Keys are never real: write API KEY PLACEHOLDER / ORG ID PLACEHOLDER.
// ============================================================================

const img = (src, alt, marks = []) => ({ src: `/guide/${src}`, alt, marks });

// Words a first-timer may not know. Shown at the top of the full guide.
export const WORDS = [
  ['Account', 'Your own private space on a website. You get in with your email and a password.'],
  ['Sign in / Log in', 'Typing your email and password to get into your account. Same thing, two names.'],
  ['Password', 'A secret word you make up. At least 8 letters or numbers. Write it down somewhere safe.'],
  ['Link', 'Blue or underlined text you can click. It takes you to another page.'],
  ['Button', 'A box with words on it, like Save or Send. Click it once and wait.'],
  ['Tab', 'One page open in your internet browser. You can have several tabs open at the top of the window, like folders.'],
  ['Copy and paste', 'Copy = highlight text, then press Ctrl+C (Windows) or ⌘+C (Mac). Paste = click where you want it, then Ctrl+V or ⌘+V.'],
  ['Download', 'Saving a file from the internet onto your computer. It usually lands in your Downloads folder.'],
  ['Devin', 'The AI helper inside Studio. It writes your offer, posts, emails and plans. You talk to it in the chat box on the right.'],
  ['HeyGen', 'A separate website that turns a written script into a video of a presenter (an "avatar"). Only needed for the video step.'],
  ['Key (API key)', 'A long secret code that lets Studio use your Devin account on your behalf. It looks like cog_ followed by letters and numbers. Treat it like a password.'],
  ['Chat', 'The column on the right side of the screen where Devin talks to you and you type back.'],
];

// Shown on both pages: what to have ready before you sit down.
export const BEFORE = [
  { title: 'An email address you can open right now', why: 'We send you a confirmation link. You need to click it. If you use Gmail on your phone, that works.' },
  { title: 'A password you have written down', why: 'Make it up before you start. At least 8 characters. Write it on paper. You will type it twice today.' },
  { title: 'A free Devin account', why: 'Devin is the AI that does the writing. Chapter 3 shows you how to make the account and copy two codes from it into Studio. Takes about 10 minutes.' },
  { title: 'A free HeyGen account (only if you want a video)', why: 'HeyGen makes the presenter video. You need a 2-minute video of yourself to build your avatar, or you can use one of HeyGen’s ready-made presenters. Chapter 4.' },
  { title: 'Rough numbers about your business', why: 'Hours you work a week, what you charge, what a normal month costs. Guesses are fine — there is a “Not sure” button for every number.' },
];

// The one pattern every step follows. Shown on both pages.
export const LOOP = [
  { title: 'Answer a few questions', text: 'Each step starts with 2–5 boxes to fill in. Blanks are fine. Devin already knows what you told it earlier.' },
  { title: 'Click the big black button', text: 'It says “Write it with Devin”. Then wait. Watch the chat on the right — Devin sometimes asks you one question first. Type your answer there and press Send.' },
  { title: 'Read it, then ask for changes', text: 'Your finished document appears under the button. Don’t like something? Type in the chat: “shorter”, “sound more like me”, “add a gift-card option”. Devin rewrites it.' },
];

// What you leave with — the short version for the public page.
export const OUTCOMES = [
  ['Your offer', 'One deal so clear and fair that the right customer says yes. Written out, with a price, a guarantee and a one-line pitch.'],
  ['What your customers say online', 'Real quotes from reviews and forums, in their words, so your posts sound like them.'],
  ['Getting found on Google', 'The exact fixes for your website and Google listing, and a script for asking for reviews.'],
  ['A plan', 'Which 2–3 places to show up, what to say, and 3 numbers to check every week.'],
  ['Ready-to-post content', 'Posts, 3 emails and 2 ads, written in your voice. Copy, paste, post.'],
  ['A presenter video', 'A short video of an avatar reading your script. Made in HeyGen, saved here.'],
  ['A calendar', 'Every post on a date for the next 30 days. Tick them off as you go.'],
  ['Time savers', '5 things you can stop doing by hand, with the setup steps.'],
  ['A lead tracker and a form', 'Every call, message and sale in one list — and a link customers can fill in that lands in it.'],
  ['Your action plan', 'What to do in the first 7 days and every week after.'],
];

// The full, chapter-by-chapter guide (in-app Help page).
export const CHAPTERS = [
  {
    id: 'account', n: 1, title: 'Create your account and sign in', time: '5 minutes',
    intro: 'Studio is a website. Your work is saved in your own account, so you can come back from any computer or phone.',
    parts: [
      {
        heading: 'Open the website',
        image: img('01-landing.png', 'The front page of Studio with the Start your sprint button', ['The big “Start your sprint” button', '“Sign in” for people who already have an account']),
        steps: ['Open your internet browser (Chrome, Safari or Edge).', 'Type the Studio web address your facilitator gave you into the bar at the top, then press Enter.', 'You see this page. Click **Start your sprint** (mark 1).'],
      },
      {
        heading: 'Create your account',
        image: img('02-login-create.png', 'The sign-in card with the Create account tab selected', ['The “Create account” tab', 'Email box', 'Password box', '“Create account” button']),
        steps: ['Click the **Create account** tab (mark 1) so it turns dark.', 'Click in the **Email** box (mark 2) and type your email address. Check the spelling.', 'Click in the **Password** box (mark 3) and type the password you wrote down. At least 8 characters.', 'Click **Create account** (mark 4).'],
      },
      {
        heading: 'Go to your email and click the link',
        image: img('03-login-check-email.png', 'The message: Check your email for a confirmation link, then sign in', ['The message telling you to check your email']),
        steps: ['You see “Check your email for a confirmation link, then sign in.” (mark 1). Nothing else happens on this page yet — that is normal.', 'Open a new tab and go to your email (for example gmail.com), or open the email app on your phone.', 'Look for a new message with “Confirm” in the subject. Give it up to 2 minutes. Check the Spam or Junk folder too.', 'Open the message and click the link or button inside it. A page opens that says your email is confirmed. You can close that page.', 'Go back to the Studio tab.'],
        expect: 'Your account now exists. You only do this once. Next time you just sign in.',
      },
      {
        heading: 'Sign in',
        image: img('04-login-signin.png', 'The sign-in card with the Sign in tab selected and the fields filled in', ['Email box', 'Password box', '“Sign in” button']),
        steps: ['Click the **Sign in** tab if it is not already dark.', 'Type the same email (mark 1) and the same password (mark 2).', 'Click **Sign in** (mark 3).', 'Wait a few seconds. The page changes to your workspace with a grey list down the left side.'],
      },
    ],
    stuck: [
      ['“Wrong email or password.”', 'Type the password again slowly. Capital letters matter. If you created the account with a different email, use that one.'],
      ['“That email already has an account. Sign in instead.”', 'Good news — you already made the account. Click the Sign in tab and use your password.'],
      ['“Too many sign-ups from this network right now.”', 'The room is sharing one internet connection and many people signed up at once. Wait one minute and click again.'],
      ['“Too many sign-up emails went out in the last hour.”', 'Wait a few minutes and try Create account again. If you already clicked the email link, just Sign in.'],
      ['No email arrived.', 'Check Spam/Junk. Check you typed the email correctly. Wait 2 minutes. Then try Create account again.'],
      ['I forgot my password.', 'There is no “forgot password” button yet. Ask your facilitator to help you reset it.'],
    ],
  },
  {
    id: 'screen', n: 2, title: 'Know your screen', time: '3 minutes',
    intro: 'Every page in Studio has the same three parts. Once you know them, every step feels the same.',
    parts: [
      {
        heading: 'The three parts',
        image: img('09-anatomy.png', 'A step page: list on the left, questions and button in the middle, chat on the right', ['The list of steps (left)', 'The questions for this step (middle)', 'The big black “Write it with Devin” button', 'The chat box where you talk to Devin (right)', 'The “How to do this step” box: how long it takes and what done looks like']),
        steps: ['**Left**: the list of all 11 steps (mark 1). Click any step name to open it. A tick ✓ means it is done.', '**Middle**: the questions (mark 2) and the big black button (mark 3). Your finished document appears below the button.', '**Right**: the chat (mark 4). Devin writes here. You type here. Press Enter to send.', 'Open **How to do this step** (mark 5) on any step to see how long it takes, why it matters and what “done” looks like.'],
      },
      {
        heading: 'Your progress',
        image: img('28-progress.png', 'The left column: countdown, progress bar and ticked steps', ['The progress bar: how many of the 11 steps are done', 'A finished step shows a tick', 'Days left in your 30-day sprint']),
        steps: ['The bar (mark 1) fills up as you finish steps.', 'Finished steps get a tick (mark 2).', 'The big number (mark 3) counts down the days left in your sprint.'],
      },
      {
        heading: 'The bottom of the left column',
        image: img('27-rail-foot.png', 'Download my sprint, Setup and Sign out at the bottom of the left column', ['“Download my sprint” — saves everything as one file', '“Setup” — where your Devin and HeyGen accounts connect. Red dot = something is missing', '“Sign out” when you are done on a shared computer']),
        steps: ['**Download my sprint** (mark 1) saves every document as one file on your computer.', '**Setup** (mark 2) is where you connect Devin and HeyGen. A red dot means something is still missing.', '**Sign out** (mark 3) before you leave a shared computer.'],
      },
    ],
    stuck: [
      ['I can’t see the chat on the right.', 'Make the window bigger, or zoom out: hold Ctrl (or ⌘ on Mac) and press the minus key.'],
      ['The page looks empty or broken.', 'Press the reload button (circle arrow) at the top of the browser. Your work is saved.'],
    ],
  },
  {
    id: 'devin', n: 3, title: 'Connect your Devin account', time: '10 minutes',
    intro: 'Devin is the AI that does the writing. Studio needs two codes from your Devin account so it can work for you. You copy them once; Studio keeps them safe and never shows them again.',
    parts: [
      {
        heading: 'See what Studio needs',
        image: img('05-setup-needed.png', 'The Setup page asking for a Devin key and Organization ID', ['“Open Devin settings” — opens Devin in a new tab', 'Where the key (cog_…) goes', 'Where the Organization ID goes', '“Save”']),
        steps: ['Click **Setup** at the bottom of the left column.', 'You see “Add your Devin key and Org ID to start.” Two empty boxes are waiting (marks 2 and 3).', 'Click **Open Devin settings** (mark 1). Devin opens in a new tab. Keep the Studio tab open — you will come back to it.'],
      },
      {
        heading: 'Make a Devin account (first time only)',
        image: img('ext/devin-signup.png', 'Devin’s sign-up page with Continue with Google, GitHub, ChatGPT or email'),
        steps: ['If Devin asks you to sign up, the easiest way is **Continue with Google** if you have a Gmail address. Click it, pick your Google account, and say yes.', 'No Gmail? Type your email in the **Email address** box, tick the box about the Terms, and click **Sign up**. Then check your email and click the link, just like in Chapter 1.', 'Only click **Continue with GitHub** if someone told you to. GitHub is a website for programmers; you probably don’t have an account there.', 'Follow Devin’s welcome screens. If it asks about “repositories” or “connecting code”, click Skip — you don’t need any of that.'],
        expect: 'You end up inside Devin, signed in. It may offer a free trial or ask you to pick a plan — Studio uses a small amount of Devin usage per step.',
      },
      {
        heading: 'Find the Devin API page',
        image: img('ext/devin-settings-api.png', 'Illustration of Devin’s Settings → Devin API page: the Organization ID at the top and a Create key button', ['Settings in the left menu', 'The “Devin API” page', 'Your Organization ID, at the top', 'The “Create” / “Provision” button that makes a key']),
        steps: ['In Devin, find **Settings** (mark 1). It is usually in the left menu or under your name/picture.', 'In Settings, click **Devin API** (mark 2).', 'At the top of that page is your **Organization ID** (mark 3). It is a block of letters and numbers.', 'Click the small copy icon next to it, or highlight it and press Ctrl+C (⌘+C on Mac).', 'Go back to the Studio tab and paste it into the **Organization ID** box (Ctrl+V or ⌘+V). Then come back to the Devin tab.'],
        note: 'This picture is a drawing of the page, not a photo — Devin changes its look now and then. The words “Devin API”, “Organization ID” and “cog_” stay the same.',
      },
      {
        heading: 'Make your key and copy it',
        image: img('ext/devin-key-dialog.png', 'Illustration of the pop-up that shows a new key starting with cog_, with a copy button', ['The new key — it starts with cog_', 'The copy button']),
        steps: ['On the Devin API page, look for a tab called **Service users** or **Personal access tokens (PATs)**. Either works.', 'Click **Create** / **Provision** (the exact word changes). Give it any name, for example “Studio”. If it asks for a role, choose **Member**.', 'A pop-up shows your new key (mark 1). It starts with **cog_**. Click the copy button (mark 2). **This is the only time Devin shows it** — if you lose it, just make a new one.', 'Go back to the Studio tab. Click in the **Devin API key** box and paste (Ctrl+V or ⌘+V). It shows as dots — that is normal.', 'Click **Save**.'],
      },
      {
        heading: 'Check it worked',
        image: img('06-setup-ready.png', 'The Setup page saying Everything’s ready with a Start with your profile button', ['“Everything’s ready.”', '“Start with your profile”']),
        steps: ['The page now says **Everything’s ready.** (mark 1) and the dot next to Devin is green.', 'Click **Start with your profile** (mark 2).'],
        expect: 'You never need to do this again on this account. The key is stored encrypted and is never shown to you or anyone else.',
      },
    ],
    stuck: [
      ['I pasted the key but Save is grey.', 'Both boxes need something in them. Fill in the Organization ID too.'],
      ['I closed the pop-up before copying the key.', 'That key is gone, but it is harmless. Make a new one: click Create again, copy it this time.'],
      ['The key I copied starts with apk_.', 'That is an old kind of key. Go to Settings → Devin API and make a new one — it must start with cog_.'],
      ['Setup says “Using the workshop’s shared Devin account”.', 'Your facilitator set Devin up for everyone. You can skip this whole chapter.'],
      ['Devin says I have no credits / usage left.', 'Studio runs on your Devin plan. Open Devin and check your plan or billing page, or ask your facilitator.'],
    ],
  },
  {
    id: 'heygen', n: 4, title: 'Connect HeyGen (for the video step)', time: '15 minutes, plus 10–20 minutes of waiting',
    intro: 'HeyGen turns a written script into a video of a presenter. You can skip this chapter now and come back when you reach step 7, Promo videos.',
    parts: [
      {
        heading: 'Make a HeyGen account',
        steps: ['Open a new tab and go to **app.heygen.com**.', 'Click **Sign up**. Use **Continue with Google** if you have Gmail, or type your email and make a password (write it down).', 'Check your email and click the confirmation link if HeyGen sends one.', 'The free plan is enough for your first video.'],
      },
      {
        heading: 'Make your avatar — your digital presenter',
        image: img('ext/heygen-new-avatar.gif', 'HeyGen: the Avatars section with the New Avatar button and the choice to clone a real person'),
        steps: ['In HeyGen, click **Avatars** in the left menu, then **New Avatar** (or **Create Avatar**).', 'Choose **Clone a Real Person** to make an avatar of yourself. You can record on your webcam right there, or upload a video from your phone.', 'Record **2 minutes** of yourself talking to the camera. Good light, quiet room, plain background, look at the lens, keep talking — no cuts.', 'HeyGen then asks for a short **consent video**: you read one sentence to the camera saying you agree. This is normal and required.', 'Click finish. HeyGen builds your avatar. **This takes 10–20 minutes.** You can go do other steps in Studio meanwhile.', 'Don’t want to be on camera? Skip this and use one of HeyGen’s ready-made presenters in step 7 instead.'],
        note: 'Pictures in this part come from HeyGen’s own help pages, so they may look slightly different from what you see.',
      },
      {
        heading: 'Connect HeyGen to Studio',
        image: img('07-setup-heygen.png', 'The Setup page with a Connect HeyGen button', ['“Connect HeyGen”']),
        steps: ['Back in Studio, click **Setup** at the bottom left.', 'Find the **HeyGen** row and click **Connect HeyGen** (mark 1).', 'A small HeyGen window opens. Sign in if asked, then click **Allow** (or **Authorize**).', 'The window closes by itself. The HeyGen row now says **Connected as** your email.'],
      },
    ],
    stuck: [
      ['The small window never opened.', 'Your browser blocked a pop-up. Look for a small icon at the right end of the address bar, click it and choose Always allow. Then click Connect HeyGen again.'],
      ['Studio says “No avatars in your HeyGen account yet.”', 'Your avatar is still building, or you haven’t made one. Wait, or pick a ready-made presenter in HeyGen first.'],
      ['HeyGen rejected my video.', 'Usually: cuts in the video, face not fully visible, or too dark. Record again in one go, facing a window.'],
    ],
  },
  {
    id: 'start', n: 5, title: 'Start here and the Business Brain', time: '30–45 minutes',
    intro: 'The Business Brain is a set of questions about your business — what you sell, what it costs, how much you can handle. Every later step reads from it, so good answers here mean better writing everywhere.',
    parts: [
      {
        heading: 'The Start here page',
        image: img('08-start-here.png', 'The Start here page with the Fill in your Business Brain button', ['“Start here” in the left list', '“Fill in your Business Brain”', 'How every step works — the 3 things you do on each step']),
        steps: ['Click **Start here** (mark 1) any time you feel lost. It shows the whole day.', 'Read **How every step works** (mark 3). It is the same three moves on every step.', 'Click **Fill in your Business Brain** (mark 2).'],
      },
      {
        heading: 'Answer the required sections',
        image: img('10-brain.png', 'The Business Brain page with its sections, the Known / Estimate / Help me buttons and the required chip', ['A section — click its name to open or close it', 'Under every answer: Known, Estimate or Help me work this out', 'The “required” label — do these four sections first']),
        steps: ['Four sections say **required** (mark 3): Business basics, Prices and costs, Capacity and cash, Campaign goals. Do those first. The others can wait.', 'Click a section name (mark 1) to open it. Fill in what you can. Questions with a red * are the important ones.', 'Under each answer, click one of the three small buttons (mark 2): **Known** if it is a real number, **Estimate** if it is a guess, **Help me work this out** if you have no idea. Devin treats guesses as guesses.', 'In **Prices and costs**, fill in the table for ONE product or service you want to sell more of — not your whole menu.', 'Your answers save by themselves as you type. The “Your numbers” box at the bottom updates live: earnings per sale, how many sales to break even, and red warnings if a price loses money.'],
      },
      {
        heading: 'Let Devin help with the numbers',
        image: img('11-brain-actions.png', 'The buttons at the bottom of the Business Brain: Save, Work out with Devin, Review my Business Brain', ['“Save”', '“Review my Business Brain”', '“Work out … answers with Devin” — appears when you tagged something Help me']),
        steps: ['If you tagged anything **Help me work this out**, a button appears: **Work out N answers with Devin** (mark 3). Click it. Devin asks you simple questions in the chat; answer them and it fills in the numbers for you to check.', 'When the four required sections show a ✓, click **Review my Business Brain** (mark 2). Devin reads everything and writes a short review of what is strong and what is missing. Read it.'],
        expect: 'In the left list, Business Brain shows ✓. Now the real steps begin.',
      },
    ],
    stuck: [
      ['I don’t know a number.', 'Click “Help me work this out” under it. Then use the Work out with Devin button. Guessing is fine; lying to yourself with $0 for your own time is not.'],
      ['It says my price loses money.', 'That is the point of this page. Devin will suggest a better price in the Offer step. Keep going.'],
      ['My answers disappeared.', 'They save every second or two. Reload the page. If they are really gone, your internet dropped while typing — type them again.'],
    ],
  },
  {
    id: 'profile', n: 6, title: 'Step 1 — Business profile', time: '20 minutes',
    intro: 'The basics in plain words: your name, what you sell, who buys, and your rough numbers. Some of these are already filled in from the Business Brain.',
    parts: [
      {
        heading: 'Fill it in and save',
        image: img('12-profile.png', 'The Business profile form with Not sure buttons next to the numbers and a Save profile button', ['“Not sure” — click it when you don’t know a number', '“Save profile”']),
        steps: ['Click **Business profile** in the left list.', 'Type your **Business name** — this is the only box you must fill.', 'Fill in the rest like you would explain your business to a new employee. Real numbers beat adjectives: “4.9 stars from 310 reviews” beats “highly rated”.', 'For any number you don’t know, click **Not sure** next to it (mark 1). A button appears to **Work out N with Devin** — click it and answer Devin in the chat.', 'Click **Save profile** (mark 2). You see “Saved. Devin will use this in every step.”', 'Click **Next: Core offer**.'],
      },
    ],
    stuck: [
      ['Save profile is grey.', 'Type a Business name first, or you haven’t changed anything since the last save.'],
    ],
  },
  {
    id: 'offer', n: 7, title: 'Step 2 — Your offer (and how every writing step works)', time: '60 minutes',
    intro: 'This is the most important step. Everything after it — posts, emails, videos — sells this offer. It is also the first step where Devin writes for you, so take it slowly; every later step works exactly the same way.',
    parts: [
      {
        heading: 'Answer the questions and press the button',
        image: img('13-offer-empty.png', 'The Core offer step before anything is written: three questions and the Write it with Devin button', ['What you want to sell more of', 'Your typical price range', 'The campaign dates', '“Write it with Devin”']),
        steps: ['Type what you want to sell more of (mark 1), your usual price (mark 2) and the dates (mark 3). Short answers are fine.', 'Click **Write it with Devin** (mark 4). The button changes to “Devin is writing…”.', 'Now look at the chat on the right.'],
      },
      {
        heading: 'Devin may ask you a question — answer it in the chat',
        image: img('14-chat-question.png', 'The chat: Devin asks a short question and waits; the reply box and Send button are at the bottom', ['Devin’s question', 'The box where you type your answer', '“Send”']),
        steps: ['First you see “Devin is starting up — this takes a minute or two.” Wait.', 'Devin often asks ONE short question first (mark 1), like “Do you offer a warranty on brake work today?”', 'Click in the box at the bottom (mark 2), type your answer in plain words, and click **Send** (mark 3) or press Enter.', '**Nothing happens until you answer.** If the step seems stuck, check the chat — Devin is probably waiting for you.', 'Then wait 2–5 minutes. Three dots in the chat mean Devin is working. You can’t start another step while it works — the other buttons are grey until it is done.'],
      },
      {
        heading: 'Read it, change it, move on',
        image: img('15-offer-done.png', 'The finished offer document with Copy all, Previous versions, Next and Change the answers buttons', ['“Copy all” — copies the whole document', '“Previous versions” — older copies if you rewrite', '“Next: …” — go to the next step', '“Change the answers and rewrite” — opens the questions again']),
        steps: ['Your offer appears in the middle. Read it top to bottom. Devin gives you 3 options and says which one it recommends.', 'Want changes? Type in the chat, for example: “Make the guarantee something I can afford” or “Pick option 2 and make the pitch shorter”. Devin rewrites and the document updates.', 'Click **Copy all** (mark 1) if you want to paste it into a note or email.', 'Click **Next** (mark 3) when you are happy. You can always come back.'],
        expect: 'Core offer shows ✓ in the left list. From here on, every step is the same three moves: answer, button, chat.',
      },
    ],
    stuck: [
      ['The button is grey and says Devin is busy.', 'Devin is still working on another step. Wait for the three dots in the chat to stop.'],
      ['“Devin is starting up” has been there for 5 minutes.', 'That happens sometimes. Wait another 2 minutes. If still nothing, click New conversation in the chat and press the big button again.'],
      ['The chat shows a red message or a “Restart Devin” button.', 'Click Restart Devin, then press the big button again. Your documents are safe.'],
      ['The document doesn’t sound like me.', 'Tell Devin in the chat. Paste something you wrote before: “Here is a post I wrote last year — rewrite it in this voice.”'],
      ['I want to start the whole document over.', 'Click “Change the answers and rewrite”, edit the answers, then click Rewrite with Devin. The old version is kept under Previous versions.'],
    ],
  },
  {
    id: 'groundwork', n: 8, title: 'Steps 3, 4 and 5 — Research, Get found, Strategy', time: '2 hours total',
    intro: 'Same three moves each time. Here is what to type and what you get.',
    parts: [
      {
        heading: 'Step 3 — Customer conversations (30 min)',
        image: img('16-research.png', 'The finished Customer conversations document', ['The document Devin wrote: where your customers talk, in their own words']),
        steps: ['Type what people search for (“brake repair cost”, “gifts for coworkers”), who you are listening for, and up to 3 competitors.', 'Click **Write it with Devin**. This step takes longer — Devin reads real reviews and forums online. 5–10 minutes.', 'You get: where your customers talk, their exact words, the questions they keep asking, and what NOT to do (no spam, no fake reviews).'],
      },
      {
        heading: 'Step 4 — Get found locally (45 min)',
        image: img('17-visibility.png', 'The finished Get found locally document', ['Website fixes, Google listing fixes and a 30-day checklist']),
        steps: ['Pick whether you have a Google Business Profile, list the services you want to be found for, your city and neighbourhoods.', 'Click **Write it with Devin**. Devin looks at your website and your competitors.', 'You get: exact fixes for your website, what to change on your Google listing, a script for asking for reviews, and a checklist split into today / this week / this month.', 'Do the “today” items before you leave.'],
      },
      {
        heading: 'Step 5 — Strategy & messaging (45 min)',
        image: img('18-strategy.png', 'The Strategy step with growth experiment cards and the Score my experiments button', ['An experiment card — one cheap test with a cost and a target', '“Score my experiments with Devin” — use it weekly once you have leads']),
        steps: ['Type your 30-day goal, your budget (even $0), and tick where you reach customers today.', 'Click **Write it with Devin**.', 'You get: the 2–3 places to focus on, what to say, and 3 numbers to check weekly. Below the document, 3–5 **experiment cards** appear (mark 1) — small cheap tests with a clear rule for when to stop or do more.', 'Later, during your campaign, come back and click **Score my experiments with Devin** (mark 2). It tells you which tests are working.'],
      },
    ],
    stuck: [
      ['Research took a long time.', 'Normal. Devin is reading real pages. Up to 10 minutes.'],
      ['The document says “(assumed)” in places.', 'Devin guessed because an earlier step was empty. Fill in that step, then click Rewrite here.'],
      ['A yellow note says an earlier step changed.', 'You changed your offer or profile after this was written. Click Rewrite with Devin to bring it in line — or ignore it if the change was small.'],
    ],
  },
  {
    id: 'content', n: 9, title: 'Step 6 — Content kit', time: '45 minutes',
    intro: 'Ready-to-post captions, emails and ads in your voice. Write them all now; post them later.',
    parts: [
      {
        heading: 'Pick your channels and write',
        image: img('19-content.png', 'The finished Content kit with the Copy all button', ['“Copy all”']),
        steps: ['Tick the places you will post (Facebook, Instagram, Google Business Profile, email…). Tick **Facebook** or **Instagram** if you want a video in the next step.', 'Describe your voice in a few words: “warm, a little funny, never pushy”. List words to avoid.', 'Click **Write it with Devin**.', 'You get 3–5 posts per channel, 3 emails (launch, reminder, last chance) and 2 short ads. Everything is ready to paste — only “[link]” needs replacing with your own link.', 'To use a post: highlight it, copy (Ctrl+C / ⌘+C), open Facebook or Instagram, paste (Ctrl+V / ⌘+V). Or click **Copy all** (mark 1) and paste everything into your phone’s notes.'],
      },
    ],
    stuck: [
      ['The hooks are too long.', 'Type in the chat: “Make the hooks shorter; people scroll fast.”'],
      ['It sounds like an ad, not like me.', 'Paste a caption you wrote before into the chat and say “rewrite post 2 like this”.'],
    ],
  },
  {
    id: 'video', n: 10, title: 'Step 7 — Promo video', time: '45 minutes',
    intro: 'Turn one of your posts into a short spoken video with a presenter. Needs HeyGen connected (Chapter 4).',
    parts: [
      {
        heading: 'Pick a post',
        image: img('20-video-kit.png', 'The Promo videos step with posts from your content kit to choose from', ['A post from your content kit — click it to turn it into a video', 'Or name a brand-new video here', '“Write the script with Devin” — if you want a fresh script instead']),
        steps: ['Click **Promo videos** in the left list.', 'Under **From your content kit**, click a Facebook or Instagram post (mark 1). The script is filled in for you.'],
      },
      {
        heading: 'Choose a presenter, check the script, press Generate',
        image: img('21-video-make.png', 'Make an avatar video: choose an avatar, edit the script, pick a shape, click Generate', ['Your avatars — click one', 'The script the presenter will say', 'The shape: tall for Reels and TikTok, square for feed posts, wide for YouTube', '“Generate”', '“Polish with Devin” — makes the script smoother']),
        steps: ['Click the avatar you want (mark 1). Your own avatar is here if you made one in HeyGen.', 'Read the script (mark 2). Change any words you like. Want it smoother? Click **Polish with Devin** (mark 5) and watch the chat.', 'Pick the shape (mark 3): **Vertical** for Reels, Stories and TikTok; **Square** for feed posts; **Wide** for YouTube or your website.', 'Click **Generate** (mark 4).', '**Keep this page open.** The button says “HeyGen is making it…” for 1–5 minutes. This uses a few HeyGen credits from your account.'],
      },
      {
        heading: 'Watch it and download it',
        image: img('22-video-done.png', 'Your videos: the finished video with a Download link', ['Your finished video — press play', '“Download” saves the file to your computer']),
        steps: ['The video appears under **Your videos** (mark 1). Press play to watch it.', 'Click **Download** (mark 2) to save it to your computer or phone, then upload it to Facebook or Instagram like any other video.', 'Studio also attaches it to that post in your calendar automatically.'],
      },
    ],
    stuck: [
      ['It says Connect HeyGen.', 'Go to Chapter 4. Click the Connect HeyGen button right there in the message.'],
      ['“No avatars in your HeyGen account yet.”', 'Your avatar is still building (10–20 min) or you skipped making one. Open app.heygen.com, finish the avatar, come back and reload.'],
      ['I closed the page while it was making the video.', 'The video still finishes in HeyGen. Come back, click “Import from HeyGen”, and click the video to pull it in.'],
      ['No Facebook or Instagram posts appear.', 'Go back to Content kit, tick Facebook or Instagram under “Write for”, and click Rewrite.'],
    ],
  },
  {
    id: 'launch', n: 11, title: 'Steps 8, 9 and 10 — Calendar, Automate, Lead tracker', time: '65 minutes total',
    intro: 'Now you line everything up on dates, hand chores to tools, and set up the list where every customer lands.',
    parts: [
      {
        heading: 'Step 8 — Campaign calendar (30 min)',
        image: img('23-calendar.png', 'The calendar: a week list with checkboxes, an opened item with its text and a Copy button', ['Tick the box when you have posted it', 'The full text of the post — ready to paste', '“Copy”', '“Change the answers and rewrite” if you need a different pace']),
        steps: ['Pick a start date, how long (30 days is good) and how often you can really post. Pick the pace you can keep on your worst week.', 'Click **Write it with Devin**. Every post and email lands on a date.', 'Each morning of your campaign: open this page, click today’s item to open it (mark 2), click **Copy** (mark 3), paste it into Facebook/Instagram/email, then tick the box (mark 1).'],
      },
      {
        heading: 'Step 9 — Automate it (20 min)',
        image: img('24-automation.png', 'The finished Automate it document', ['Five time-savers, ranked by hours saved']),
        steps: ['List the tools you already use (Gmail, Square, Instagram…) and what eats your time every week.', 'Click **Write it with Devin**.', 'You get 5 things to automate, ranked, with the setup steps and the auto-reply text already written. Start with ONE this week.'],
      },
      {
        heading: 'Step 10 — Lead tracker and your customer form (15 min)',
        image: img('25-tracker.png', 'The Lead tracker: the form link, Add a lead, Ask Devin what to do next, and the table of leads', ['Your form link — share it or print it as a QR code', '“Copy link”', '“Add a lead” — adds a new row', '“Ask Devin what to do next”', 'The stage of each lead: Lead → Contacted → Quoted → Won or Lost']),
        steps: ['**Your form link** (mark 1) is a simple web page where a customer types their name, phone and question. Anything they send lands in this list by itself. Click **Copy link** (mark 2) and paste it into your Instagram bio, your website, or make a QR code for the counter.', 'Every time someone calls or messages you, click **Add a lead** (mark 3) and type their name, how they found you, and a note. 20 seconds. It saves itself.', 'As things move, change the **Stage** (mark 5) — Contacted, Quoted, Won, Lost — and type the sale amount when you win.', 'Once a week, click **Ask Devin what to do next** (mark 4). It tells you who to follow up with today and what to say.'],
      },
    ],
    stuck: [
      ['A calendar item won’t open.', 'A yellow note may say some items couldn’t be read. Type in the chat: “Fix the calendar so every item has a date and a title.”'],
      ['I need to move everything a day later.', 'Type in the chat: “Move everything after week 2 one day later.”'],
      ['Someone filled in the form but I don’t see them.', 'Reload the page. New form entries appear at the top of the list with Source = Website.'],
    ],
  },
  {
    id: 'plan', n: 12, title: 'Step 11 — Action plan, then take it home', time: '30 minutes',
    intro: 'The workshop ends today; your campaign doesn’t. This is what you follow next week.',
    parts: [
      {
        heading: 'Write your action plan',
        image: img('26-action-plan.png', 'The finished Action plan with Download my sprint in the left column', ['Your 7-day launch checklist and weekly routine', '“Download my sprint”']),
        steps: ['Type how many hours a week you can really give this, your launch date, and who is helping.', 'Click **Write it with Devin**.', 'You get a 7-day checklist (each item under an hour), a weekly routine that fits your hours, the 3 numbers to look at every week, and a check-in date. Put that date in your phone’s calendar now.'],
      },
      {
        heading: 'Take everything home',
        steps: ['Click **Download my sprint** at the bottom of the left column (mark 2 in the picture above). One file with every document saves to your Downloads folder. Email it to yourself.', 'Everything stays in your account too. At home, go to the same web address, click **Sign in**, and carry on.', 'On a shared computer, click **Sign out** before you leave.'],
      },
    ],
    stuck: [
      ['The downloaded file won’t open.', 'It is a plain text file ending in .md. Open it with Notes, TextEdit, Word or Google Docs — right-click it and choose Open with.'],
    ],
  },
  {
    id: 'daily', n: 13, title: 'During your 30 days', time: '15 minutes a day',
    intro: 'The daily and weekly habit that makes the plan actually happen.',
    parts: [
      {
        heading: 'Every day',
        steps: ['Open Studio → **Campaign calendar**. Click today’s item, **Copy**, paste it where it goes, tick the box.', 'Someone called or messaged? **Lead tracker** → **Add a lead**. Same day.'],
      },
      {
        heading: 'Every week',
        steps: ['**Lead tracker** → **Ask Devin what to do next**. Follow up with the people it names.', '**Strategy & messaging** → **Score my experiments with Devin**. Stop the tests it says to stop; do more of the ones that work.', 'Look at the 3 numbers from your action plan. If one is flat, the plan says what to change.'],
      },
      {
        heading: 'Any time',
        steps: ['Changed your mind about your offer? Open **Core offer**, click **Change the answers and rewrite**. Later steps show a yellow note so you can rewrite them too.', 'Lost? Click **Start here**.'],
      },
    ],
    stuck: [
      ['The chat says “Working” but I didn’t ask for anything.', 'Devin is finishing something from earlier. Wait, or click New conversation.'],
      ['Studio seems slow or says “try again in a moment”.', 'Devin is busy for everyone right now. Wait a minute. Your work is saved.'],
    ],
  },
];

// The short public version: one line per chapter, pointing into the full guide.
export const SHORT_CHAPTERS = CHAPTERS.map(c => {
  const images = c.parts.map(p => p.image).filter(Boolean);
  return { id: c.id, n: c.n, title: c.title, time: c.time, intro: c.intro, image: images.find(i => !i.src.includes('/ext/')) || images[0] || null };
});
