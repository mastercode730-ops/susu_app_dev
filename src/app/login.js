import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { Button, Field, Segmented } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { colors, font, gradients, radius, shadowStrong, space, weight } from '../theme';

function Banner({ msg, ok }) {
  if (!msg) return null;
  return (
    <View style={[styles.banner, ok ? styles.bannerOk : styles.bannerErr]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={ok ? colors.success : colors.danger} />
      <Text style={[styles.bannerText, { color: ok ? colors.success : colors.danger }]}>{msg}</Text>
    </View>
  );
}

// Login page "Change Password" (user or staff) — verified by id + current password.
function ResetPasswordSheet({ visible, onClose, staff }) {
  const [id, setId] = useState('');
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async () => {
    setMsg(null);
    if (!id.trim() || !cur.trim() || !nw.trim()) return setMsg({ t: 'Saare fields bharna zaroori hai' });
    if (nw.trim() !== conf.trim()) return setMsg({ t: 'New password match nahi kar raha' });
    setBusy(true);
    const r = staff
      ? await api.post('/api/auth/reset-subuser-password', { subUserID: id.trim(), currentPassword: cur.trim(), newPassword: nw.trim() }, { auth: false })
      : await api.post('/api/auth/reset-password', { mobile: id.trim(), currentPassword: cur.trim(), newPassword: nw.trim() }, { auth: false });
    setBusy(false);
    if (r?.success) {
      setMsg({ t: r.message || 'Password change ho gaya!', ok: true });
      setCur(''); setNw(''); setConf('');
    } else setMsg({ t: r?.message || 'Kuch galat ho gaya' });
  };
  return (
    <Sheet
      visible={visible}
      onClose={() => { setMsg(null); onClose(); }}
      title="Change Password"
      subtitle={staff ? 'Staff account — verify with SubUser ID and current password' : 'User account — verify with mobile number and current password'}
      footer={<Button title="Change Password" icon="key-outline" loading={busy} onPress={submit} full />}
    >
      <Field label={staff ? 'Staff / Sub User ID' : 'Mobile Number'} icon={staff ? 'id-card-outline' : 'call-outline'} value={id} onChangeText={setId} keyboardType={staff ? 'default' : 'number-pad'} maxLength={staff ? 30 : 10} autoCapitalize="none" placeholder={staff ? 'Enter SubUser ID' : '10 digit mobile number'} />
      <Field label="Current Password" icon="lock-closed-outline" value={cur} onChangeText={setCur} secure placeholder="Current password" />
      <Field label="New Password" icon="key-outline" value={nw} onChangeText={setNw} secure placeholder="New password" />
      <Field label="Confirm New Password" icon="key-outline" value={conf} onChangeText={setConf} secure placeholder="Re-enter new password" />
      <Banner msg={msg?.t} ok={msg?.ok} />
    </Sheet>
  );
}

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login, staffLogin, managerLogin } = useAuth();
  const [tab, setTab] = useState('user');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffPwd, setStaffPwd] = useState('');
  const [smMobile, setSmMobile] = useState('');
  const [smPwd, setSmPwd] = useState('');
  const [expired, setExpired] = useState(false);
  const smPwdRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const pwdRef = useRef(null);
  const staffPwdRef = useRef(null);

  const submit = async () => {
    setError('');
    setExpired(false);
    const isUser = tab === 'user';
    const isSm = tab === 'sm';
    const idVal = (isSm ? smMobile : isUser ? mobile : staffId).trim();
    const pwVal = isSm ? smPwd : (isUser ? password : staffPwd).trim();
    if (!idVal || !pwVal) {
      setError(tab === 'staff' ? 'SubUser ID and password required' : 'Mobile and password required');
      return;
    }
    setBusy(true);
    const r = isSm ? await managerLogin(idVal, pwVal) : isUser ? await login(idVal, pwVal) : await staffLogin(idVal, pwVal);
    setBusy(false);
    if (r.ok) router.replace(isSm ? '/sm' : '/home');
    else {
      setError(r.message || (tab === 'staff' ? 'Invalid or inactive' : 'Invalid credentials'));
      setExpired(isUser && r.code === 'SUBSCRIPTION_EXPIRED');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 36 }]}>
            <View style={styles.logo}><Text style={styles.logoText}>Y7</Text></View>
            <Text style={styles.brand}>Yubi7</Text>
            <Text style={styles.tagline}>Game management, in your pocket</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Segmented
              value={tab}
              onChange={(k) => { setTab(k); setError(''); }}
              options={[{ key: 'user', label: 'Admin', icon: 'person-outline' }, { key: 'staff', label: 'Staff', icon: 'people-outline' }, { key: 'sm', label: 'Manager', icon: 'shield-checkmark-outline' }]}
              style={{ marginBottom: space.lg }}
            />
            {tab === 'user' ? (
              <>
                <Field label="Mobile Number" icon="call-outline" value={mobile} onChangeText={setMobile} keyboardType="number-pad" maxLength={10} placeholder="10 digit mobile number" returnKeyType="next" onSubmitEditing={() => pwdRef.current?.focus()} />
                <Field ref={pwdRef} label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secure placeholder="Enter password" returnKeyType="go" onSubmitEditing={submit} />
              </>
            ) : tab === 'sm' ? (
              <>
                <Field label="Super Manager Mobile" icon="call-outline" value={smMobile} onChangeText={setSmMobile} keyboardType="number-pad" maxLength={10} placeholder="10 digit mobile number" returnKeyType="next" onSubmitEditing={() => smPwdRef.current?.focus()} />
                <Field ref={smPwdRef} label="Password" icon="lock-closed-outline" value={smPwd} onChangeText={setSmPwd} secure placeholder="Enter password" returnKeyType="go" onSubmitEditing={submit} />
              </>
            ) : (
              <>
                <Field label="Staff / Sub User ID" icon="id-card-outline" value={staffId} onChangeText={setStaffId} autoCapitalize="none" placeholder="Enter SubUser ID" returnKeyType="next" onSubmitEditing={() => staffPwdRef.current?.focus()} />
                <Field ref={staffPwdRef} label="Password" icon="lock-closed-outline" value={staffPwd} onChangeText={setStaffPwd} secure placeholder="Enter password" returnKeyType="go" onSubmitEditing={submit} />
              </>
            )}
            <Banner msg={error} />
            {expired ? (
              <Button title="Renew subscription" icon="refresh" variant="outline" onPress={() => router.push({ pathname: '/subscribe', params: { renew: '1', mobile: mobile.trim() } })} full style={{ marginBottom: space.sm }} />
            ) : null}
            <Button title={tab === 'user' ? 'Login' : tab === 'sm' ? 'Manager Login' : 'Staff Login'} size="lg" iconRight="arrow-forward" loading={busy} onPress={submit} full style={{ marginTop: space.sm }} />
            {tab !== 'sm' ? (
              <View style={styles.links}>
                <Pressable hitSlop={8} onPress={() => setSheet(tab === 'user' ? 'cp-user' : 'cp-staff')}>
                  <Text style={styles.link}>Change Password</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <Pressable onPress={() => router.push('/subscribe')} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
            <View style={styles.ctaIcon}><Ionicons name="sparkles" size={20} color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Get a Subscription</Text>
              <Text style={styles.ctaSub}>Plan chunein, payment karein aur apna Admin account paayein</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.brand} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>© Yubi7 · Secure Login</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <ResetPasswordSheet visible={sheet === 'cp-user'} onClose={() => setSheet(null)} />
      <ResetPasswordSheet visible={sheet === 'cp-staff'} onClose={() => setSheet(null)} staff />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 72, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  logoText: { color: '#fff', fontSize: 30, fontWeight: weight.heavy, letterSpacing: -1 },
  brand: { color: '#fff', fontSize: font.hero, fontWeight: weight.heavy, marginTop: 14, letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.82)', fontSize: font.base, marginTop: 4 },
  card: { marginHorizontal: space.lg, marginTop: -48, backgroundColor: colors.card, borderRadius: radius.xl, padding: space.xl, ...shadowStrong },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  link: { color: colors.brandText, fontWeight: weight.bold, fontSize: font.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, marginBottom: space.sm },
  bannerErr: { backgroundColor: colors.dangerSoft },
  bannerOk: { backgroundColor: colors.successSoft },
  bannerText: { flex: 1, fontSize: font.sm, fontWeight: weight.semi },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.lg, marginTop: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brand + '33' },
  ctaIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontSize: font.md, fontWeight: weight.heavy, color: colors.brandText },
  ctaSub: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  footer: { textAlign: 'center', color: colors.faint, fontSize: font.xs, marginTop: space.xl },
});
