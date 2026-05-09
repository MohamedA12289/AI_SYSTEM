import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './ModeToggle.css';

interface ModeToggleProps {
  currentMode: 'chat' | 'code';
}

export function ModeToggle({ currentMode }: ModeToggleProps) {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const handleModeChange = (mode: 'chat' | 'code') => {
    if (mode === 'chat') {
      navigate(`/project/${projectId}/thread/latest`);
    } else {
      navigate(`/project/${projectId}/code`);
    }
  };

  return (
    <div className="mode-toggle">
      <button
        className={`mode-toggle-button ${currentMode === 'chat' ? 'active' : ''}`}
        onClick={() => handleModeChange('chat')}
      >
        Chat
      </button>
      <button
        className={`mode-toggle-button ${currentMode === 'code' ? 'active' : ''}`}
        onClick={() => handleModeChange('code')}
      >
        Code
      </button>
    </div>
  );
}
