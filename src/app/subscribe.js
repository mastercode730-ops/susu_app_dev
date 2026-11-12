// Public subscribe flow (no login): choose plan → pay via QR / bank →
// upload payment screenshot → get a request ID. Mirrors frontend/subscribe.html.
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { durText, inr } from '../lib/subscription';
import { Badge, Button, Card, Field, Header, Loading, Row, Screen, SectionTitle, tap } from '../ui/kit';
import { toast } from '../ui/Toast';
import { colors, font, radius, space, weight } from '../theme';

// Loaded lazily so an over-the-air update to a build without the native
// module degrades to a message instead of crashing the app on import.
function getPicker() {
  try { return require('expo-image-picker'); } catch { return null; }
}

const MAX_CHARS = 6 * 1024 * 1024;

function PlanCard({ plan, selected, onPress }) {
  const feats = [
    `${durText(plan.DurationDays)} full access`,
    plan.MaxSubUsers == null ? 'Unlimited sub users' : `${plan.MaxSubUsers} sub users`,
    plan.MaxCustomers == null ? 'Unlimited customers' : `${plan.MaxCustomers} customers`,
  ];
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={[styles.plan, selected && styles.planSel]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.planName}>{plan.PlanName}</Text>
        <Text style={styles.planPrice}>{inr(plan.Price)}<Text style={styles.planDur}>  / {durText(plan.DurationDays)}</Text></Text>
        {plan.Description ? <Text style={styles.planDesc}>{plan.Description}</Text> : null}
        {feats.map((f) => (
          <View key={f} style={styles.feat}><Ionicons name="checkmark" size={14} color={colors.success} /><Text style={styles.featText}>{f}</Text></View>
        ))}
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={selected ? colors.brand : colors.faint} />
    </Pressable>
  );
}

function CopyRow({ label, value, copy }) {
  if (!value) return null;
  return (
    <View style={styles.copyRow}>
      <Text style={styles.copyLabel}>{label}</Text>
      <Text style={styles.copyValue} selectable>{value}</Text>
      {copy ? (
        <Pressable hitSlop={8} onPress={async () => { await Clipboard.setStringAsync(String(value)); toast(`${label} copied`); }}>
          <Ionicons name="copy-outline" size={18} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusCheck({ initialMobile, initialId }) {
  const [mobile, setMobile] = useState(initialMobile || '');
  const [rid, setRid] = useState(initialId ? String(initialId) : '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  useEffect(() => { if (initialId) setRid(String(initialId)); }, [initialId]);
  useEffect(() => { if (initialMobile) setMobile(initialMobile); }, [initialMobile]);
  const check = async () => {
    if (!/^\d{10}$/.test(mobile) || !rid) { toast('Mobile aur Request ID dono daalein', 'error'); return; }
    setBusy(true);
    const r = await api.get('/api/subscription/request-status', { mobile, requestId: rid }, { auth: false });
    setBusy(false);
    setRes(r);
  };
  const d = res?.success ? res.data : null;
  const tone = d?.Status === 'Approved' ? 'success' : d?.Status === 'Rejected' ? 'danger' : 'warning';
  return (
    <Card>
      <SectionTitle title="Check request status" style={{ marginTop: 0 }} />
      <Row gap={10}>
        <Field label="Mobile" value={mobile} onChangeText={(v) => setMobile(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} containerStyle={{ flex: 1.3 }} />
        <Field label="Request ID" value={rid} onChangeText={(v) => setRid(v.replace(/\D/g, ''))} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
      </Row>
      <Button title="Check status" variant="outline" icon="search" loading={busy} onPress={check} />
      {res && !res.success ? <Text style={[styles.note, { color: colors.danger }]}>{res.message}</Text> : null}
      {d ? (
        <View style={{ marginTop: space.md }}>
          <Row justify="space-between"><Text style={styles.bold}>#{d.RequestID} · {d.PlanName}</Text><Badge text={d.Status} tone={tone} /></Row>
          {d.Remarks ? <Text style={styles.note}>Remarks: {d.Remarks}</Text> : null}
          <Text style={styles.note}>
            {d.Status === 'Approved' ? 'Aapka account ready hai — share kiye gaye mobile/password se login karein.'
              : d.Status === 'Rejected' ? 'Payment verify nahi ho paya. Support se contact karein.'
              : 'Verification chal raha hai. Thodi der baad check karein.'}
          </Text>
          {d.Status === 'Approved' ? <Button title="Go to login" icon="log-in-outline" onPress={() => router.replace('/login')} style={{ marginTop: space.sm }} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function Subscribe() {
  const params = useLocalSearchParams();
  const renew = !!params.renew;
  const [plans, setPlans] = useState(null);
  const [info, setInfo] = useState({});
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState(String(params.mobile || '').replace(/\D/g, '').slice(0, 10));
  const [email, setEmail] = useState('');
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState('');
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, i] = await Promise.all([
        api.get('/api/subscription/plans', null, { auth: false }),
        api.get('/api/subscription/payment-info', null, { auth: false }),
      ]);
      if (p?.success) setPlans(p.data || []);
      else { setPlans([]); setLoadErr(p?.message || 'Plans load nahi ho paye'); }
      if (i?.success) setInfo(i.data || {});
    })();
  }, []);

  const pickImage = async () => {
    const ImagePicker = getPicker();
    if (!ImagePicker?.launchImageLibraryAsync) {
      toast('Image upload is app version mein available nahi hai — app update karein ya website se submit karein.', 'error');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const a = r.assets[0];
    const mime = a.mimeType === 'image/png' || a.mimeType === 'image/webp' ? a.mimeType : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${a.base64}`;
    if (dataUrl.length > MAX_CHARS) { toast('Image bahut badi hai, chhoti screenshot chunein', 'error'); return; }
    setShot({ uri: a.uri, dataUrl });
  };

  const submit = async () => {
    if (!name.trim()) return toast('Naam likhein', 'error');
    if (!/^\d{10}$/.test(mobile)) return toast('Mobile number 10 digit ka hona chahiye', 'error');
    if (!shot) return toast('Payment screenshot upload karein', 'error');
    setBusy(true);
    const r = await api.post('/api/subscription/request', {
      planId: plan.PlanID, fullName: name.trim(), mobile, email: email.trim(),
      transactionRef: utr.trim(), notes: notes.trim(), screenshot: shot.dataUrl,
    }, { auth: false });
    setBusy(false);
    if (!r?.success) return toast(r?.message || 'Submit nahi ho paya', 'error');
    setDone(r);
    setStep(4);
  };

  const back = () => {
    if (step > 1 && step < 4) setStep(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const bankRows = [['UPI ID', info.UpiID, true], ['Payee', info.PayeeName], ['Bank', info.BankName], ['Account holder', info.AccountHolder],
    ['Account no.', info.AccountNumber, true], ['IFSC', info.IFSC, true], ['Branch', info.BranchName], ['Support', info.SupportMobile]];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={renew ? 'Renew subscription' : 'Get a subscription'} subtitle={step < 4 ? `Step ${step} of 3` : 'Submitted'} onBack={back} />
      <Screen scroll>
        {step === 1 ? (
          <>
            <Text style={styles.lead}>Plan chunein, QR / bank se payment karein aur screenshot upload karein. Verification ke baad aapko Admin login milega.</Text>
            {plans === null ? <Loading inline /> : null}
            {loadErr ? <Text style={[styles.note, { color: colors.danger }]}>{loadErr}</Text> : null}
            {(plans || []).map((p) => <PlanCard key={p.PlanID} plan={p} selected={plan?.PlanID === p.PlanID} onPress={() => setPlan(p)} />)}
            <Button title="Continue to payment" iconRight="arrow-forward" disabled={!plan} onPress={() => setStep(2)} style={{ marginTop: space.sm }} />
          </>
        ) : null}

        {step === 2 && plan ? (
          <>
            <Card style={{ alignItems: 'center' }}>
              <Text style={styles.muted}>Amount to pay</Text>
              <Text style={styles.amount}>{inr(plan.Price)}</Text>
              <Text style={styles.muted}>{plan.PlanName} · {durText(plan.DurationDays)}</Text>
              {info.QrImage ? <Image source={{ uri: info.QrImage }} style={styles.qr} resizeMode="contain" /> : <Text style={[styles.note, { marginTop: space.md }]}>QR available nahi hai — bank details use karein.</Text>}
            </Card>
            <Card>
              <SectionTitle title="Bank / UPI details" style={{ marginTop: 0 }} />
              {bankRows.map(([k, v, c]) => <CopyRow key={k} label={k} value={v} copy={c} />)}
              {info.Instructions ? <Text style={styles.instructions}>{info.Instructions}</Text> : null}
            </Card>
            <Button title="I have paid" iconRight="arrow-forward" onPress={() => setStep(3)} />
          </>
        ) : null}

        {step === 3 && plan ? (
          <Card>
            <Field label="Full name *" icon="person-outline" value={name} onChangeText={setName} maxLength={150} />
            <Field label="Mobile * (your login ID)" icon="call-outline" value={mobile} onChangeText={(v) => setMobile(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} />
            <Field label="Email (optional)" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={150} />
            <Field label="Transaction / UTR ref (optional)" icon="receipt-outline" value={utr} onChangeText={setUtr} maxLength={100} />
            <Text style={styles.label}>PAYMENT SCREENSHOT *</Text>
            <Pressable onPress={pickImage} style={styles.drop}>
              {shot ? <Image source={{ uri: shot.uri }} style={styles.preview} resizeMode="contain" /> : (
                <><Ionicons name="image-outline" size={30} color={colors.brand} /><Text style={styles.muted}>Tap to choose screenshot</Text></>
              )}
            </Pressable>
            <Field label="Note for verifier (optional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />
            <Button title="Submit for verification" icon="cloud-upload-outline" loading={busy} onPress={submit} />
          </Card>
        ) : null}

        {step === 4 && done ? (
          <Card style={{ alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            <Text style={styles.doneTitle}>Payment submitted</Text>
            <Text style={styles.muted}>Your request ID</Text>
            <Text style={styles.rid}>#{done.requestId}</Text>
            <Text style={[styles.note, { textAlign: 'center' }]}>Isse save kar lijiye. Verification ke baad Super Manager aapko Admin login details share karenge.</Text>
          </Card>
        ) : null}

        <StatusCheck initialMobile={step === 4 ? mobile : undefined} initialId={done?.requestId} />
        <Button title="Already have an account? Login" variant="ghost" icon="log-in-outline" onPress={() => router.replace('/login')} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, fontSize: font.sm, marginBottom: space.md, lineHeight: 19 },
  plan: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, borderWidth: 2, borderColor: colors.border },
  planSel: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  planName: { fontSize: font.lg, fontWeight: weight.heavy, color: colors.text },
  planPrice: { fontSize: font.xl, fontWeight: weight.heavy, color: colors.brandText, marginTop: 2 },
  planDur: { fontSize: font.sm, color: colors.muted, fontWeight: weight.semi },
  planDesc: { fontSize: font.sm, color: colors.muted, marginTop: 4, marginBottom: 4 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  featText: { fontSize: font.sm, color: colors.textSoft },
  amount: { fontSize: 34, fontWeight: weight.heavy, color: colors.text, marginVertical: 2 },
  muted: { color: colors.muted, fontSize: font.sm },
  qr: { width: 230, height: 230, marginTop: space.md, borderRadius: radius.md, backgroundColor: '#fff' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  copyLabel: { width: 110, fontSize: font.sm, color: colors.muted },
  copyValue: { flex: 1, fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  instructions: { marginTop: space.md, backgroundColor: colors.brandSoft, padding: space.md, borderRadius: radius.md, color: colors.textSoft, fontSize: font.sm, lineHeight: 19 },
  label: { fontSize: font.xs, fontWeight: weight.bold, color: colors.muted, marginBottom: 6, letterSpacing: 0.5 },
  drop: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: radius.md, minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: space.md, padding: space.sm },
  preview: { width: '100%', height: 260 },
  note: { color: colors.muted, fontSize: font.sm, marginTop: space.sm, lineHeight: 19 },
  bold: { fontWeight: weight.heavy, color: colors.text, fontSize: font.md },
  doneTitle: { fontSize: font.xl, fontWeight: weight.heavy, color: colors.text, marginTop: space.sm },
  rid: { fontSize: 30, fontWeight: weight.heavy, color: colors.brandText, marginVertical: space.sm },
});
