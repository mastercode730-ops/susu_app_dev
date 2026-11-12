// Review one payment request: screenshot, approve (creates / extends the
// Admin login) or reject with a reason.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import SmGuard from '../../components/SmGuard';
import { durText, genPassword, inr, subDate, subDateTime } from '../../lib/subscription';
import { Badge, Button, Card, Field, Header, KeyValue, Loading, Row, Screen, SectionTitle } from '../../ui/kit';
import { SelectField } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { colors, font, radius, space, weight } from '../../theme';

function RequestScreen() {
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [zoom, setZoom] = useState(false);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([api.get(`/api/sm/requests/${id}`), api.get('/api/sm/plans')]);
    if (!r?.success) { toast(r?.message || 'Request not found', 'error'); return; }
    setData(r);
    setPlans(p?.success ? p.data || [] : []);
    setMobile(r.data.Mobile || '');
    setPlanId(r.data.fPlanID);
    setPassword(r.existingUser ? '' : genPassword());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.bg }}><Header title={`Request #${id}`} /><Loading /></View>;
  const d = data.data;
  const ex = data.existingUser;
  const pending = d.Status === 'Pending' || d.Status === 'Processing';

  const approve = async () => {
    if (!/^\d{10}$/.test(mobile)) return toast('Mobile 10 digit ka hona chahiye', 'error');
    if (!ex && password.trim().length < 4) return toast('Password kam se kam 4 characters', 'error');
    setBusy(true);
    const r = await api.post(`/api/sm/requests/${d.RequestID}/approve`, { mobile, password: password.trim(), planId, remarks: remarks.trim() });
    setBusy(false);
    if (!r?.success) return toast(r?.message || 'Error', 'error');
    setResult(r);
  };

  const reject = async () => {
    if (!remarks.trim()) return toast('Reason likhein (payer ko dikhega)', 'error');
    setBusy(true);
    const r = await api.post(`/api/sm/requests/${d.RequestID}/reject`, { remarks: remarks.trim() });
    setBusy(false);
    if (!r?.success) return toast(r?.message || 'Error', 'error');
    toast('Request rejected');
    router.back();
  };

  const credsText = result ? [
    `Yubi7 Admin account ${result.created ? 'created' : 'renewed'} ✅`,
    `Mobile: ${result.mobile}`,
    result.password ? `Password: ${result.password}` : 'Password: (unchanged)',
    `Plan: ${result.planName}`,
    `Valid till: ${subDate(result.endDate)}`,
  ].join('\n') : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={`Request #${d.RequestID}`} subtitle={d.RequestType === 'RENEW' ? 'Renewal' : 'New subscription'} />
      <Screen scroll>
        <Card>
          <KeyValue label="Name" value={d.FullName} />
          <KeyValue label="Mobile" value={d.Mobile} />
          {d.Email ? <KeyValue label="Email" value={d.Email} /> : null}
          <KeyValue label="Plan" value={`${d.PlanName} · ${durText(d.DurationDays)}`} />
          <KeyValue label="Amount expected" value={inr(d.Amount)} />
          <KeyValue label="UTR / Ref" value={d.TransactionRef || '-'} />
          <KeyValue label="Submitted" value={subDateTime(d.CreatedOn)} />
          {d.Notes ? <KeyValue label="Note" value={d.Notes} /> : null}
        </Card>

        <Pressable onPress={() => setZoom(true)}>
          <Image source={{ uri: d.Screenshot }} style={styles.shot} resizeMode="contain" />
          <Text style={styles.hint}>Tap to enlarge</Text>
        </Pressable>

        {ex ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={18} color={colors.info} />
            <Text style={styles.noticeText}>
              {ex.subscription
                ? `Existing Admin #${ex.UID} (${ex.subscription.planName || '-'}, ends ${subDate(ex.subscription.endDate)}). Approve karne par plan extend hoga.`
                : `Is mobile ka login pehle se hai (UID #${ex.UID}). Isi account par plan lagega; password khali = purana password.`}
            </Text>
          </View>
        ) : null}

        {result ? (
          <Card>
            <SectionTitle title={result.message} style={{ marginTop: 0 }} />
            <Text style={styles.creds} selectable>{credsText}</Text>
            <Row gap={8} style={{ marginTop: space.md }}>
              <Button title="Copy" icon="copy-outline" variant="outline" onPress={async () => { await Clipboard.setStringAsync(credsText); toast('Copied'); }} style={{ flex: 1 }} />
              <Button title="WhatsApp" icon="logo-whatsapp" variant="success" onPress={() => Linking.openURL(`https://wa.me/91${result.mobile}?text=${encodeURIComponent(credsText)}`).catch(() => {})} style={{ flex: 1 }} />
            </Row>
            <Button title="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
          </Card>
        ) : pending ? (
          <Card>
            <SectionTitle title={rejectMode ? 'Reject payment' : ex ? 'Approve & extend' : 'Approve & create Admin login'} style={{ marginTop: 0 }} />
            {!rejectMode ? (
              <>
                <Field label="Login mobile" icon="call-outline" value={mobile} onChangeText={(v) => setMobile(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} />
                <Field
                  label={ex ? 'Password (optional — reset)' : 'Password'}
                  icon="key-outline"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  placeholder={ex ? 'Leave blank to keep current' : ''}
                  right={<Pressable hitSlop={8} onPress={() => setPassword(genPassword())}><Ionicons name="refresh" size={18} color={colors.brand} /></Pressable>}
                />
                <SelectField
                  label="Plan"
                  value={planId}
                  onChange={setPlanId}
                  searchable={false}
                  options={plans.map((p) => ({ value: p.PlanID, label: `${p.PlanName} — ${durText(p.DurationDays)} — ${inr(p.Price)}` }))}
                />
              </>
            ) : null}
            <Field label={rejectMode ? 'Reason (payer will see this)' : 'Remarks (optional)'} value={remarks} onChangeText={setRemarks} maxLength={500} />
            {rejectMode ? (
              <Row gap={8}>
                <Button title="Cancel" variant="outline" onPress={() => setRejectMode(false)} style={{ flex: 1 }} />
                <Button title="Reject" variant="danger" loading={busy} onPress={reject} style={{ flex: 1.3 }} />
              </Row>
            ) : (
              <Row gap={8}>
                <Button title="Reject" variant="dangerSoft" onPress={() => setRejectMode(true)} style={{ flex: 1 }} />
                <Button title="Approve" icon="checkmark" variant="success" loading={busy} onPress={approve} style={{ flex: 1.5 }} />
              </Row>
            )}
          </Card>
        ) : (
          <Card>
            <Row justify="space-between"><Text style={styles.bold}>Status</Text><Badge text={d.Status} tone={d.Status === 'Approved' ? 'success' : 'danger'} /></Row>
            <Text style={styles.hint}>by {d.ReviewedByName || '-'} · {subDateTime(d.ReviewedOn)}{d.fCreatedUID ? ` · Admin #${d.fCreatedUID}` : ''}</Text>
            {d.Remarks ? <Text style={[styles.hint, { textAlign: 'left' }]}>Remarks: {d.Remarks}</Text> : null}
          </Card>
        )}
      </Screen>

      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={styles.zoomBg} onPress={() => setZoom(false)}>
          <Image source={{ uri: d.Screenshot }} style={{ width: '100%', height: '90%' }} resizeMode="contain" />
        </Pressable>
      </Modal>
    </View>
  );
}

export default function SmRequest() {
  return <SmGuard><RequestScreen /></SmGuard>;
}

const styles = StyleSheet.create({
  shot: { width: '100%', height: 320, backgroundColor: colors.card, borderRadius: radius.lg, marginBottom: 4 },
  hint: { textAlign: 'center', color: colors.muted, fontSize: font.xs, marginTop: 4, marginBottom: space.md },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: colors.infoSoft, padding: space.md, borderRadius: radius.md, marginBottom: space.md },
  noticeText: { flex: 1, color: colors.info, fontSize: font.sm, fontWeight: weight.semi },
  creds: { backgroundColor: '#0f172a', color: '#e2e8f0', padding: space.md, borderRadius: radius.md, fontFamily: 'monospace', fontSize: font.base, lineHeight: 22 },
  bold: { fontWeight: weight.heavy, color: colors.text, fontSize: font.md },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
});
