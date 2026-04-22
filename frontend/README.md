# Create a React App & Replace Base JSX with current TSX（inside scripts)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js) or yarn
- Your existing `.tsx` file(s) ready

---

## Step 1: Scaffold a New React + TypeScript App

Use **Vite** (recommended over the legacy `create-react-app`):

```bash
npm create vite@latest my-app -- --template react-ts
```

> Replace `my-app` with your desired project name.

This generates a project with TypeScript support out of the box.

---

## Step 2: Navigate Into the Project

```bash
cd my-app
```

---

## Step 3: Install Dependencies

```bash
npm install
```

---

## Step 4: Understand the Default File Structure

```
my-app/
├── public/
├── src/
│   ├── App.jsx          ← Main component (replace this)
│   ├── App.css
│   ├── main.tsx         ← Entry point (keep this)
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── tsconfig.json
├── vite.config.ts
└── package.json
```

The file you'll be replacing is **`src/App.jsx`**.

---
 
## Step 3: Update the Import in main.tsx
 
Open `src/main.tsx` and confirm the import still points to `App`:
 
```tsx
import { useState, useRef, useCallback, useEffect } from "react";
```
 
No change needed — the extension is resolved automatically.
 
---

> Check your TSX file's `import` statements to see what packages are needed.

---

## Step 5: Run the Dev Server

```bash
npm run dev
```

Vite will start a local server, typically at `http://localhost:5173`. Open that URL in your browser to see your component running.

---

## Step 6: Fix Any TypeScript or Import Errors

Check the terminal and browser console for errors. Common issues:

| Issue | Fix |
|---|---|
| `Cannot find module '...'` | Run `npm install <package-name>` |
| `Type error` on props | Add or update TypeScript types/interfaces in your TSX |
| Missing CSS file | Create the CSS file or remove the import |
| `export default` missing | Add `export default` to your component function |

---

## Step 7: Build for Production (When Ready)

```bash
npm run build
```

The output will be in the `dist/` folder, ready to deploy.

---

## Quick Reference Cheatsheet

```bash
npm create vite@latest my-app -- --template react-ts   # 1. Create app
cd my-app                                               # 2. Enter folder
npm install                                             # 3. Install deps
cp /path/to/YourComponent.tsx src/App.tsx               # 4. Replace App.tsx
npm run dev                                             # 5. Start dev server
```
