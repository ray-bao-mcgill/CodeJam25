// Analytics Types - Backend will populate these structures
// Inspired by Gartic Phone reveals + Spotify Wrapped storytelling

export interface GameHistory {
  lobbyId: string;
  gameMode: "competitive" | "casual";
  timestamp: Date;
  duration: number; // seconds

  // Single player focus
  player: AnalyticsPlayer;
  rounds: RoundHistory[];
  feedback: PhaseFeedback[];
  skillAssessment: SkillAssessment;
  highlights: PersonalHighlight[];
  overallRating: OverallRating;
}

export interface AnalyticsPlayer {
  id: string;
  name: string;
  jobTitle?: string;
  totalScore: number;
  finalResult: "HIRED" | "FIRED";
  stats: PlayerStats;
}

export interface PlayerStats {
  // Aggregate stats
  totalWordsTyped: number;
  avgResponseTime: number; // seconds
  fastestResponse: number;
  slowestResponse: number;

  // Rapid Fire specific
  totalCorrect?: number;
  totalAttempted?: number;
  accuracy?: number; // percentage
  livesRemaining?: number;

  // Behavioural specific
  avgWordCount?: number;
  longestAnswer?: number; // words

  // Streaks & achievements
  winStreak: number;
  biggestComeback?: number; // score deficit overcome
  perfectRounds: number; // rounds where beat opponent
}

export interface RoundHistory {
  roundNumber: number;
  phase: "behavioural" | "followup" | "theory" | "practical" | "rapid-fire";
  title: string;
  question?: string;

  results: Array<{
    playerId: string;
    score: number;
    scoreDelta: number; // change from previous round

    // Detailed breakdown
    breakdown?: {
      // Rapid Fire
      correctAnswers?: number;
      timeBonus?: number;
      livesBonus?: number;

      // Behavioural
      wordCount?: number;
      submissionTime?: number;
      aiScore?: number;

      // Technical
      testsPassed?: number;
      codeQuality?: number;
    };

    // Fun metadata
    responseTime?: number;
    wasComeback?: boolean; // came from behind this round
    wasPerfect?: boolean; // max possible score
  }>;

  // Round commentary (backend can generate fun quips)
  commentary?: string;
  highlight?: "close" | "blowout" | "upset" | "comeback";
}

// AI Feedback per phase
export interface PhaseFeedback {
  phase: "behavioural" | "followup" | "theory" | "practical" | "rapid-fire";
  roundNumber: number;
  score: number;
  maxScore: number;

  // AI-generated feedback
  feedback: {
    strengths: string[]; // What you did well
    improvements: string[]; // Areas to improve
    keyInsight: string; // Main takeaway
    tone: "praise" | "constructive" | "encouraging";
  };

  // Specific metrics
  metrics?: {
    wordCount?: number;
    clarity?: number; // 0-100
    relevance?: number; // 0-100
    depth?: number; // 0-100
    accuracy?: number; // 0-100 for rapid-fire
    speed?: number; // percentile
  };
}

// Skill assessment breakdown
export interface SkillAssessment {
  categories: Array<{
    name:
      | "Communication"
      | "Technical Knowledge"
      | "Problem Solving"
      | "Speed & Accuracy"
      | "Critical Thinking";
    score: number; // 0-100
    level: "Needs Work" | "Developing" | "Proficient" | "Expert";
    description: string;
  }>;
}

// Personal highlights (not competitive)
export interface PersonalHighlight {
  type:
    | "best_answer"
    | "fastest_response"
    | "most_detailed"
    | "perfect_accuracy"
    | "consistency"
    | "improvement";
  phase: string;
  roundNumber: number;
  title: string;
  description: string;
  stat: number;
  icon: string;
}

// Overall performance rating
export interface OverallRating {
  score: number; // 0-100
  letter: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";
  summary: string; // Overall performance summary
  topStrength: string; // Your best skill
  focusArea: string; // Main area to improve
  interviewReadiness: number; // 0-100
}

// Mock data generator for development
export function createMockGameHistory(): GameHistory {
  return {
    lobbyId: "mock-lobby-123",
    gameMode: "competitive",
    timestamp: new Date(),
    duration: 720, // 12 minutes

    player: {
      id: "player1",
      name: "You",
      jobTitle: "Software Engineer",
      totalScore: 3500,
      finalResult: "HIRED",
      stats: {
        totalWordsTyped: 485,
        avgResponseTime: 42,
        fastestResponse: 18,
        slowestResponse: 58,
        totalCorrect: 12,
        totalAttempted: 15,
        accuracy: 80,
        livesRemaining: 2,
        avgWordCount: 97,
        longestAnswer: 145,
        winStreak: 3,
        biggestComeback: 250,
        perfectRounds: 2,
      },
    },

    rounds: [
      {
        roundNumber: 1,
        phase: "behavioural",
        title: "Tell me about a time...",
        results: [
          {
            playerId: "player1",
            score: 450,
            scoreDelta: 450,
            breakdown: { wordCount: 125, aiScore: 85 },
            responseTime: 45,
          },
          {
            playerId: "player2",
            score: 380,
            scoreDelta: 380,
            breakdown: { wordCount: 98, aiScore: 72 },
            responseTime: 52,
          },
        ],
        commentary: "Alice took an early lead with a detailed story!",
        highlight: "close",
      },
      {
        roundNumber: 2,
        phase: "followup",
        title: "Follow-up Question",
        results: [
          {
            playerId: "player1",
            score: 520,
            scoreDelta: 70,
            breakdown: { wordCount: 145, aiScore: 92 },
            responseTime: 38,
            wasPerfect: true,
          },
          {
            playerId: "player2",
            score: 490,
            scoreDelta: 110,
            breakdown: { wordCount: 118, aiScore: 88 },
            responseTime: 41,
            wasComeback: true,
          },
        ],
        commentary: "Bob is closing the gap with a strong comeback answer!",
        highlight: "comeback",
      },
      {
        roundNumber: 3,
        phase: "rapid-fire",
        title: "Quick-Fire Questions",
        results: [
          {
            playerId: "player1",
            score: 1200,
            scoreDelta: 680,
            breakdown: { correctAnswers: 12, timeBonus: 300, livesBonus: 200 },
            responseTime: 18,
            wasPerfect: true,
          },
          {
            playerId: "player2",
            score: 950,
            scoreDelta: 460,
            breakdown: { correctAnswers: 9, timeBonus: 150, livesBonus: 100 },
            responseTime: 28,
          },
        ],
        commentary: "Alice dominated the rapid-fire round! 🔥",
        highlight: "blowout",
      },
      {
        roundNumber: 4,
        phase: "practical",
        title: "Coding Challenge",
        results: [
          {
            playerId: "player1",
            score: 650,
            scoreDelta: -550,
            breakdown: { testsPassed: 7, codeQuality: 75 },
          },
          {
            playerId: "player2",
            score: 460,
            scoreDelta: -490,
            breakdown: { testsPassed: 5, codeQuality: 62 },
          },
        ],
        commentary: "Alice maintained the lead to the finish line!",
      },
    ],

    feedback: [
      {
        phase: "behavioural",
        roundNumber: 1,
        score: 450,
        maxScore: 500,
        feedback: {
          strengths: [
            "Provided specific examples with clear context",
            "Used STAR method effectively",
            "Demonstrated strong communication skills",
          ],
          improvements: [
            "Could elaborate more on the outcome/results",
            "Add more quantifiable metrics to your story",
          ],
          keyInsight:
            "Your storytelling is strong, but backing it up with numbers would make it even more impactful.",
          tone: "praise",
        },
        metrics: {
          wordCount: 125,
          clarity: 85,
          relevance: 90,
          depth: 80,
        },
      },
      {
        phase: "followup",
        roundNumber: 2,
        score: 520,
        maxScore: 600,
        feedback: {
          strengths: [
            "Excellent self-reflection and learning mindset",
            "Connected the follow-up naturally to your initial story",
            "Showed growth and adaptability",
          ],
          improvements: [
            "Could have mentioned specific action items you implemented",
          ],
          keyInsight:
            "You demonstrated strong learning agility—a key trait interviewers look for!",
          tone: "praise",
        },
        metrics: {
          wordCount: 145,
          clarity: 92,
          relevance: 95,
          depth: 88,
        },
      },
      {
        phase: "rapid-fire",
        roundNumber: 3,
        score: 1200,
        maxScore: 1500,
        feedback: {
          strengths: [
            "Impressive response speed—you think on your feet!",
            "12 out of 15 correct shows solid fundamentals",
            "Maintained composure under time pressure",
          ],
          improvements: [
            "Review data structures and algorithms basics",
            "Practice identifying edge cases faster",
          ],
          keyInsight:
            "Your speed is a strength, but slowing down slightly on tricky questions could improve accuracy.",
          tone: "constructive",
        },
        metrics: {
          accuracy: 80,
          speed: 92,
        },
      },
      {
        phase: "practical",
        roundNumber: 4,
        score: 650,
        maxScore: 900,
        feedback: {
          strengths: [
            "Clean, readable code structure",
            "Good variable naming and comments",
            "Passed most test cases",
          ],
          improvements: [
            "Consider edge cases earlier in development",
            "Optimize for time complexity",
            "Add more robust error handling",
          ],
          keyInsight:
            "Your code quality is solid. Focus on thinking through edge cases before coding.",
          tone: "encouraging",
        },
        metrics: {
          accuracy: 70,
          clarity: 75,
          depth: 72,
        },
      },
    ],

    skillAssessment: {
      categories: [
        {
          name: "Communication",
          score: 88,
          level: "Proficient",
          description:
            "You articulate ideas clearly and tell compelling stories. Your STAR responses are well-structured.",
        },
        {
          name: "Technical Knowledge",
          score: 72,
          level: "Proficient",
          description:
            "Solid fundamentals with room to grow in advanced topics. Keep studying system design and algorithms.",
        },
        {
          name: "Problem Solving",
          score: 75,
          level: "Proficient",
          description:
            "You approach problems methodically and can think on your feet. Work on considering edge cases earlier.",
        },
        {
          name: "Speed & Accuracy",
          score: 80,
          level: "Proficient",
          description:
            "Impressive response speed! Balancing speed with accuracy will take you to the next level.",
        },
        {
          name: "Critical Thinking",
          score: 70,
          level: "Developing",
          description:
            "You show good analytical skills. Dive deeper into 'why' questions and challenge assumptions more.",
        },
      ],
    },

    highlights: [
      {
        type: "best_answer",
        phase: "Follow-up Question",
        roundNumber: 2,
        title: "Best Answer of the Session",
        description:
          "Your follow-up response scored 92% clarity—demonstrating exceptional self-awareness and learning agility!",
        stat: 92,
        icon: "💯",
      },
      {
        type: "fastest_response",
        phase: "Rapid Fire",
        roundNumber: 3,
        title: "Lightning Fast!",
        description:
          "18-second average response time puts you in the top 5% of candidates!",
        stat: 18,
        icon: "⚡",
      },
      {
        type: "most_detailed",
        phase: "Follow-up Question",
        roundNumber: 2,
        title: "Depth Champion",
        description:
          "Your 145-word answer showed impressive detail and thoroughness.",
        stat: 145,
        icon: "📝",
      },
      {
        type: "consistency",
        phase: "Overall",
        roundNumber: 0,
        title: "Consistent Performer",
        description:
          "You maintained strong performance across all phases—no major dips!",
        stat: 77,
        icon: "📈",
      },
    ],

    overallRating: {
      score: 77,
      letter: "B+",
      summary:
        "Strong interview performance with standout communication skills! You demonstrated solid technical knowledge and impressive composure under pressure. Focus on deepening your understanding of advanced topics and considering edge cases earlier in problem-solving.",
      topStrength: "Communication & Storytelling",
      focusArea: "Advanced Technical Depth",
      interviewReadiness: 82,
    },
  };
}
