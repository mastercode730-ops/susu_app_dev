// Super Manager home: KPIs + pending payment requests (polled, with a toast
// when a new payment arrives while the screen is open).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import SmGuard from '../../components/SmGuard';
import { usePolling } from '../../lib/hooks';
import { inr, subDateTime } from '../../lib/subscription';
import { Badge, Button, Card, EmptyState, Header, HeaderAction, ListRow, Loading, Row, Screen, Segmented, SectionTitle, StatTile } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { colors, font, space } from '../../theme';

const STATUSES = [
  { key: 'Pending', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
];

function SmHome() {
  const { displayName, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('Pending');
  const [rows, setRows] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lastId = useRef(null);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api.get('/api/sm/summary'), api.get('/api/sm/requests', { status })]);
    if (s?.success) setSummary(s.data || {});
    setRows(r?.success ? r.data || [] : []);
  }, [status]);

  useEffect(() => { setRows(null); load(); }, [load]);

  // Alert on new payments while the app is open.
  usePolling(async () => {
    const n = await api.get('/api/sm/notifications');
    if (!n?.success) return;
    if (lastId.current !== null && n.latestId > lastId.current) {
      const first = n.items?.[0];
      toast(first ? `New payment: ${first.FullName} · ${inr(first.Amount)}` : 'New payment received');
      load();
    }
    lastId.current = n.latestId || 0;
  }, 20000);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Super Manager" subtitle={displayName} back={false} right={<HeaderAction icon="log-out-outline" onPress={() => setConfirm(true)} />} />
      <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
        <Row gap={10}>
          <StatTile label="Pending" icon="time" tone="warning" value={summary ? String(summary.PendingRequests ?? 0) : '–'} />
          <StatTile label="Active admins" icon="people" tone="success" value={summary ? String(summary.ActiveAdmins ?? 0) : '–'} onPress={() => router.push({ pathname: '/sm/admins', params: { filter: 'active' } })} />
        </Row>
        <Row gap={10} style={{ marginTop: 10 }}>
          <StatTile label="Expiring 7d" icon="hourglass" tone="brand" value={summary ? String(summary.ExpiringSoon ?? 0) : '–'} onPress={() => router.push({ pathname: '/sm/admins', params: { filter: 'expiring' } })} />
          <StatTile label="This month" icon="trending-up" value={summary ? inr(summary.RevenueThisMonth || 0) : '–'} />
        </Row>
        <Button title="Manage admins" icon="people-outline" variant="outline" onPress={() => router.push('/sm/admins')} style={{ marginTop: space.md }} />

        <SectionTitle title="Payment requests" />
        <Segmented value={status} onChange={setStatus} options={STATUSES} small style={{ marginBottom: space.sm }} />
        {rows === null ? <Loading inline /> : rows.length === 0 ? (
          <EmptyState icon="receipt-outline" title={status === 'Pending' ? 'All caught up' : 'Nothing here'} message={status === 'Pending' ? 'Koi pending payment nahi hai.' : undefined} />
        ) : (
          <Card padded={false}>
            {rows.map((r) => (
              <ListRow
                key={r.RequestID}
                title={`#${r.RequestID} · ${r.FullName}`}
                subtitle={`${r.Mobile} · ${r.PlanName} · ${inr(r.Amount)}`}
                meta={subDateTime(r.CreatedOn)}
                right={<Badge text={r.RequestType === 'RENEW' ? 'Renewal' : r.Status === 'Processing' ? 'Pending' : r.Status} tone={r.RequestType === 'RENEW' ? 'info' : r.Status === 'Approved' ? 'success' : r.Status === 'Rejected' ? 'danger' : 'warning'} />}
                onPress={() => router.push({ pathname: '/sm/request', params: { id: String(r.RequestID) } })}
              />
            ))}
          </Card>
        )}
        <Text style={styles.note}>Plans, QR / bank details aur Super Managers web portal se manage karein.</Text>
      </Screen>
      <Sheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title="Log out?"
        footer={<Row gap={10}><Button title="Stay" variant="outline" onPress={() => setConfirm(false)} style={{ flex: 1 }} /><Button title="Logout" variant="danger" onPress={() => { setConfirm(false); logout(); }} style={{ flex: 1.3 }} /></Row>}
      />
    </View>
  );
}

export default function SmIndex() {
  return <SmGuard><SmHome /></SmGuard>;
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: font.xs, textAlign: 'center', marginTop: space.lg },
});
