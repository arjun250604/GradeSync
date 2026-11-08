# 🎓 GradeSync — Student Academic Planner & GPA Calculator

> A zero-friction, modern academic command center for college students to track grades, calculate SGPA/CGPA in real time, manage coursework deadlines with a Kanban board, and visualize weekly schedules.

---

## 🌟 Key Features

- **📊 Real-Time SGPA / CGPA Engine**:
  - Credit-weighted SGPA calculation per semester with course CRUD.
  - Multi-semester cumulative CGPA scorecards with circular SVG progress rings.
  - **Target CGPA Estimator**: computes the required average SGPA for remaining semesters.
  - Support for 10-point (standard) and 4-point GPA scales with grade-scale reference tables.

- **📋 Kanban Assignment & Exam Tracker**:
  - Visual columns: *To Do*, *In Progress*, and *Done*.
  - Color-coded priority badges (High, Medium, Low) and task category tags.
  - **48-Hour Urgent Alert Banner** and overdue deadline badges.

- **📅 Weekly Timetable Visualizer**:
  - Monday–Saturday class schedule grid.
  - **"Today's Agenda"** widget with active status detection for ongoing lectures based on system time.

- **🔐 Dual Authentication & Persistence**:
  - **Supabase Auth SDK v2**: Cloud-synced user accounts with email & password authentication.
  - **Guest Mode Fallback**: Instant local operation using `localStorage` without backend dependencies.

- **💾 Data Portability**:
  - One-click JSON backup export and restore.
  - "Load Presentation Demo Data" button for rapid evaluation and demonstrations.
  - Full **Dark Mode** toggle with persistent user preference.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Modern Modular JavaScript (ES6+), Tailwind CSS (via CDN)
- **Icons & Typography**: FontAwesome 6, Google Fonts (*Inter*)
- **Backend / Auth**: Supabase JS SDK v2 & LocalStorage API

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/GradeSync.git
cd GradeSync
```

### 2. Run the application
Open `index.html` in any modern web browser or serve it with a local web server:
```bash
npx serve .
```

### 3. (Optional) Configure Supabase Cloud Sync
1. Create a free project at [supabase.com](https://supabase.com).
2. Copy your **Project URL** and **Public/Anon Key** from *Project Settings → API*.
3. Add them in `js/auth.js`:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_PUBLIC_KEY';
```
*(Or simply click **Continue as Guest** to run entirely in local mode!)*

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
