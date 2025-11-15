import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const LobbySetup: React.FC = () => {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedJobDescription, setSelectedJobDescription] = useState('')

  const roles = ['Frontend', 'Backend', 'Full Stack', 'DevOps', 'Mobile']
  const jobDescriptions = ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead']

  const handleNext = () => {
    if (selectedRole && selectedJobDescription) {
      // TODO: Call API to create lobby with user details
      console.log('Creating lobby with:', { selectedRole, selectedJobDescription })
      navigate('/waiting-room')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 game-bg">
      <div className="w-full max-w-4xl space-y-12">
        <h1 
          className="text-6xl font-black text-center tracking-widest game-text-glow-cyan"
          style={{ 
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: 'var(--game-cyan)',
            textTransform: 'uppercase'
          }}
        >
          LOBBY
        </h1>
        
        <div className="space-y-10">
          {/* Role Selection */}
          <div className="space-y-4">
            <h2 
              className="text-2xl font-bold text-center"
              style={{ color: 'var(--game-text-primary)' }}
            >
              SELECT ROLE
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {roles.map((role) => (
                <Button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className="px-8 py-6 text-lg font-bold rounded-xl transform hover:scale-105 transition-all duration-200"
                  style={{
                    background: selectedRole === role
                      ? `linear-gradient(135deg, var(--game-cyan-dark), var(--game-cyan))`
                      : 'rgba(15, 10, 31, 0.8)',
                    border: `3px solid var(--game-cyan)`,
                    color: 'var(--game-text-primary)',
                    fontFamily: 'Impact, Arial Black, sans-serif',
                    textTransform: 'uppercase',
                    boxShadow: selectedRole === role
                      ? `0 0 20px var(--game-cyan-glow)`
                      : 'none'
                  }}
                >
                  {role}
                </Button>
              ))}
            </div>
          </div>

          {/* Job Description Selection */}
          <div className="space-y-4">
            <h2 
              className="text-2xl font-bold text-center"
              style={{ color: 'var(--game-text-primary)' }}
            >
              SELECT LEVEL
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {jobDescriptions.map((level) => (
                <Button
                  key={level}
                  onClick={() => setSelectedJobDescription(level)}
                  className="px-8 py-6 text-lg font-bold rounded-xl transform hover:scale-105 transition-all duration-200"
                  style={{
                    background: selectedJobDescription === level
                      ? `linear-gradient(135deg, var(--game-red-dark), var(--game-red))`
                      : 'rgba(15, 10, 31, 0.8)',
                    border: `3px solid var(--game-red)`,
                    color: 'var(--game-text-primary)',
                    fontFamily: 'Impact, Arial Black, sans-serif',
                    textTransform: 'uppercase',
                    boxShadow: selectedJobDescription === level
                      ? `0 0 20px var(--game-red-glow)`
                      : 'none'
                  }}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          {/* Next Button */}
          <div className="flex justify-center pt-6">
            <Button 
              onClick={handleNext}
              disabled={!selectedRole || !selectedJobDescription}
              className="px-20 py-8 text-2xl font-bold rounded-2xl transform hover:scale-110 transition-all duration-300"
              style={{
                background: (selectedRole && selectedJobDescription)
                  ? `linear-gradient(135deg, #00cc66, var(--game-green))`
                  : 'rgba(50, 50, 50, 0.5)',
                border: (selectedRole && selectedJobDescription)
                  ? `3px solid var(--game-green)`
                  : '3px solid #555',
                color: 'var(--game-text-primary)',
                fontFamily: 'Impact, Arial Black, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: (selectedRole && selectedJobDescription)
                  ? `0 0 20px rgba(0, 255, 136, 0.5)`
                  : 'none',
                cursor: (selectedRole && selectedJobDescription) ? 'pointer' : 'not-allowed'
              }}
            >
              NEXT
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LobbySetup

