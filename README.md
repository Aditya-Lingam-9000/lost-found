# Campus Finder - Lost & Found

A modern, secure, and intuitive web platform built for college campuses to help students report and find lost items easily. It is designed to replace campus-wide email blasts by providing a centralized hub where ownership can be verified securely.

## 🚀 Features

- **Marketing Landing Page**: Informational landing page explaining how the platform works and its core benefits.
- **Secure Authentication**: Requires college-issued Google account login via **Firebase Authentication**.
- **Interactive Dashboard**: A centralized hub behind the auth-wall where users can natively report items and view their statuses.
- **Seamless Reporting Forms**: Built-in "Report Lost" and "Report Found" slide-down forms that don't redirect the user.
- **Modern UI/UX**: Clean White, Indigo, and Emerald color scheme, complete with smooth slide-up and fade-in animations.
- **Local Persistence**: Temporarily uses `localStorage` as a mock database to test rendering pending items smoothly before connecting the actual backend.

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Custom Variables, CSS Grid/Flexbox), Vanilla JavaScript `(app.js)`
- **Authentication**: Firebase Google Auth
- **Design System**: Custom built, utilizing the *Poppins* font family.

## ⚙️ Getting Started (Local Development)

### **Important Note on Firebase Auth**
Because Firebase Google OAuth has strict security policies, you **cannot** open the `index.html` file directly from a `file:///` path. It **must** be run on a local server (like `http://localhost` or `http://127.0.0.1`).

### Option 1: VS Code Live Server (Recommended)
1. Install the **[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)** extension in VS Code.
2. Open `frontend/index.html` in your editor.
3. Right-click the code and select **Open with Live Server**.
4. The site will automatically open in your browser at `http://127.0.0.1:5500/frontend/index.html`.
5. Replace that 127.0.0.1:5500 with "localhost"
6. Finally it should be http://localhost:5500/frontend/index.html

### Option 2: Using Node or Python
1. Open your terminal in the project root.
2. Using Node: `npx http-server`
3. Using Python: `python -m http.server`
4. Click the newly generated `http://localhost:8000` link.

## 🔑 Firebase Configuration

The app currently expects a `firebaseConfig.js` file inside `frontend/js/`. 
To use your own Firebase backend:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a Project and enable **Authentication -> Google Sign-In**.
3. Go to project settings -> web app -> grab your config keys.
4. Replace the keys in `frontend/js/firebaseConfig.js`.
5. Under Authentication Settings, ensure `localhost` and `127.0.0.1` are listed as **Authorized Domains**.
