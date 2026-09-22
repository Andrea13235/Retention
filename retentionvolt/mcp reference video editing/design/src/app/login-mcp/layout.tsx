import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connect CyberMCP — RETENTIONVOLT',
  description:
    'Authorize and connect your AI coding agent (Codex, Claude Code, Cursor) directly to the RetentionVolt CyberMCP server.',
};

export default function LoginMcpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
