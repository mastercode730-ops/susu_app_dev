// The signed-in Admin's plan, usage against plan limits, renewal history.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Guard from '../components/Guard';
import { daysLeftText, inr, subDate } from '../lib/subscription';
import { Badge, Button, Card, EmptyState, Header, KeyValue, Loading, Row, Screen, SectionTitle } from '../ui/kit';
import { colors, font, radius, space, weight } from '../theme';

function Usage({ label, used, max }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.uLabel}>{label}</Text>
      <Text style={styles.uValue}>{used}<Text style={styles.uMax}>{max == null ? ' / unlimited' : ` / ${max}`}</Text></Text>
      {max != null ? <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }, pct >= 100 && { backgroundColor: colors.danger }]} /></View> : null}
    </View>
  );
}

function MySubscription() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    const r = await api.get('/api/auth/subscription');
    setData(r?.success ? r.data : { error: r?.message || 'Load nahi ho paya' });
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.subscription;
  const soon = s && s.state === 'active' && s.daysLeft <= 7;
  const [label, tone] = !s ? ['', 'neutral'] : s.state === 'blocked' ? ['Blocked', 'danger'] : s.state === 'expired' ? ['Expired', 'danger'] : soon ? ['Expiring soon', 'warning'] : ['Active', 'success'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="My Subscription" />
      <Screen scroll>
        {!data ? <Loading inline /> : data.error ? <EmptyState icon="alert-circle-outline" title={data.error} /> : !s ? (
          <EmptyState icon="ribbon-outline" title="No subscription plan" message="Ye account subscription plan par nahi hai (legacy account)." />
        ) : (
          <>
            <Card>
              <Row justify="space-between">
                <Text style={styles.plan}>{s.planName || 'Plan'}</Text>
                <Badge text={label} tone={tone} />
              </Row>
              <Text style={styles.days}>{daysLeftText(s.daysLeft)}</Text>
              <KeyValue label="Started" value={subDate(s.startDate)} />
              <KeyValue label="Valid till" value={subDate(s.endDate)} />
              <Row gap={16} style={{ marginTop: space.md }}>
                <Usage label="Sub users" used={data.usage?.SubUsers ?? 0} max={s.maxSubUsers} />
                <Usage label="Customers" used={data.usage?.Customers ?? 0} max={s.maxCustomers} />
              </Row>
              <Button
                title="Renew / upgrade plan"
                icon="refresh"
                onPress={() => router.push({ pathname: '/subscribe', params: { renew: '1', mobile: user?.Mobile || '' } })}
                style={{ marginTop: space.lg }}
              />
              <Text style={styles.note}>Renew karne par bache hue din jude rehte hain.</Text>
            </Card>
            {data.history?.length ? (
              <>
                <SectionTitle title="History" />
                <Card padded={false}>
                  {data.history.map((h) => (
                    <View key={h.HistoryID} style={styles.hist}>
                      <Row justify="space-between">
                        <Text style={styles.histTitle}>{h.Action}{h.PlanName ? ` · ${h.PlanName}` : ''}</Text>
                        <Text style={styles.histMeta}>{subDate(h.CreatedOn)}</Text>
                      </Row>
                      {h.EndDate ? <Text style={styles.histMeta}>Valid till {subDate(h.EndDate)}{h.Amount != null && (h.Action === 'CREATE' || h.Action === 'RENEW') ? ` · ${inr(h.Amount)}` : ''}</Text> : null}
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </Screen>
    </View>
  );
}

export default function MySubscriptionScreen() {
  return <Guard ownerOnly title="My Subscription"><MySubscription /></Guard>;
}

const styles = StyleSheet.create({
  plan: { fontSize: font.xl, fontWeight: weight.heavy, color: colors.text },
  days: { fontSize: font.md, fontWeight: weight.bold, color: colors.brandText, marginTop: 4, marginBottom: space.sm },
  uLabel: { fontSize: font.xs, color: colors.muted, fontWeight: weight.bold, textTransform: 'uppercase' },
  uValue: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text, marginTop: 2 },
  uMax: { fontSize: font.sm, color: colors.muted, fontWeight: weight.semi },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.brand },
  note: { fontSize: font.xs, color: colors.muted, textAlign: 'center', marginTop: space.sm },
  hist: { padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  histTitle: { fontWeight: weight.bold, color: colors.text },
  histMeta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
});
