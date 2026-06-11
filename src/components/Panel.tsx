import type { ReactNode } from "react";

interface PanelHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
}

export function PanelHeader({ title, actions }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-title">{title}</div>
      {actions}
    </div>
  );
}

interface PanelFooterProps {
  start: ReactNode;
  end: ReactNode;
}

export function PanelFooter({ start, end }: PanelFooterProps) {
  return (
    <footer className="panel-footer">
      <span>{start}</span>
      <span>{end}</span>
    </footer>
  );
}
