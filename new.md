# **Methodology: Multi-Stage AI Matching and Verification Pipeline**

## **Core Message**

* System integrates multimodal similarity (text + image), adaptive thresholds, and verification layers to reduce false matches and increase confidence.

---

## **Main Pipeline Flow (Left → Right)**

### **1. User Login**

* Identity verified using Google authentication

### **2. Report Submission**

* Lost/found forms with metadata and optional image upload

### **3. Data Normalization**

* Clean text, tokenize fields, standardize inputs

### **4. Text Similarity**

* Field-weighted fuzzy + semantic comparison

### **5. Image Similarity**

* Perceptual hash-based visual matching

### **6. Fusion Scoring**

* Combine text and image scores with adaptive weighting
* Multimodal fusion improves accuracy by combining multiple data types ([Unitlab Blogs][1])

### **7. Verification Workflow**

* Q&A-based ownership validation
* Secure chat between users

### **8. Resolution and Feedback**

* Match closure, audit logging, incentive updates

---

## **Scoring Model (Formula Section)**

### **Text Similarity Score**

[
S_{text} = 0.50,S_{name} + 0.35,S_{description} + 0.15,S_{location}
]

### **Final Score (With Images)**

[
S_{final} = 0.55,S_{image} + 0.45,S_{text}
]

---

## **Threshold Logic**

* **Both images present:**
  ( S_{final} \ge 0.65 )

* **Partial image evidence:**
  ( S_{final} \ge 0.60 )

* **Text-only case:**
  ( S_{final} \ge 0.55 )

* **High-confidence alert:**
  ( S_{final} > 0.75 )

---

## **System Design Rules**

* Anti-false-positive constraint:

  * Same-user reports are never auto-matched

---

## **Visual Design Guidelines**

### **Flow Representation**

* 8 numbered circular nodes:

  * User → Form → Filter → Text → Image → Scale → Shield → Checkmark

### **Color Coding**

* Input Stage: Blue
* AI Scoring Stage: Orange
* Verification & Trust Stage: Green

---

## **Slide Animation Sequence**

1. Show full pipeline (faded)
2. Highlight each stage sequentially (left → right)
3. Reveal scoring formulas
4. Reveal threshold logic table

---

[1]: https://blog.unitlab.ai/multimodal-ai/?utm_source=chatgpt.com "The Ultimate Guide to Multimodal AI [Technical Explanation ..."




# **Implementation: Architecture, Modules, and Deployment**

---

## **System Architecture (Top Half)**

### **Frontend (React + Vite + Firebase Auth)**

* Google authentication (secure login)
* Lost and found submission forms
* Dashboard, match view, chat interface

---

### **Backend API (Flask + Gunicorn)**

* REST endpoints: submit, fetch, match, verify, resolve
* CORS-enabled communication layer
* Error handling and structured logging

---

### **AI Services**

* Text Matcher: field-level weighted scoring
* Image Matcher: perceptual hash comparison
* Fusion Engine: score combination + threshold logic
* Risk & Verification: validation checks and ownership logic

---

### **Storage Layer**

* Collections: lost, found, matches, chats, users
* Structured schema for each entity
* Match lifecycle tracking (pending → verified → resolved)

---

### **Deployment (Render)**

* Frontend hosted as static build
* Backend deployed with Python runtime
* Gunicorn for production serving
* Environment-based API routing

---

## **Architecture Flow (Left → Right)**

Frontend
→ Backend API
→ AI Services
→ Storage
→ Deployment

---

## **Implementation Achievements (Bottom Half)**

* End-to-end workflow: submission → matching → resolution
* Multi-user system with cross-device access
* Verification-driven false match reduction
* Real-time dashboard updates after actions
* Live production deployment with accessible URL

---

## **Screens / Visual Proof to Include**

### **Dashboard Submission (Lost / Found Form)**

![Image](https://s3-alpha.figma.com/hub/file/6430287082/3f56b38f-36c1-45a9-b468-286f2d5feac9-cover.png)

![Image](https://www.researchgate.net/publication/374608419/figure/fig2/AS%3A11431281197510598%401697032107632/FoundeLost-Web-based-System-User-Interface.png)

![Image](https://coreui.io/images/templates/coreui_pro_default_light_dark_hu_58abf253ec9c779b.webp)

---

### **Match Analysis Screen**

![Image](https://cdn.buttercms.com/BNM9D2PvTkapW60J2yMh)

![Image](https://cdn.bap-software.net/2024/12/05053622/SSIM.png)

![Image](https://dashthis.com/media/4921/6-sem-dashboard.png)

---

### **Chat Verification Screen**

![Image](https://cdn.dribbble.com/userupload/15412851/file/original-3b1f6006f60e8310331bc74960317f74.png)

![Image](https://cdn.dribbble.com/users/194964/screenshots/3144295/chat-module.jpg)

![Image](https://cdn.dribbble.com/userupload/46859751/file/47b16e3559619302f243900887aa45a1.png?format=webp\&resize=400x300\&vertical=center)

---

### **Deployment Status (Render Dashboard)**

![Image](https://render.com/docs-assets/f9b00234b56a8a4935bdd7c5df864d3b3a2ab3e8a0ca64af24720272dc873901/select-instance-type.png)

![Image](https://render.com/docs-assets/7473e5151aa94709fc26425483095c391c148df1ac169c8293394557ded7b795/log-explorer.webp)

![Image](https://docs.cloudbees.com/docs/cloudbees-cd/latest/dashboards-built-in/_images/app-deployments.a4b7f8c.png)

---

### **Optional: Firebase Login Success**

![Image](https://firebase.google.com/static/docs/auth/images/firebaseui-android.png)

![Image](https://developers.google.com/static/identity/gsi/web/images/one-tap-ui-fedcm.png)

![Image](https://i.sstatic.net/WOA0X.png)

---

## **Design Structure Guidelines**

* Dark or gradient background with high contrast
* Horizontal card layout with thin connector arrows
* Uniform minimal icons per module
* Max 10–12 words per card
* One accent color per layer:

  * Frontend: Blue
  * Backend: Purple
  * AI: Orange
  * Storage: Gray
  * Deployment: Green
