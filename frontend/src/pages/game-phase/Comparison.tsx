import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLobby } from '@/hooks/useLobby'
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket'

interface QuestionComparison {
  question: string
  phase: string
  questionId: string
  bestAnswer: {
    playerId: string
    playerName: string
    answer: string
    score: number
    compliment: string
  }
  worstAnswer: {
    playerId: string
    playerName: string
    answer: string
    score: number
    roast: string
  }
}

const Comparison: React.FC = () => {
  const navigate = useNavigate()
  const { lobby, lobbyId, playerId } = useLobby()
  const [comparisons, setComparisons] = useState<QuestionComparison[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [typingBest, setTypingBest] = useState(true)
  const [typingWorst, setTypingWorst] = useState(false)
  const [displayedBestText, setDisplayedBestText] = useState('')
  const [displayedWorstText, setDisplayedWorstText] = useState('')
  const [typingJudgeBest, setTypingJudgeBest] = useState(false)
  const [typingJudgeWorst, setTypingJudgeWorst] = useState(false)
  const [displayedJudgeBestText, setDisplayedJudgeBestText] = useState('')
  const [displayedJudgeWorstText, setDisplayedJudgeWorstText] = useState('')
  const hasLoadedRef = useRef(false)

  // Set up WebSocket
  useLobbyWebSocket({
    lobbyId: lobbyId || null,
    enabled: !!lobbyId,
    onLobbyUpdate: () => {},
    onGameStarted: () => {},
    onDisconnect: () => {},
    onKicked: () => {},
    currentPlayerId: playerId || null,
    onGameMessage: (message: any) => {
      if (message.type === 'comparisons_ready') {
        setComparisons(message.comparisons)
        setIsLoading(false)
      }
    },
  })

  // Load comparison data (mock for now - should come from backend)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      // TODO: Fetch real data from backend
      // For now, using mock data
      setTimeout(() => {
        const mockComparisons: QuestionComparison[] = [
          {
            question: "Tell me about a time you faced a difficult challenge at work.",
            phase: "Behavioural",
            questionId: "behavioural_q1",
            bestAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "I implemented a new system that improved efficiency by 40%. I started by analyzing the workflow, identified bottlenecks, and proposed automation solutions. The team was initially resistant, but I organized workshops to demonstrate the benefits. Within 3 months, we saw significant improvements in productivity.",
              score: 850,
              compliment: "Outstanding communication and clear structure! Your answer demonstrated excellent problem-solving skills."
            },
            worstAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "I... uh... worked on something hard once...",
              score: 250,
              roast: "A bit vague there! Next time, try adding specific details and concrete examples to make your answer shine."
            }
          },
          {
            question: "Describe a situation where you had to work with a difficult team member.",
            phase: "Behavioural",
            questionId: "behavioural_q2",
            bestAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "I worked with a colleague who often missed deadlines. Instead of confronting them aggressively, I scheduled a one-on-one to understand their perspective. I discovered they were overwhelmed with tasks. We worked together to prioritize work and establish better communication channels, which improved our collaboration significantly.",
              score: 820,
              compliment: "Great empathy and problem-solving approach! You showed excellent interpersonal skills."
            },
            worstAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "I just avoided them and did my own work.",
              score: 180,
              roast: "That's not really teamwork! Consider discussing conflict resolution strategies next time."
            }
          },
          {
            question: "What is the difference between let, const, and var in JavaScript?",
            phase: "Technical Theory",
            questionId: "technical_theory_q1",
            bestAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "var has function scope and is hoisted, let and const have block scope. let allows reassignment while const doesn't. var can be redeclared, but let and const cannot. const must be initialized when declared.",
              score: 900,
              compliment: "Perfect explanation! You covered all the key differences clearly."
            },
            worstAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "They're all the same, just different ways to declare variables.",
              score: 100,
              roast: "Not quite! There are important differences in scope, hoisting, and mutability."
            }
          },
          {
            question: "Implement a function to reverse a string.",
            phase: "Technical Practical",
            questionId: "technical_practical_q1",
            bestAnswer: {
              playerId: lobby?.players[1]?.id || "p2",
              playerName: lobby?.players[1]?.name || "Player 2",
              answer: "function reverseString(str) { return str.split('').reverse().join(''); } This splits the string into an array of characters, reverses the array, and joins it back into a string.",
              score: 880,
              compliment: "Clean and efficient solution! Great use of built-in methods."
            },
            worstAnswer: {
              playerId: lobby?.players[0]?.id || "p1",
              playerName: lobby?.players[0]?.name || "Player 1",
              answer: "I would use a for loop... but I'm not sure exactly how.",
              score: 220,
              roast: "Good start with the approach, but you need to provide actual working code!"
            }
          }
        ]
        setComparisons(mockComparisons)
        setIsLoading(false)
      }, 1000)
    }
  }, [lobby])

  useEffect(() => {
    if (currentIndex < comparisons.length && comparisons[currentIndex]) {
      const current = comparisons[currentIndex]
      
      // Reset text
      setDisplayedBestText('')
      setDisplayedWorstText('')
      setDisplayedJudgeBestText('')
      setDisplayedJudgeWorstText('')
      setTypingBest(true)
      setTypingWorst(true)
      setTypingJudgeBest(false)
      setTypingJudgeWorst(false)
      
      // Typewriter effect for best answer
      let bestIndex = 0
      const bestInterval = setInterval(() => {
        if (bestIndex < current.bestAnswer.answer.length) {
          setDisplayedBestText(current.bestAnswer.answer.slice(0, bestIndex + 1))
          bestIndex++
        } else {
          clearInterval(bestInterval)
          setTypingBest(false)
        }
      }, 30) // Speed of typing (30ms per character)
      
      // Typewriter effect for worst answer (same timing)
      let worstIndex = 0
      const worstInterval = setInterval(() => {
        if (worstIndex < current.worstAnswer.answer.length) {
          setDisplayedWorstText(current.worstAnswer.answer.slice(0, worstIndex + 1))
          worstIndex++
        } else {
          clearInterval(worstInterval)
          setTypingWorst(false)
        }
      }, 30) // Speed of typing (30ms per character)
      
      return () => {
        clearInterval(bestInterval)
        clearInterval(worstInterval)
      }
    }
  }, [currentIndex, comparisons])

  // Judge typewriter effect - starts after both answers finish
  useEffect(() => {
    if (!typingBest && !typingWorst && currentIndex < comparisons.length && comparisons[currentIndex]) {
      const current = comparisons[currentIndex]
      
      setTypingJudgeBest(true)
      setTypingJudgeWorst(true)
      
      // Typewriter effect for judge best comment
      let judgeBestIndex = 0
      const judgeBestInterval = setInterval(() => {
        if (judgeBestIndex < current.bestAnswer.compliment.length) {
          setDisplayedJudgeBestText(current.bestAnswer.compliment.slice(0, judgeBestIndex + 1))
          judgeBestIndex++
        } else {
          clearInterval(judgeBestInterval)
          setTypingJudgeBest(false)
        }
      }, 30)
      
      // Typewriter effect for judge worst comment (same timing)
      let judgeWorstIndex = 0
      const judgeWorstInterval = setInterval(() => {
        if (judgeWorstIndex < current.worstAnswer.roast.length) {
          setDisplayedJudgeWorstText(current.worstAnswer.roast.slice(0, judgeWorstIndex + 1))
          judgeWorstIndex++
        } else {
          clearInterval(judgeWorstInterval)
          setTypingJudgeWorst(false)
        }
      }, 30)
      
      return () => {
        clearInterval(judgeBestInterval)
        clearInterval(judgeWorstInterval)
      }
    }
  }, [typingBest, typingWorst, currentIndex, comparisons])

  const handleNext = () => {
    if (currentIndex < comparisons.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      navigate('/podium')
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-2xl font-black">PREPARING COMPARISON...</div>
        </div>
      </div>
    )
  }

  if (comparisons.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen game-bg">
        <div className="game-paper px-8 py-6 game-shadow-hard-lg">
          <div className="text-2xl font-black mb-4">NO COMPARISONS AVAILABLE</div>
          <button
            onClick={() => navigate('/podium')}
            className="game-sharp px-6 py-3 game-button-hover"
            style={{
              border: '4px solid var(--game-text-primary)',
              backgroundColor: 'var(--game-green)',
            }}
          >
            CONTINUE
          </button>
        </div>
      </div>
    )
  }

  const current = comparisons[currentIndex]

  return (
    <div className="flex items-center justify-center min-h-screen game-bg relative overflow-hidden">
      {/* Continuous Vertical Line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-[var(--game-text-primary)] transform -translate-x-1/2 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]" />

      {/* Title at top */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="game-label-text text-3xl game-shadow-hard">
          ANSWER COMPARISON
        </div>
      </div>

      {/* Question Phase Label */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10">
        <div className="game-paper px-6 py-2 game-shadow-hard">
          <div className="text-sm font-bold text-gray-600">{current.phase} Round</div>
        </div>
      </div>

      {/* Question Display */}
      <div className="absolute top-36 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-3xl px-8">
        <div className="game-paper px-8 py-4 game-shadow-hard-lg text-center">
          <div className="text-xl font-bold mb-3">{current.question}</div>
          <div className="text-sm text-gray-600">
            Question {currentIndex + 1} of {comparisons.length}
          </div>
        </div>
      </div>

      {/* Main VS Content - Chat Bubble Style - Side by Side */}
      <div className="relative z-10 w-full max-w-[1400px] px-8 mt-16 flex items-start justify-between gap-8">
        {/* Best Answer - Left Side (Blue Chat Bubble) */}
        <div className="w-[42%] animate-stamp-in" style={{ animationDelay: '0.2s' }}>
          <div className="game-label-text text-sm mb-2 game-shadow-hard-sm px-3 py-1 inline-flex items-center gap-2"
            style={{ 
              backgroundColor: '#FFD700',
              color: 'black',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4)'
            }}>
            {current.bestAnswer.playerName.toUpperCase()}
          </div>
          <div className="relative">
            {/* Chat bubble tail pointing left */}
            <div 
              className="absolute left-0 top-4 w-0 h-0"
              style={{
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderRight: '12px solid var(--game-blue)',
                transform: 'translateX(-11px)',
              }}
            />
            <div className="px-6 py-4 game-sharp game-shadow-hard-lg border-4 border-[var(--game-text-primary)]"
              style={{ backgroundColor: 'var(--game-blue)' }}>
              <div className="text-base leading-relaxed font-semibold text-white">
                {displayedBestText}
                {typingBest && <span className="inline-block w-1 h-5 bg-white ml-1 animate-blink" />}
              </div>
            </div>
          </div>
          
          {/* Judge Reply - Best Answer */}
          {!typingBest && !typingWorst && (
            <div className="mt-4">
              <div className="game-label-text text-xs mb-2 game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                JUDGE
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing left */}
                <div 
                  className="absolute left-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: '10px solid var(--game-text-primary)',
                    transform: 'translateX(-9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {displayedJudgeBestText}
                    {typingJudgeBest && <span className="inline-block w-1 h-4 bg-[var(--game-text-primary)] ml-1 animate-blink" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Worst Answer - Right Side (Red Chat Bubble) */}
        <div className="w-[42%] animate-stamp-in" style={{ animationDelay: '0.2s' }}>
          <div className="text-right mb-2">
            <div className="game-label-text text-sm game-shadow-hard-sm bg-[var(--game-red)] px-3 py-1 text-white inline-flex items-center gap-2">
              {current.worstAnswer.playerName.toUpperCase()}
            </div>
          </div>
          <div className="relative">
            {/* Chat bubble tail pointing right */}
            <div 
              className="absolute right-0 top-4 w-0 h-0"
              style={{
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderLeft: '12px solid var(--game-red)',
                transform: 'translateX(11px)',
              }}
            />
            <div className="px-6 py-4 game-sharp game-shadow-hard-lg border-4 border-[var(--game-text-primary)]"
              style={{ backgroundColor: 'var(--game-red)' }}>
              <div className="text-base leading-relaxed font-semibold text-white">
                {displayedWorstText}
                {typingWorst && <span className="inline-block w-1 h-5 bg-white ml-1 animate-blink" />}
              </div>
            </div>
          </div>
          
          {/* Judge Reply - Worst Answer */}
          {!typingBest && !typingWorst && (
            <div className="mt-4">
              <div className="text-right mb-2">
                <div className="game-label-text text-xs game-shadow-hard-sm bg-gray-700 px-3 py-1 text-white inline-flex items-center gap-2">
                  JUDGE
                </div>
              </div>
              <div className="relative">
                {/* Chat bubble tail pointing right */}
                <div 
                  className="absolute right-0 top-4 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderLeft: '10px solid var(--game-text-primary)',
                    transform: 'translateX(9px)',
                  }}
                />
                <div className="px-4 py-3 game-sharp game-shadow-hard border-4 border-[var(--game-text-primary)] bg-white">
                  <div className="text-sm leading-relaxed text-[var(--game-text-primary)]">
                    {displayedJudgeWorstText}
                    {typingJudgeWorst && <span className="inline-block w-1 h-4 bg-[var(--game-text-primary)] ml-1 animate-blink" />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VS in Circle - Fixed position to not overlap */}
      <div className="flex items-center justify-center fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-stamp-in-vs pointer-events-none" style={{ animationDelay: '0.3s' }}>
        <div className="rounded-full flex items-center justify-center w-[140px] h-[140px] bg-gradient-to-br from-yellow-300 via-[var(--game-yellow)] to-orange-400 border-[8px] border-[var(--game-text-primary)] shadow-[8px_8px_0px_rgba(0,0,0,0.4)]">
          <div className="text-[4rem] font-black text-[var(--game-text-primary)] leading-none drop-shadow-lg" style={{ fontFamily: 'Impact, sans-serif' }}>
            VS
          </div>
        </div>
      </div>

      {/* Navigation Buttons - positioned at bottom */}
      <div className="fixed bottom-8 w-full max-w-[1400px] px-8 left-1/2 transform -translate-x-1/2 z-10 flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="game-sharp px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
          style={{
            border: '4px solid var(--game-text-primary)',
            backgroundColor: currentIndex === 0 ? 'var(--game-bg-alt)' : '#FF1493',
            color: 'white',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.5 : 1,
          }}
        >
          PREVIOUS
        </button>
        <button
          onClick={handleNext}
          className="game-sharp px-8 py-4 text-base font-black uppercase tracking-widest game-shadow-hard-lg game-button-hover"
          style={{
            border: '4px solid var(--game-text-primary)',
            backgroundColor: 'var(--game-green)',
            color: 'var(--game-text-white)',
          }}
        >
          {currentIndex < comparisons.length - 1 ? 'NEXT ' : 'VIEW RANKINGS'}
        </button>
      </div>
    </div>
  )
}

export default Comparison
