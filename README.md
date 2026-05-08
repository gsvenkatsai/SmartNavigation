# SmartNav - AI Intelligence Layer

This project contains the frontend application and the AI intelligence backend for the **SmartNav** application. It leverages Vite, React, Firebase, and Gemini AI to create a smart, context-aware traffic and routing system.

## Project Structure

The project is structured as a full-stack monolithic application using Vite:

- `src/agents/`: Contains the AI Agents that power the intelligence backend.
  - `reporterAgent.js`: Processes initial user reports.
  - `routeIntelligenceAgent.js`: Analyzes routes for traffic, hazards, and alternative suggestions.
  - `whyAvoidAgent.js`: Generates user-friendly explanations for why certain routes should be avoided.
  - `verificationAgent.js`, `delayAgent.js`, `confidenceAgent.js`: Internal verification, delay estimation, and scoring mechanisms.
- `src/services/`: External service integrations (e.g., `weatherService.js`).
- `src/config/`: Configuration files (`firebase.js`, `gemini.js`).
- `src/utils/`: Shared utilities (`aiUtils.js`).

## Getting Started

### Prerequisites
- Node.js (v18+)
- Docker (optional, but recommended for consistent environments)
- API Keys: Google Gemini API Key and OpenWeather API Key

### Environment Variables
Ensure you have a `.env` file in the root directory with the necessary keys:
```env
VITE_GEMINI_KEY=your_gemini_api_key
VITE_OPENWEATHER_KEY=your_openweather_api_key
```

### Installation with Docker

A `Dockerfile` is provided to easily package and run the app along with its dependencies.

1. **Build the Docker image:**
   ```bash
   docker build -t smartnav-app .
   ```
2. **Run the Docker container:**
   ```bash
   docker run -p 5173:5173 --env-file .env smartnav-app
   ```
The application will be accessible at `http://localhost:5173`.

### Local Installation (Without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the development server:**
   ```bash
   npm run dev
   ```

## Frontend & Backend Integration Guide

For the developers integrating the frontend React UI with the AI backend agents:

1. **Agent Exports**: The primary AI agent functions are exported cleanly from `src/agents/index.js`.
2. **Invoking Agents**: From your frontend components, import and call these functions to trigger AI workflows.
   
   ```javascript
   import { startReporterAgent, runRouteIntelligence, runWhyAvoidAgent } from './agents';

   // Example: Triggering the reporter agent from a UI component
   const handleSubmitReport = async (reportData) => {
     try {
       const result = await startReporterAgent(reportData);
       // Handle the structured JSON response from the agent
       console.log("Agent Processed Output:", result);
     } catch (error) {
       console.error("Agent execution failed:", error);
     }
   };
   ```

3. **Internal vs. External Agents**: 
   - `startReporterAgent`, `runRouteIntelligence`, and `runWhyAvoidAgent` are public entry points designed to be called by the frontend.
   - `delayAgent` and `confidenceAgent` are internal sub-agents. Do not call them directly from the UI. They are orchestrated autonomously by the primary agents.
4. **Data Flow**: The agents are designed to process inputs, query external services (like weather APIs), interact with Gemini models using structured JSON contracts, and update the Firebase database automatically. The frontend should react to these database changes or use the direct responses from the agent function calls.
