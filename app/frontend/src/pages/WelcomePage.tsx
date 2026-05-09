import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import CloneRepositoryDialog from '@/components/CloneRepositoryDialog';
import './WelcomePage.css';

interface Project {
  id: string;
  name: string;
  path: string;
  last_accessed?: string;
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  useEffect(() => {
    fetch('/projects')
      .then((res) => res.json())
      .then((data) => {
        const filtered = data.filter((p: Project) => p.id !== 'self_upgrade');
        const sorted = filtered.sort((a: Project, b: Project) => {
          const timeA = a.last_accessed ? new Date(a.last_accessed).getTime() : 0;
          const timeB = b.last_accessed ? new Date(b.last_accessed).getTime() : 0;
          return timeB - timeA;
        });
        setRecentProjects(sorted.slice(0, 5));
      })
      .catch((err) => console.error('Failed to load recent projects:', err));
  }, []);

  const handleNewFile = () => {
    // Create untitled file in editor (stub for now)
    navigate('/new-project');
  };

  const handleOpenFile = async () => {
    try {
      const result = await window.cubosDesktop.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text Files', extensions: ['txt', 'md', 'json'] },
          { name: 'Code Files', extensions: ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        // For now, just log it - full file editor comes later
        console.log('Selected file:', result.filePaths[0]);
        toast.info(`File selected: ${result.filePaths[0]}\n\nSingle file editing will be implemented in a future release. For now, please open the parent folder.`);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const result = await window.cubosDesktop.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        
        // Import the folder as a new project
        const response = await fetch('/projects/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: folderPath }),
        });

        if (response.ok) {
          const project = await response.json();
          navigate(`/project/${project.id}/thread/latest`);
        } else {
          const error = await response.text();
          toast.error(`Failed to import folder: ${error}`);
        }
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  };

  const handleCloneRepository = () => {
    setShowCloneDialog(true);
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}/thread/latest`);
  };

  return (
    <div className="welcome-page">
      <div className="welcome-container">
        <div className="welcome-header">
          <h1>Welcome to CubOS</h1>
          <p>Your AI-powered development environment</p>
        </div>

        <div className="welcome-actions">
          <h2>Start</h2>
          <div className="action-cards">
            <div className="action-card" onClick={handleNewFile}>
              <div className="action-icon">📄</div>
              <h3>New File</h3>
              <p>Create a new untitled file</p>
            </div>

            <div className="action-card" onClick={handleOpenFile}>
              <div className="action-icon">📂</div>
              <h3>Open File</h3>
              <p>Open and edit a single file</p>
            </div>

            <div className="action-card" onClick={handleOpenFolder}>
              <div className="action-icon">📁</div>
              <h3>Open Folder</h3>
              <p>Import an existing project folder</p>
            </div>

            <div className="action-card" onClick={handleCloneRepository}>
              <div className="action-icon">🔗</div>
              <h3>Clone Repository</h3>
              <p>Clone from a Git repository</p>
            </div>
          </div>
        </div>

        {recentProjects.length > 0 && (
          <div className="recent-projects">
            <h2>Recent Projects</h2>
            <div className="recent-projects-list">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="recent-project-item"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <div className="project-icon">📦</div>
                  <div className="project-info">
                    <div className="project-name">{project.name}</div>
                    <div className="project-path">{project.path}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <CloneRepositoryDialog
          isOpen={showCloneDialog}
          onClose={() => setShowCloneDialog(false)}
        />
      </div>
    </div>
  );
}
