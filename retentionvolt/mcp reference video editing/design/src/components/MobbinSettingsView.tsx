'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  X, 
  Copy, 
  Check, 
  Terminal, 
  User, 
  Sliders, 
  CreditCard, 
  Users, 
  Sparkles, 
  Activity, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Layers, 
  Code2,
  Server,
  ArrowLeft,
  ExternalLink,
  Shield,
  Trash2,
  Mail,
  CheckCircle2,
  Lock,
  Download,
  Plus,
  Zap,
  Cpu,
  Bot
} from 'lucide-react';
import { McpIcon } from '@/components/McpIcon';
import { MCP_TOOLS_DEFINITIONS } from '@/mcp/tools';
import { useAuth } from '@/context/AuthContext';

export interface MobbinSettingsViewProps {
  onClose?: () => void;
  onOpenPaywall?: () => void;
  initialTab?: 'account' | 'preferences' | 'billing' | 'team' | 'mcp';
  isModal?: boolean;
}

export const MobbinSettingsView: React.FC<MobbinSettingsViewProps> = ({
  onClose,
  onOpenPaywall,
  initialTab = 'mcp',
  isModal = false
}) => {
  const { user, updateProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'billing' | 'team' | 'mcp'>(initialTab);
  const [activeTool, setActiveTool] = useState<'cursor' | 'claude_code' | 'antigravity' | 'windsurf' | 'codex' | 'v0' | 'other'>('cursor');
  const [setupFormat, setSetupFormat] = useState<'agent_prompt' | 'cli' | 'json'>('agent_prompt');
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);

  // MCP API keys (server-issued, Pro only). Plaintext shown ONCE at creation.
  const isProUser = user?.plan === 'pro';
  interface McpKeyInfo {
    id: string;
    prefix: string;
    name: string;
    isActive: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }
  const [mcpKeys, setMcpKeys] = useState<McpKeyInfo[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('Default key');
  const [creatingKey, setCreatingKey] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const [pingStatus, setPingStatus] = useState<{ state: 'idle' | 'testing' | 'success' | 'error'; ms?: number; message?: string }>({ state: 'idle' });
  const [selectedToolIndex, setSelectedToolIndex] = useState<number | null>(0);

  // Restore fresh key from sessionStorage if present in this browser session
  useEffect(() => {
    try {
      const savedKey = sessionStorage.getItem('retentionvolt_active_mcp_key');
      if (savedKey && (savedKey.startsWith('rv_') || savedKey.startsWith('rb_'))) {
        setFreshKey(savedKey);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // The key actually used in configs / ping: the explicitly selected active key,
  // else the most recent active key. Never a predictable client-side string.
  const activeKeyRecord = mcpKeys.find(k => k.id === selectedKeyId && k.isActive)
    || [...mcpKeys].filter(k => k.isActive).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    || null;
  const activeKeyPrefix = activeKeyRecord ? activeKeyRecord.prefix : null;

  const authHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { supabase } = await import('@/lib/supabase');
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) return { Authorization: `Bearer ${token}` };
      }
    } catch { /* fall through */ }
    return {};
  };

  const fetchMcpKeys = async () => {
    if (!isProUser) return;
    setKeysLoading(true);
    setKeysError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/mcp/keys', { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load API keys');
      if (data.migrationMissing) setMigrationMissing(true);
      setMcpKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch (err: any) {
      setKeysError(err?.message || 'Failed to load API keys');
    } finally {
      setKeysLoading(false);
    }
  };

  const handleCreateKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCreatingKey(true);
    setKeysError(null);
    setFreshKey(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: newKeyName.trim() || 'Default key' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create key');
      if (data.migrationMissing) setMigrationMissing(true);
      // Full key visible ONCE — user must copy it now
      setFreshKey(data.key);
      setSelectedKeyId(data.record?.id || null);
      setMcpKeys(prev => [data.record, ...prev]);
    } catch (err: any) {
      setKeysError(err?.message || 'Failed to create key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? Connected AI agents using it will stop working immediately.')) return;
    setRevokingId(id);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/mcp/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to revoke key');
      setMcpKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: false } : k));
      if (selectedKeyId === id) setSelectedKeyId(null);
    } catch (err: any) {
      setKeysError(err?.message || 'Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'mcp' && isProUser && mcpKeys.length === 0 && !keysLoading) {
      fetchMcpKeys();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isProUser]);

  // ---- Real billing state (Stripe) ----
  interface BillingCard { brand: string; last4: string; expMonth: number; expYear: number }
  interface BillingInvoice { id: string; amount: number; currency: string; status: string; date: number; pdfUrl: string | null }
  interface BillingInfo {
    hasSubscription: boolean;
    subscriptionId?: string;
    status?: string;
    plan?: { amount: number; currency: string; interval: string };
    currentPeriodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
    cancelAt?: number | null;
    trialEnd?: number | null;
    isTrialing?: boolean;
    card?: BillingCard | null;
    invoices?: BillingInvoice[];
  }
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/stripe/subscription', { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load subscription');
      setBilling(data);
    } catch (err: any) {
      setBillingError(err?.message || 'Failed to load subscription');
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'billing' && billing === null && !billingLoading) {
      fetchBilling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCancelAction = async (action: 'cancel_at_period_end' | 'cancel_trial' | 'cancel_immediate', confirmText?: string) => {
    const message = action === 'cancel_trial'
      ? 'Cancel your free trial now? You will not be charged anything.'
      : action === 'cancel_immediate'
        ? 'Cancel IMMEDIATELY? You lose Pro access right now. (Standard cancel keeps access until period end.)'
        : 'Cancel at the end of the current billing period? You keep Pro until then.';
    if (!confirm(message)) return;
    if (action === 'cancel_immediate') {
      const typed = prompt('Type CANCEL to confirm immediate cancellation:');
      if (typed !== 'CANCEL') return;
    }
    setBillingAction(action);
    setBillingError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action, confirm: action === 'cancel_immediate' ? true : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setBillingSuccess(confirmText || 'Done.');
      await fetchBilling();
    } catch (err: any) {
      setBillingError(err?.message || 'Cancel failed');
    } finally {
      setBillingAction(null);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    setBillingError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/stripe/portal', { method: 'POST', headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not open billing portal');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setBillingError(err?.message || 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  // Account Form State
  const [fullName, setFullName] = useState(user?.name || 'Andrea Barretta');
  const [email, setEmail] = useState(user?.email || 'andrea@retentionvolt.com');
  const [username, setUsername] = useState(user?.email ? user.email.split('@')[0] : 'andrea');
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  // Password change
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwStatus, setPwStatus] = useState<{ type: 'idle' | 'ok' | 'err'; msg?: string }>({ type: 'idle' });
  const [pwLoading, setPwLoading] = useState(false);
  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus({ type: 'idle' });
    if (pwNew.length < 8) {
      setPwStatus({ type: 'err', msg: 'New password must be at least 8 characters.' });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwStatus({ type: 'err', msg: 'New passwords do not match.' });
      return;
    }
    setPwLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Password change failed');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setPwStatus({ type: 'ok', msg: 'Password updated.' });
    } catch (err: any) {
      setPwStatus({ type: 'err', msg: err?.message || 'Password change failed' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    if (deleteConfirm !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.');
      return;
    }
    if (!confirm('Permanently delete your account and cancel any subscription? This cannot be undone.')) return;
    setDeleteLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirm })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await logout();
      window.location.href = '/';
    } catch (err: any) {
      setDeleteError(err?.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (user.name) setFullName(user.name);
      if (user.email) {
        setEmail(user.email);
        setUsername(user.email.split('@')[0]);
      }
    }
  }, [user]);

  // Preferences State (persisted to localStorage per user)
  const prefsKey = user?.id ? `retentionvolt_prefs_${user.id}` : 'retentionvolt_prefs_guest';
  const loadPrefs = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(prefsKey) : null;
      if (raw) return JSON.parse(raw);
    } catch { /* ignore corrupt prefs */ }
    return null;
  };
  const savedPrefs = typeof window !== 'undefined' ? loadPrefs() : null;
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'system' | 'light'>(savedPrefs?.theme || 'dark');
  const [primaryNle, setPrimaryNle] = useState(savedPrefs?.primaryNle || 'premiere');
  const [autoplayVideos, setAutoplayVideos] = useState(savedPrefs?.autoplayVideos ?? true);
  const [highQualityPreview, setHighQualityPreview] = useState(savedPrefs?.highQualityPreview ?? true);
  const [audioFeedback, setAudioFeedback] = useState(savedPrefs?.audioFeedback ?? true);
  const [emailDigest, setEmailDigest] = useState(savedPrefs?.emailDigest ?? true);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const persistPrefs = (patch: Record<string, unknown>) => {
    try {
      const current = loadPrefs() || {};
      localStorage.setItem(prefsKey, JSON.stringify({ ...current, ...patch }));
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 1500);
    } catch { /* storage full/blocked — non-fatal */ }
  };

  // Team State — the signed-in user is the owner; invites are local until
  // a team backend exists (no fake members, no fake "sent" state).
  const ownerName = user?.name || 'Owner';
  const ownerEmail = user?.email || '';
  const [teamMembers, setTeamMembers] = useState([
    { id: 1, name: ownerName, email: ownerEmail, role: 'Owner', avatar: (ownerName[0] || 'O').toUpperCase() },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Keep owner row in sync when user loads
  useEffect(() => {
    if (user) {
      setTeamMembers(prev =>
        prev.map(m => m.role === 'Owner'
          ? { ...m, name: user.name || m.name, email: user.email || m.email, avatar: ((user.name || 'O')[0] || 'O').toUpperCase() }
          : m)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const mcpServerUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/mcp` 
    : 'https://retentionvolt.com/api/mcp';

  const handleCopy = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleCopyPrompt = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const runPingTest = async () => {
    setPingStatus({ state: 'testing' });
    if (!freshKey && !activeKeyRecord) {
      setPingStatus({ state: 'error', message: 'Create an API key first' });
      setTimeout(() => setPingStatus({ state: 'idle' }), 4000);
      return;
    }
    const startTime = performance.now();
    try {
      // Ping with the Supabase session JWT: proves the account's live Pro status
      // end-to-end (same check the MCP server enforces for tool calls).
      const headers = await authHeaders();
      const res = await fetch('/api/mcp', { headers });
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      if (res.ok) {
        const data = await res.json();
        const isAccessGranted = data.current_access === 'pro_granted';
        setPingStatus({
          state: isAccessGranted ? 'success' : 'error',
          ms: latency,
          message: isAccessGranted
            ? `Pro Online (${latency}ms)`
            : `Free (Upgrade Required)`
        });
      } else {
        setPingStatus({ state: 'error', message: `HTTP ${res.status}` });
      }
    } catch (err: any) {
      setPingStatus({ state: 'error', message: err?.message || 'Offline' });
    }
    setTimeout(() => {
      setPingStatus({ state: 'idle' });
    }, 4000);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountSaved(false);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          name: fullName.trim() || user?.name || 'Creator',
          email: email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (updateProfile) {
        await updateProfile({ name: fullName.trim() || user?.name || 'Creator' });
      }
      if (data.emailChangePending) {
        setAccountNotice('Name saved. Check both inboxes to confirm the email change.');
      } else {
        setAccountSaved(true);
        setTimeout(() => setAccountSaved(false), 2500);
      }
    } catch (err: any) {
      setAccountError(err?.message || 'Save failed');
    }
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    // No team backend yet: generate a shareable signup link so the inviter can
    // send it manually. The invited member is listed as "Invited" (pending),
    // not as an active member.
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${encodeURIComponent(inviteRole.toLowerCase())}&from=${encodeURIComponent(ownerEmail || 'team')}`;
    setInviteLink(link);
    setTeamMembers(prev => {
      if (prev.some(m => m.email.toLowerCase() === inviteEmail.toLowerCase())) return prev;
      return [
        ...prev,
        {
          id: Date.now(),
          name: inviteEmail.split('@')[0],
          email: inviteEmail,
          role: `${inviteRole} (invited)`,
          avatar: (inviteEmail[0] || 'I').toUpperCase()
        }
      ];
    });
    setInviteEmail('');
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 2500);
  };

  // 1-Click Code Agent Key Resolution & Prompt Builder (21st.dev style)
  const effectiveKeyForDisplay = freshKey || customKeyInput.trim() || (activeKeyPrefix ? `${activeKeyPrefix}…` : 'rv_live_••••••••••••••••');

  const ensureActiveKey = async (): Promise<string | null> => {
    if (freshKey) return freshKey;
    if (customKeyInput.trim().startsWith('rv_') || customKeyInput.trim().startsWith('rb_')) {
      const k = customKeyInput.trim();
      setFreshKey(k);
      try { sessionStorage.setItem('retentionvolt_active_mcp_key', k); } catch {}
      return k;
    }
    setCreatingKey(true);
    setKeysError(null);
    try {
      const headers = await authHeaders();
      const toolLabels: Record<string, string> = {
        cursor: 'Cursor Agent Key',
        claude_code: 'Claude Code Key',
        antigravity: 'Antigravity Key',
        windsurf: 'Windsurf Key',
        codex: 'Codex Key',
        v0: 'v0 Key',
        other: 'Universal Agent Key',
      };
      const keyName = `${toolLabels[activeTool] || 'Agent Key'} - ${new Date().toLocaleDateString('it-IT')}`;
      const res = await fetch('/api/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: keyName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Impossibile generare la chiave');
      if (data.key) {
        setFreshKey(data.key);
        try { sessionStorage.setItem('retentionvolt_active_mcp_key', data.key); } catch {}
        setSelectedKeyId(data.record?.id || null);
        setMcpKeys(prev => [data.record, ...prev.filter(k => k.id !== data.record?.id)]);
        return data.key;
      }
    } catch (err: any) {
      setKeysError(err?.message || 'Errore durante la creazione della chiave');
    } finally {
      setCreatingKey(false);
    }
    return null;
  };

  const getAgentPrompt = (tool: string, keyVal?: string) => {
    const k = keyVal || effectiveKeyForDisplay;
    switch (tool) {
      case 'cursor':
        return `Configura il server MCP di RetentionVolt in questo workspace Cursor.
Aggiungi la configurazione al file .cursor/mcp.json:

{
  "mcpServers": {
    "retentionvolt": {
      "url": "${mcpServerUrl}",
      "headers": {
        "Authorization": "Bearer ${k}"
      }
    }
  }
}

Crea o aggiorna il file .cursor/mcp.json con questa configurazione e verifica la connessione richiamando i tool disponibili.`;

      case 'claude_code':
        return `Installa e connetti il server MCP di RetentionVolt per Claude Code eseguendo questo comando:
claude mcp add --transport http retentionvolt "${mcpServerUrl}" --header "Authorization: Bearer ${k}"

Verifica la connessione ed elenca i tool MCP disponibili.`;

      case 'antigravity':
        return `Configura il server MCP di RetentionVolt nel mio workspace Antigravity.
Aggiungi alla configurazione MCP dell'ambiente:
- Nome Server: retentionvolt
- Tipo: Streamable HTTP
- Endpoint: ${mcpServerUrl}
- Header: Authorization: Bearer ${k}

Salva la configurazione e verifica la disponibilità dei tool di analisi e retention video.`;

      case 'windsurf':
        return `Configura il server MCP di RetentionVolt in Windsurf.
Aggiungi la seguente configurazione a ~/.codeium/windsurf/mcp_config.json:

{
  "mcpServers": {
    "retentionvolt": {
      "url": "${mcpServerUrl}",
      "headers": {
        "Authorization": "Bearer ${k}"
      }
    }
  }
}

Salva il file e verifica gli strumenti di montaggio e pacing di RetentionVolt.`;

      case 'codex':
        return `Configura il server MCP di RetentionVolt in Codex tramite CLI:
codex mcp add retentionvolt "${mcpServerUrl}" --header "Authorization: Bearer ${k}"`;

      case 'v0':
        return `In v0, configura un Custom Tool Endpoint con i seguenti parametri:
URL: ${mcpServerUrl}
Headers: { "Authorization": "Bearer ${k}" }`;

      default:
        return `Configura il server MCP di RetentionVolt nel mio ambiente di sviluppo:
- Nome: retentionvolt
- Endpoint: ${mcpServerUrl}
- Headers:
  Authorization: Bearer ${k}

Salva la configurazione nel file MCP appropriato per questo editor e verifica la connessione.`;
    }
  };

  const getCliCommand = (tool: string, keyVal?: string) => {
    const k = keyVal || effectiveKeyForDisplay;
    if (tool === 'claude_code') {
      return `claude mcp add --transport http retentionvolt "${mcpServerUrl}" --header "Authorization: Bearer ${k}"`;
    }
    return `codex mcp add retentionvolt "${mcpServerUrl}" --header "Authorization: Bearer ${k}"`;
  };

  const getJsonConfig = (tool: string, keyVal?: string) => {
    const k = keyVal || effectiveKeyForDisplay;
    return `{\n  "mcpServers": {\n    "retentionvolt": {\n      "url": "${mcpServerUrl}",\n      "headers": {\n        "Authorization": "Bearer ${k}"\n      }\n    }\n  }\n}`;
  };

  const handleCopyAgentSetup = async (format: 'agent_prompt' | 'cli' | 'json') => {
    try {
      let key: string | null = freshKey || (customKeyInput.trim() ? customKeyInput.trim() : null);
      if (!key) {
        key = await ensureActiveKey();
      }
      if (!key) return;

      let contentToCopy = '';
      if (format === 'agent_prompt') {
        contentToCopy = getAgentPrompt(activeTool, key);
      } else if (format === 'cli') {
        contentToCopy = getCliCommand(activeTool, key);
      } else {
        contentToCopy = getJsonConfig(activeTool, key);
      }

      await navigator.clipboard.writeText(contentToCopy);
      setCopiedFormat(format);
      const label = activeTool === 'cursor' ? 'Cursor' :
                    activeTool === 'claude_code' ? 'Claude Code' :
                    activeTool === 'antigravity' ? 'Antigravity' :
                    activeTool === 'windsurf' ? 'Windsurf' :
                    activeTool === 'codex' ? 'Codex' : 'Code Agent';
      setCopyToastMessage(
        format === 'agent_prompt'
          ? `✅ Messaggio per ${label} copiato con la tua API Key! Incollalo nella chat dell'editor (Cmd+V).`
          : format === 'cli'
          ? `✅ Comando CLI copiato con la tua API Key! Incollalo nel terminale.`
          : `✅ Configurazione JSON copiata con la tua API Key!`
      );
      setTimeout(() => {
        setCopiedFormat(null);
        setCopyToastMessage(null);
      }, 5000);
    } catch (err: any) {
      setKeysError(err?.message || 'Errore durante la copia');
    }
  };

  const examplePrompts = [
    {
      id: 1,
      title: 'Ricerca tagli e ritmo per creator',
      prompt: 'Utilizza il server MCP retentionvolt per cercare tutti i video di MrBeast con oltre 25 CPM e forniscimi la timeline dei primi 30 secondi con le inquadrature usate.'
    },
    {
      id: 2,
      title: 'Estrai formula Hook 0-15s',
      prompt: 'Interroga il tool get_retention_flow di retentionvolt con objective="hook_0_15s" e spiegami perché funziona a livello psicologico e di retention.'
    },
    {
      id: 3,
      title: 'Pattern Motion Graphic per Remotion / CSS',
      prompt: 'Chiama il tool get_motion_pattern con pattern_id="MG-001" ed estrai il codice snippet CSS/Tailwind per replicare l\'animazione cinetica.'
    },
    {
      id: 4,
      title: 'Blueprint psicologico miniatura',
      prompt: 'Usa get_thumbnail_blueprint per analizzare la composizione e generare una ricetta visiva ad alto CTR in stile Marques Brownlee.'
    }
  ];

  return (
    <div className={`w-full min-h-screen bg-[#0e0e0e] text-white flex flex-col font-sans antialiased ${isModal ? 'fixed inset-0 z-50 overflow-y-auto' : ''}`}>
      
      {/* Top Bar (Mobbin-style full-width bar) */}
      <header className="sticky top-0 z-40 w-full bg-[#0e0e0e] border-b border-[#1c1e24] px-4 sm:px-8 h-16 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          {isModal ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-xs font-mono text-[#8e8e8e] hover:text-white transition-colors p-1 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to library</span>
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-mono text-[#8e8e8e] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to library</span>
            </Link>
          )}
          <div className="h-4 w-px bg-[#262832] hidden sm:block" />
          <h2 className="text-sm font-bold text-white tracking-tight hidden sm:block">Settings</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#d6336c] text-white flex items-center justify-center font-bold text-xs uppercase">
            {fullName ? fullName.charAt(0) : 'A'}
          </div>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 text-[#8e8e8e] hover:text-white transition-colors ml-2"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Full-Screen Layout: Mobbin Left Sidebar + Content */}
      <div className="flex-1 max-w-[1500px] w-full mx-auto flex flex-col md:flex-row">
        
        {/* Left Sidebar (5 exact Mobbin items) */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#1c1e24] p-4 sm:p-6 space-y-6 shrink-0 bg-[#0e0e0e]">
          <div className="text-xs font-mono uppercase tracking-wider text-[#666] px-3 font-semibold">
            Settings
          </div>

          <nav className="space-y-1">
            {/* 1. Account */}
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'account'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Account</span>
            </button>

            {/* 2. Preferences */}
            <button
              onClick={() => setActiveTab('preferences')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'preferences'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Preferences</span>
            </button>

            {/* 3. Plan & Billing */}
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'billing'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-white/5'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Plan &amp; Billing</span>
            </button>

            {/* 4. Team */}
            <button
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'team'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team</span>
            </button>

            {/* 5. MCP (PRO) */}
            <button
              onClick={() => setActiveTab('mcp')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'mcp'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <McpIcon className={`w-3.5 h-3.5 ${activeTab === 'mcp' ? 'text-black' : 'text-[#d1fe17]'}`} />
                <span>MCP</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                activeTab === 'mcp'
                  ? 'bg-black text-[#d1fe17]'
                  : 'bg-[#d1fe17]/10 text-[#d1fe17] border border-[#d1fe17]/20'
              }`}>
                PRO
              </span>
            </button>
          </nav>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 p-6 sm:p-10 md:p-12 overflow-y-auto max-w-4xl space-y-8">
          
          {/* ================= SECTION 1: ACCOUNT ================= */}
          {activeTab === 'account' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Account</h1>
                <p className="text-xs sm:text-sm text-[#8e8e8e] mt-1.5">
                  Manage your personal details, email address, password and active sessions.
                </p>
              </div>

              {/* Profile Card */}
              <form onSubmit={handleSaveAccount} className="p-6 sm:p-7 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#d6336c] text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-lg uppercase">
                    {fullName ? fullName.charAt(0) : 'A'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Profile</h3>
                    <p className="text-xs text-[#8e8e8e] mt-0.5">{user?.email || 'Signed in'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#8e8e8e]">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#444] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-[#8e8e8e]">Username</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#666]">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl pl-8 pr-4 py-2.5 text-xs text-white focus:border-[#444] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[#8e8e8e]">Email Address</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setAccountNotice(null); }}
                      className="flex-1 bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#444] focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-[#666]">Changing email requires confirmation from both addresses.</p>
                </div>

                {accountError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{accountError}</div>
                )}
                {accountNotice && (
                  <div className="p-3 rounded-xl bg-[#d1fe17]/5 border border-[#d1fe17]/30 text-[#d1fe17] text-xs">{accountNotice}</div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-full bg-white hover:bg-[#e0e0e0] text-black text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                  >
                    {accountSaved ? <Check className="w-4 h-4 text-emerald-600" /> : null}
                    <span>{accountSaved ? 'Saved Changes' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>

              {/* Password & Security */}
              <div className="p-6 sm:p-7 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Lock className="w-4 h-4 text-[#8e8e8e]" />
                  <span>Security &amp; Password</span>
                </div>
                <p className="text-xs text-[#8e8e8e]">Change your password. Signed in with Google? Set a password here to enable email login.</p>
                <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#8e8e8e]">Current password</label>
                    <input
                      type="password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      autoComplete="current-password"
                      className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#444] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#8e8e8e]">New password (min 8 chars)</label>
                      <input
                        type="password"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        autoComplete="new-password"
                        className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#444] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#8e8e8e]">Confirm new password</label>
                      <input
                        type="password"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        autoComplete="new-password"
                        className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#444] focus:outline-none"
                      />
                    </div>
                  </div>
                  {pwStatus.type !== 'idle' && pwStatus.msg && (
                    <div className={`p-3 rounded-xl text-xs border ${
                      pwStatus.type === 'ok'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                      {pwStatus.msg}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all disabled:opacity-60"
                  >
                    {pwLoading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              </div>

              {/* Danger Zone */}
              <div className="p-6 rounded-2xl bg-red-950/10 border border-red-900/20 space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</h4>
                <p className="text-xs text-[#8e8e8e]">Permanently delete your account: cancels any active subscription, revokes API keys, deletes profile data. This cannot be undone.</p>
                <form onSubmit={handleDeleteAccount} className="space-y-2.5">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder='Type DELETE to confirm'
                    className="w-full sm:max-w-xs bg-[#0c0d10] border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#666] focus:border-red-500 focus:outline-none"
                  />
                  {deleteError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{deleteError}</div>
                  )}
                  <div>
                    <button
                      type="submit"
                      disabled={deleteLoading}
                      className="px-4 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      {deleteLoading ? 'Deleting…' : 'Delete Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================= SECTION 2: PREFERENCES ================= */}
          {activeTab === 'preferences' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Preferences</h1>
                <p className="text-xs sm:text-sm text-[#8e8e8e] mt-1.5">
                  Customize your viewing experience, editing workflow, and default NLE exports.
                </p>
              </div>

              <div className="p-6 sm:p-7 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-6">
                {/* Theme Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">Interface Theme</label>
                  <p className="text-xs text-[#8e8e8e]">Select how Retentionvolt looks to you.</p>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {(['dark', 'system', 'light'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => { setSelectedTheme(mode); persistPrefs({ theme: mode }); }}
                        className={`p-3 rounded-xl border text-xs font-medium capitalize text-center transition-all ${
                          selectedTheme === mode
                            ? 'bg-white text-black font-bold border-white shadow-sm'
                            : 'bg-[#0c0d10] text-[#8e8e8e] border-[#242732] hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Primary NLE Workflow */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">Primary NLE Software</label>
                  <p className="text-xs text-[#8e8e8e]">Default timeline export format for one-click exports.</p>
                  <select
                    value={primaryNle}
                    onChange={(e) => { setPrimaryNle(e.target.value); persistPrefs({ primaryNle: e.target.value }); }}
                    className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="premiere">Adobe Premiere Pro (.edl / .xml)</option>
                    <option value="resolve">DaVinci Resolve (.drp / .xml)</option>
                    <option value="fcp">Final Cut Pro (.fcpxml)</option>
                    <option value="capcut">CapCut (.json timeline)</option>
                  </select>
                </div>

                <div className="h-px bg-white/5" />

                {/* Toggles */}
                <div className="space-y-4 text-xs">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-semibold text-white">Autoplay Video References on Hover</div>
                      <div className="text-[#8e8e8e] text-[11px] mt-0.5">Silently play reference previews when hovering cards</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoplayVideos}
                      onChange={(e) => { setAutoplayVideos(e.target.checked); persistPrefs({ autoplayVideos: e.target.checked }); }}
                      className="w-4 h-4 accent-[#d1fe17] rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-semibold text-white">High-Resolution Previews</div>
                      <div className="text-[#8e8e8e] text-[11px] mt-0.5">Stream 1080p60 timelines by default</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={highQualityPreview}
                      onChange={(e) => { setHighQualityPreview(e.target.checked); persistPrefs({ highQualityPreview: e.target.checked }); }}
                      className="w-4 h-4 accent-[#d1fe17] rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-semibold text-white">Audio &amp; Haptic Cues on Copy</div>
                      <div className="text-[#8e8e8e] text-[11px] mt-0.5">Subtle sound feedback when copying prompts or code</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={audioFeedback}
                      onChange={(e) => { setAudioFeedback(e.target.checked); persistPrefs({ audioFeedback: e.target.checked }); }}
                      className="w-4 h-4 accent-[#d1fe17] rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-semibold text-white">Weekly Retention Digest Email</div>
                      <div className="text-[#8e8e8e] text-[11px] mt-0.5">Get top viral hook breakdowns in your inbox</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailDigest}
                      onChange={(e) => { setEmailDigest(e.target.checked); persistPrefs({ emailDigest: e.target.checked }); }}
                      className="w-4 h-4 accent-[#d1fe17] rounded cursor-pointer"
                    />
                  </label>
                </div>
                {prefsSaved && (
                  <div className="text-[11px] font-mono text-[#d1fe17]">Preferences saved ✓</div>
                )}
              </div>
            </div>
          )}

          {/* ================= SECTION 3: PLAN & BILLING ================= */}
          {activeTab === 'billing' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Plan &amp; Billing</h1>
                <p className="text-xs sm:text-sm text-[#8e8e8e] mt-1.5">
                  Manage your subscription tier, billing cycle, invoices and payment methods.
                </p>
              </div>

              {/* Current Plan Card */}
              <div className="p-6 sm:p-7 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase text-[#8e8e8e]">Current Plan</div>
                    <div className="text-xl font-extrabold text-white mt-0.5 flex items-center gap-2">
                      <span>{isProUser ? 'Creator Pro' : 'Starter Free'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                        isProUser
                          ? 'bg-[#d1fe17]/10 text-[#d1fe17] border-[#d1fe17]/30'
                          : 'bg-white/10 text-white/80 border-white/20'
                      }`}>
                        {isProUser ? 'Active (Pro)' : 'Active (Free)'}
                      </span>
                    </div>
                    <div className="text-xs text-[#aaa] mt-1">
                      {isProUser
                        ? '$12/month (or $6/mo annual with 50% discount) • Unlimited videos & CyberMCP server'
                        : '$0/forever • Limited to 4 featured studies • MCP & EDL exports locked'}
                    </div>
                    {/* Real subscription status line */}
                    {billingLoading && (
                      <div className="text-[11px] text-[#666] mt-2 font-mono">Loading live subscription…</div>
                    )}
                    {!billingLoading && billing?.hasSubscription && (
                      <div className="text-[11px] text-[#8e8e8e] mt-2 space-y-0.5">
                        <div className="font-mono">
                          Status: <span className="text-white font-bold">{billing.status}</span>
                          {billing.isTrialing && billing.trialEnd && (
                            <span className="text-[#d1fe17]"> • trial ends {new Date(billing.trialEnd).toLocaleDateString()}</span>
                          )}
                          {billing.currentPeriodEnd && !billing.isTrialing && (
                            <span> • renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}</span>
                          )}
                        </div>
                        {billing.cancelAtPeriodEnd && (
                          <div className="font-mono text-amber-300">
                            Cancels at period end{billing.currentPeriodEnd ? ` (${new Date(billing.currentPeriodEnd).toLocaleDateString()})` : ''} — access until then.
                          </div>
                        )}
                        {billing.plan && (
                          <div className="font-mono">
                            {(billing.plan.amount / 100).toFixed(2)} {billing.plan.currency.toUpperCase()} / {billing.plan.interval}
                          </div>
                        )}
                      </div>
                    )}
                    {!billingLoading && billing && !billing.hasSubscription && isProUser && (
                      <div className="text-[11px] text-amber-300 mt-2 font-mono">
                        No active Stripe subscription found — status will sync from the next webhook.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isProUser && (
                      <button
                        onClick={onOpenPaywall}
                        className="px-4 py-2 rounded-full bg-white hover:bg-[#e0e0e0] text-black text-xs font-bold transition-all shadow-sm"
                      >
                        Upgrade to Pro (7-Day Trial)
                      </button>
                    )}
                    {billing?.hasSubscription && (
                      <button
                        onClick={openPortal}
                        disabled={portalLoading}
                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 disabled:opacity-60"
                      >
                        {portalLoading ? 'Opening…' : 'Manage billing (portal)'}
                      </button>
                    )}
                  </div>
                </div>

                {billingError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3">
                    <span>{billingError}</span>
                    <button onClick={fetchBilling} className="underline shrink-0">Retry</button>
                  </div>
                )}

                {billingSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between gap-3">
                    <span>{billingSuccess}</span>
                    <button onClick={() => setBillingSuccess(null)} className="underline shrink-0">Dismiss</button>
                  </div>
                )}

                {/* Cancel / trial controls (real) */}
                {billing?.hasSubscription && !billing.cancelAtPeriodEnd && billing.status !== 'canceled' && (
                  <div className="p-4 rounded-xl bg-[#0c0d10] border border-[#242732] space-y-2.5">
                    <div className="text-xs font-bold text-white">
                      {billing.isTrialing ? 'Free trial active' : 'Cancel subscription'}
                    </div>
                    <p className="text-[11px] text-[#8e8e8e]">
                      {billing.isTrialing
                        ? 'Cancel now and you will never be charged. Access ends immediately.'
                        : 'Standard cancel keeps Pro until the end of the billing period. Immediate cancel ends access now.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {billing.isTrialing ? (
                        <button
                          onClick={() => handleCancelAction('cancel_trial', 'Trial canceled — you were not charged.')}
                          disabled={billingAction !== null}
                          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors disabled:opacity-60"
                        >
                          {billingAction === 'cancel_trial' ? 'Canceling…' : 'Cancel free trial (no charge)'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCancelAction('cancel_at_period_end', 'Subscription will cancel at period end. Pro stays active until then.')}
                            disabled={billingAction !== null}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors disabled:opacity-60"
                          >
                            {billingAction === 'cancel_at_period_end' ? 'Canceling…' : 'Cancel at period end'}
                          </button>
                          <button
                            onClick={() => handleCancelAction('cancel_immediate')}
                            disabled={billingAction !== null}
                            className="px-4 py-2 rounded-lg bg-transparent hover:bg-red-500/10 text-red-400 text-xs font-bold transition-colors border border-red-500/30 disabled:opacity-60"
                          >
                            {billingAction === 'cancel_immediate' ? 'Canceling…' : 'Cancel immediately'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="h-px bg-white/5" />

                {/* Plan Benefits Checklist */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-white font-mono uppercase">
                    {isProUser ? 'Pro Benefits Active' : 'Free Tier vs Pro'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#ccc]">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#d1fe17]" />
                      <span>{isProUser ? 'Unlimited video references & timeline breakdowns' : '4 Featured video breakdowns (Pro: 500k+ cuts)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isProUser ? <Check className="w-4 h-4 text-[#d1fe17]" /> : <X className="w-4 h-4 text-red-400" />}
                      <span className={isProUser ? '' : 'text-[#888]'}>Remote CyberMCP AI Server Access (Pro only)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#d1fe17]" />
                      <span>High-CTR thumbnail blueprints &amp; prompts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isProUser ? <Check className="w-4 h-4 text-[#d1fe17]" /> : <X className="w-4 h-4 text-red-400" />}
                      <span className={isProUser ? '' : 'text-[#888]'}>Export EDL &amp; XML for Premiere and DaVinci Resolve</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method (real card from Stripe) */}
              <div className="p-6 sm:p-7 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase font-mono">Payment Method</h3>
                    <p className="text-xs text-[#8e8e8e] mt-0.5">Card charged for recurring subscriptions.</p>
                  </div>
                  {billing?.hasSubscription && (
                    <button
                      onClick={openPortal}
                      disabled={portalLoading}
                      className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors disabled:opacity-60"
                    >
                      {portalLoading ? 'Opening…' : 'Update'}
                    </button>
                  )}
                </div>

                {billingLoading ? (
                  <div className="text-[11px] text-[#666] font-mono">Loading card…</div>
                ) : billing?.card ? (
                  <div className="p-3.5 rounded-xl bg-[#0c0d10] border border-[#242732] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="px-2.5 py-1.5 rounded-md bg-[#222] border border-white/10 font-bold text-xs font-mono uppercase">
                        {billing.card.brand.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white capitalize">
                          {billing.card.brand} ending in {billing.card.last4}
                        </div>
                        <div className="text-[11px] text-[#666]">
                          Expires {String(billing.card.expMonth).padStart(2, '0')}/{billing.card.expYear}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">Default</span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#0c0d10] border border-[#242732] text-xs text-[#8e8e8e]">
                    {billing?.hasSubscription
                      ? 'No card on file — update it in the billing portal.'
                      : 'No payment method — it will be collected at Pro checkout.'}
                  </div>
                )}
                <p className="text-[11px] text-[#666]">
                  Cards are managed securely by Stripe. To remove a card, cancel the subscription first, then remove it in the portal.
                </p>
              </div>

              {/* Billing History Table (real invoices) */}
              <div className="p-6 sm:p-7 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase font-mono">Invoices &amp; Receipts</h3>
                  {!billingLoading && billing?.invoices && billing.invoices.length > 0 && (
                    <button onClick={fetchBilling} className="text-[11px] font-mono text-[#8e8e8e] hover:text-white transition-colors">
                      Refresh
                    </button>
                  )}
                </div>
                {billingLoading ? (
                  <div className="text-[11px] text-[#666] font-mono">Loading invoices…</div>
                ) : billing?.invoices && billing.invoices.length > 0 ? (
                  <div className="divide-y divide-white/5 text-xs">
                    {billing.invoices.map(inv => (
                      <div key={inv.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="text-white font-semibold">Creator Pro</div>
                          <div className="text-[11px] text-[#666]">
                            {new Date(inv.date).toLocaleDateString()} • {inv.id.slice(0, 12)}…
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-white font-bold">
                            {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                            inv.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-300'
                          }`}>
                            {inv.status}
                          </span>
                          {inv.pdfUrl && (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#8e8e8e] hover:text-white"
                              title="Download Invoice"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#8e8e8e]">
                    {billing?.hasSubscription ? 'No invoices yet.' : 'No invoices — subscribe to Pro to start your billing history.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= SECTION 4: TEAM ================= */}
          {activeTab === 'team' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Team</h1>
                <p className="text-xs sm:text-sm text-[#8e8e8e] mt-1.5">
                  Collaborate with editors, directors, and designers in your workspace.
                </p>
              </div>

              {/* Team Workspace Overview */}
              <div className="p-6 rounded-2xl bg-[#14151a] border border-[#20222a] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-base font-bold text-white">Retention Studio Workspace</div>
                  <div className="text-xs text-[#8e8e8e] mt-0.5">Single-seat workspace — team seats coming soon</div>
                </div>
              </div>

              {/* Invite Form */}
              <form onSubmit={handleSendInvite} className="p-6 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <h3 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#d1fe17]" />
                  <span>Invite New Team Member</span>
                </h3>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full sm:flex-1 bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full sm:w-36 bg-[#0c0d10] border border-[#242732] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  >
                    <option>Editor</option>
                    <option>Viewer</option>
                    <option>Admin</option>
                  </select>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-[#e0e0e0] text-black text-xs font-bold transition-all shrink-0"
                  >
                    {inviteSent ? 'Link ready!' : 'Create invite link'}
                  </button>
                </div>
                <p className="text-[11px] text-[#666]">Email sending is not wired yet — copy the link below and send it manually.</p>
                {inviteLink && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteLink}
                      className="flex-1 bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs font-mono text-[#d1fe17] focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(inviteLink, setCopiedUrl)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#22252f] hover:bg-[#2c303c] text-xs font-mono font-semibold text-white border border-[#2e3240] transition-colors"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#d1fe17]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </form>

              {/* Members List */}
              <div className="p-6 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <h3 className="text-xs font-bold text-white uppercase font-mono">Members ({teamMembers.length})</h3>
                <div className="divide-y divide-white/5">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#222] border border-white/10 text-white flex items-center justify-center font-bold text-xs">
                          {member.avatar}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{member.name}</div>
                          <div className="text-[11px] text-[#8e8e8e]">{member.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-white/5 text-white font-mono text-[11px] border border-white/10">
                          {member.role}
                        </span>
                        {member.role !== 'Owner' && (
                          <button
                            onClick={() => setTeamMembers(prev => prev.filter(m => m.id !== member.id))}
                            className="text-[#666] hover:text-red-400 p-1.5 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 5: MCP (PRO) ================= */}
          {activeTab === 'mcp' && (
            <div className="space-y-8 animate-fade-in">
              
              {/* Header */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                      <span>MCP</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#d1fe17] text-black tracking-wider uppercase">
                        PRO
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-[#8e8e8e] mt-1.5">
                      Allow AI agents to interact with Retentionvolt directly.
                    </p>
                  </div>

                  <a
                    href="#tools"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8e8e8e] hover:text-white transition-colors"
                  >
                    <span>See documentation</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Mobbin Exact Beta Notice Banner */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#15171d] border border-[#22252f] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-black/60 text-[#d1fe17] font-bold text-[10px] border border-[#d1fe17]/30">
                      BETA
                    </span>
                    <p className="text-[11px] text-[#8e8e8e]">
                      MCP has unlimited usage during beta but may require AI credits in the future.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={runPingTest}
                      disabled={pingStatus.state === 'testing'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181a20] hover:bg-[#22252e] border border-[#272a35] text-[11px] font-mono text-white transition-all"
                    >
                      <RefreshCw className={`w-3 h-3 text-[#d1fe17] ${pingStatus.state === 'testing' ? 'animate-spin' : ''}`} />
                      <span>
                        {pingStatus.state === 'testing' 
                          ? 'Testing...' 
                          : pingStatus.state === 'success' 
                            ? `✓ ${pingStatus.ms}ms` 
                            : 'Ping Server'}
                      </span>
                    </button>

                    <button
                      onClick={onOpenPaywall}
                      className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-[#e0e0e0] transition-colors"
                    >
                      Get Pro
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobbin Section: Connect tool or Pro Lock Banner */}
              {!isProUser ? (
                <div className="p-8 sm:p-10 rounded-3xl bg-[#14151a] border border-[#20222a] text-center space-y-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#d1fe17]/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="w-16 h-16 rounded-2xl bg-[#d1fe17]/10 border border-[#d1fe17]/30 flex items-center justify-center mx-auto text-[#d1fe17] shadow-lg">
                    <Lock className="w-8 h-8" />
                  </div>

                  <div className="space-y-2 max-w-lg mx-auto">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d1fe17]/10 text-[#d1fe17] text-[11px] font-mono font-bold uppercase tracking-wider border border-[#d1fe17]/30">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pro Exclusive Integration</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      Connect AI Agents via CyberMCP
                    </h2>
                    <p className="text-xs sm:text-sm text-[#8e8e8e] leading-relaxed">
                      Allow Claude Code, Cursor, Codex, and autonomous video agents to search 500k+ retention curves, pacing benchmarks, shot cadences, and Remotion templates directly from your editor.
                    </p>
                  </div>

                  {/* Pricing Card Banner */}
                  <div className="p-5 rounded-2xl bg-[#181a22] border border-[#272a38] flex flex-col sm:flex-row items-center justify-between gap-4 text-left max-w-lg mx-auto">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-[#8e8e8e]">Pro Annual Membership</div>
                      <div className="text-xl font-bold text-white flex items-baseline gap-1.5 mt-0.5">
                        <span>$6 / month</span>
                        <span className="text-xs text-[#8e8e8e] font-normal">($72 billed annually)</span>
                      </div>
                      <div className="text-xs font-mono text-[#d1fe17] mt-1 flex items-center gap-1">
                        <span>✨ 50% discount • 7-day free trial included</span>
                      </div>
                    </div>

                    <button
                      onClick={onOpenPaywall}
                      className="w-full sm:w-auto px-6 py-3 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md shrink-0 active:scale-[0.99]"
                    >
                      Start 7-Day Free Trial
                    </button>
                  </div>

                  {/* Feature preview list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto pt-2 text-xs">
                    <div className="p-3 rounded-xl bg-[#101115] border border-white/5 flex items-center gap-2.5 text-[#ccc]">
                      <Check className="w-4 h-4 text-[#d1fe17] shrink-0" />
                      <span>Full Streamable HTTP endpoint for AI agents</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#101115] border border-white/5 flex items-center gap-2.5 text-[#ccc]">
                      <Check className="w-4 h-4 text-[#d1fe17] shrink-0" />
                      <span>Dedicated Pro Bearer token &amp; CLI setup</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#101115] border border-white/5 flex items-center gap-2.5 text-[#ccc]">
                      <Check className="w-4 h-4 text-[#d1fe17] shrink-0" />
                      <span>Zero rate limit caps during beta</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#101115] border border-white/5 flex items-center gap-2.5 text-[#ccc]">
                      <Check className="w-4 h-4 text-[#d1fe17] shrink-0" />
                      <span>All 8 CyberMCP tools unlocked</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d1fe17]/10 text-[#d1fe17] text-[10px] font-mono font-bold uppercase tracking-wider border border-[#d1fe17]/20 mb-1">
                          <Zap className="w-3 h-3" />
                          <span>Setup 1-Click Zero Frizione</span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                          <span>Installa nel tuo Code Agent</span>
                        </h3>
                        <p className="text-xs text-[#8e8e8e] mt-0.5">
                          La chiave API viene generata e inserita direttamente nel messaggio. Incollalo una volta sola nella chat o nel terminale del tuo editor.
                        </p>
                      </div>

                      {/* Toast Banner if copied */}
                      {copyToastMessage && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#d1fe17]/10 border border-[#d1fe17]/30 text-[#d1fe17] text-xs font-mono animate-fade-in shadow-lg">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{copyToastMessage}</span>
                        </div>
                      )}
                    </div>

                    {/* Client Selector (Tabs) */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <button
                        onClick={() => setActiveTool('cursor')}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                          activeTool === 'cursor'
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#14151a] text-[#8e8e8e] border-[#20222a] hover:text-white hover:border-[#333]'
                        }`}
                      >
                        <Code2 className="w-4 h-4" />
                        <span>Cursor</span>
                      </button>

                      <button
                        onClick={() => setActiveTool('claude_code')}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                          activeTool === 'claude_code'
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#14151a] text-[#8e8e8e] border-[#20222a] hover:text-white hover:border-[#333]'
                        }`}
                      >
                        <Terminal className="w-4 h-4" />
                        <span>Claude Code</span>
                      </button>

                      <button
                        onClick={() => setActiveTool('antigravity')}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                          activeTool === 'antigravity'
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#14151a] text-[#8e8e8e] border-[#20222a] hover:text-white hover:border-[#333]'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-[#d1fe17]" />
                        <span>Antigravity</span>
                      </button>

                      <button
                        onClick={() => setActiveTool('windsurf')}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                          activeTool === 'windsurf'
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#14151a] text-[#8e8e8e] border-[#20222a] hover:text-white hover:border-[#333]'
                        }`}
                      >
                        <Cpu className="w-4 h-4" />
                        <span>Windsurf</span>
                      </button>

                      <button
                        onClick={() => setActiveTool('codex')}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                          activeTool === 'codex'
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#14151a] text-[#8e8e8e] border-[#20222a] hover:text-white hover:border-[#333]'
                        }`}
                      >
                        <Bot className="w-4 h-4" />
                        <span>Codex</span>
                      </button>

                      <button
                        onClick={() => setActiveTool('other')}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
                          activeTool === 'other'
                            ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                            : 'bg-[#14151a] text-[#8e8e8e] border-[#20222a] hover:text-white hover:border-[#333]'
                        }`}
                      >
                        <Server className="w-4 h-4" />
                        <span>Universal / Altri</span>
                      </button>
                    </div>

                    {/* HERO 1-CLICK INTEGRATION CARD */}
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-[#161821] to-[#101116] border border-[#262938] shadow-2xl relative overflow-hidden space-y-5">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-[#d1fe17]/5 rounded-full blur-3xl pointer-events-none" />

                      {/* Top status bar inside hero */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#d1fe17] animate-pulse" />
                          <span className="font-mono text-[#8e8e8e]">
                            {freshKey || customKeyInput ? (
                              <span className="text-white">
                                Chiave API attiva inclusa: <code className="text-[#d1fe17] bg-black/40 px-1.5 py-0.5 rounded font-mono font-bold">{(freshKey || customKeyInput).slice(0, 14)}••••••••</code>
                              </span>
                            ) : (
                              <span>Nessuna configurazione manuale: cliccando su Copia verrà creata e inserita la chiave in automatico.</span>
                            )}
                          </span>
                        </div>

                        {freshKey && (
                          <button
                            onClick={() => {
                              setFreshKey(null);
                              try { sessionStorage.removeItem('retentionvolt_active_mcp_key'); } catch {}
                            }}
                            className="text-[11px] font-mono text-[#8e8e8e] hover:text-white underline underline-offset-2 self-start sm:self-auto"
                          >
                            Genera nuova chiave al prossimo click
                          </button>
                        )}
                      </div>

                      {/* Primary 1-Click Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                        <button
                          onClick={() => handleCopyAgentSetup('agent_prompt')}
                          disabled={creatingKey}
                          className="flex-1 py-4 px-6 rounded-2xl bg-[#d1fe17] hover:bg-[#d8ff33] text-black font-extrabold text-sm transition-all shadow-xl flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50"
                        >
                          {creatingKey ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Generazione chiave in corso…</span>
                            </>
                          ) : copiedFormat === 'agent_prompt' ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Messaggio Copiato con API Key!</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 fill-black" />
                              <span>
                                Copia Messaggio per {
                                  activeTool === 'cursor' ? 'Cursor Composer' :
                                  activeTool === 'claude_code' ? 'Claude Code' :
                                  activeTool === 'antigravity' ? 'Antigravity' :
                                  activeTool === 'windsurf' ? 'Windsurf' :
                                  activeTool === 'codex' ? 'Codex' : 'Code Agent'
                                } (1-Click)
                              </span>
                            </>
                          )}
                        </button>

                        {(activeTool === 'claude_code' || activeTool === 'codex') && (
                          <button
                            onClick={() => handleCopyAgentSetup('cli')}
                            disabled={creatingKey}
                            className="py-4 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-mono font-bold text-xs transition-colors border border-white/10 flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
                          >
                            {copiedFormat === 'cli' ? <Check className="w-4 h-4 text-[#d1fe17]" /> : <Terminal className="w-4 h-4" />}
                            <span>Copia Comando CLI</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCopyAgentSetup('json')}
                          disabled={creatingKey}
                          className="py-4 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-mono font-bold text-xs transition-colors border border-white/10 flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
                        >
                          {copiedFormat === 'json' ? <Check className="w-4 h-4 text-[#d1fe17]" /> : <Code2 className="w-4 h-4" />}
                          <span>Copia JSON</span>
                        </button>
                      </div>

                      {/* Format preview selector tabs */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSetupFormat('agent_prompt')}
                              className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-colors ${
                                setupFormat === 'agent_prompt'
                                  ? 'bg-white/10 text-white font-bold'
                                  : 'text-[#8e8e8e] hover:text-white'
                              }`}
                            >
                              💬 Prompt per Code Agent (Consigliato)
                            </button>
                            <button
                              onClick={() => setSetupFormat('json')}
                              className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-colors ${
                                setupFormat === 'json'
                                  ? 'bg-white/10 text-white font-bold'
                                  : 'text-[#8e8e8e] hover:text-white'
                              }`}
                            >
                              ⚙️ Configurazione JSON (.mcp.json)
                            </button>
                            {(activeTool === 'claude_code' || activeTool === 'codex') && (
                              <button
                                onClick={() => setSetupFormat('cli')}
                                className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-colors ${
                                  setupFormat === 'cli'
                                    ? 'bg-white/10 text-white font-bold'
                                    : 'text-[#8e8e8e] hover:text-white'
                                }`}
                              >
                                💻 Comando Terminale
                              </button>
                            )}
                          </div>

                          <span className="text-[11px] font-mono text-[#8e8e8e] hidden sm:inline">
                            {setupFormat === 'agent_prompt'
                              ? 'Incolla nella chat del tuo editor'
                              : setupFormat === 'json'
                              ? 'Configurazione JSON per workspace'
                              : 'Esegui nel tuo terminale'}
                          </span>
                        </div>

                        {/* Code box preview */}
                        <div className="relative group">
                          <pre className="p-4 rounded-2xl bg-[#090a0d] border border-[#222532] text-xs font-mono text-[#ccc] overflow-x-auto max-h-72 leading-relaxed">
                            {setupFormat === 'agent_prompt' && getAgentPrompt(activeTool)}
                            {setupFormat === 'json' && getJsonConfig(activeTool)}
                            {setupFormat === 'cli' && getCliCommand(activeTool)}
                          </pre>
                          <button
                            onClick={() => handleCopyAgentSetup(setupFormat)}
                            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-colors border border-white/10"
                          >
                            {copiedFormat === setupFormat ? <Check className="w-3.5 h-3.5 text-[#d1fe17]" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedFormat === setupFormat ? 'Copiato' : 'Copia'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 3 Step Instruction Guide */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                        <div className="p-3.5 rounded-xl bg-[#0b0c10] border border-white/5 space-y-1">
                          <div className="font-mono text-[#d1fe17] font-bold">1. Copia in 1-Click</div>
                          <p className="text-[#8e8e8e] text-[11px] leading-relaxed">
                            La chiave API Pro viene incorporata istantaneamente nel messaggio.
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#0b0c10] border border-white/5 space-y-1">
                          <div className="font-mono text-white font-bold">2. Incolla nell'Agente</div>
                          <p className="text-[#8e8e8e] text-[11px] leading-relaxed">
                            Apri la chat del tuo editor (Cursor Composer, Windsurf, Claude Code, Antigravity) e premi Cmd+V.
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#0b0c10] border border-white/5 space-y-1">
                          <div className="font-mono text-[#d1fe17] font-bold">3. Pronto all'Uso</div>
                          <p className="text-[#8e8e8e] text-[11px] leading-relaxed">
                            L'agente si connette a RetentionVolt con tutti gli 8 tool CyberMCP sbloccati.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

              {/* Server Credentials Box */}
              <div className="p-6 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#d1fe17]" />
                  <span>Server Connection Credentials</span>
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-[#8e8e8e] uppercase">MCP Server URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={mcpServerUrl}
                        className="flex-1 bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none select-all"
                      />
                      <button
                        onClick={() => handleCopy(mcpServerUrl, setCopiedUrl)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#22252f] hover:bg-[#2c303c] text-xs font-mono font-semibold text-white border border-[#2e3240] transition-colors"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#d1fe17]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Use existing key input */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-mono text-[#8e8e8e] uppercase">
                      <span>Hai già una chiave salvata? (opzionale)</span>
                      {customKeyInput && (
                        <button
                          onClick={() => {
                            setCustomKeyInput('');
                            try { sessionStorage.removeItem('retentionvolt_active_mcp_key'); } catch {}
                          }}
                          className="text-[10px] text-[#8e8e8e] hover:text-white"
                        >
                          Rimuovi
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Incolla una chiave salvata (rv_live_...) per usarla nei comandi sopra"
                      value={customKeyInput}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setCustomKeyInput(val);
                        if (val.startsWith('rv_') || val.startsWith('rb_')) {
                          setFreshKey(val);
                          try { sessionStorage.setItem('retentionvolt_active_mcp_key', val); } catch {}
                        }
                      }}
                      className="w-full bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-[#d1fe17]/40"
                    />
                  </div>

                  {/* Fresh key banner — shown ONCE after creation */}
                  {freshKey && (
                    <div className="p-4 rounded-xl bg-[#d1fe17]/5 border border-[#d1fe17]/30 space-y-2.5">
                      <div className="text-xs font-bold text-[#d1fe17] flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>New API key created — copy it now, it will never be shown again</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            readOnly
                            value={freshKey}
                            className="w-full bg-[#0c0d10] border border-[#d1fe17]/40 rounded-xl pl-4 pr-10 py-2.5 text-xs font-mono text-[#d1fe17] focus:outline-none select-all"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
                            title={showApiKey ? 'Hide key' : 'Show key'}
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={() => handleCopy(freshKey, setCopiedKey)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#d1fe17] hover:bg-[#e2ff4d] text-black text-xs font-mono font-bold transition-colors"
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey ? 'Copied' : 'Copy key'}</span>
                        </button>
                      </div>
                      <button
                        onClick={() => setFreshKey(null)}
                        className="text-[11px] text-[#8e8e8e] hover:text-white transition-colors"
                      >
                        I saved it securely — hide this key
                      </button>
                    </div>
                  )}

                  {/* Key list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-[#8e8e8e] uppercase">Your API keys</label>
                      <button
                        onClick={fetchMcpKeys}
                        disabled={keysLoading}
                        className="text-[11px] font-mono text-[#8e8e8e] hover:text-white transition-colors"
                      >
                        {keysLoading ? 'Loading…' : 'Refresh'}
                      </button>
                    </div>
                    {keysError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                        {keysError}
                      </div>
                    )}
                    {migrationMissing && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                        Server tables are being provisioned — keys will be available shortly. If this persists, contact support.
                      </div>
                    )}
                    {!keysLoading && mcpKeys.length === 0 && !keysError && (
                      <div className="p-3.5 rounded-xl bg-[#0c0d10] border border-[#242732] text-xs text-[#8e8e8e]">
                        No API keys yet. Create your first key below to connect AI agents.
                      </div>
                    )}
                    <div className="space-y-2">
                      {mcpKeys.map(k => (
                        <div
                          key={k.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                            k.isActive
                              ? (selectedKeyId === k.id || (!selectedKeyId && activeKeyRecord?.id === k.id))
                                ? 'bg-[#15171d] border-[#d1fe17]/40'
                                : 'bg-[#0c0d10] border-[#242732]'
                              : 'bg-[#0c0d10] border-[#242732] opacity-50'
                          }`}
                        >
                          <button
                            onClick={() => k.isActive && setSelectedKeyId(k.id)}
                            disabled={!k.isActive}
                            className="flex-1 min-w-0 text-left"
                            title={k.isActive ? 'Use this key in the configs below' : 'Revoked'}
                          >
                            <div className="text-xs font-bold text-white truncate">{k.name}</div>
                            <div className="text-[11px] font-mono text-[#8e8e8e] mt-0.5">
                              {k.prefix}…{k.lastUsedAt ? ` • last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' • never used'}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {!k.isActive ? (
                              <span className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 text-[#888] border border-white/10">REVOKED</span>
                            ) : (selectedKeyId === k.id || (!selectedKeyId && activeKeyRecord?.id === k.id)) ? (
                              <span className="text-[10px] font-mono px-2 py-1 rounded bg-[#d1fe17]/10 text-[#d1fe17] border border-[#d1fe17]/30 font-bold">IN USE</span>
                            ) : null}
                            {k.isActive && (
                              <button
                                onClick={() => handleRevokeKey(k.id)}
                                disabled={revokingId === k.id}
                                className="p-2 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Revoke key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Create key */}
                  <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Key name (e.g. MacBook Cursor)"
                      maxLength={60}
                      className="flex-1 bg-[#0c0d10] border border-[#242732] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#444]"
                    />
                    <button
                      type="submit"
                      disabled={creatingKey}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#e0e0e0] text-black text-xs font-bold transition-all shrink-0 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{creatingKey ? 'Creating…' : 'Create new key'}</span>
                    </button>
                  </form>
                  <p className="text-[11px] text-[#666]">
                    Keys are stored hashed and can be revoked anytime. Full keys are shown only once at creation.
                  </p>
                </div>
              </div>
              </>
              )}

              {/* Tools Catalog */}
              <div id="tools" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#d1fe17]" />
                    <span>Available MCP Tools ({MCP_TOOLS_DEFINITIONS.length})</span>
                  </h3>
                  <span className="text-xs text-[#8e8e8e]">Exposed via CyberMCP</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {MCP_TOOLS_DEFINITIONS.map((tool, idx) => {
                    const isSelected = selectedToolIndex === idx;
                    return (
                      <div
                        key={tool.name}
                        onClick={() => setSelectedToolIndex(isSelected ? null : idx)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#15171d] border-[#d1fe17]/40 shadow-sm'
                            : 'bg-[#121419] border-[#1e2028] hover:border-[#2e3240]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-xs text-[#d1fe17] truncate">
                            {tool.name}
                          </span>
                          <span className="text-[10px] font-mono text-[#666] bg-black/40 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                            tool
                          </span>
                        </div>

                        <p className="text-xs text-[#aaa] mt-1.5 line-clamp-2 leading-relaxed">
                          {tool.description}
                        </p>

                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-xs font-mono animate-fade-in">
                            <div className="text-[10px] uppercase text-[#777]">Input Parameters</div>
                            <div className="bg-[#0a0b0e] p-3 rounded-lg text-[#888] overflow-x-auto max-h-36">
                              <pre className="text-[11px] text-[#ccc]">
                                {JSON.stringify(tool.inputSchema.properties || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Example Prompts */}
              <div className="p-6 rounded-2xl bg-[#14151a] border border-[#20222a] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#d1fe17]" />
                    <span>Example Agent Prompts</span>
                  </h3>
                  <span className="text-xs text-[#8e8e8e]">Click to copy</span>
                </div>

                <div className="space-y-3">
                  {examplePrompts.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleCopyPrompt(item.prompt, item.id)}
                      className="p-3.5 rounded-xl bg-[#0c0d10] hover:bg-[#181a22] border border-[#222530] hover:border-[#333745] cursor-pointer transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-white group-hover:text-[#d1fe17] transition-colors">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#888] truncate mt-0.5">
                          "{item.prompt}"
                        </div>
                      </div>

                      <button className="shrink-0 p-2 rounded-lg bg-white/5 group-hover:bg-white/10 text-white text-xs font-mono">
                        {copiedPromptId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#888] group-hover:text-white" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

    </div>
  );
};
