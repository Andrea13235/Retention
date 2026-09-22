import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In — RETENTIONVOLT',
  description:
    'Sign in to your RETENTIONVOLT account to access retention curves, pacing cadences, and CyberMCP AI integration.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
