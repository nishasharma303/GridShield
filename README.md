# ⚡ GridShield
### Renewable Grid Risk Intelligence System

---

## 🌍 Overview

**GridShield+** is a full-stack web application that helps power grid operators understand and manage the risk caused by fluctuating renewable energy (solar, wind, hydro).

Instead of just showing generation data, the system answers:

> **Is today a risky day for the grid? Why? What should we do?**

It transforms raw renewable energy inputs into **actionable operational decisions**.

---

## 🚨 Problem

Renewable energy is highly variable:
- Solar drops due to clouds or seasonal changes  
- Wind fluctuates unpredictably  
- Hydro depends on reservoir levels  

Grid operators must:
- Maintain supply-demand balance  
- Avoid outages  
- Arrange backup power  

Currently, this process is:
- Manual  
- Reactive  
- Based on experience  

---

## ✅ Solution

GridShield+ provides a **real-time decision support system**.

Given today’s renewable generation values, it instantly provides:

- ⚠️ Risk level (Low / Medium / High / Critical)  
- 📊 Probability of grid stress  
- ⚡ Safe renewable energy to dispatch  
- 🔋 Backup power required  
- 🧠 Reasons behind the risk  
- 🔁 Actions to reduce the risk  

---

## 🧠 Core Functionality

### 1. 🎯 Risk Prediction

Users input:
- Solar generation (MU)
- Wind generation (MU)
- Hydro generation (MU)
- Optional demand and weather

System outputs:
- Risk probability  
- Risk category  

---

### 2. ⚡ Dispatch Recommendation

Automatically calculates:

- **Safe RE Dispatch** → how much renewable energy can be used safely  
- **RE Buffer** → energy to hold back  
- **Backup Requirement** → additional power needed  

This helps operators take immediate action.

---

### 3. 🔍 Risk Explanation

The system identifies *why* risk is high.

Examples:
- Total renewable energy is too low  
- Hydro generation is weak  
- Solar is below seasonal expectations  
- Demand is too high compared to supply  

Only relevant factors are shown dynamically.

---

### 4. 🔁 What-If Analysis

Users can simulate improvements like:
- Increasing total renewable energy  
- Improving hydro or solar  
- Reducing volatility  

System shows:
- Updated probability  
- Risk reduction impact  

---

### 5. 📊 Historical Insights

- Uses 5 years of real data  
- Shows:
  - Region-wise averages  
  - Stress frequency  
  - Renewable trends  

---

### 6. 🗓 Seasonal Planning

- Month-wise stress patterns  
- Renewable availability trends  
- Operational recommendations  

Example:
- Winter → plan backup  
- Monsoon → maximize renewables  

---

### 7. 🧪 Scenario Simulation

Users can test hypothetical situations:
- Peak summer  
- Monsoon  
- Worst-case scenario  
- Optimal conditions  

Helps understand system behavior under different conditions.

---

## 🏗️ Architecture

### Backend
- FastAPI server
- REST APIs
- Risk scoring engine
- Data processing

### Frontend
- React (Vite)
- TailwindCSS
- Interactive UI components
- Charts and visualizations

### Data & Logic
- Historical renewable generation data
- Rule-based risk evaluation
- Feature-driven logic derived from ML pipeline

## 📊 Dataset

The project uses real-world renewable energy generation data:

- Source: POSOCO (India’s grid operator)
- Time range: 2017 – 2022
- Regions: North, West, South, East, North-East
- Data includes:
  - Solar generation (MU)
  - Wind generation (MU)
  - Hydro generation (MU)
- Weather data sourced from Open-Meteo (ERA5)

Place all dataset CSV files inside:


---

## ⚙️ Setup & Run


git clone <your-repo-url>
cd gridshield

cd backend
pip install -r requirements.txt
python app/main.py

cd frontend
npm install
npm run dev
