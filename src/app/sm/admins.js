// Subscribed Admins: filter, extend plan, block/unblock, reset password.
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import SmGuard from '../../components/SmGuard';
import { useDebounced } from '../../lib/hooks';
import { daysLeftText, durText, genPassword, inr, subDate, subDateTime } from '../../lib/subscription';
import { Badge, Button, Card, Chip, EmptyState, Field, Header, Loading, Row, Screen } from '../../ui/kit';
import { SelectField, Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { colors, font, radius, space, weight } from '../../theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
  { key: 'blocked', label: 'Blocked' },
];

const isBlocked = (a) => a.IsBlocked === true || a.IsBlocked === 1;
function stateOf(a) {
  if (isBlocked(a)) return ['Blocked', 'danger'];
  if (a.DaysLeft < 0) return ['Expired', 'danger'];
  if (a.DaysLeft <= 7) return ['Expiring', 'warning'];
  return ['Active', 'success'];
}

function AdminsScreen() {
  const params = useLocalSearchParams();
  const [filter, setFilter] = useState(String(params.filter || 'all'));
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [rows, setRows] = useState(null);
  const [plans, setPlans] = useState([]);
  const [sel, setSel] = useState(null);       // admin whose action sheet is open
  const [mode, setMode] = useState(null);     // 'extend' | 'password' | 'block' | 'history'
  const [planId, setPlanId] = useState(null);
  const [amount, setAmount] = useState('');
  const [pwd, setPwd] = useState('');
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/api/sm/admins', { filter, q: dq });
    setRows(r?.success ? r.data || [] : []);
  }, [filter, dq]);
  useEffect(() => { setRows(null); load(); }, [load]);
  useEffect(() => { api.get('/api/sm/plans').then((p) => setPlans(p?.success ? p.data || [] : [])); }, []);

  const open = (a, m) => {
    setSel(a); setMode(m); setPlanId(a.fPlanID); setAmount(''); setPwd(genPassword()); setHistory(null);
    if (m === 'history') api.get(`/api/sm/admins/${a.UID}/history`).then((r) => setHistory(r?.success ? r.data || [] : []));
  };
  const close = () => { setSel(null); setMode(null); };

  const run = async () => {
    setBusy(true);
    let r;
    if (mode === 'extend') r = await api.post(`/api/sm/admins/${sel.UID}/extend`, { planId, amount });
    if (mode === 'block') r = await api.post(`/api/sm/admins/${sel.UID}/block`, { blocked: !isBlocked(sel) });
    if (mode === 'password') r = await api.post(`/api/sm/admins/${sel.UID}/reset-password`, { newPassword: pwd.trim() });
    setBusy(false);
    if (!r?.success) return toast(r?.message || 'Error', 'error');
    if (mode === 'extend') toast(`Valid till ${subDate(r.endDate)}`);
    if (mode === 'block') toast(isBlocked(sel) ? 'Unblocked' : 'Blocked');
    if (mode === 'password') {
      const text = `Yubi7 login\nMobile: ${sel.Mobile}\nNew password: ${pwd.trim()}`;
      Linking.openURL(`https://wa.me/91${sel.Mobile}?text=${encodeURIComponent(text)}`).catch(() => toast('Password reset ho gaya'));
    }
    close();
    load();
  };

  const titles = {
    extend: 'Extend subscription',
    block: sel && isBlocked(sel) ? 'Unblock admin?' : 'Block admin?',
    password: 'Reset password',
    history: 'History',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Admins" subtitle={rows ? `${rows.length} shown` : ' '} />
      <Screen scroll>
        <Row gap={6} wrap style={{ marginBottom: space.sm }}>
          {FILTERS.map((f) => <Chip key={f.key} label={f.label} small selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
        </Row>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search mobile, name or UID…" placeholderTextColor={colors.faint} style={styles.searchInput} />
        </View>
        {rows === null ? <Loading inline /> : rows.length === 0 ? <EmptyState icon="people-outline" title="No admins" /> : rows.map((a) => {
          const [st, tone] = stateOf(a);
          return (
            <Card key={a.UID}>
              <Row justify="space-between">
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{a.FullName || a.Mobile} <Text style={styles.uid}>#{a.UID}</Text></Text>
                  <Text style={styles.meta}>{a.Mobile} · {a.PlanName || '-'}</Text>
                  <Text style={styles.meta}>Till {subDate(a.EndDate)} · {daysLeftText(a.DaysLeft)}</Text>
                  <Text style={styles.meta}>Sub users {a.SubUserCount}{a.MaxSubUsers == null ? '' : `/${a.MaxSubUsers}`} · Customers {a.CustomerCount}{a.MaxCustomers == null ? '' : `/${a.MaxCustomers}`}</Text>
                </View>
                <Badge text={st} tone={tone} />
              </Row>
              <Row gap={6} style={{ marginTop: space.md }}>
                <Button size="sm" title="Extend" variant="success" onPress={() => open(a, 'extend')} style={{ flex: 1 }} />
                <Button size="sm" title={isBlocked(a) ? 'Unblock' : 'Block'} variant={isBlocked(a) ? 'successSoft' : 'dangerSoft'} onPress={() => open(a, 'block')} style={{ flex: 1 }} />
                <Button size="sm" icon="key-outline" variant="outline" onPress={() => open(a, 'password')} />
                <Button size="sm" icon="time-outline" variant="outline" onPress={() => open(a, 'history')} />
              </Row>
            </Card>
          );
        })}
      </Screen>

      <Sheet
        visible={!!sel}
        onClose={close}
        title={mode ? titles[mode] : ''}
        subtitle={sel ? `${sel.FullName || ''} ${sel.Mobile} · #${sel.UID}` : ''}
        footer={mode && mode !== 'history' ? (
          <Row gap={10}>
            <Button title="Cancel" variant="outline" onPress={close} style={{ flex: 1 }} />
            <Button title={mode === 'block' ? (sel && isBlocked(sel) ? 'Unblock' : 'Block') : mode === 'password' ? 'Reset & share' : 'Extend'} variant={mode === 'block' && sel && !isBlocked(sel) ? 'danger' : 'success'} loading={busy} onPress={run} style={{ flex: 1.3 }} />
          </Row>
        ) : null}
      >
        {mode === 'extend' ? (
          <>
            <SelectField label="Plan" value={planId} onChange={setPlanId} searchable={false} options={plans.map((p) => ({ value: p.PlanID, label: `${p.PlanName} — ${durText(p.DurationDays)} — ${inr(p.Price)}` }))} />
            <Field label="Amount received (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="Default: plan price" />
            <Text style={styles.meta}>Active plan: days current end date ke baad jude jayenge. Expired: aaj se shuru.</Text>
          </>
        ) : null}
        {mode === 'block' && sel ? (
          <Text style={styles.body}>{isBlocked(sel) ? 'Admin aur unke staff dobara login kar payenge.' : 'Admin aur unke saare staff turant logout ho jayenge.'}</Text>
        ) : null}
        {mode === 'password' ? (
          <Field label="New password" value={pwd} onChangeText={setPwd} autoCapitalize="none" hint="Reset ke baad WhatsApp par share karne ka option khulega." />
        ) : null}
        {mode === 'history' ? (history === null ? <Loading inline /> : history.length === 0 ? <Text style={styles.body}>No history</Text> : history.map((h) => (
          <View key={h.HistoryID} style={styles.hist}>
            <Row justify="space-between"><Text style={styles.histTitle}>{h.Action}{h.PlanName ? ` · ${h.PlanName}` : ''}</Text><Text style={styles.meta}>{subDateTime(h.CreatedOn)}</Text></Row>
            {h.StartDate ? <Text style={styles.meta}>{subDate(h.StartDate)} → {subDate(h.EndDate)}{h.Amount != null ? ` · ${inr(h.Amount)}` : ''}</Text> : null}
            {h.Remarks ? <Text style={styles.meta}>{h.Remarks}</Text> : null}
          </View>
        ))) : null}
      </Sheet>
    </View>
  );
}

export default function SmAdmins() {
  return <SmGuard><AdminsScreen /></SmGuard>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  searchInput: { flex: 1, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  name: { fontSize: font.md, fontWeight: weight.heavy, color: colors.text },
  uid: { fontSize: font.xs, color: colors.faint },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  body: { fontSize: font.base, color: colors.textSoft, lineHeight: 21 },
  hist: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  histTitle: { fontWeight: weight.bold, color: colors.text },
});
