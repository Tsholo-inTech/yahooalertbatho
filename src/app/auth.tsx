import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenBackButton } from '../components/screen-back-button';
import { Colors } from '../constants/colors';
import { COUNTRIES, formatToE164 } from '../constants/countries';
import { ensureProfile, supabase } from '../lib/supabase';

type AuthMode = 'login' | 'register' | 'verify';
type VerificationMethod = 'email' | 'sms';

type PendingVerification = {
  method: VerificationMethod;
  identifier: string;
};

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Please try again.';
  if (/error sending confirmation email|sending confirmation email/i.test(message)) {
    return 'Supabase could not send the confirmation email. Check your project’s Auth → SMTP settings. Supabase’s default email service only sends to authorized team addresses and has a low sending limit; configure custom SMTP to send to other addresses. After fixing email delivery, use “Resend code” below.';
  }
  return message;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function isInvalidCredentialsError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (/invalid login credentials|invalid credentials/i.test(error.message)) return true;
  return 'code' in error && error.code === 'invalid_credentials';
}

function validatePassword(value: string) {
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least 1 uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain at least 1 lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must contain at least 1 number.';
  return null;
}

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('email');
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [verificationNotice, setVerificationNotice] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginError, setLoginError] = useState(''); // New state for login errors

  // Registration State
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(''); // <--- Add this line

  async function handleLogin() {
    setLoginError(''); // Clear previous errors
    const identifier = loginIdentifier.trim();
    
    if (!identifier || !password) {
      setLoginError('Please enter your email/phone and password.');
      return;
    }

    const credentials = identifier.includes('@')
      ? { email: normalizeEmail(identifier), password }
      : (() => {
          const phone = normalizePhone(identifier);
          return phone ? { phone, password } : null;
        })();
        
    if (!credentials) {
      setLoginError('Invalid phone number format. Please include the country code.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (!data.user) throw new Error('Login succeeded without returning a user account.');

      try {
        await ensureProfile(data.user);
      } catch (profileError) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('Could not end the session after profile creation failed:', signOutError);
        }
        throw profileError;
      }
    } catch (error) {
      console.error('Login failed:', error);
      if (isInvalidCredentialsError(error)) {
        setLoginError('Invalid credentials. The email/phone number or password is incorrect.');
      } else {
        setLoginError(error instanceof Error ? error.message : 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const normalizedEmail = normalizeEmail(email);
    const normalizedConfirmEmail = normalizeEmail(confirmEmail);
    const formattedPhone = formatToE164(selectedCountry.code, phone);
    const normalizedPhone = normalizePhone(formattedPhone);
    const normalizedConfirmPhone = normalizePhone(
      formatToE164(selectedCountry.code, confirmPhone),
    );

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !normalizedEmail ||
      !normalizedConfirmEmail ||
      !phone.trim() ||
      !confirmPhone.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Missing details', 'Complete every field to create your account.');
      return;
    }
    if (cleanFirstName.length > 100 || cleanLastName.length > 100) {
      Alert.alert('Invalid name', 'First and last names must be 100 characters or fewer.');
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (normalizedEmail !== normalizedConfirmEmail) {
      Alert.alert('Email mismatch', 'The email addresses do not match.');
      return;
    }
    if (!normalizedPhone) {
      Alert.alert('Invalid phone number', 'Enter a valid phone number.');
      return;
    }
    if (normalizedPhone !== normalizedConfirmPhone) {
      Alert.alert('Phone number mismatch', 'Cell phone numbers do not match.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'The passwords do not match.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Password requirements', passwordError);
      return;
    }

    const identifier = verificationMethod === 'email' ? normalizedEmail : normalizedPhone;
    const userData = {
      first_name: cleanFirstName,
      last_name: cleanLastName,
      full_name: `${cleanFirstName} ${cleanLastName}`,
      email_address: normalizedEmail,
      phone_number: normalizedPhone,
      verification_method: verificationMethod,
    };

    setLoading(true);
    try {
      const signup =
        verificationMethod === 'email'
          ? await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: { data: userData },
            })
          : await supabase.auth.signUp({
              phone: normalizedPhone,
              password,
              options: { data: userData },
            });

      if (signup.error) throw signup.error;
      if (!signup.data.user) {
        throw new Error('The account could not be created. Please try again.');
      }
      if (signup.data.session) {
        throw new Error(
          'OTP verification is not enabled for this sign-up method. Enable email or phone confirmation in Supabase Auth settings, then try again.',
        );
      }

      setPendingVerification({ method: verificationMethod, identifier });
      setVerificationNotice('');
      setOtp('');
      setMode('verify');
    } catch (error) {
      if (
        verificationMethod === 'email' &&
        error instanceof Error &&
        /error sending confirmation email|sending confirmation email/i.test(error.message)
      ) {
        setPendingVerification({ method: 'email', identifier });
        setVerificationNotice(getAuthErrorMessage(error));
        setOtp('');
        setMode('verify');
        return;
      }
      console.error('Registration failed:', error);
      Alert.alert('Registration failed', getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

    async function handleVerifyOtp() {
    setOtpError(''); // Clear previous errors
    const token = otp.trim();
    
    if (!pendingVerification) {
      setOtpError('Verification unavailable. Please start registration again.');
      setMode('register');
      return;
    }
    if (!/^\d{8}$/.test(token) && !/^\d{6}$/.test(token)) {
      setOtpError('Enter the 8-digit or 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const verification =
        pendingVerification.method === 'email'
          ? await supabase.auth.verifyOtp({
              email: pendingVerification.identifier,
              token,
              type: 'signup',
            })
          : await supabase.auth.verifyOtp({
              phone: pendingVerification.identifier,
              token,
              type: 'sms',
            });

      if (verification.error) throw verification.error;
      if (!verification.data.user) {
        throw new Error('Verification succeeded, but no user account was returned.');
      }
      
      try {
        await ensureProfile(verification.data.user);
      } catch (profileError) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('Could not end the session after profile creation failed:', signOutError);
        }
        throw profileError;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      setLoginIdentifier(pendingVerification.identifier);
      setPendingVerification(null);
      setVerificationNotice('');
      setOtp('');
      setPassword('');
      setMode('login');
      router.replace('/auth');
      Alert.alert('Account verified', 'Your account is verified. Log in with your password to continue.');
      
    } catch (error: any) {
      // DISPLAY THE ERROR ON SCREEN INSTEAD OF THROWING IT
      setOtpError(error.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }



  async function handleResendOtp() {
    if (!pendingVerification) return;
    setLoading(true);
    try {
      const result =
        pendingVerification.method === 'email'
          ? await supabase.auth.resend({ type: 'signup', email: pendingVerification.identifier })
          : await supabase.auth.resend({ type: 'sms', phone: pendingVerification.identifier });

      if (result.error) throw result.error;
      setVerificationNotice('');
      Alert.alert('Code sent', `A new verification code was sent to your ${pendingVerification.method}.`);
    } catch (error) {
      console.error('Could not resend verification code:', error);
      Alert.alert('Could not resend code', getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function startRegistration() {
    setPassword('');
    setConfirmPassword('');
    setLoginError(''); // Clear login errors when switching
    setMode('register');
  }

  function cancelVerification() {
    setPendingVerification(null);
    setOtp('');
    setMode('login');
  }

  function handleBack() {
    if (mode === 'verify') {
      cancelVerification();
    } else if (mode === 'register') {
      setMode('login');
    } else if (router.canGoBack()) {
      router.back();
    }
  }

  const verificationDestination = pendingVerification?.identifier ?? '';
  
  // --- REAL-TIME VALIDATION LOGIC ---
  const normalizedEmail = normalizeEmail(email);
  const normalizedConfirmEmail = normalizeEmail(confirmEmail);
  const formattedPhone = formatToE164(selectedCountry.code, phone);
  const normalizedPhone = normalizePhone(formattedPhone);
  const normalizedConfirmPhone = normalizePhone(
    formatToE164(selectedCountry.code, confirmPhone),
  );

  // Email Validation
  const emailError =
    email.trim() && !isValidEmail(normalizedEmail) ? 'Enter a valid email address.' : '';
  const confirmEmailError = confirmEmail.trim()
    ? !isValidEmail(normalizedConfirmEmail)
      ? 'Enter a valid email address.'
      : normalizedEmail !== normalizedConfirmEmail
        ? 'Email addresses do not match.'
        : ''
    : '';

  // Phone Validation
  const phoneError =
    phone.trim() && !normalizedPhone ? 'Enter all digits for a valid cell phone number.' : '';
  const confirmPhoneError = confirmPhone.trim()
    ? !normalizedConfirmPhone
      ? 'Enter all digits for a valid cell phone number.'
      : normalizedPhone !== normalizedConfirmPhone
        ? 'Cell phone numbers do not match.'
        : ''
    : '';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <ScreenBackButton onPress={handleBack} />

          <Image 
            source={require('../../assets/yaho-logo.png')} 
            style={styles.logo} 
            resizeMode="contain" 
          />

          {mode === 'login' && (
            <>
              <Text style={styles.subtitle}>Enter your login details</Text>

              <TextInput
                accessibilityLabel="Email address or phone number"
                style={styles.input}
                placeholder="Email or phone number"
                placeholderTextColor={Colors.textMuted}
                value={loginIdentifier}
                onChangeText={(text) => {
                  setLoginIdentifier(text);
                  setLoginError(''); // Clear error when typing
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                accessibilityLabel="Password"
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setLoginError(''); // Clear error when typing
                }}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={() => void handleLogin()}
              />

              {/* LOGIN ERROR MESSAGE */}
              {!!loginError && (
                <Text style={styles.loginErrorText}>{loginError}</Text>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.disabledButton]}
                  onPress={() => void handleLogin()}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginBtnText}>Login</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.cancelBtn} onPress={startRegistration}>
                  <Text style={styles.cancelBtnText}>Register</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot your password?</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'register' && (
            <>
              <Text style={styles.subtitle}>Create your account</Text>

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>

              {/* EMAIL INPUTS */}
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {!!emailError && <Text style={styles.validationError}>{emailError}</Text>}
              
              <TextInput
                style={styles.input}
                placeholder="Confirm email address"
                placeholderTextColor={Colors.textMuted}
                value={confirmEmail}
                onChangeText={setConfirmEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {!!confirmEmailError && <Text style={styles.validationError}>{confirmEmailError}</Text>}
              {!confirmEmailError && confirmEmail.trim() && isValidEmail(normalizedConfirmEmail) && (
                <Text style={styles.validationSuccess}>Email addresses match.</Text>
              )}

              {/* PHONE INPUTS */}
              <View style={{ flexDirection: 'row', marginBottom: 16, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.input, { width: 100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }]}
                  onPress={() => setIsCountryModalOpen(true)}
                >
                  <Text style={{ color: Colors.text }}>
                    {selectedCountry.flag} {selectedCountry.code}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>

                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. 0621234567"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              {!!phoneError && <Text style={styles.validationError}>{phoneError}</Text>}

              <TextInput
                style={styles.input}
                placeholder="Confirm phone number"
                placeholderTextColor={Colors.textMuted}
                value={confirmPhone}
                onChangeText={setConfirmPhone}
                keyboardType="phone-pad"
              />
              {!!confirmPhoneError && <Text style={styles.validationError}>{confirmPhoneError}</Text>}
              {!confirmPhoneError && confirmPhone.trim() && normalizedConfirmPhone && (
                <Text style={styles.validationSuccess}>Cell phone numbers match.</Text>
              )}

              <Modal
                visible={isCountryModalOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setIsCountryModalOpen(false)}
              >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                  <View style={{ backgroundColor: Colors.card, borderRadius: 12, padding: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 15 }}>
                      Select Country
                    </Text>
                    {COUNTRIES.map((country) => (
                      <TouchableOpacity
                        key={country.code}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setSelectedCountry(country);
                          setIsCountryModalOpen(false);
                        }}
                      >
                        <Text style={{ fontSize: 20, marginRight: 10 }}>{country.flag}</Text>
                        <Text style={{ fontSize: 16, color: Colors.text, flex: 1 }}>{country.name}</Text>
                        <Text style={{ fontSize: 16, color: Colors.textMuted }}>{country.code}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setIsCountryModalOpen(false)}>
                      <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Text style={styles.fieldLabel}>Send verification code by</Text>
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[styles.methodButton, verificationMethod === 'email' && styles.methodSelected]}
                  onPress={() => setVerificationMethod('email')}
                >
                  <Text style={[styles.methodText, verificationMethod === 'email' && styles.methodTextSelected]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodButton, verificationMethod === 'sms' && styles.methodSelected]}
                  onPress={() => setVerificationMethod('sms')}
                >
                  <Text style={[styles.methodText, verificationMethod === 'sms' && styles.methodTextSelected]}>SMS</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Text style={styles.passwordHint}>
                At least 8 characters, including uppercase, lowercase, and a number.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.disabledButton]}
                  onPress={() => void handleRegister()}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginBtnText}>Sign Up</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('login')}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

                    {mode === 'verify' && (
            <>
              <Text style={styles.subtitle}>
                Enter the code sent to {verificationDestination}
              </Text>
              
              {!!verificationNotice && (
                <Text style={styles.errorNotice}>
                  {verificationNotice}
                </Text>
              )}

              <TextInput
                style={styles.input}
                placeholder="Verification code"
                placeholderTextColor={Colors.textMuted}
                value={otp}
                onChangeText={(value) => {
                  setOtp(value.replace(/\D/g, '').slice(0, 8));
                  setOtpError(''); // Clear error when user types
                }}
                keyboardType="number-pad"
                maxLength={8}
              />

              {/* ADD THIS EXACT BLOCK */}
              {!!otpError && (
                <Text style={styles.validationError}>{otpError}</Text>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.disabledButton]}
                  onPress={() => void handleVerifyOtp()}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginBtnText}>Verify</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={cancelVerification}
                  disabled={loading}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.forgotBtn}
                onPress={() => void handleResendOtp()}
                disabled={loading}
              >
                <Text style={styles.forgotText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: Colors.card, padding: 25, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, width: '100%', maxWidth: 500, alignSelf: 'center' },
  logo: { width: '100%', height: 150, alignSelf: 'center', marginBottom: 20 },
  subtitle: { fontSize: 16, color: Colors.text, textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 4, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: Colors.text, marginBottom: 14, backgroundColor: Colors.card },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, gap: 10 },
  loginBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  cancelBtn: { flex: 1, backgroundColor: '#9CA3AF', paddingVertical: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  forgotBtn: { marginTop: 20, alignSelf: 'flex-start' },
  forgotText: { color: Colors.text, fontSize: 14, textDecorationLine: 'underline' },
  fieldLabel: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 5 },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  methodButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 4 },
  methodSelected: { borderColor: Colors.primary, backgroundColor: '#FEF2F2' },
  methodText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  methodTextSelected: { color: Colors.primary },
  passwordHint: { color: Colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: 15 },
  errorNotice: { color: Colors.primary, fontSize: 13, marginBottom: 15, textAlign: 'center' },
  
  // Validation Styles
  validationError: { color: Colors.primary, fontSize: 12, marginTop: -10, marginBottom: 12 },
  validationSuccess: { color: Colors.success, fontSize: 12, marginTop: -10, marginBottom: 12 },
  loginErrorText: { color: Colors.primary, fontSize: 14, textAlign: 'center', marginBottom: 15, fontWeight: '600' },
  
  disabledButton: { opacity: 0.7 },
});