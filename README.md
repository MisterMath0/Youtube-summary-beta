# YouTube Summary App

 This is a simple web application built with a **Node.js** backend and a **Next.js** frontend. The app allows users to create projects, add YouTube video links, and retrieve summaries and data about those videos. While the AI-driven script generation feature is coming soon, the current version lets you gather useful insights from video metadata.

## Features

- **Dashboard**: The main area of the app where users can manage projects.
- **Project Creation**: Users can create new projects by clicking the **+** icon, naming the project, and adding YouTube videos for analysis.
- **YouTube Video Analysis**: By adding a YouTube video URL, the app uses the **YouTube API** to extract video metadata.
- **Video Summary**: The app will generate a summary of the video transcript (once AI integration is live).

## Technologies Used

- **Frontend**: Built with **Next.js**, a React framework that enables server-side rendering, static site generation, and API routes.
- **Backend**: Powered by **Node.js**, a runtime environment for building scalable server-side applications.
- **YouTube API**: Used to retrieve video metadata, including titles, descriptions, and transcripts.
- **OpenAI API**: Once integrated, it will be used to analyze video transcripts and generate summaries or scripts.
  
## How It Works

1. **Create a Project**: 
   - Navigate to the dashboard and click the **+** icon to create a new project.
   - Name your project to keep things organized.

2. **Add YouTube Videos**:
   - Once the project is created, add YouTube video links.
   - The app will extract the metadata of the video via the **YouTube API**.

3. **Video Summary**:
   - For each video added, the app will use the **YouTube API** to fetch the video’s transcript (if available) and summarize it.
   - The summary feature is currently in progress and will use the **OpenAI API** to analyze and summarize the video transcript.

## APIs Used

- **YouTube API**: 
  - Retrieves video metadata such as title, description, transcript, and more.
  - [Learn more about YouTube API](https://developers.google.com/youtube/v3)

- **OpenAI API**: 
  - Will be used to process and analyze video transcripts to generate summaries and scripts.
  - [Learn more about OpenAI API](https://beta.openai.com/)


## Installation

To run this project locally, follow the steps below:

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/Youtube-summary-beta.git
 
2. Install the dependencies:

  ```bash
  cd YouTube-summary-beta
  npm install
```

3.Create a .env.local file with the following environment variables:
  ```bash
  YOUTUBE_API_KEY=your_youtube_api_key
  OPENAI_API_KEY=your_openai_api_key
```

4. Start the development server:
  ```bash
  npm run dev
```

