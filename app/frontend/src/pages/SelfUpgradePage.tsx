import ProjectWorkspacePage from "@/pages/ProjectWorkspacePage";
import type { AssistantMode } from "@/types";

interface Props {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  assistantMode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
}

export default function SelfUpgradePage(props: Props) {
  return <ProjectWorkspacePage {...props} forceProjectId="self_upgrade" isSelfUpgrade />;
}
