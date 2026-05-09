import ProjectWorkspacePage from "@/pages/ProjectWorkspacePage";

interface Props {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

export default function SelfUpgradePage(props: Props) {
  return <ProjectWorkspacePage {...props} forceProjectId="self_upgrade" isSelfUpgrade />;
}
