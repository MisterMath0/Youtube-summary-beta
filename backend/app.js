const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

const cleanJsonResponse = (jsonString) => {
    return jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
  };

// Helper function to extract video ID from YouTube URL
const getVideoId = (url) => {
    if (!url) return null;
    
    try {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^/?]+)/
        ];
    
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting video ID:', error);
        return null;
    }
};

// Function to get video metadata from YouTube
// Updated getVideoMetadata function
const getVideoMetadata = async (videoId) => {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  try {
    // Fetch video data with essential parts
    const videoResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: videoId,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    if (!videoResponse?.data?.items?.length) {
      throw new Error('Video not found');
    }

    const video = videoResponse.data.items[0];
    const channelId = video.snippet.channelId;

    // Fetch channel statistics
    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'statistics',
        id: channelId,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    if (!channelResponse?.data?.items?.length) {
      throw new Error('Channel not found');
    }

    const channel = channelResponse.data.items[0];

    // Enhanced duration parser
    const parseDuration = (duration) => {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const hours = parseInt(match[1]) || 0;
      const minutes = parseInt(match[2]) || 0;
      const seconds = parseInt(match[3]) || 0;
      
      const timeParts = [];
      if (hours > 0) timeParts.push(hours.toString().padStart(2, '0'));
      timeParts.push(minutes.toString().padStart(2, '0'));
      timeParts.push(seconds.toString().padStart(2, '0'));
      
      return timeParts.join(':').replace(/^00:/, '') || '0:00';
    };

    // Safe number parsing with fallbacks
    const safeParse = (value) => {
      const num = parseInt(value, 10);
      return Number.isNaN(num) ? 0 : num;
    };

    // Structure matches frontend VideoMetadata interface
    return {
      videoId: String(videoId),
      url: `https://youtube.com/watch?v=${videoId}`,
      title: video.snippet.title || 'Untitled Video',
      thumbnail: video.snippet.thumbnails?.medium?.url || '',
      channelTitle: video.snippet.channelTitle || 'Unknown Channel',
      publishedAt: video.snippet.publishedAt,
      duration: parseDuration(video.contentDetails.duration),
      viewCount: safeParse(video.statistics.viewCount),
      likeCount: safeParse(video.statistics.likeCount),
      commentCount: safeParse(video.statistics.commentCount),
      subscriberCount: safeParse(channel.statistics.subscriberCount)
    };
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    throw new Error(`Failed to fetch metadata: ${error.message}`);
  }
};

// Process single video
app.post('/api/process-video', async (req, res) => {
    try {
      const { url } = req.body;
      const videoId = getVideoId(url);
  
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }
  
      // Get video metadata
      const metadata = await getVideoMetadata(videoId);
  
      // Get transcript
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      const fullText = transcript.map(entry => entry.text).join(' ');
  
      // Process with OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Analyze this YouTube video transcript and extract: 1) Main topics discussed 2) Key points for each topic 3) insights or perspectives 4) Supporting data or statistics mentioned. Format the response as JSON."
          },
          {
            role: "user",
            content: fullText
          }
        ]
      });
  
      const analysis = JSON.parse(completion.choices[0].message.content);
  
      return res.json({
        metadata,
        analysis
      });
    } catch (error) {
      console.error('Error processing video:', error);
      res.status(500).json({ error: 'Error processing video' });
    }
  });
  

// Process multiple videos
app.post('/api/process-project', async (req, res) => {
    try {
        const { urls } = req.body;
        const processedVideos = [];

        // Process each video in parallel
        await Promise.all(urls.map(async (url) => {
            const videoId = getVideoId(url);
            const [metadata, transcript] = await Promise.all([
                getVideoMetadata(videoId),
                YoutubeTranscript.fetchTranscript(videoId)
            ]);
            processedVideos.push({ metadata, transcript: transcript.map(t => t.text).join(' ') });
        }));

        // Combine all transcripts for analysis
        const combinedText = processedVideos.map(video => video.transcript).join('\n\n');

        // Generate synthesis
        const synthesisCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Analyze these YouTube video transcripts and provide a valid JSON object with the following keys:
                        - commonThemes: array of common themes and topics across videos
                        - differentPerspectives: array of different viewpoints on similar topics
                        - contentGaps: array of potential content opportunities
                        - suggestedOutline: array of sections for a new video
                        All values should be arrays of strings. Return only JSON without markdown formatting.`
                },
                {
                    role: "user",
                    content: combinedText
                }
            ],
            response_format: { type: "json_object" } // Enforce JSON output
        });

        const rawSynthesis = synthesisCompletion.choices[0].message.content;
        const cleanedSynthesis = cleanJsonResponse(rawSynthesis);
        const synthesis = JSON.parse(cleanedSynthesis);

        // Generate title suggestions
        const titleCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Based on this content analysis, generate 5 engaging, YouTube video titles. Make sure the titles ressemble those of popular youtube videos(Avoid blog titles style or book titles style). Return as a JSON array of strings."
                },
                {
                    role: "user",
                    content: JSON.stringify(synthesis)
                }
            ]
        });

        const titleSuggestions = JSON.parse(titleCompletion.choices[0].message.content);

        const rawTitles = titleCompletion.choices[0].message.content;
        const cleanedTitles = cleanJsonResponse(rawTitles);
       

        return res.json({
            videos: processedVideos.map(v => v.metadata),
            synthesis,
            titleSuggestions
        });
    } catch (error) {
        console.error('Error processing project:', error);
        res.status(500).json({ error: 'Error processing project' });
    }
});

// Save project
app.post('/api/save-project', async (req, res) => {
    try {
        const { projectName, videos, synthesis } = req.body;
        
        // Here you would typically save to a database
        // For now, we'll just return success
        res.json({
            message: 'Project saved successfully',
            data: { projectName, videos, synthesis }
        });
    } catch (error) {
        console.error('Error saving project:', error);
        res.status(500).json({ error: 'Error saving project' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});