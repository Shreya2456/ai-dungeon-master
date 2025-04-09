# 🧙‍♂️ AI Dungeon Master

An interactive AI-powered Dungeon Master for your fantasy adventures, built using **Vanilla JavaScript**, **HTML**, and **CSS**. The project uses **Vite** as the bundler and is hosted on **Vercel**.

## 🚀 Live Preview

Check out the live version here:  
👉 [AI Dungeon Master Live](https://ai-dungeon-master-one.vercel.app/)  

---

## 🛠 Tech Stack

- **Vite** – Fast and optimized build tool  
- **Vanilla JavaScript** – Logic and interaction  
- **HTML/CSS** – Layout and styling  
- **Vercel** – Deployment platform  
- **Hugging Face API** – AI-generated story responses

---

## 🧑‍💻 Running Locally

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

- Go to [Hugging Face](https://huggingface.co/settings/tokens) and create your own API key.
- Open the `.env.example` file and paste your API key like this:

```
VITE_HF_API_KEY=your_api_key_here
```

- Rename the file from `.env.example` to `.env`:
On linux/unix just write the below command in root directory
```bash
mv .env.example .env
```
For windows manually rename it.

### 4. Start the Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser to explore the AI Dungeon Master!

---

## 🌟 Features

- AI-generated storytelling and adventure responses  
- Simple and clean user interface  
- Fully responsive  
- Easy to customize and extend

---

## 📦 Deployment

This project is deployed using **Vercel**.

---

## 🙌 Contributing

Feel free to fork the repo, add features, or open issues!
